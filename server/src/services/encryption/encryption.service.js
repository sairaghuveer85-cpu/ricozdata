import crypto from 'crypto';
import defaultKeyProvider from './keyProvider.js';

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const IV_LENGTH_BYTES = 12; // 96-bit IV recommended by NIST SP 800-38D for GCM
export const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag

/**
 * Custom error thrown when authentication tag verification fails
 * or ciphertext has been altered/tampered with.
 */
export class TamperedCiphertextError extends Error {
  constructor(message = 'Ciphertext authentication failed: data has been tampered with or key is invalid') {
    super(message);
    this.name = 'TamperedCiphertextError';
    this.statusCode = 400;
  }
}

/**
 * Custom error thrown for general encryption/decryption failures.
 */
export class CryptoOperationError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'CryptoOperationError';
    this.statusCode = 500;
    this.cause = originalError;
  }
}

/**
 * Serialize an encryption bundle to a compact, version-safe string representation:
 * Format: `enc:v1:<keyId>:<ivHex>:<authTagHex>:<ciphertextHex>`
 *
 * @param {Object} bundle
 * @returns {string} Serialized ciphertext
 */
export function serializeCiphertext(bundle) {
  if (!bundle || typeof bundle !== 'object') {
    throw new CryptoOperationError('Cannot serialize invalid ciphertext bundle');
  }
  return `enc:v${bundle.version || 1}:${bundle.keyId}:${bundle.iv}:${bundle.authTag}:${bundle.ciphertext}`;
}

/**
 * Deserialize a compact string or JSON string back into a structured encryption bundle.
 * Supports:
 *   1. Compact string: `enc:v1:<keyId>:<iv>:<authTag>:<ciphertext>`
 *   2. JSON string: `{"version":1,"keyId":"...","iv":"...","authTag":"...","ciphertext":"..."}`
 *   3. Already-parsed bundle object
 *
 * @param {string|Object} input
 * @returns {{ version: number, keyId: string, algorithm: string, iv: string, authTag: string, ciphertext: string }}
 */
export function deserializeCiphertext(input) {
  if (!input) {
    throw new TamperedCiphertextError('Empty or missing ciphertext payload');
  }

  // If already an object
  if (typeof input === 'object' && input.ciphertext && input.iv && input.authTag) {
    return {
      version: Number(input.version) || 1,
      keyId: input.keyId || 'KEY_V1',
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

  // Case 1: Compact serialization `enc:v<version>:<keyId>:<iv>:<authTag>:<ciphertext>`
  if (trimmed.startsWith('enc:')) {
    const parts = trimmed.split(':');
    if (parts.length !== 6) {
      throw new TamperedCiphertextError('Malformed compact ciphertext format');
    }
    const versionStr = parts[1]; // 'v1'
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

  // Case 2: JSON formatted string
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
        throw new TamperedCiphertextError('JSON ciphertext bundle is missing required fields (ciphertext, iv, authTag)');
      }
      return {
        version: Number(parsed.version) || 1,
        keyId: parsed.keyId || 'KEY_V1',
        algorithm: parsed.algorithm || ENCRYPTION_ALGORITHM,
        iv: parsed.iv,
        authTag: parsed.authTag,
        ciphertext: parsed.ciphertext
      };
    } catch (err) {
      if (err instanceof TamperedCiphertextError) throw err;
      throw new TamperedCiphertextError('Failed to parse JSON ciphertext payload');
    }
  }

  throw new TamperedCiphertextError('Unrecognized ciphertext format');
}

/**
 * Enterprise AES-256-GCM Encryption Service.
 * Provides authenticated encryption, unique per-operation random IVs,
 * key versioning, tamper detection, and key rotation.
 */
