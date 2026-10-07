import { DataSource } from '../models/DataSource.js';
import { Dataset } from '../models/Dataset.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { ConnectorService } from '../connectors/index.js';
import { CatalogSyncService } from '../services/CatalogSyncService.js';
import {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  parseFilters,
  buildSearchFilter
} from '../services/query.service.js';

/**
 * Controller for Enterprise Data Source Management, Hardened Encryption,
 * and Lifecycle Operations.
 */

export async function createDataSource(req, res) {
  const { name, type, description, configuration, connectionConfig, credentials, tags, metadata } = req.body;

  if (!name || !type) {
    return sendError(res, 'VALIDATION_ERROR', 'Name and type are required fields for data source creation', 400);
  }

  const existing = await DataSource.findOne({
    organizationId: req.organizationId,
    name: name.trim(),
    isDeleted: { $ne: true }
  });

  if (existing) {
    return sendError(res, 'DUPLICATE_NAME', `Data source with name "${name}" already exists in this organization`, 409);
  }

  const resolvedConfig = configuration || connectionConfig || {};

  const dataSource = new DataSource({
    organizationId: req.organizationId,
    name: name.trim(),
    type: String(type).toLowerCase().trim(),
    description: description ? description.trim() : '',
    configuration: resolvedConfig,
    connectionConfig: resolvedConfig,
    metadata: metadata || {},
    tags: tags || [],
    status: 'ACTIVE',
    healthStatus: 'UNTESTED',
    connectionState: 'DISCONNECTED',
    createdBy: req.user?._id,
    updatedBy: req.user?._id,
    ownerId: req.user?._id
  });

  if (credentials) {
    // Encrypts using AES-256-GCM. Raw credentials are never persisted to MongoDB!
    dataSource.setCredentials(credentials);
  }

  await dataSource.save();

  // Audit activity logging (strictly zero secret leakage)
  try {
    if (req.user?._id) {
      await Activity.create({
        organizationId: req.organizationId,
        actorId: req.user._id,
        action: 'data_source.created',
        entityType: 'data_source',
        entityId: dataSource._id,
        metadata: {
          name: dataSource.name,
          type: dataSource.type,
          hasCredentials: Boolean(credentials)
        }
      });
    }
  } catch (actErr) {
    logger.warn(`[Activity] Failed to record data_source.created: ${actErr.message}`);
  }

  // toJSON transformation automatically redacts all credentials and exposes credentialStatus: 'configured'
  return sendSuccess(res, dataSource, {}, 201);
}

export async function getDataSources(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, ['createdAt', 'updatedAt', 'name', 'type', 'status'], { createdAt: -1 });
  const filterCriteria = parseFilters(req.query, {
    type: { type: 'string' },
    status: { type: 'string' }
  });

  // Normalize type filter to lowercase if present
  if (filterCriteria.type && typeof filterCriteria.type === 'string') {
    filterCriteria.type = filterCriteria.type.toLowerCase();
  }

  // Normalize status filter to uppercase if present
  if (filterCriteria.status && typeof filterCriteria.status === 'string') {
    filterCriteria.status = { $in: [filterCriteria.status.toUpperCase(), filterCriteria.status.toLowerCase()] };
  }

  const filter = {
    organizationId: req.organizationId,
    isDeleted: { $ne: true },
    ...filterCriteria
  };

  const searchTerm = req.query.query || req.query.search;
  if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim()) {
    const searchFilter = buildSearchFilter(searchTerm, ['name', 'type', 'description'], req.organizationId);
    if (searchFilter.$or) {
      filter.$or = searchFilter.$or;
    }
  }

  const hasPaginationParams = req.query.page !== undefined || req.query.limit !== undefined;

  if (hasPaginationParams) {
    const [total, dataSources] = await Promise.all([
      DataSource.countDocuments(filter),
      DataSource.find(filter).sort(sort).skip(skip).limit(limit)
    ]);
    const paginationMeta = buildPaginationMeta(total, page, limit);
    return sendPaginated(res, dataSources, paginationMeta);
  }

  const dataSources = await DataSource.find(filter).sort(sort);
  return sendSuccess(res, dataSources);
}

export async function getDataSourceById(req, res) {
  const dataSource = await DataSource.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataSource) {
    return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Data source not found or does not belong to this organization', 404);
  }

  return sendSuccess(res, dataSource);
}

