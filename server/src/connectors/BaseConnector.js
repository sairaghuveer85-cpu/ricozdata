import {
  ConnectorUnsupportedError,
  ConnectorTimeoutError,
  ConnectorError
} from './errors.js';

/**
 * BaseConnector defines the standard extensible interface for all RicozData connectors.
 * Every concrete connector (PostgreSQL, MySQL, Snowflake, MongoDB, S3) must extend this class.
 */
export class BaseConnector {
  /**
   * @param {import('./ConnectorContext.js').ConnectorContext} context
   */
  constructor(context) {
    if (!context) {
      throw new Error('ConnectorContext is required to instantiate a connector');
    }
    this.context = context;
    this.type = context.sourceType;
    this.isConnected = false;
  }

  /**
   * Capability matrix exposed by this connector.
   * Concrete subclasses override these properties according to their true feature support.
   */
  get capabilities() {
    return {
      supportsMetadataDiscovery: false,
      supportsSampling: false,
      supportsSchemaDiscovery: false,
      supportsColumnMetadata: false,
      supportsRelationships: false,
      supportsStreaming: false
    };
  }

  /**
   * Establish underlying client connection or connection pool.
   * @returns {Promise<void>}
   */
  async connect() {
    throw new ConnectorUnsupportedError(`connect() is not implemented for connector type "${this.type}"`);
  }

  /**
   * Perform lightweight live connectivity validation (e.g. SELECT 1 or ping).
   * @returns {Promise<{ success: boolean, connectorType: string, status: string, latencyMs: number, checkedAt: string, details: Object }>}
   */
  async test() {
    throw new ConnectorUnsupportedError(`test() is not implemented for connector type "${this.type}"`);
  }

  /**
   * Gracefully close connections, release pool resources, and reset state.
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.isConnected = false;
  }

  /**
   * Fetch normalized catalog metadata (schemas, tables, views, columns, keys, indexes).
   * @param {Object} [options]
   * @param {string} [options.schema] - Optional schema filter
   * @param {string[]} [options.tables] - Optional list of table names to filter
   * @returns {Promise<Object>} Normalized metadata contract
   */
  async fetchMetadata(options = {}) {
    throw new ConnectorUnsupportedError(`fetchMetadata() is not implemented for connector type "${this.type}"`);
  }

  /**
   * Fetch bounded sample rows for a specific table or asset.
   * @param {Object} params
   * @param {string} params.tableName - Target table/asset name
   * @param {string} [params.schema] - Target schema name
   * @param {number} [params.limit=50] - Number of sample rows (enforces strict maximum server-side)
   * @returns {Promise<Object>} Bounded sample data
   */
  async sampleData(params = {}) {
    throw new ConnectorUnsupportedError(`sampleData() is not implemented for connector type "${this.type}"`);
  }

  /**
   * Execute a read-only parameterized query under bounded constraints.
   * @param {string} sqlQuery
   * @param {Array} [params=[]]
   * @param {Object} [options={}]
   * @returns {Promise<Object>}
   */
  async executeQueryReadOnly(sqlQuery, params = [], options = {}) {
    throw new ConnectorUnsupportedError(`executeQueryReadOnly() is not implemented for connector type "${this.type}"`);
  }

  /**
   * Evaluates a single quality rule against the target dataset.
   * @param {Object} rule - Rule definition and configuration
   * @param {Object} dataset - Target dataset metadata
   * @param {Object} [options={}] - Execution options
   * @returns {Promise<Object>} Normalized quality check result
   */
  async executeQualityRule(rule, dataset, options = {}) {
    throw new ConnectorUnsupportedError(`executeQualityRule() is not implemented for connector type "${this.type}"`);
  }

  /**
   * Computes statistical column profiling for the target dataset.
   * @param {Object} dataset - Target dataset metadata
   * @param {Object} [options={}] - Profiling options
   * @returns {Promise<Object>} Normalized profile result
   */
  async profileDataset(dataset, options = {}) {
    throw new ConnectorUnsupportedError(`profileDataset() is not implemented for connector type "${this.type}"`);
  }

  /**
   * Utility helper to execute an asynchronous block under a strict timeout.
   * @param {Promise<any>} promise
   * @param {number} timeoutMs
   * @param {string} operationName
   * @returns {Promise<any>}
   */
  async withTimeout(promise, timeoutMs, operationName = 'Operation') {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new ConnectorTimeoutError(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Helper that executes a unit of work through the complete connector lifecycle:
   * construct -> connect -> operate -> disconnect
   * Guarantees disconnect/cleanup in finally block even if errors occur.
   * 
   * @param {Function} operation - Async callback receiving the connected connector
   * @returns {Promise<any>}
   */
  async executeWithLifecycle(operation) {
    try {
      await this.connect();
      return await operation(this);
    } finally {
      try {
        await this.disconnect();
      } catch (cleanupErr) {
        this.context.logger.warn('Error during connector disconnect cleanup', { error: cleanupErr.message });
      }
    }
  }
}
