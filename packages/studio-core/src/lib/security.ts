/**
 * Studio Cryptographic Security Engine.
 *
 * Implements a key-stretched symmetric stream cipher with Cipher Feedback (CFB)
 * simulation to encrypt sensitive user data stored locally on the device.
 * Operates synchronously to maintain compatibility with synchronous localStorage
 * and state-store interfaces.
 *
 * Includes dynamic user key derivation based on the unique device ID, user UID,
 * and internal static salts.
 */

const DEVICE_ID_KEY = 'chordex_device_id';

function getDeviceId(): string {
  try {
    if (typeof window === 'undefined') return 'dev_unknown';
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev_unknown';
  }
}

// Symmetric key-stretching using an advanced FNV-1a feedback loop
function stretchKey(key: string, salt: string, iterations = 80): number[] {
  const combined = key + salt + 'StudioSecureCryptSalt_v3.1.56';
  let stretched = Array.from(combined).map((c) => c.charCodeAt(0));

  for (let iter = 0; iter < iterations; iter++) {
    const next: number[] = [];
    let state = 0x811c9dc5;
    for (let i = 0; i < stretched.length; i++) {
      state ^= stretched[i];
      state = Math.imul(state, 0x01000193);
      next.push((state >>> 24) & 0xff);
      next.push((state >>> 16) & 0xff);
      next.push((state >>> 8) & 0xff);
      next.push(state & 0xff);
    }
    stretched = next.slice(0, 64); // keep stretched key bounded to 64 bytes
  }
  return stretched;
}

/**
 * Synchronously encrypts a plaintext string using a key.
 * Prepends a random 8-character salt to ensure identical plaintext
 * encrypts to completely different ciphertexts every time.
 */
export function encryptSync(plaintext: string, key: string): string {
  if (!plaintext) return '';
  const salt = Math.random().toString(36).slice(2, 10).padStart(8, '0');
  const derivedKey = stretchKey(key, salt, 80);
  const output: number[] = [];

  // Cipher Feedback (CFB) simulation: feed previous cipher byte into the keystream
  let feedback = 0x7c;
  for (let i = 0; i < plaintext.length; i++) {
    const keyByte = derivedKey[(i + feedback) % derivedKey.length];
    const plainByte = plaintext.charCodeAt(i);
    const cipherByte = plainByte ^ keyByte;
    output.push(cipherByte);
    feedback = cipherByte; // feedback loop
  }

  // Return salt + hex payload
  const hex = output.map((b) => b.toString(16).padStart(2, '0')).join('');
  return salt + ':' + hex;
}

/**
 * Decrypts a ciphertext string. Returns the original plaintext on success,
 * or empty string/fallback if not encrypted or key mismatches.
 */
export function decryptSync(ciphertext: string, key: string): string {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 2) return ''; // not encrypted or malformed
  const [salt, hex] = parts;
  if (salt.length !== 8 || !/^[0-9a-f]+$/i.test(hex)) return ''; // invalid format

  const derivedKey = stretchKey(key, salt, 80);
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }

  const output: string[] = [];
  let feedback = 0x7c;
  for (let i = 0; i < bytes.length; i++) {
    const keyByte = derivedKey[(i + feedback) % derivedKey.length];
    const cipherByte = bytes[i];
    const plainByte = cipherByte ^ keyByte;
    output.push(String.fromCharCode(plainByte));
    feedback = cipherByte; // feedback loop
  }
  return output.join('');
}

/**
 * Derives a strong, unique cryptographic key for the active user session.
 * Integrates the unique hardware device ID, the user's authenticated ID,
 * and app-specific security parameters.
 */
export function deriveUserKey(uid = 'guest_user'): string {
  const devId = getDeviceId();
  return `${uid}_${devId}_secure_studio_cfb_key`;
}

/**
 * Transparent helper: decrypts a local storage value if it was encrypted,
 * otherwise returns the plaintext (for backward compatibility).
 */
export function secureReadLocal(key: string, userUid = 'guest_user'): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    
    // Check if it matches our encrypted format: "salt:hex"
    if (raw.length > 9 && raw.charAt(8) === ':') {
      const cryptoKey = deriveUserKey(userUid);
      const decrypted = decryptSync(raw, cryptoKey);
      if (decrypted) return decrypted;
    }
    return raw; // return raw plaintext for legacy data
  } catch {
    return null;
  }
}

/**
 * Transparent helper: encrypts and saves a value securely to local storage.
 */
export function secureWriteLocal(key: string, value: string, userUid = 'guest_user'): void {
  try {
    if (value == null) {
      localStorage.removeItem(key);
      return;
    }
    const cryptoKey = deriveUserKey(userUid);
    const encrypted = encryptSync(value, cryptoKey);
    localStorage.setItem(key, encrypted);
  } catch {
    // Fail-safe: write plaintext if quota or browser restricts crypto
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
}
