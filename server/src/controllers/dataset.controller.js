import mongoose from 'mongoose';
import { Dataset } from '../models/Dataset.js';
import { DataSource } from '../models/DataSource.js';
import { Activity } from '../models/Activity.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  parseFilters,
  buildSearchFilter
} from '../services/query.service.js';
import { ProfilingService } from '../services/ProfilingService.js';
import CacheService from '../services/CacheService.js';
import { ConnectorService } from '../connectors/ConnectorService.js';

/**
 * Controller for Enterprise Dataset Catalog Management, CRUD,
 * and Metadata Synchronization.
 */

export async function createDataset(req, res) {
  const {
    name,
    dataSourceId,
    externalId,
    schemaName,
    path,
    description,
    type,
    origin,
    columns,
    tags,
    classification,
    metadata
  } = req.body;

  if (!name || !dataSourceId) {
    return sendError(res, 'VALIDATION_ERROR', 'Name and dataSourceId are required fields for dataset creation', 400);
  }

  // Verify dataSource belongs to this organization and is not deleted
  const dataSource = await DataSource.findOne({
    _id: dataSourceId,
    organizationId: req.organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataSource) {
    return sendError(res, 'DATA_SOURCE_NOT_FOUND', 'Associated data source not found in this organization', 404);
  }

  // Check for duplicate dataset name in the same data source
  const existing = await Dataset.findOne({
    organizationId: req.organizationId,
    dataSourceId,
    name: name.trim(),
    isDeleted: { $ne: true }
  });

  if (existing) {
    return sendError(res, 'DUPLICATE_DATASET', `Dataset "${name}" already exists in this data source`, 409);
  }

  const dataset = await Dataset.create({
    organizationId: req.organizationId,
    dataSourceId,
    externalId: externalId || `${schemaName || 'public'}.${name.trim()}`,
    name: name.trim(),
    schemaName: schemaName || 'public',
    fullyQualifiedName: `${schemaName || 'public'}.${name.trim()}`,
    path: path || '',
    description: description ? description.trim() : '',
    type: type || 'table',
    assetType: type || 'table',
    origin: origin || 'MANUAL',
    syncStatus: 'ACTIVE',
    columns: columns || [],
    schemaMetadata: {
      fields: columns || [],
      rowCount: 0,
      sizeBytes: 0,
      lastSchemaSyncAt: origin === 'DISCOVERED' ? new Date() : null
    },
    tags: tags || [],
    classification: classification || 'internal',
    ownerId: req.user?._id,
    metadata: metadata || {}
  });

  // Activity audit logging
  try {
    if (req.user?._id) {
      await Activity.create({
        organizationId: req.organizationId,
        actorId: req.user._id,
        action: origin === 'DISCOVERED' ? 'dataset.discovered' : 'dataset.created',
        entityType: 'dataset',
        entityId: dataset._id,
        metadata: {
          name: dataset.name,
          dataSourceId: String(dataSourceId),
          type: dataset.type,
          columnCount: dataset.columns.length,
          origin: dataset.origin
        }
      });
    }
  } catch (actErr) {
    logger.warn(`[Activity] Failed to record dataset creation audit: ${actErr.message}`);
  }

  await CacheService.invalidateDashboard(req.organizationId);
  return sendSuccess(res, dataset, {}, 201, 'Dataset created successfully');
}

export async function getDatasets(req, res) {
  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const sort = parseSort(req.query.sort, ['createdAt', 'updatedAt', 'name', 'type', 'syncStatus', 'classification', 'qualityScore.score', 'schemaName'], { createdAt: -1 });
  const filterCriteria = parseFilters(req.query, {
    dataSourceId: { type: 'string' },
    type: { type: 'enum', values: ['table', 'view', 'stream', 'file', 'collection', 'model'] },
    origin: { type: 'enum', values: ['DISCOVERED', 'MANUAL'] },
    syncStatus: { type: 'string' },
    classification: { type: 'string' },
    schemaName: { type: 'string' }
  });

  const filter = {
    organizationId: req.organizationId,
    isDeleted: { $ne: true },
    ...filterCriteria
  };

  const searchTerm = req.query.query || req.query.search;
  if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim()) {
    const searchFilter = buildSearchFilter(searchTerm, ['name', 'description', 'path', 'fullyQualifiedName', 'tags'], req.organizationId);
    if (searchFilter.$or) {
      filter.$or = searchFilter.$or;
    }
  }

  const [total, datasets] = await Promise.all([
    Dataset.countDocuments(filter),
    Dataset.find(filter)
      .populate('dataSourceId', 'name type status healthStatus connectionConfig configuration')
      .populate('ownerId', 'name email role')
      .populate('stewardId', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit)
  ]);

  const paginationMeta = buildPaginationMeta(total, page, limit);

  return sendPaginated(res, datasets, paginationMeta);
}