export class EncryptionService {
  /**
   * @param {Object} [options]
   * @param {import('./keyProvider.js').KeyProvider} [options.keyProvider]
   */
  constructor(options = {}) {
    this.keyProvider = options.keyProvider || defaultKeyProvider;
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Every operation MUST generate a unique, cryptographically random 12-byte IV.
   *
   * @param {string|Object} plaintext - Data to encrypt
   * @param {Object} [options]
   * @param {string} [options.keyId] - Target key version (defaults to currentKeyId)
   * @param {import('./keyProvider.js').KeyProvider} [options.keyProvider] - Override key provider
   * @returns {{
   *   version: number,
   *   keyId: string,
   *   algorithm: string,
   *   iv: string,
   *   authTag: string,
   *   ciphertext: string,
   *   serialized: string,
   *   toString: () => string
   * }}
   */
  encrypt(plaintext, options = {}) {
    if (plaintext === null || plaintext === undefined) {
      throw new CryptoOperationError('Cannot encrypt null or undefined value');
    }

    const provider = options.keyProvider || this.keyProvider;
    const targetKeyId = options.keyId || provider.getCurrentKeyId();
    const keyBuffer = provider.getKey(targetKeyId);

    // Convert object to JSON string if needed
    const textToEncrypt = typeof plaintext === 'object' ? JSON.stringify(plaintext) : String(plaintext);

    // Generate cryptographically random 12-byte IV for every single encryption
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);

    // Create AES-256-GCM cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);

    const ciphertextBuffer = Buffer.concat([
      cipher.update(textToEncrypt, 'utf8'),
      cipher.final()
    ]);

    // Extract 16-byte authentication tag
    const authTagBuffer = cipher.getAuthTag();

    const bundle = {
      version: 1,
      keyId: targetKeyId,
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
   * Decrypt AES-256-GCM ciphertext with strict tamper detection.
   * Fails closed if authentication tag doesn't match or ciphertext was modified.
   *
   * @param {string|Object} encryptedInput - Ciphertext bundle or serialized string
   * @param {Object} [options]
   * @param {boolean} [options.asJson=false] - Attempt parsing decrypted string as JSON
   * @param {import('./keyProvider.js').KeyProvider} [options.keyProvider] - Override key provider
   * @returns {string|Object} Decrypted plaintext
   */
  decrypt(encryptedInput, options = {}) {
    const bundle = deserializeCiphertext(encryptedInput);
    const provider = options.keyProvider || this.keyProvider;

    if (bundle.algorithm !== ENCRYPTION_ALGORITHM) {
      throw new CryptoOperationError(`Unsupported encryption algorithm: ${bundle.algorithm}`);
    }

    // Retrieve key by version identifier recorded in bundle
    const keyBuffer = provider.getKey(bundle.keyId);

    const ivBuffer = Buffer.from(bundle.iv, 'hex');
    const authTagBuffer = Buffer.from(bundle.authTag, 'hex');
    const ciphertextBuffer = Buffer.from(bundle.ciphertext, 'hex');

    // Strict validation of buffers
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

      if (options.asJson) {
        try {
          return JSON.parse(decryptedText);
        } catch {
          return decryptedText;
        }
      }

      return decryptedText;
    } catch (err) {
      // Node.js crypto throws 'Unsupported state or unable to authenticate data' on tampering
      throw new TamperedCiphertextError(
        'Decryption authentication failed: ciphertext, auth tag, or IV has been tampered with or key is incorrect.'
      );
    }
  }

  /**
   * Re-encrypt / rotate credentials from an older key version to the target key version.
   * Old key is used for decryption; new key encrypts with fresh random IV and fresh auth tag.
   *
   * @param {string|Object} encryptedInput - Existing ciphertext
   * @param {string} [targetKeyId] - Target key version (defaults to currentKeyId)
   * @param {Object} [options]
   * @returns {Object} New ciphertext bundle
   */
  rotate(encryptedInput, targetKeyId = null, options = {}) {
    const provider = options.keyProvider || this.keyProvider;
    const destinationKeyId = targetKeyId || provider.getCurrentKeyId();

    // 1. Decrypt using existing key version
    const plaintext = this.decrypt(encryptedInput, { keyProvider: provider });

    // 2. Re-encrypt with new key version and new random IV
    return this.encrypt(plaintext, {
      keyId: destinationKeyId,
      keyProvider: provider
    });
  }
}

// Default singleton export
export const encryptionService = new EncryptionService();
export default encryptionService;
