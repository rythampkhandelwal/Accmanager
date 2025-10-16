/**
 * Client-Side Cryptographic Utilities
 * Implements the Zero-Trust encryption model using Web Crypto API
 * All operations match the worker's cryptographic implementation
 */

const PBKDF2_ITERATIONS = 300000;
const NONCE_BYTES = 12;

/**
 * Derives an AES-256-GCM encryption key from a password and salt using PBKDF2
 * @param password - The user's master password
 * @param salt - A deterministic salt (e.g., user ID converted to string)
 * @returns A CryptoKey for AES-GCM encryption/decryption
 */
export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  // Import the password as a raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive the AES-GCM key using PBKDF2 with 300,000 iterations
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypts plaintext data using AES-256-GCM
 * @param data - The plaintext string to encrypt
 * @param key - The derived CryptoKey
 * @returns Base64-encoded string containing nonce + ciphertext
 */
export async function encryptData(data: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Generate a random 12-byte nonce
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    dataBuffer
  );

  // Concatenate nonce + ciphertext
  const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
  combined.set(nonce, 0);
  combined.set(new Uint8Array(ciphertext), nonce.length);

  // Encode as Base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts Base64-encoded ciphertext using AES-256-GCM
 * @param encryptedData - Base64 string containing nonce + ciphertext
 * @param key - The derived CryptoKey
 * @returns The decrypted plaintext string
 */
export async function decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
  // Decode Base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract nonce and ciphertext
  const nonce = combined.slice(0, NONCE_BYTES);
  const ciphertext = combined.slice(NONCE_BYTES);

  // Decrypt the data
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    ciphertext
  );

  // Convert back to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypts an object's properties that end with "_encrypted" suffix
 * @param obj - Object with properties to encrypt
 * @param key - The derived CryptoKey
 * @returns Object with encrypted values
 */
export async function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  key: CryptoKey
): Promise<Record<string, string | null>> {
  const encrypted: Record<string, string | null> = {};

  for (const [fieldKey, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }

    if (value === null || value === '') {
      encrypted[`${fieldKey}_encrypted`] = null;
      continue;
    }

    encrypted[`${fieldKey}_encrypted`] = await encryptData(String(value), key);
  }

  return encrypted;
}

/**
 * Decrypts an object's properties that have "_encrypted" suffix
 * @param encryptedObj - Object with encrypted properties
 * @param key - The derived CryptoKey
 * @returns Object with decrypted values
 */
export async function decryptObject(
  encryptedObj: Record<string, string | null | number>,
  key: CryptoKey
): Promise<Record<string, string | null | number>> {
  const decrypted: Record<string, string | null | number> = {};

  await Promise.all(
    Object.entries(encryptedObj).map(async ([fieldKey, value]) => {
      if (fieldKey.endsWith('_encrypted')) {
        const originalKey = fieldKey.replace('_encrypted', '');
        if (typeof value === 'string' && value.length > 0) {
          try {
            decrypted[originalKey] = await decryptData(value, key);
          } catch (error) {
            console.error(`Failed to decrypt ${originalKey}:`, error);
            decrypted[originalKey] = '[DECRYPTION FAILED]';
          }
        } else {
          decrypted[originalKey] = null;
        }
      } else if (['id', 'user_id', 'date_modified'].includes(fieldKey)) {
        decrypted[fieldKey] = value;
      }
    })
  );

  return decrypted;
}
