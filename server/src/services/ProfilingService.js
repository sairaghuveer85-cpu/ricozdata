import { Dataset } from '../models/Dataset.js';
import { DataSource } from '../models/DataSource.js';
import { DataProfile } from '../models/DataProfile.js';
import { ConnectorService } from '../connectors/index.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../utils/logger.js';

// Concurrency lock for dataset profiling
const activeDatasetProfiles = new Set();

export class ProfilingService {
  /**
   * Profiles a dataset by orchestrating database-side aggregate computations via connector.
   * 
   * @param {string} datasetId - Dataset ID
   * @param {string} organizationId - Tenant organization ID
   * @param {Object} [options]
   * @param {Object} [options.actor] - User identity triggering profile
   * @returns {Promise<Object>} Created DataProfile document
   */
  static async profileDataset(datasetId, organizationId, options = {}) {
    const lockKey = `${organizationId}:${datasetId}`;
    if (activeDatasetProfiles.has(lockKey)) {
      const err = new Error('A profiling job is already running for this dataset. Please wait a moment.');
      err.statusCode = 429;
      err.code = 'PROFILING_IN_PROGRESS';
      throw err;
    }

    const dataset = await Dataset.findOne({
      _id: datasetId,
      organizationId,
      isDeleted: { $ne: true }
    });

    if (!dataset) {
      const err = new Error('Dataset not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const dataSource = await DataSource.findOne({
      _id: dataset.dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    });

    if (!dataSource) {
      const err = new Error('Underlying data source not found or inaccessible');
      err.statusCode = 404;
      err.code = 'DATA_SOURCE_NOT_FOUND';
      throw err;
    }

    activeDatasetProfiles.add(lockKey);
    const actorId = options.actor?._id || options.actor?.userId || null;
    const startHr = process.hrtime.bigint();

    try {
      // Execute profiling via connector layer (database-side aggregation)
      const rawProfile = await ConnectorService.profileDataset(
        dataSource._id,
        organizationId,
        dataset,
        { timeoutMs: 30000 }
      );

      // Sensitive classification protection:
      // If column is classified as PII or confidential, mask histogram buckets
      const sensitiveColumnNames = new Set(
        (dataset.columns || [])
          .filter(c => ['pii', 'sensitive_pii', 'financial', 'confidential', 'restricted'].includes(String(c.classification || c.piiClassification).toLowerCase()))
          .map(c => c.name.toLowerCase())
      );

      const processedColumns = (rawProfile.columns || []).map(col => {
        const isSensitive = sensitiveColumnNames.has(col.columnName.toLowerCase()) ||
          ['email', 'ssn', 'phone', 'password', 'credit_card'].some(term => col.columnName.toLowerCase().includes(term));

        if (isSensitive && Array.isArray(col.histogram)) {
          // Redact sensitive literal values from distribution bucket previews
          return {
            ...col,
            histogram: col.histogram.map(h => ({
              bucket: '[REDACTED_SENSITIVE]',
              count: h.count,
              percentage: h.percentage
            }))
          };
        }
        return col;
      });

      const endHr = process.hrtime.bigint();
      const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      // Persist profile
      const dataProfile = await DataProfile.create({
        organizationId,
        datasetId,
        dataSourceId: dataSource._id,
        status: 'SUCCESS',
        rowCount: rawProfile.rowCount,
        columnCount: processedColumns.length,
        columns: processedColumns,
        profiledBy: actorId,
        durationMs
      });

      // Update Dataset row count in schema metadata
      if (dataset.schemaMetadata) {
        dataset.schemaMetadata.rowCount = rawProfile.rowCount;
        await dataset.save();
      }

      // Log activity
      try {
        await Activity.create({
          organizationId,
          actorId: actorId || organizationId,
          action: 'dataset.profiled',
          entityType: 'dataset',
          entityId: dataset._id,
          metadata: {
            datasetName: dataset.name,
            rowCount: rawProfile.rowCount,
            columnCount: processedColumns.length,
            durationMs
          }
        });
      } catch (actErr) {
        logger.warn('[ProfilingService] Failed to record dataset.profiled audit:', actErr.message);
      }

      return dataProfile;
    } catch (err) {
      const endHr = process.hrtime.bigint();
      const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      await DataProfile.create({
        organizationId,
        datasetId,
        dataSourceId: dataSource._id,
        status: 'FAILED',
        profiledBy: actorId,
        durationMs,
        error: {
          code: err.code || 'PROFILING_FAILED',
          message: err.message || 'Execution error during profiling'
        }
      });

      throw err;
    } finally {
      activeDatasetProfiles.delete(lockKey);
    }
  }

  /**
   * Retrieves the latest profile for a dataset.
   */
  static async getLatestProfile(datasetId, organizationId) {
    return await DataProfile.findOne({ datasetId, organizationId }).sort({ createdAt: -1 });
  }

  /**
   * Retrieves profiling history with pagination.
   */
  static async getProfileHistory(datasetId, organizationId, options = {}) {
    const page = Math.max(parseInt(options.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      DataProfile.find({ datasetId, organizationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      DataProfile.countDocuments({ datasetId, organizationId })
    ]);

    return {
      profiles,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export default ProfilingService;
