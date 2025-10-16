import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'accmanager-auth',
    }
  )
);

interface SystemState {
  isInitialized: boolean | null;
  theme: 'light' | 'dark';
  setInitialized: (value: boolean) => void;
  toggleTheme: () => void;
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set) => ({
      isInitialized: null,
      theme: 'dark',
      setInitialized: (value) => set({ isInitialized: value }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'accmanager-system',
    }
  )
);

interface VaultState {
  masterKey: CryptoKey | null;
  userSalt: string | null;
  isUnlocked: boolean;
  unlockExpiry: number | null;
  setMasterKey: (key: CryptoKey, rememberFor?: number) => void;
  clearMasterKey: () => void;
  setUserSalt: (salt: string | null) => void;
  checkUnlockStatus: () => boolean;
}

// Store encrypted key material in sessionStorage for vault persistence
const VAULT_STORAGE_KEY = 'accmanager-vault-session';
const DEFAULT_UNLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

async function storeVaultSession(key: CryptoKey, duration: number) {
  try {
    const exported = await crypto.subtle.exportKey('raw', key);
    const keyArray = Array.from(new Uint8Array(exported));
    const expiry = Date.now() + duration;
    sessionStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify({ key: keyArray, expiry }));
  } catch (error) {
    console.error('Failed to store vault session:', error);
  }
}

async function retrieveVaultSession(): Promise<CryptoKey | null> {
  try {
    const stored = sessionStorage.getItem(VAULT_STORAGE_KEY);
    if (!stored) return null;

    const { key: keyArray, expiry } = JSON.parse(stored);
    if (Date.now() > expiry) {
      sessionStorage.removeItem(VAULT_STORAGE_KEY);
      return null;
    }

    const keyBuffer = new Uint8Array(keyArray).buffer;
    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Failed to retrieve vault session:', error);
    sessionStorage.removeItem(VAULT_STORAGE_KEY);
    return null;
  }
}

function clearVaultSession() {
  sessionStorage.removeItem(VAULT_STORAGE_KEY);
}

export const useVaultStore = create<VaultState>()((set, get) => ({
  masterKey: null,
  userSalt: null,
  isUnlocked: false,
  unlockExpiry: null,
  setMasterKey: (key, rememberFor = DEFAULT_UNLOCK_DURATION) => {
    set({ masterKey: key, isUnlocked: true, unlockExpiry: Date.now() + rememberFor });
    storeVaultSession(key, rememberFor);
  },
  clearMasterKey: () => {
    set({ masterKey: null, isUnlocked: false, unlockExpiry: null });
    clearVaultSession();
  },
  setUserSalt: (salt) => set({ userSalt: salt }),
  checkUnlockStatus: () => {
    const state = get();
    if (state.masterKey && state.unlockExpiry && Date.now() < state.unlockExpiry) {
      return true;
    }
    // Try to retrieve from sessionStorage
    retrieveVaultSession().then(key => {
      if (key) {
        set({ masterKey: key, isUnlocked: true });
      }
    });
    return false;
  },
}));
