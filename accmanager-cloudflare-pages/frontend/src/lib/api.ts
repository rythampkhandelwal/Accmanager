const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  created_at?: string;
}

export interface EncryptedAccountDto {
  id: number;
  user_id: number;
  name_encrypted: string;
  email_encrypted: string;
  issuer_encrypted: string | null;
  password_encrypted: string;
  dob_encrypted: string | null;
  two_fa_secret_encrypted: string | null;
  date_modified: string;
}

export interface EncryptedSecretDto {
  id: number;
  user_id: number;
  secret_name_encrypted: string;
  description_encrypted: string | null;
  account_linked_encrypted: string | null;
  value_encrypted: string;
  date_modified: string;
}

type AuthTokenState = {
  state?: {
    token?: string | null;
  } | null;
};

function getStoredToken(): string | null {
  const raw = localStorage.getItem('accmanager-auth');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthTokenState;
    const token = parsed?.state?.token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  } catch (error) {
    console.warn('Failed to parse stored auth token', error);
    return null;
  }
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildHeaders(options: RequestInit): HeadersInit {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = getStoredToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: this.buildHeaders(options),
    });

    if (!response.ok) {
      const payload = await parseJsonSafe(response);
      const message = (payload as { error?: string })?.error ?? `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }

  // Auth endpoints
  getStatus() {
    return this.request<{ isInitialized: boolean }>('/status');
  }

  setupAdmin(data: { username: string; email: string; password: string }) {
    return this.request<{ success: boolean; message: string }>('/setup/admin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  register(data: { username: string; email: string; password: string }) {
    return this.request<{ success: boolean; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  login(data: { username: string; password: string }) {
    return this.request<{
      success: boolean;
      token: string;
      user: ApiUser;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  logout() {
    return this.request<{ success: boolean; message: string }>('/auth/logout', {
      method: 'POST',
    });
  }

  getMe() {
    return this.request<ApiUser>('/auth/me');
  }

  resetPassword(data: { token: string; newPassword: string }) {
    return this.request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Accounts
  getAccounts() {
    return this.request<{ accounts: EncryptedAccountDto[] }>('/accounts');
  }

  getAccount(id: number) {
    return this.request<{ account: EncryptedAccountDto }>(`/accounts/${id}`);
  }

  createAccount(payload: Record<string, string | null>) {
    return this.request<{ success: boolean; id: number | null }>('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateAccount(id: number, payload: Record<string, string | null>) {
    return this.request<{ success: boolean }>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteAccount(id: number) {
    return this.request<{ success: boolean }>(`/accounts/${id}`, {
      method: 'DELETE',
    });
  }

  // Secrets
  getSecrets() {
    return this.request<{ secrets: EncryptedSecretDto[] }>('/secrets');
  }

  getSecret(id: number) {
    return this.request<{ secret: EncryptedSecretDto }>(`/secrets/${id}`);
  }

  createSecret(payload: Record<string, string | null>) {
    return this.request<{ success: boolean; id: number | null }>('/secrets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateSecret(id: number, payload: Record<string, string | null>) {
    return this.request<{ success: boolean }>(`/secrets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteSecret(id: number) {
    return this.request<{ success: boolean }>(`/secrets/${id}`, {
      method: 'DELETE',
    });
  }

  // Admin endpoints
  getAllUsers() {
    return this.request<{ users: ApiUser[] }>('/admin/users');
  }

  deleteUser(id: number) {
    return this.request<{ success: boolean }>(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  forceResetPassword(id: number, newPassword: string) {
    return this.request<{ success: boolean; message: string }>(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  sendResetLink(id: number) {
    return this.request<{ success: boolean; message: string }>(`/admin/users/${id}/send-reset-link`, {
      method: 'POST',
    });
  }

  getStats() {
    return this.request<{ users: number; accounts: number; secrets: number }>('/admin/stats');
  }

  exportData() {
    return this.request<any>('/admin/export');
  }

  importData(payload: Record<string, unknown>) {
    return this.request<{ success: boolean; message: string }>('/admin/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
export const apiClient = api;
