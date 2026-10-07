import config from '../../config/env.js';

/**
 * Custom error class for encryption key validation failures.
 */
export class InvalidEncryptionKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEncryptionKeyError';
    this.statusCode = 500;
  }
}

/**
 * Custom error class for missing encryption keys.
 */
export class KeyNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyNotFoundError';
    this.statusCode = 500;
  }
}

/**
 * Abstract Base Class for Key Providers in RicozData.
 * Defines the contract for acquiring 32-byte encryption keys and managing versioning.
 */
export class KeyProvider {
  /**
   * Retrieve the 32-byte binary key Buffer for the specified key identifier.
   * @param {string} keyId - Identifier of the key version (e.g. 'KEY_V1')
   * @returns {Buffer} 32-byte cryptographic key
   */
  getKey(keyId) {
    throw new Error('KeyProvider.getKey must be implemented by subclass');
  }

  /**
   * Get the identifier of the current active encryption key.
   * @returns {string} Key identifier
   */
  getCurrentKeyId() {
    throw new Error('KeyProvider.getCurrentKeyId must be implemented by subclass');
  }

  /**
   * Retrieve the active key and its identifier.
   * @returns {{ keyId: string, keyBuffer: Buffer }}
   */
  getCurrentKey() {
    throw new Error('KeyProvider.getCurrentKey must be implemented by subclass');
  }
}

/**
 * Local / Environment Key Provider.
 * Loads AES-256 keys from environment configuration, performs strict 32-byte validation,
 * and manages key versions for seamless rotation without downtime.
 */
export class LocalEnvironmentKeyProvider extends KeyProvider {
  /**
   * @param {Object} options
   * @param {string} [options.currentKeyId] - Active key identifier
   * @param {Record<string, string|Buffer>} [options.keys] - Key dictionary
   */
  constructor(options = {}) {
    super();
    this.currentKeyId = options.currentKeyId || config.security?.currentKeyId || 'KEY_V1';
    this.keys = new Map();

    // Seed from config or options
    const initialKeys = options.keys || config.security?.keys || {};
    for (const [id, value] of Object.entries(initialKeys)) {
      if (value) {
        this.keys.set(id, value);
      }
    }

    // Ensure fallback if single encryptionKey was configured
    if (!this.keys.has('KEY_V1') && config.security?.encryptionKey) {
      this.keys.set('KEY_V1', config.security.encryptionKey);
    }
  }

  /**
   * Strict validation and normalization of cryptographic key material.
   * Validates exact 32-byte (256-bit) length.
   * Accepts:
   *  - 64-character hex string (32 bytes)
   *  - 32-character UTF-8 / ASCII string (32 bytes)
   *  - 32-byte Buffer
   *
   * @param {string|Buffer} rawKey - Key material
   * @param {string} keyId - Key identifier for error reporting
   * @returns {Buffer} 32-byte key Buffer
   */
  normalizeAndValidateKey(rawKey, keyId) {
    if (!rawKey) {
      throw new KeyNotFoundError(`Encryption key for "${keyId}" is empty or not provided.`);
    }

    let buffer;
    if (Buffer.isBuffer(rawKey)) {
      buffer = rawKey;
    } else if (typeof rawKey === 'string') {
      const trimmed = rawKey.trim();
      // Check if 64-character valid hex string
      if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
        buffer = Buffer.from(trimmed, 'hex');
      } else if (Buffer.byteLength(trimmed, 'utf8') === 32) {
        buffer = Buffer.from(trimmed, 'utf8');
      } else {
        throw new InvalidEncryptionKeyError(
          `Encryption key for "${keyId}" must be exactly 32 bytes (256 bits). ` +
          `Received string with length ${trimmed.length} characters (${Buffer.byteLength(trimmed, 'utf8')} bytes).`
        );
      }
    } else {
      throw new InvalidEncryptionKeyError(
        `Encryption key for "${keyId}" must be a string or Buffer. Received ${typeof rawKey}.`
      );
    }

    if (buffer.length !== 32) {
      throw new InvalidEncryptionKeyError(
        `Encryption key for "${keyId}" must be exactly 32 bytes (256 bits). Received ${buffer.length} bytes.`
      );
    }

    return buffer;
  }

  /**
   * Set or update a key version.
   * @param {string} keyId - Key identifier
   * @param {string|Buffer} rawKey - 32-byte key
   */
  setKey(keyId, rawKey) {
    // Validate upon registration to fail fast
    this.normalizeAndValidateKey(rawKey, keyId);
    this.keys.set(keyId, rawKey);
  }

  /**
   * Retrieve the validated 32-byte key Buffer for a given key version.
   * @param {string} [keyId] - Key identifier (defaults to currentKeyId)
   * @returns {Buffer} 32-byte key Buffer
   */
  getKey(keyId = null) {
    const targetId = keyId || this.currentKeyId;
    const rawKey = this.keys.get(targetId);

    if (!rawKey) {
      throw new KeyNotFoundError(
        `Encryption key "${targetId}" not found in provider. Available keys: [${Array.from(this.keys.keys()).join(', ')}]`
      );
    }

    return this.normalizeAndValidateKey(rawKey, targetId);
  }

  /**
   * Get the active key identifier.
   * @returns {string} Current key ID
   */
  getCurrentKeyId() {
    return this.currentKeyId;
  }

  /**
   * Set the active key identifier.
   * @param {string} keyId
   */
  setCurrentKeyId(keyId) {
    if (!this.keys.has(keyId)) {
      throw new KeyNotFoundError(`Cannot set active key to "${keyId}": key does not exist in provider.`);
    }
    this.currentKeyId = keyId;
  }

  /**
   * Get the active key material and its identifier.
   * @returns {{ keyId: string, keyBuffer: Buffer }}
   */
  getCurrentKey() {
    const keyId = this.getCurrentKeyId();
    const keyBuffer = this.getKey(keyId);
    return { keyId, keyBuffer };
  }
}

/**
 * KMS Key Provider Extension Point.
 * Architectural preparation for AWS KMS / GCP Cloud KMS / HashiCorp Vault.
 *
 * NOTE: As required by enterprise specification, cloud KMS integration is not
 * falsely simulated or mocked when unconfigured. It explicitly throws until configured.
 */
export class KMSKeyProvider extends KeyProvider {
  constructor(options = {}) {
    super();
    this.providerName = options.providerName || 'AWS_KMS';
    this.keyArn = options.keyArn || null;
    this.region = options.region || null;
    this.isConfigured = false;
  }

  getKey(keyId) {
    throw new Error(
      `KMSKeyProvider: Cloud KMS provider (${this.providerName}) is an architectural extension point ` +
      `and is not currently configured in this environment. Use LocalEnvironmentKeyProvider.`
    );
  }

  getCurrentKeyId() {
    throw new Error(
      `KMSKeyProvider: Cloud KMS provider (${this.providerName}) is not currently configured.`
    );
  }

  getCurrentKey() {
    throw new Error(
      `KMSKeyProvider: Cloud KMS provider (${this.providerName}) is not currently configured.`
    );
  }
}

// Default singleton instance
export const defaultKeyProvider = new LocalEnvironmentKeyProvider();
export default defaultKeyProvider;
