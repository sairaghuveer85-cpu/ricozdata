import { connectorRegistry } from './ConnectorRegistry.js';
import { ConnectorContext } from './ConnectorContext.js';
import { ConnectorConfigurationError } from './errors.js';
import encryptionService from '../services/encryption/encryption.service.js';

/**
 * ConnectorFactory instantiates concrete connectors inside the secure execution boundary.
 */
export class ConnectorFactory {
  /**
   * Create a connector from an existing ConnectorContext.
   * @param {ConnectorContext} context
   * @returns {import('./BaseConnector.js').BaseConnector}
   */
  static create(context) {
    if (!context || !(context instanceof ConnectorContext)) {
      throw new ConnectorConfigurationError('Valid ConnectorContext is required to create a connector');
    }

    const ConnectorClass = connectorRegistry.get(context.sourceType);
    return new ConnectorClass(context);
  }

  /**
   * Instantiate a connector directly from a Mongoose DataSource document or transient payload.
   * Securely decrypts credentials into context memory without leaking to caller.
   * 
   * @param {import('../models/DataSource.js').DataSource|Object} dataSource
   * @param {Object} [options]
   * @param {Object} [options.credentials]
   * @param {Object} [options.configuration]
   * @param {Object} [options.timeouts]
   * @param {AbortSignal} [options.abortSignal]
   * @returns {import('./BaseConnector.js').BaseConnector}
   */
  static createFromDataSource(dataSource, options = {}) {
    if (!dataSource) {
      throw new ConnectorConfigurationError('DataSource instance is required');
    }

    const sourceType = String(dataSource.type || options.type || '').toLowerCase().trim();
    if (!sourceType) {
      throw new ConnectorConfigurationError('DataSource type is missing');
    }

    const resolvedConfig = {
      ...(dataSource.configuration || {}),
      ...(dataSource.connectionConfig || {}),
      ...(options.configuration || {}),
      ...(options.connectionConfig || {})
    };

    // Helper to decrypt ciphertext if encrypted
    const safeDecrypt = (val) => {
      if (!val) return null;
      try {
        if (typeof val === 'string' && val.startsWith('enc:v')) {
          return encryptionService.decrypt(val, { asJson: true });
        }
        if (typeof val === 'object' && val.encryptedData && typeof val.encryptedData === 'string' && val.encryptedData.startsWith('enc:v')) {
          return encryptionService.decrypt(val.encryptedData, { asJson: true });
        }
      } catch (err) {
        // Fall back to null if decryption fails
        return null;
      }
      return null;
    };

    // Decrypt credentials strictly in execution memory using AES-256-GCM
    let decryptedCredentials = {};

    // 1. Explicit credentials in options (transient request body or explicit caller override)
    if (options.credentials !== undefined && options.credentials !== null) {
      const decrypted = safeDecrypt(options.credentials);
      if (decrypted) {
        decryptedCredentials = typeof decrypted === 'string' ? { password: decrypted } : { ...decrypted };
      } else if (typeof options.credentials === 'string') {
        decryptedCredentials = { password: options.credentials };
      } else if (typeof options.credentials === 'object') {
        decryptedCredentials = { ...options.credentials };
      }
    }
    // 2. Mongoose document helper getDecryptedCredentials()
    else if (typeof dataSource.getDecryptedCredentials === 'function') {
      const dec = dataSource.getDecryptedCredentials();
      if (dec) {
        decryptedCredentials = typeof dec === 'string' ? { password: dec } : { ...dec };
      }
    }
    // 3. Stored or transient credentials property on dataSource
    else if (dataSource.credentials !== undefined && dataSource.credentials !== null) {
      const decrypted = safeDecrypt(dataSource.credentials);
      if (decrypted) {
        decryptedCredentials = typeof decrypted === 'string' ? { password: decrypted } : { ...decrypted };
      } else if (typeof dataSource.credentials === 'string') {
        decryptedCredentials = { password: dataSource.credentials };
      } else if (typeof dataSource.credentials === 'object') {
        decryptedCredentials = { ...dataSource.credentials };
      }
    }

    // 4. Recover transient password or username from configuration if passed there
    if (!decryptedCredentials.password && resolvedConfig.password !== undefined) {
      decryptedCredentials.password = resolvedConfig.password;
    }
    if (!decryptedCredentials.username) {
      if (resolvedConfig.username) decryptedCredentials.username = resolvedConfig.username;
      else if (resolvedConfig.user) decryptedCredentials.username = resolvedConfig.user;
    }

    const context = new ConnectorContext({
      dataSourceId: dataSource._id || options.dataSourceId,
      organizationId: dataSource.organizationId || options.organizationId,
      sourceType,
      configuration: resolvedConfig,
      credentials: decryptedCredentials,
      timeouts: options.timeouts,
      abortSignal: options.abortSignal
    });

    return ConnectorFactory.create(context);
  }
}

export default ConnectorFactory;
