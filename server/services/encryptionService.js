const crypto = require('crypto');

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit IV recommended by NIST SP 800-38D
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag
const DEFAULT_KEY_ID = 'KEY_V1';
const DEFAULT_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

class TamperedCiphertextError extends Error {
  constructor(message = 'Ciphertext authentication failed: data has been tampered with or key is invalid') {
    super(message);
    this.name = 'TamperedCiphertextError';
    this.statusCode = 400;
  }
}

class CryptoOperationError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'CryptoOperationError';
    this.statusCode = 500;
    this.cause = originalError;
  }
}

function getKeyBuffer(keyId = DEFAULT_KEY_ID) {
  const envKey = process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY_V1 || DEFAULT_KEY_HEX;
  const hex = (typeof envKey === 'string' && envKey.trim()) ? envKey.trim() : DEFAULT_KEY_HEX;
  if (hex.length === 64) {
    return Buffer.from(hex, 'hex');
  }
  // If UTF-8 string of 32 characters
  if (Buffer.byteLength(hex, 'utf8') === 32) {
    return Buffer.from(hex, 'utf8');
  }
  // Fallback to SHA-256 digest to guarantee 32 bytes
  return crypto.createHash('sha256').update(hex).digest();
}

/**
 * Serialize an encryption bundle to: `enc:v1:<keyId>:<ivHex>:<authTagHex>:<ciphertextHex>`
 */
function serializeCiphertext(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    throw new CryptoOperationError('Cannot serialize invalid ciphertext bundle');
  }
  return `enc:v${bundle.version || 1}:${bundle.keyId || DEFAULT_KEY_ID}:${bundle.iv}:${bundle.authTag}:${bundle.ciphertext}`;
}

/**
 * Deserialize a compact string or bundle object.
 */
function deserializeCiphertext(input) {
  if (!input) {
    throw new TamperedCiphertextError('Empty or missing ciphertext payload');
  }

  if (typeof input === 'object' && input.ciphertext && input.iv && input.authTag) {
    return {
      version: Number(input.version) || 1,
      keyId: input.keyId || DEFAULT_KEY_ID,
      algorithm: input.algorithm || ENCRYPTION_ALGORITHM,
      iv: input.iv,
      authTag: input.authTag,
      ciphertext: input.ciphertext
    };
  }

  if (typeof input !== 'string') {
    throw new TamperedCiphertextError('Ciphertext input must be a string or structured bundle object');
  }

  const trimmed = input.trim();
  if (trimmed.startsWith('enc:')) {
    const parts = trimmed.split(':');
    if (parts.length !== 6) {
      throw new TamperedCiphertextError('Malformed compact ciphertext format');
    }
    const versionStr = parts[1];
    const version = parseInt(versionStr.replace(/^v/, ''), 10) || 1;
    const keyId = parts[2];
    const iv = parts[3];
    const authTag = parts[4];
    const ciphertext = parts[5];

    return {
      version,
      keyId,
      algorithm: ENCRYPTION_ALGORITHM,
      iv,
      authTag,
      ciphertext
    };
  }

  throw new TamperedCiphertextError('Unrecognized ciphertext format');
}

/**
 * Encrypt plaintext using AES-256-GCM with unique 12-byte random IV.
 * @param {string|Object} plaintext
 * @param {Object} [options]
 * @returns {{ version: number, keyId: string, algorithm: string, iv: string, authTag: string, ciphertext: string, serialized: string }}
 */
function encrypt(plaintext, options = {}) {
  if (plaintext === null || plaintext === undefined) {
    throw new CryptoOperationError('Cannot encrypt null or undefined value');
  }

  const keyId = options.keyId || DEFAULT_KEY_ID;
  const keyBuffer = getKeyBuffer(keyId);
  const textToEncrypt = typeof plaintext === 'object' ? JSON.stringify(plaintext) : String(plaintext);

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);

  const ciphertextBuffer = Buffer.concat([
    cipher.update(textToEncrypt, 'utf8'),
    cipher.final()
  ]);

  const authTagBuffer = cipher.getAuthTag();

  const bundle = {
    version: 1,
    keyId,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('hex'),
    authTag: authTagBuffer.toString('hex'),
    ciphertext: ciphertextBuffer.toString('hex')
  };

  const serialized = serializeCiphertext(bundle);
  return {
    ...bundle,
    serialized,
    toString() {
      return serialized;
    }
  };
}

/**
 * Decrypt AES-256-GCM ciphertext with strict authentication tag verification.
 * @param {string|Object} encryptedInput
 * @param {Object} [options]
 * @param {boolean} [options.asJson=true]
 * @returns {string|Object}
 */
function decrypt(encryptedInput, options = {}) {
  const asJson = options.asJson !== false; // default true
  const bundle = deserializeCiphertext(encryptedInput);

  if (bundle.algorithm !== ENCRYPTION_ALGORITHM) {
    throw new CryptoOperationError(`Unsupported encryption algorithm: ${bundle.algorithm}`);
  }

  const keyBuffer = getKeyBuffer(bundle.keyId);
  const ivBuffer = Buffer.from(bundle.iv, 'hex');
  const authTagBuffer = Buffer.from(bundle.authTag, 'hex');
  const ciphertextBuffer = Buffer.from(bundle.ciphertext, 'hex');

  if (ivBuffer.length !== IV_LENGTH_BYTES) {
    throw new TamperedCiphertextError(`Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, got ${ivBuffer.length}`);
  }
  if (authTagBuffer.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new TamperedCiphertextError(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH_BYTES} bytes, got ${authTagBuffer.length}`);
  }

  try {
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBuffer, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    const decryptedBuffer = Buffer.concat([
      decipher.update(ciphertextBuffer),
      decipher.final()
    ]);

    const decryptedText = decryptedBuffer.toString('utf8');

    if (asJson) {
      try {
        return JSON.parse(decryptedText);
      } catch {
        return decryptedText;
      }
    }

    return decryptedText;
  } catch (err) {
    if (err instanceof TamperedCiphertextError) {
      throw err;
    }
    throw new TamperedCiphertextError(`Decryption failed: auth tag mismatch or invalid key (${err.message})`);
  }
}

function isEncrypted(data) {
  if (!data) return false;
  if (typeof data === 'string' && data.startsWith('enc:v')) return true;
  if (typeof data === 'object' && data.encryptedData && typeof data.encryptedData === 'string' && data.encryptedData.startsWith('enc:v')) return true;
  return false;
}

module.exports = {
  ENCRYPTION_ALGORITHM,
  IV_LENGTH_BYTES,
  AUTH_TAG_LENGTH_BYTES,
  DEFAULT_KEY_ID,
  TamperedCiphertextError,
  CryptoOperationError,
  encrypt,
  decrypt,
  isEncrypted,
  serializeCiphertext,
  deserializeCiphertext
};