export async function updateDataSource(req, res) {
  const dataSource = await DataSource.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataSource) {
    return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Data source not found or does not belong to this organization', 404);
  }

  const { name, type, description, configuration, connectionConfig, credentials, tags, metadata, status } = req.body;

  if (name && name.trim() !== dataSource.name) {
    const existing = await DataSource.findOne({
      organizationId: req.organizationId,
      name: name.trim(),
      _id: { $ne: dataSource._id },
      isDeleted: { $ne: true }
    });
    if (existing) {
      return sendError(res, 'DUPLICATE_NAME', `Data source with name "${name}" already exists in this organization`, 409);
    }
    dataSource.name = name.trim();
  }

  if (type) dataSource.type = String(type).toLowerCase().trim();
  if (description !== undefined) dataSource.description = String(description).trim();
  if (status) dataSource.status = status;

  const resolvedConfig = configuration || connectionConfig;
  if (resolvedConfig) {
    dataSource.configuration = { ...dataSource.configuration, ...resolvedConfig };
    dataSource.connectionConfig = dataSource.configuration;
  }

  if (tags) dataSource.tags = tags;
  if (metadata) dataSource.metadata = { ...dataSource.metadata, ...metadata };

  if (credentials) {
    // Re-encrypt updated credentials using active key
    dataSource.setCredentials(credentials);
  }

  dataSource.updatedBy = req.user?._id;
  await dataSource.save();

  // Audit activity logging (strictly zero secret leakage)
  try {
    if (req.user?._id) {
      await Activity.create({
        organizationId: req.organizationId,
        actorId: req.user._id,
        action: credentials ? 'data_source.credentials_updated' : 'data_source.updated',
        entityType: 'data_source',
        entityId: dataSource._id,
        metadata: {
          name: dataSource.name,
          type: dataSource.type,
          credentialsChanged: Boolean(credentials)
        }
      });
    }
  } catch (actErr) {
    logger.warn(`[Activity] Failed to record data_source.updated: ${actErr.message}`);
  }

  return sendSuccess(res, dataSource);
}

export async function deleteDataSource(req, res) {
  const dataSource = await DataSource.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataSource) {
    return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Data source not found or does not belong to this organization', 404);
  }

  // Downstream dataset dependency check: Prevent hard/orphaned cascades
  const dependentDatasetsCount = await Dataset.countDocuments({
    organizationId: req.organizationId,
    dataSourceId: dataSource._id
  });

  if (dependentDatasetsCount > 0) {
    return sendError(
      res,
      'CONFLICT',
      `Cannot delete data source: ${dependentDatasetsCount} dependent dataset(s) exist in catalog. Inactivate the data source or remove dependent datasets first.`,
      409,
      { dependentDatasetsCount }
    );
  }

  // Safe deactivation and soft-deletion preserving audit history
  dataSource.status = 'INACTIVE';
  dataSource.healthStatus = 'UNTESTED';
  dataSource.connectionState = 'DISCONNECTED';
  dataSource.isDeleted = true;
  dataSource.deletedAt = new Date();
  dataSource.updatedBy = req.user?._id;
  await dataSource.save();

  // Audit activity logging
  try {
    if (req.user?._id) {
      await Activity.create({
        organizationId: req.organizationId,
        actorId: req.user._id,
        action: 'data_source.deleted',
        entityType: 'data_source',
        entityId: dataSource._id,
        metadata: {
          name: dataSource.name,
          type: dataSource.type
        }
      });
    }
  } catch (actErr) {
    logger.warn(`[Activity] Failed to record data_source.deleted: ${actErr.message}`);
  }

  return sendSuccess(
    res,
    { id: dataSource._id, status: 'INACTIVE', isDeleted: true },
    {},
    200,
    'Data source deactivated successfully'
  );
}

export async function testDataSourceConnection(req, res) {
  try {
    const result = await ConnectorService.testConnection(req.params.id, req.organizationId, {
      actor: req.user
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        status: 'connected',
        diagnostic: {
          hasRequiredSecrets: true
        },
        data: {
          id: req.params.id,
          status: 'connected',
          healthStatus: result.status,
          latencyMs: result.latencyMs,
          checkedAt: result.checkedAt,
          details: result.details,
          diagnostic: {
            hasRequiredSecrets: true
          }
        },
        error: null,
        meta: { timestamp: new Date().toISOString() }
      });
    } else {
      return res.status(200).json({
        success: false,
        status: 'error',
        diagnostic: {
          hasRequiredSecrets: true
        },
        data: {
          id: req.params.id,
          status: 'error',
          healthStatus: result.status,
          latencyMs: result.latencyMs,
          checkedAt: result.checkedAt,
          error: result.error,
          details: result.details,
          diagnostic: {
            hasRequiredSecrets: true
          }
        },
        error: {
          code: 'CONNECTION_FAILED',
          message: result.error
        },
        meta: { timestamp: new Date().toISOString() }
      });
    }
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'NOT_FOUND') {
      return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Data source not found or does not belong to this organization', 404);
    }
    if (err.statusCode === 429 || err.code === 'CONNECTION_TEST_IN_PROGRESS') {
      return sendError(res, 'CONNECTION_TEST_IN_PROGRESS', err.message, 429);
    }
    return sendError(res, err.code || 'CONNECTION_TEST_ERROR', err.message, err.statusCode || 500);
  }
}

