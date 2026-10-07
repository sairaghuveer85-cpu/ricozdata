import { Dataset } from '../models/Dataset.js';
import { DataSource } from '../models/DataSource.js';
import { sendSuccess } from '../utils/response.js';
import { parsePagination, buildPaginationMeta, parseSort, buildSearchFilter } from '../services/query.service.js';

/**
 * Controller for Unified Enterprise Search across Datasets and Data Sources.
 * Enforces strict multi-tenant isolation, query limits, and safe regex escaping.
 */
export async function unifiedSearch(req, res) {
  const searchTerm = req.query.query || req.query.search || '';
  const searchType = (req.query.type || 'all').toLowerCase();
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sort, ['createdAt', 'updatedAt', 'name', 'type', 'status'], { createdAt: -1 });

  const orgId = req.organizationId;

  // Build safe tenant-scoped search filters
  const dsSearchFilter = buildSearchFilter(searchTerm, ['name', 'type', 'status'], orgId);
  const datasetSearchFilter = buildSearchFilter(searchTerm, ['name', 'description', 'path', 'type'], orgId);

  // Apply filters if provided
  if (req.query.filter && typeof req.query.filter === 'object') {
    if (req.query.filter.status) {
      dsSearchFilter.status = req.query.filter.status;
    }
    if (req.query.filter.type) {
      datasetSearchFilter.type = req.query.filter.type;
      dsSearchFilter.type = req.query.filter.type;
    }
  }

  let datasets = [];
  let dataSources = [];
  let datasetTotal = 0;
  let dataSourceTotal = 0;

  if (searchType === 'dataset' || searchType === 'all') {
    [datasetTotal, datasets] = await Promise.all([
      Dataset.countDocuments(datasetSearchFilter),
      Dataset.find(datasetSearchFilter)
        .populate('dataSourceId', 'name type status')
        .sort(sort)
        .skip(skip)
        .limit(limit)
    ]);
  }

  if (searchType === 'data_source' || searchType === 'all') {
    [dataSourceTotal, dataSources] = await Promise.all([
      DataSource.countDocuments(dsSearchFilter),
      DataSource.find(dsSearchFilter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
    ]);
  }

  // Combine and format results
  const items = [
    ...datasets.map(d => ({
      id: d._id,
      name: d.name,
      entityType: 'dataset',
      type: d.type,
      description: d.description,
      path: d.path,
      tags: d.tags,
      dataSource: d.dataSourceId ? { id: d.dataSourceId._id, name: d.dataSourceId.name } : null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    })),
    ...dataSources.map(ds => ({
      id: ds._id,
      name: ds.name,
      entityType: 'data_source',
      type: ds.type,
      status: ds.status,
      tags: ds.tags,
      credentials: ds.toJSON().credentials, // Redacted credentials metadata
      createdAt: ds.createdAt,
      updatedAt: ds.updatedAt
    }))
  ];

  const totalMatches = datasetTotal + dataSourceTotal;
  const paginationMeta = buildPaginationMeta(totalMatches, page, limit);

  return sendSuccess(res, {
    items,
    counts: {
      datasets: datasetTotal,
      dataSources: dataSourceTotal,
      total: totalMatches
    }
  }, { pagination: paginationMeta });
}