export async function getDatasetById(req, res) {
  const isObjectId = mongoose.Types.ObjectId.isValid(req.params.id);
  const filter = {
    organizationId: req.organizationId,
    isDeleted: { $ne: true },
    ...(isObjectId
      ? { _id: req.params.id }
      : {
          $or: [
            { externalId: req.params.id },
            { fullyQualifiedName: req.params.id },
            { name: req.params.id }
          ]
        })
  };

  const dataset = await Dataset.findOne(filter)
    .populate('dataSourceId', 'name type status healthStatus connectionConfig configuration')
    .populate('ownerId', 'name email role')
    .populate('stewardId', 'name email role');

  if (!dataset) {
    return sendError(res, 'DATASET_NOT_FOUND', 'Dataset not found or does not belong to this organization', 404);
  }

  return sendSuccess(res, dataset);
}

export async function updateDataset(req, res) {
  const dataset = await Dataset.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataset) {
    return sendError(res, 'DATASET_NOT_FOUND', 'Dataset not found or does not belong to this organization', 404);
  }

  // Immutable source identity protection
  if (req.body.organizationId && String(req.body.organizationId) !== String(dataset.organizationId)) {
    return sendError(res, 'IMMUTABLE_FIELD', 'Cannot modify dataset organizationId', 400);
  }
  if (req.body.dataSourceId && String(req.body.dataSourceId) !== String(dataset.dataSourceId)) {
    return sendError(res, 'IMMUTABLE_FIELD', 'Cannot modify dataset dataSourceId', 400);
  }
  if (req.body.externalId && req.body.externalId !== dataset.externalId) {
    return sendError(res, 'IMMUTABLE_FIELD', 'Cannot modify dataset externalId', 400);
  }

  const { name, description, type, columns, tags, path, classification, metadata } = req.body;

  let metadataChanged = false;

  if (name && name.trim() !== dataset.name) {
    const existing = await Dataset.findOne({
      organizationId: req.organizationId,
      dataSourceId: dataset.dataSourceId,
      name: name.trim(),
      _id: { $ne: dataset._id },
      isDeleted: { $ne: true }
    });
    if (existing) {
      return sendError(res, 'DUPLICATE_DATASET', `Dataset "${name}" already exists in this data source`, 409);
    }
    dataset.name = name.trim();
  }

  if (description !== undefined) dataset.description = description.trim();
  if (type) {
    dataset.type = type;
    dataset.assetType = type;
  }
  if (path !== undefined) dataset.path = path;
  if (tags) dataset.tags = tags;
  if (classification) dataset.classification = classification;
  if (metadata) dataset.metadata = { ...dataset.metadata, ...metadata };

  if (columns && Array.isArray(columns)) {
    dataset.columns = columns;
    dataset.schemaMetadata = {
      ...dataset.schemaMetadata,
      fields: columns,
      lastSchemaSyncAt: new Date()
    };
    metadataChanged = true;
  }

  await dataset.save();

  // Audit activity logging
  try {
    if (req.user?._id) {
      await Activity.create({
        organizationId: req.organizationId,
        actorId: req.user._id,
        action: metadataChanged ? 'dataset.metadata_changed' : 'dataset.updated',
        entityType: 'dataset',
        entityId: dataset._id,
        metadata: {
          name: dataset.name,
          updatedFields: Object.keys(req.body),
          metadataChanged
        }
      });
    }
  } catch (actErr) {
    logger.warn(`[Activity] Failed to record dataset update audit: ${actErr.message}`);
  }

  await CacheService.invalidateDashboard(req.organizationId);
  return sendSuccess(res, dataset, {}, 200, 'Dataset updated successfully');
}

