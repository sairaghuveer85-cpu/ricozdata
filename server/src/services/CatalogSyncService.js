import { DataSource } from '../models/DataSource.js';
import { Dataset } from '../models/Dataset.js';
import { CatalogSyncRun } from '../models/CatalogSyncRun.js';
import { Activity } from '../models/Activity.js';
import { ConnectorService } from '../connectors/ConnectorService.js';
import { logger } from '../utils/logger.js';
import CacheService from './CacheService.js';

// In-memory mutex to prevent concurrent sync runs on the same data source
const activeSyncJobs = new Set();

/**
 * CatalogSyncService reconciles live data source metadata with the RicozData catalog,
 * performs granular schema drift detection, and logs audit events.
 */
export class CatalogSyncService {
  /**
   * Run synchronization for a data source within tenant scope.
   * 
   * @param {string} dataSourceId
   * @param {string} organizationId
   * @param {Object} [options]
   * @param {Object} [options.actor] - User identity triggering sync
   * @returns {Promise<Object>} Completed sync run report
   */
  static async synchronize(dataSourceId, organizationId, options = {}) {
    const lockKey = `${organizationId}:${dataSourceId}`;
    if (activeSyncJobs.has(lockKey)) {
      const err = new Error('Catalog synchronization is already in progress for this data source');
      err.statusCode = 429;
      err.code = 'SYNC_IN_PROGRESS';
      throw err;
    }

    const dataSource = await DataSource.findOne({
      _id: dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    });

    if (!dataSource) {
      const err = new Error('Data source not found or does not belong to this organization');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    activeSyncJobs.add(lockKey);
    const startedAt = new Date();

    const syncRun = new CatalogSyncRun({
      organizationId,
      dataSourceId,
      status: 'RUNNING',
      startedAt,
      triggeredBy: options.actor?._id || options.actor?.userId || dataSource.createdBy
    });
    await syncRun.save();

    dataSource.syncStatus = 'running';
    await dataSource.save();

    try {
      // 1. Fetch metadata snapshot from the source connector
      const metadata = await ConnectorService.fetchMetadata(dataSourceId, organizationId);
      const discoveredTables = metadata.tables || [];

      // 2. Load existing datasets for this data source (including previously deleted for resurrection)
      const existingDatasets = await Dataset.find({
        organizationId,
        dataSourceId
      });

      const existingByExternalId = new Map();
      const existingByName = new Map();
      for (const ds of existingDatasets) {
        if (ds.externalId) existingByExternalId.set(ds.externalId, ds);
        existingByName.set(ds.name, ds);
      }

      let createdCount = 0;
      let updatedCount = 0;
      let removedCount = 0;
      const driftDetails = [];

      const discoveredExternalIds = new Set();

      // 3. Process discovered assets (Additions & Modifications)
      for (const table of discoveredTables) {
        discoveredExternalIds.add(table.externalId);

        let existing = existingByExternalId.get(table.externalId) || existingByName.get(table.name);

        if (!existing) {
          // TABLE_ADDED
          const newDataset = await Dataset.create({
            organizationId,
            dataSourceId,
            externalId: table.externalId,
            name: table.name,
            schemaName: table.schema || 'public',
            fullyQualifiedName: table.externalId,
            type: table.type || 'table',
            assetType: table.type || 'table',
            origin: 'DISCOVERED',
            syncStatus: 'ACTIVE',
            columns: table.columns || [],
            schemaMetadata: {
              fields: table.columns || [],
              rowCount: table.rowCount || 0,
              lastSchemaSyncAt: new Date()
            }
          });

          createdCount++;
          driftDetails.push({
            type: 'TABLE_ADDED',
            assetName: table.name,
            externalId: table.externalId,
            details: {
              type: table.type,
              columnCount: table.columns?.length || 0
            }
          });
        } else {
          // If dataset was previously soft-deleted, reactivate it as TABLE_ADDED
          let wasReactivated = false;
          if (existing.isDeleted) {
            existing.isDeleted = false;
            existing.deletedAt = null;
            existing.syncStatus = 'ACTIVE';
            wasReactivated = true;
            createdCount++;
            driftDetails.push({
              type: 'TABLE_ADDED',
              assetName: table.name,
              externalId: table.externalId,
              details: {
                type: table.type,
                columnCount: table.columns?.length || 0
              }
            });
          }

          // Check for modifications and drift on existing dataset
          const driftsForTable = CatalogSyncService._detectDrift(existing, table);
          const rowCountChanged = table.rowCount !== undefined && table.rowCount !== existing.schemaMetadata?.rowCount;

          if (driftsForTable.length > 0 || rowCountChanged || wasReactivated) {
            // Apply drift and row count updates safely preserving user-maintained column metadata
            const mergedColumns = CatalogSyncService._mergeColumns(existing.columns || [], table.columns || []);
            existing.columns = mergedColumns;
            existing.schemaMetadata = {
              ...existing.schemaMetadata,
              fields: mergedColumns,
              rowCount: table.rowCount !== undefined ? table.rowCount : (existing.schemaMetadata?.rowCount || 0),
              lastSchemaSyncAt: new Date()
            };
            if (existing.syncStatus === 'MISSING_FROM_SOURCE') {
              existing.syncStatus = 'ACTIVE';
            }
            await existing.save();

            if (!wasReactivated) {
              updatedCount++;
            }
            if (driftsForTable.length > 0) {
              driftDetails.push(...driftsForTable);
            }
          } else if (existing.syncStatus === 'MISSING_FROM_SOURCE') {
            // Table reappeared in source without drift
            existing.syncStatus = 'ACTIVE';
            await existing.save();
            updatedCount++;
          }
        }
      }

      // 4. Identify removed assets (TABLE_REMOVED)
      for (const ds of existingDatasets) {
        if (!ds.isDeleted && ds.origin === 'DISCOVERED' && ds.syncStatus === 'ACTIVE') {
          if (!discoveredExternalIds.has(ds.externalId) && !discoveredExternalIds.has(ds.name)) {
            // Safe lifecycle: mark as MISSING_FROM_SOURCE (preserve historical metadata, no hard delete)
            ds.syncStatus = 'MISSING_FROM_SOURCE';
            await ds.save();

            removedCount++;
            driftDetails.push({
              type: 'TABLE_REMOVED',
              assetName: ds.name,
              externalId: ds.externalId || ds.name,
              details: {
                previousColumnCount: ds.columns?.length || 0
              }
            });
          }
        }
      }

      // 5. Update SyncRun record
      const completedAt = new Date();
      syncRun.status = 'SUCCESS';
      syncRun.completedAt = completedAt;
      syncRun.discoveredCount = discoveredTables.length;
      syncRun.createdCount = createdCount;
      syncRun.updatedCount = updatedCount;
      syncRun.removedCount = removedCount;
      syncRun.driftCount = driftDetails.length;
      syncRun.driftDetails = driftDetails;
      await syncRun.save();

      // 6. Update DataSource sync stats
      dataSource.lastSyncAt = completedAt;
      dataSource.syncStatus = 'success';
      dataSource.syncStats = {
        datasetsCount: discoveredTables.length,
        lastError: null
      };
      await dataSource.save();

      // 7. Activity Audit Log
      const actorId = options.actor?._id || options.actor?.userId || dataSource.createdBy || dataSource.ownerId;
      if (actorId) {
        try {
          await Activity.create({
            organizationId,
            actorId,
            action: 'catalog.synchronized',
            entityType: 'data_source',
            entityId: dataSource._id,
            metadata: {
              dataSourceName: dataSource.name,
              discoveredCount: discoveredTables.length,
              createdCount,
              updatedCount,
              removedCount,
              driftCount: driftDetails.length
            }
          });
        } catch (actErr) {
          logger.warn(`[CatalogSyncService] Failed to record catalog.synchronized audit: ${actErr.message}`);
        }
      }

      await CacheService.invalidateDashboard(organizationId);

      return {
        syncRunId: syncRun._id,
        dataSourceId: dataSource._id,
        status: 'SUCCESS',
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        discoveredCount: discoveredTables.length,
        createdCount,
        updatedCount,
        removedCount,
        driftCount: driftDetails.length,
        driftDetails
      };
    } catch (err) {
      const completedAt = new Date();
      const safeMsg = err.message ? err.message.substring(0, 300) : 'Catalog synchronization failed';

      syncRun.status = 'FAILED';
      syncRun.completedAt = completedAt;
      syncRun.errorCode = err.code || 'SYNC_ERROR';
      syncRun.errorMessageSafe = safeMsg;
      await syncRun.save();

      dataSource.syncStatus = 'failed';
      dataSource.syncStats = {
        datasetsCount: dataSource.syncStats?.datasetsCount || 0,
        lastError: safeMsg
      };
      await dataSource.save();

      throw err;
    } finally {
      activeSyncJobs.delete(lockKey);
    }
  }

  /**
   * Compare existing dataset model against discovered metadata to detect granular schema drift.
   * @private
   */
  static _detectDrift(existingDataset, discoveredTable) {
    const drifts = [];
    const existingCols = existingDataset.columns || [];
    const discoveredCols = discoveredTable.columns || [];

    const existingColMap = new Map();
    for (const c of existingCols) {
      existingColMap.set(c.name.toLowerCase(), c);
    }

    const discoveredColMap = new Map();
    for (const c of discoveredCols) {
      discoveredColMap.set(c.name.toLowerCase(), c);
    }

    // Check for ADDED columns or MODIFIED columns
    for (const [colName, newCol] of discoveredColMap.entries()) {
      const oldCol = existingColMap.get(colName);
      if (!oldCol) {
        drifts.push({
          type: 'COLUMN_ADDED',
          assetName: existingDataset.name,
          externalId: existingDataset.externalId || existingDataset.name,
          details: {
            column: newCol.name,
            dataType: newCol.dataType,
            nullable: newCol.nullable
          }
        });
      } else {
        // Check data type change
        if (oldCol.dataType.toLowerCase() !== newCol.dataType.toLowerCase()) {
          drifts.push({
            type: 'COLUMN_TYPE_CHANGED',
            assetName: existingDataset.name,
            externalId: existingDataset.externalId || existingDataset.name,
            details: {
              column: newCol.name,
              oldType: oldCol.dataType,
              newType: newCol.dataType
            }
          });
        }
        // Check nullability change
        if (Boolean(oldCol.nullable) !== Boolean(newCol.nullable)) {
          drifts.push({
            type: 'COLUMN_NULLABILITY_CHANGED',
            assetName: existingDataset.name,
            externalId: existingDataset.externalId || existingDataset.name,
            details: {
              column: newCol.name,
              oldNullable: oldCol.nullable,
              newNullable: newCol.nullable
            }
          });
        }
      }
    }

    // Check for REMOVED columns
    for (const [colName, oldCol] of existingColMap.entries()) {
      if (!discoveredColMap.has(colName)) {
        drifts.push({
          type: 'COLUMN_REMOVED',
          assetName: existingDataset.name,
          externalId: existingDataset.externalId || existingDataset.name,
          details: {
            column: oldCol.name,
            dataType: oldCol.dataType
          }
        });
      }
    }

    return drifts;
  }

  /**
   * Safely merge discovered columns into existing columns, preserving user-maintained
   * annotations such as description, tags, and PII sensitivity classifications.
   * @private
   */
  static _mergeColumns(existingCols = [], discoveredCols = []) {
    const existingColMap = new Map();
    for (const col of existingCols) {
      if (col && col.name) {
        existingColMap.set(col.name.toLowerCase(), col);
      }
    }

    return discoveredCols.map((newCol, idx) => {
      const oldCol = existingColMap.get(newCol.name.toLowerCase());
      if (!oldCol) {
        return {
          name: newCol.name,
          dataType: newCol.dataType,
          nullable: newCol.nullable !== undefined ? newCol.nullable : true,
          ordinalPosition: newCol.ordinalPosition || idx + 1,
          defaultValue: newCol.defaultValue || null,
          isPrimaryKey: Boolean(newCol.isPrimaryKey),
          isForeignKey: Boolean(newCol.isForeignKey),
          description: newCol.description || '',
          tags: Array.isArray(newCol.tags) ? newCol.tags : [],
          classification: newCol.classification || 'none',
          piiClassification: newCol.piiClassification || 'none'
        };
      }

      // Preserve user-maintained governance metadata while updating structural/source fields
      return {
        name: newCol.name,
        dataType: newCol.dataType || oldCol.dataType,
        nullable: newCol.nullable !== undefined ? newCol.nullable : oldCol.nullable,
        ordinalPosition: newCol.ordinalPosition || idx + 1,
        defaultValue: newCol.defaultValue !== undefined ? newCol.defaultValue : oldCol.defaultValue,
        isPrimaryKey: newCol.isPrimaryKey !== undefined ? Boolean(newCol.isPrimaryKey) : Boolean(oldCol.isPrimaryKey),
        isForeignKey: newCol.isForeignKey !== undefined ? Boolean(newCol.isForeignKey) : Boolean(oldCol.isForeignKey),
        // Preserve user curation
        description: oldCol.description !== undefined && oldCol.description !== '' ? oldCol.description : (newCol.description || ''),
        tags: Array.isArray(oldCol.tags) && oldCol.tags.length > 0 ? oldCol.tags : (Array.isArray(newCol.tags) ? newCol.tags : []),
        classification: oldCol.classification && oldCol.classification !== 'none' ? oldCol.classification : (newCol.classification || 'none'),
        piiClassification: oldCol.piiClassification && oldCol.piiClassification !== 'none' ? oldCol.piiClassification : (newCol.piiClassification || 'none')
      };
    });
  }
}

export default CatalogSyncService;