export async function rotateDataSourceKey(req, res) {
  const { targetKeyId } = req.body || {};

  const dataSource = await DataSource.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    isDeleted: { $ne: true }
  }).select('+credentials.encryptedData +credentials.keyId');

  if (!dataSource) {
    return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Data source not found or does not belong to this organization', 404);
  }

  if (!dataSource.credentials?.encryptedData) {
    return sendError(res, 'NO_CREDENTIALS', 'Data source has no encrypted credentials to rotate', 400);
  }

  // Rotate credentials to target key version without plaintext exposure
  dataSource.rotateCredentials(targetKeyId || null);
  dataSource.updatedBy = req.user?._id;
  await dataSource.save();

  return sendSuccess(
    res,
    { credentialStatus: 'configured' },
    {},
    200,
    'Data source credentials successfully rotated to new encryption key version',
    { credentialStatus: 'configured' }
  );
}

/**
 * Discover and introspect metadata from the data source using its connector.
 */
export async function discoverDataSourceMetadata(req, res) {
  const { id } = req.params;
  const { schema } = req.body || {};

  const startHr = process.hrtime.bigint();
  try {
    const metadata = await ConnectorService.fetchMetadata(id, req.organizationId, {
      schema
    });

    const endHr = process.hrtime.bigint();
    const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

    const tables = metadata.tables || [];
    const tablesCount = tables.filter((t) => t.type === 'table').length;
    const viewsCount = tables.filter((t) => t.type === 'view').length;
    const columnsCount = tables.reduce((acc, t) => acc + (t.columns?.length || 0), 0);

    return sendSuccess(
      res,
      {
        dataSourceId: id,
        sourceType: metadata.sourceType,
        database: metadata.database,
        schema: metadata.schema,
        schemas: metadata.schemas,
        counts: {
          tablesCount,
          viewsCount,
          columnsCount,
          totalAssets: tables.length
        },
        durationMs,
        discoveredAt: new Date().toISOString(),
        assets: tables.map((t) => ({
          externalId: t.externalId,
          name: t.name,
          schema: t.schema,
          type: t.type,
          columnCount: t.columns?.length || 0,
          primaryKey: t.primaryKey,
          foreignKeyCount: t.foreignKeys?.length || 0,
          indexCount: t.indexes?.length || 0,
          columns: t.columns
        })),
        tables: tables.map((t) => ({
          externalId: t.externalId,
          name: t.name,
          schema: t.schema,
          type: t.type,
          columnCount: t.columns?.length || 0,
          primaryKey: t.primaryKey,
          foreignKeyCount: t.foreignKeys?.length || 0,
          indexCount: t.indexes?.length || 0,
          columns: t.columns
        }))
      },
      {},
      200,
      'Metadata discovery completed successfully'
    );
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'NOT_FOUND') {
      return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Data source not found or does not belong to this organization', 404);
    }
    return sendError(res, err.code || 'DISCOVERY_ERROR', err.message, err.statusCode || 500);
  }
}

/**
 * Synchronize live data source catalog into RicozData datasets,
 * detect schema drift, and record synchronization history.
 */
export async function syncDataSourceCatalog(req, res) {
  const { id } = req.params;

  try {
    const result = await CatalogSyncService.synchronize(id, req.organizationId, {
      actor: req.user
    });

    return sendSuccess(res, result, {}, 200, 'Catalog synchronization completed successfully');
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'NOT_FOUND') {
      return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Data source not found or does not belong to this organization', 404);
    }
    if (err.statusCode === 429 || err.code === 'SYNC_IN_PROGRESS') {
      return sendError(res, 'SYNC_IN_PROGRESS', err.message, 429);
    }
    return sendError(res, err.code || 'SYNC_ERROR', err.message, err.statusCode || 500);
  }
}