export async function deleteDataset(req, res) {
  const dataset = await Dataset.findOne({
    _id: req.params.id,
    organizationId: req.organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataset) {
    return sendError(res, 'DATASET_NOT_FOUND', 'Dataset not found', 404);
  }

  // Safe deactivation and soft-deletion preserving governance history
  dataset.isDeleted = true;
  dataset.deletedAt = new Date();
  dataset.syncStatus = 'DEPRECATED';
  await dataset.save();

  // Audit activity logging
  try {
    if (req.user?._id) {
      await Activity.create({
        organizationId: req.organizationId,
        actorId: req.user._id,
        action: 'dataset.deleted',
        entityType: 'dataset',
        entityId: dataset._id,
        metadata: {
          name: dataset.name,
          externalId: dataset.externalId,
          dataSourceId: String(dataset.dataSourceId)
        }
      });
    }
  } catch (actErr) {
    logger.warn(`[Activity] Failed to record dataset delete audit: ${actErr.message}`);
  }

  await CacheService.invalidateDashboard(req.organizationId);
  return sendSuccess(res, { id: req.params.id, isDeleted: true }, {}, 200, 'Dataset deactivated successfully');
}

/**
 * POST /api/v1/datasets/:id/profile
 * Trigger statistical data profiling for a dataset.
 */
export async function triggerDatasetProfile(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const profile = await ProfilingService.profileDataset(id, organizationId, {
    actor: req.user
  });

  return sendSuccess(res, profile, {}, 200, 'Dataset profiled successfully');
}

/**
 * GET /api/v1/datasets/:id/profile
 * Get latest statistical profile for a dataset.
 */
export async function getLatestDatasetProfile(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const profile = await ProfilingService.getLatestProfile(id, organizationId);
  if (!profile) {
    return sendError(res, 'NOT_FOUND', 'No profile found for this dataset', 404);
  }

  return sendSuccess(res, profile, {}, 200);
}

/**
 * GET /api/v1/datasets/:id/profile/history
 * Get profiling historical runs.
 */
export async function getDatasetProfileHistory(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const result = await ProfilingService.getProfileHistory(id, organizationId, req.query);
  return sendSuccess(res, result.profiles, result.meta, 200);
}

/**
 * POST /api/v1/datasets/:id/query
  * Execute a safe read-only query against the real data source of the dataset.
  * Supports relational SQL (Postgres, MySQL, SQL Server, Snowflake),
  * document querying for MongoDB, and bounded previews for S3.
  */
export async function executeDatasetQuery(req, res) {
  const { id } = req.params;
  const { query, limit = 50 } = req.body;
  const organizationId = req.organizationId;

  const dataset = await Dataset.findOne({
    _id: id,
    organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataset) {
    return sendError(res, 'NOT_FOUND', 'Dataset not found', 404);
  }

  if (!dataset.dataSourceId) {
    return sendError(res, 'DATASET_NOT_CONNECTED', 'This dataset is not currently connected to a source table.', 400);
  }

  // Verify that the associated DataSource exists and is not deleted
  const dataSource = await DataSource.findOne({
    _id: dataset.dataSourceId,
    organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataSource) {
    return sendError(res, 'DATA_SOURCE_UNAVAILABLE', 'Unable to connect to the configured data source.', 503);
  }

  const tableName = dataset.tableName || dataset.name;
  const options = {
    maxRows: limit,
    timeoutMs: 15000,
    tableName,
    collection: tableName,
    schema: dataset.schemaName
  };

  try {
    const result = await ConnectorService.executeReadOnlyQuery(
      dataset.dataSourceId,
      organizationId,
      query,
      [],
      options
    );

    return sendSuccess(res, result, {}, 200, 'Query executed successfully');
  } catch (err) {
    logger.warn(`[DatasetQuery] Query execution failed for dataset ${id}: ${err.message}`);
    const msg = err.message || '';
    const pgCode = err.details?.pgCode || err.code;

    // 1. Source Table Does Not Exist (PostgreSQL 42P01, SQL Server 208, MySQL ER_NO_SUCH_TABLE)
    if (
      pgCode === '42P01' ||
      err.details?.sqlServerNumber === 208 ||
      err.details?.mysqlCode === 'ER_NO_SUCH_TABLE' ||
      /relation ["']?.*["']? does not exist/i.test(msg) ||
      /table ["']?.*["']? does not exist/i.test(msg) ||
      /Invalid object name/i.test(msg) ||
      /Source table not found/i.test(msg)
    ) {
      const match = msg.match(/relation ["']?([^"']+)["']? does not exist/i) || msg.match(/Invalid object name ['"]?([^'"]+)['"]?/i);
      const matchedTable = match ? match[1] : (dataset.schemaName ? `${dataset.schemaName}.${dataset.name}` : dataset.name);
      return sendError(res, 'SOURCE_TABLE_NOT_FOUND', `Source table not found: ${matchedTable}.`, 404, { tableName: matchedTable });
    }

    // 2. Forbidden SQL / Disallowed statement
    if (err.name === 'ConnectorConfigurationError' && (/read-only/i.test(msg) || /forbidden/i.test(msg) || /multiple/i.test(msg) || /prohibited/i.test(msg) || /disallowed/i.test(msg) || /dangerous/i.test(msg))) {
      return sendError(res, 'FORBIDDEN_SQL', 'Query rejected: only approved read-only statements are allowed.', 403);
    }

    // 3. Invalid SQL syntax (PostgreSQL 42601)
    if (pgCode === '42601' || /syntax error/i.test(msg) || err.name === 'ConnectorConfigurationError') {
      return sendError(res, 'INVALID_SQL', 'Invalid SQL query.', 400, { detail: msg });
    }

    // 4. Query Timeout (PostgreSQL 57014)
    if (err.name === 'ConnectorTimeoutError' || pgCode === '57014' || /statement_timeout/i.test(msg) || /timed out/i.test(msg)) {
      return sendError(res, 'QUERY_TIMEOUT', 'Query timed out.', 504);
    }

    // 5. Permission Error (PostgreSQL 42501)
    if (err.name === 'ConnectorPermissionError' || pgCode === '42501' || /permission denied/i.test(msg)) {
      return sendError(res, 'PERMISSION_ERROR', 'Insufficient permissions on data source to execute query.', 403);
    }

    // 6. Data Source Offline / Connection Failure
    if (err.name === 'ConnectorUnavailableError' || err.name === 'ConnectorAuthenticationError' || /connection/i.test(msg) || /refused/i.test(msg)) {
      return sendError(res, 'CONNECTION_FAILURE', 'Unable to connect to the configured data source.', 503);
    }

    const statusCode = err.statusCode || 500;
    return sendError(res, 'QUERY_EXECUTION_ERROR', msg || 'Query execution failed.', statusCode);
  }
}

/**
 * GET /api/v1/datasets/:id/preview
 * Fetch bounded live data preview for the dataset from its connected source.
 */
export async function getDatasetPreview(req, res) {
  const { id } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const organizationId = req.organizationId;

  const dataset = await Dataset.findOne({
    _id: id,
    organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataset) {
    return sendError(res, 'NOT_FOUND', 'Dataset not found', 404);
  }

  if (!dataset.dataSourceId) {
    return sendError(res, 'DATASET_NOT_CONNECTED', 'This dataset is not currently connected to a source table.', 400);
  }

  const tableName = dataset.tableName || dataset.name;
  try {
    const result = await ConnectorService.sampleData(
      dataset.dataSourceId,
      organizationId,
      {
        tableName,
        collectionName: tableName,
        key: tableName,
        schema: dataset.schemaName,
        limit
      }
    );

    return sendSuccess(res, result, {}, 200, 'Dataset preview loaded successfully');
  } catch (err) {
    logger.warn(`[DatasetPreview] Preview failed for dataset ${id}: ${err.message}`);
    const statusCode = err.statusCode || 500;
    return sendError(res, err.code || 'PREVIEW_ERROR', err.message || 'Failed to load preview from source.', statusCode);
  }
}
