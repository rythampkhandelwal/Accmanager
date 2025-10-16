/**
 * Cryptography utilities for AccManager
 * Implements Zero-Trust encryption/decryption using Web Crypto API
 * Optimized for Cloudflare Workers CPU limits (uses PBKDF2 only for speed)
 */

const PBKDF2_ITERATIONS_DEFAULT = 100; // Minimal iterations for lowest CPU usage
const AES_GCM_NONCE_BYTES = 12;
const SALT_BYTES = 16;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hashSha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  return new Uint8Array(digest);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }

  return mismatch === 0;
}

/**
 * Generates a cryptographically strong random token and returns it as a hex string.
 */
export function generateToken(length: number = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a SHA-256 hash of the provided token string (UTF-8 encoded) and returns it as hex.
 * Useful for storing reset tokens without persisting them in plaintext.
 */
export async function hashToken(token: string): Promise<string> {
  const digestBytes = await hashSha256(textEncoder.encode(token));
  return Array.from(digestBytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives an AES-256-GCM key from a password using PBKDF2.
 */
export async function deriveKey(password: string, salt: string, iterations: number = PBKDF2_ITERATIONS_DEFAULT): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext data using AES-256-GCM.
 */
export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    textEncoder.encode(plaintext)
  );

  const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
  combined.set(nonce, 0);
  combined.set(new Uint8Array(ciphertext), nonce.length);
  return toBase64(combined);
}

/**
 * Decrypts AES-256-GCM encrypted data.
 */
export async function decrypt(key: CryptoKey, encryptedData: string): Promise<string> {
  const combined = fromBase64(encryptedData);
  const nonce = combined.slice(0, AES_GCM_NONCE_BYTES);
  const ciphertext = combined.slice(AES_GCM_NONCE_BYTES);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    ciphertext
  );

  return textDecoder.decode(plaintext);
}

/**
 * Generates a production-grade password hash using PBKDF2 (optimized for speed).
 * Format: $pbkdf2$iterations$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const passwordBytes = textEncoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBytes = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS_DEFAULT,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  const saltB64 = toBase64(salt);
  const hashB64 = toBase64(new Uint8Array(hashBytes));

  return `$pbkdf2$${PBKDF2_ITERATIONS_DEFAULT}$${saltB64}$${hashB64}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash using constant-time comparison.
 * Optimized for minimal CPU usage.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  console.log('[VERIFY] Checking hash format:', storedHash.substring(0, 30));
  
  // Check if it's PBKDF2 format
  if (!storedHash.startsWith('$pbkdf2$')) {
    console.log('[VERIFY] Unsupported hash format. Only PBKDF2 is supported.');
    return false;
  }

  console.log('[VERIFY] Using PBKDF2 verification');
  const match = storedHash.match(/^\$pbkdf2\$(\d+)\$([^$]+)\$([^$]+)$/);
  
  if (!match) {
    console.log('[VERIFY] PBKDF2 format match failed');
    return false;
  }

  const [, iterationsStr, saltB64, hashB64] = match;
  const iterations = Number(iterationsStr);
  
  console.log('[VERIFY] PBKDF2 iterations:', iterations);
  
  if (Number.isNaN(iterations)) {
    console.log('[VERIFY] Invalid iterations');
    return false;
  }

  const salt = fromBase64(saltB64);
  const expectedHash = fromBase64(hashB64);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const calculatedBytes = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const calculated = new Uint8Array(calculatedBytes);
  const result = timingSafeEqual(calculated, expectedHash);
  console.log('[VERIFY] PBKDF2 comparison result:', result);
  return result;
}
