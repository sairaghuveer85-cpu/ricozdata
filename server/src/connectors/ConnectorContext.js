import { logger as rootLogger } from '../utils/logger.js';

/**
 * ConnectorContext encapsulates execution-scoped context for a data source operation.
 * 
 * CRITICAL SECURITY INVARIANT:
 * Decrypted credentials remain strictly inside this server-side execution context.
 * They are NEVER serialized in toJSON, logged, or returned outside the connector boundary.
 */
export class ConnectorContext {
  /**
   * @param {Object} params
   * @param {string} params.dataSourceId - Target DataSource ObjectId
   * @param {string} params.organizationId - Trusted Tenant Organization ID
   * @param {string} params.sourceType - Normalized source type (e.g. postgresql, mysql)
   * @param {Object} [params.configuration={}] - Safe connection configuration parameters
   * @param {Object} [params.credentials={}] - Server-side decrypted credentials
   * @param {Object} [params.timeouts={}] - Operation timeouts in milliseconds
   * @param {AbortSignal} [params.abortSignal] - Optional AbortSignal for cooperative cancellation
   */
  constructor({
    dataSourceId,
    organizationId,
    sourceType,
    configuration = {},
    credentials = {},
    timeouts = {},
    abortSignal = null
  }) {
    this.dataSourceId = String(dataSourceId || '');
    this.organizationId = String(organizationId || '');
    this.sourceType = String(sourceType || '').toLowerCase();
    
    // Deep clone configuration while stripping accidental secret fields
    this.configuration = this._sanitizeConfig(configuration);
    
    // Hold credentials in a private memory reference
    this._credentials = Object.freeze({ ...(credentials || {}) });
    
    // Centralized timeout policies (in milliseconds)
    this.timeouts = {
      connect: timeouts.connect || 10000,
      query: timeouts.query || 15000,
      metadata: timeouts.metadata || 30000,
      sample: timeouts.sample || 15000
    };

    this.abortSignal = abortSignal;

    // Scoped logger that prefixes tenant and source info
    this.logger = {
      info: (msg, meta = {}) => rootLogger.info(`[Connector:${this.sourceType}] ${msg}`, this._cleanMeta(meta)),
      warn: (msg, meta = {}) => rootLogger.warn(`[Connector:${this.sourceType}] ${msg}`, this._cleanMeta(meta)),
      error: (msg, meta = {}) => rootLogger.error(`[Connector:${this.sourceType}] ${msg}`, this._cleanMeta(meta)),
      debug: (msg, meta = {}) => rootLogger.debug(`[Connector:${this.sourceType}] ${msg}`, this._cleanMeta(meta))
    };
  }

  /**
   * Access the decrypted credentials inside the execution boundary.
   * Never expose this method return value to HTTP responses or external callers.
   * @returns {Object}
   */
  getCredentials() {
    return this._credentials;
  }

  /**
   * Get safe metadata representation without sensitive parameters.
   */
  toJSON() {
    return {
      dataSourceId: this.dataSourceId,
      organizationId: this.organizationId,
      sourceType: this.sourceType,
      configuration: this.configuration,
      timeouts: this.timeouts
    };
  }

  _sanitizeConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return {};
    const sanitized = { ...cfg };
    const forbidden = ['password', 'secret', 'apiKey', 'token', 'clientSecret', 'secretAccessKey', 'privateKey'];
    for (const key of forbidden) {
      delete sanitized[key];
    }
    return Object.freeze(sanitized);
  }

  _cleanMeta(meta) {
    if (!meta || typeof meta !== 'object') return {};
    const clean = { ...meta };
    delete clean.password;
    delete clean.credentials;
    delete clean.secret;
    delete clean.apiKey;
    delete clean.secretAccessKey;
    clean.organizationId = this.organizationId;
    clean.dataSourceId = this.dataSourceId;
    return clean;
  }
}
