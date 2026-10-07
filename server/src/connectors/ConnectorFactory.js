import { connectorRegistry } from './ConnectorRegistry.js';
import { ConnectorContext } from './ConnectorContext.js';
import { ConnectorConfigurationError } from './errors.js';

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
   * Instantiate a connector directly from a Mongoose DataSource document.
   * Securely decrypts credentials into context memory without leaking to caller.
   * 
   * @param {import('../models/DataSource.js').DataSource} dataSource
   * @param {Object} [options]
   * @param {Object} [options.timeouts]
   * @param {AbortSignal} [options.abortSignal]
   * @returns {import('./BaseConnector.js').BaseConnector}
   */
  static createFromDataSource(dataSource, options = {}) {
    if (!dataSource) {
      throw new ConnectorConfigurationError('DataSource instance is required');
    }

    const sourceType = String(dataSource.type || '').toLowerCase().trim();
    if (!sourceType) {
      throw new ConnectorConfigurationError('DataSource type is missing');
    }

    const resolvedConfig = dataSource.configuration || dataSource.connectionConfig || {};

    // Decrypt credentials in execution memory using AES-256-GCM
    let decryptedCredentials = {};
    if (typeof dataSource.getDecryptedCredentials === 'function') {
      decryptedCredentials = dataSource.getDecryptedCredentials() || {};
    }

    const context = new ConnectorContext({
      dataSourceId: dataSource._id,
      organizationId: dataSource.organizationId,
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
