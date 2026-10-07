import { DataSource } from '../models/DataSource.js';
import { Activity } from '../models/Activity.js';
import { ConnectorFactory } from './ConnectorFactory.js';
import {
  ConnectorError,
  ConnectorConfigurationError,
  ConnectorTimeoutError,
  ConnectorAuthenticationError,
  ConnectorUnavailableError,
  ConnectorUnsupportedError
} from './errors.js';
import { logger } from '../utils/logger.js';

/**
 * In-flight lock to prevent concurrent connection tests on the same data source
 */
const activeTests = new Set();

/**
 * ConnectorService orchestrates connector operations, tenant isolation,
 * health state updates, and activity audit logging.
 */
export class ConnectorService {
  /**
   * Test connection to a data source with full lifecycle, health tracking, and audit logging.
   * 
   * @param {string} dataSourceId - DataSource ID
   * @param {string} organizationId - Trusted tenant organization ID
   * @param {Object} [options] - Optional options
   * @param {Object} [options.actor] - User identity performing test (for audit)
   * @returns {Promise<Object>} Normalized health check result
   */
  static async testConnection(dataSourceId, organizationId, options = {}) {
    const lockKey = `${organizationId}:${dataSourceId}`;
    if (activeTests.has(lockKey)) {
      throw new ConnectorError(
        'A connection test is already in progress for this data source. Please wait a moment.',
        'CONNECTION_TEST_IN_PROGRESS',
        429
      );
    }

    // Tenant-scoped lookup with encrypted credentials selected for execution boundary
    const dataSource = await DataSource.findOne({
      _id: dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    }).select('+credentials.encryptedData +credentials.keyId');

    if (!dataSource) {
      const err = new Error('Data source not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    activeTests.add(lockKey);
    const startHr = process.hrtime.bigint();
    const checkedAt = new Date();

    // Safe actor resolution for audit
    const actorId = options.actor?._id || options.actor?.userId || dataSource.createdBy || dataSource.ownerId || dataSource.organizationId;

    // Log connection test start
    try {
      if (actorId) {
        await Activity.create({
          organizationId,
          actorId,
          action: 'connection_test.started',
          entityType: 'data_source',
          entityId: dataSource._id,
          metadata: {
            dataSourceId: String(dataSource._id),
            dataSourceName: dataSource.name,
            sourceType: dataSource.type
          }
        });
      }
    } catch (actErr) {
      logger.warn('[ConnectorService] Failed to record connection_test.started audit', { error: actErr.message });
    }

    let connector = null;
    try {
      connector = ConnectorFactory.createFromDataSource(dataSource, {
        timeouts: { connect: 10000, query: 10000 }
      });

      const result = await connector.test();
      const endHr = process.hrtime.bigint();
      const latencyMs = Number(endHr - startHr) / 1_000_000;

      const roundedLatency = Math.round(latencyMs * 100) / 100;

      // Update DataSource health state
      dataSource.healthStatus = result.status || 'HEALTHY';
      dataSource.connectionState = 'CONNECTED';
      dataSource.lastTestedAt = checkedAt;
      dataSource.lastTestLatencyMs = roundedLatency;
      dataSource.lastTestError = null;
      await dataSource.save();

      // Audit log success
      try {
        if (actorId) {
          await Activity.create({
            organizationId,
            actorId,
            action: 'connection_test.succeeded',
            entityType: 'data_source',
            entityId: dataSource._id,
            metadata: {
              dataSourceId: String(dataSource._id),
              dataSourceName: dataSource.name,
              sourceType: dataSource.type,
              latencyMs: roundedLatency,
              status: result.status || 'HEALTHY'
            }
          });
        }
      } catch (actErr) {
        logger.warn('[ConnectorService] Failed to record connection_test.succeeded audit', { error: actErr.message });
      }

      return {
        success: true,
        connectorType: dataSource.type,
        status: result.status || 'HEALTHY',
        latencyMs: roundedLatency,
        checkedAt,
        details: result.details || {}
      };
    } catch (err) {
      const endHr = process.hrtime.bigint();
      const latencyMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      const safeErrorMsg = ConnectorService._normalizeErrorMessage(err);
      const isConfigOrAuth = err instanceof ConnectorAuthenticationError || 
                             err instanceof ConnectorConfigurationError ||
                             err instanceof ConnectorUnsupportedError;
      const healthStatus = isConfigOrAuth ? 'ERROR' : 'UNHEALTHY';

      dataSource.healthStatus = healthStatus;
      dataSource.connectionState = 'ERROR';
      dataSource.lastTestedAt = checkedAt;
      dataSource.lastTestLatencyMs = latencyMs;
      dataSource.lastTestError = safeErrorMsg;
      await dataSource.save();

      // Audit log failure
      try {
        if (actorId) {
          await Activity.create({
            organizationId,
            actorId,
            action: 'connection_test.failed',
            entityType: 'data_source',
            entityId: dataSource._id,
            metadata: {
              dataSourceId: String(dataSource._id),
              dataSourceName: dataSource.name,
              sourceType: dataSource.type,
              latencyMs,
              error: safeErrorMsg
            }
          });
        }
      } catch (actErr) {
        logger.warn('[ConnectorService] Failed to record connection_test.failed audit', { error: actErr.message });
      }

      return {
        success: false,
        connectorType: dataSource.type,
        status: healthStatus,
        latencyMs,
        checkedAt,
        error: safeErrorMsg,
        details: {
          code: err.code || 'CONNECTION_FAILED',
          message: safeErrorMsg
        }
      };
    } finally {
      activeTests.delete(lockKey);
      if (connector) {
        try {
          await connector.disconnect();
        } catch (cleanupErr) {
          logger.warn('[ConnectorService] Cleanup error after testConnection', { error: cleanupErr.message });
        }
      }
    }
  }

  /**
   * Discover and fetch normalized metadata from the target data source.
   * 
   * @param {string} dataSourceId
   * @param {string} organizationId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  static async fetchMetadata(dataSourceId, organizationId, options = {}) {
    const dataSource = await DataSource.findOne({
      _id: dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    }).select('+credentials.encryptedData +credentials.keyId');

    if (!dataSource) {
      const err = new Error('Data source not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const connector = ConnectorFactory.createFromDataSource(dataSource, {
      timeouts: { metadata: 45000 }
    });

    return await connector.executeWithLifecycle(async (conn) => {
      return await conn.fetchMetadata(options);
    });
  }

  /**
   * Sample bounded rows from a dataset on the target data source.
   * 
   * @param {string} dataSourceId
   * @param {string} organizationId
   * @param {Object} params
   * @param {string} params.tableName
   * @param {string} [params.schema]
   * @param {number} [params.limit=50]
   * @returns {Promise<Object>}
   */
  static async sampleData(dataSourceId, organizationId, params = {}) {
    const dataSource = await DataSource.findOne({
      _id: dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    }).select('+credentials.encryptedData +credentials.keyId');

    if (!dataSource) {
      const err = new Error('Data source not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Enforce strict upper bound on sample rows server-side (max 100 rows)
    const boundedLimit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 100);

    const connector = ConnectorFactory.createFromDataSource(dataSource, {
      timeouts: { sample: 20000 }
    });

    return await connector.executeWithLifecycle(async (conn) => {
      return await conn.sampleData({
        ...params,
        limit: boundedLimit
      });
    });
  }

  /**
   * Execute a single quality rule on target data source.
   */
  static async executeQualityRule(dataSourceId, organizationId, rule, dataset, options = {}) {
    const dataSource = await DataSource.findOne({
      _id: dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    }).select('+credentials.encryptedData +credentials.keyId');

    if (!dataSource) {
      const err = new Error('Data source not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const connector = ConnectorFactory.createFromDataSource(dataSource, {
      timeouts: { query: options.timeoutMs || 25000 }
    });

    return await connector.executeWithLifecycle(async (conn) => {
      return await conn.executeQualityRule(rule, dataset, options);
    });
  }

  /**
   * Execute statistical profiling on target dataset.
   */
  static async profileDataset(dataSourceId, organizationId, dataset, options = {}) {
    const dataSource = await DataSource.findOne({
      _id: dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    }).select('+credentials.encryptedData +credentials.keyId');

    if (!dataSource) {
      const err = new Error('Data source not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const connector = ConnectorFactory.createFromDataSource(dataSource, {
      timeouts: { query: options.timeoutMs || 30000 }
    });

    return await connector.executeWithLifecycle(async (conn) => {
      return await conn.profileDataset(dataset, options);
    });
  }

  /**
   * Execute a safe read-only query on target data source.
   */
  static async executeReadOnlyQuery(dataSourceId, organizationId, sqlQuery, params = [], options = {}) {
    const dataSource = await DataSource.findOne({
      _id: dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    }).select('+credentials.encryptedData +credentials.keyId');

    if (!dataSource) {
      const err = new Error('Data source not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const connector = ConnectorFactory.createFromDataSource(dataSource, {
      timeouts: { query: options.timeoutMs || 15000 }
    });

    return await connector.executeWithLifecycle(async (conn) => {
      return await conn.executeQueryReadOnly(sqlQuery, params, options);
    });
  }

  static async executeQueryReadOnly(dataSourceId, organizationId, sqlQuery, params = [], options = {}) {
    return this.executeReadOnlyQuery(dataSourceId, organizationId, sqlQuery, params, options);
  }

  /**
   * Strip sensitive details, passwords, and raw stack traces from error messages.
   * @private
   */
  static _normalizeErrorMessage(err) {
    if (!err) return 'Unknown connection failure';
    let msg = err.message || 'Connection failure';
    
    // Strip connection strings containing passwords
    msg = msg.replace(/:[^:@/]+@/g, ':****@');
    
    // Strip file paths or driver internals
    if (err instanceof ConnectorError) {
      return msg;
    }

    if (err.code === 'ECONNREFUSED') {
      return `Target host refused connection. Verify host and port.`;
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      return `Connection timed out. Target host may be unreachable or firewalled.`;
    }
    if (err.code === 'ENOTFOUND') {
      return `Host lookup failed. Target hostname could not be resolved.`;
    }
    if (err.code === '28P01' || err.message?.includes('password authentication failed')) {
      return `Authentication failed: Invalid username or password.`;
    }
    if (err.code === '3D000') {
      return `Database does not exist on target server.`;
    }

    return msg.length > 250 ? `${msg.substring(0, 247)}...` : msg;
  }
}

export default ConnectorService;
