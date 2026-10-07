import { BadRequestError } from '../utils/errors.js';

/**
 * Enterprise Query Service for RicozData.
 * Implements centralized query parsing for pagination, sorting allowlists,
 * safe multi-field filtering, and regex-injection-protected tenant-scoped search.
 */

const DEFAULT_PAGINATION_LIMIT = 25;
const MAX_PAGINATION_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;

/**
 * Parses and validates pagination query parameters.
 *
 * @param {Object} query - Express req.query
 * @param {number} [defaultLimit=25]
 * @param {number} [maxLimit=100]
 * @returns {{ page: number, limit: number, skip: number }}
 */
export function parsePagination(query = {}, defaultLimit = DEFAULT_PAGINATION_LIMIT, maxLimit = MAX_PAGINATION_LIMIT) {
  let page = 1;
  let limit = defaultLimit;

  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new BadRequestError('Invalid "page" parameter. Must be a positive integer greater than or equal to 1.');
    }
    page = parsedPage;
  }

  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const parsedLimit = Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestError('Invalid "limit" parameter. Must be a positive integer.');
    }
    if (parsedLimit > maxLimit) {
      throw new BadRequestError(`"limit" exceeds maximum permitted value of ${maxLimit}.`);
    }
    limit = parsedLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Computes standard pagination metadata object.
 *
 * @param {number} total - Total count of matching records
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {{ page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean }}
 */
export function buildPaginationMeta(total, page, limit) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / limit));

  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

/**
 * Validates and normalizes sort parameters against an explicit allowlist.
 * Prevents arbitrary MongoDB path injection or prototype pollution.
 * Supports:
 *   - "createdAt:desc"
 *   - "name:asc,createdAt:desc"
 *   - "-createdAt" (desc) or "+name" (asc)
 *
 * @param {string} [sortParam]
 * @param {string[]} [allowedFields=['createdAt', 'updatedAt', 'name', 'status', 'type']]
 * @param {Object} [defaultSort={ createdAt: -1 }]
 * @returns {Record<string, 1|-1>}
 */
export function parseSort(sortParam, allowedFields = ['createdAt', 'updatedAt', 'name', 'status', 'type'], defaultSort = { createdAt: -1 }) {
  if (!sortParam || typeof sortParam !== 'string' || !sortParam.trim()) {
    return defaultSort;
  }

  const sortObj = {};
  const segments = sortParam.split(',').map(s => s.trim()).filter(Boolean);

  for (const segment of segments) {
    let field = segment;
    let direction = 1;

    // Check format: field:asc / field:desc
    if (segment.includes(':')) {
      const [f, dir] = segment.split(':').map(p => p.trim().toLowerCase());
      field = f;
      direction = dir === 'desc' ? -1 : 1;
    } else if (segment.startsWith('-')) {
      field = segment.slice(1).trim();
      direction = -1;
    } else if (segment.startsWith('+')) {
      field = segment.slice(1).trim();
      direction = 1;
    }

    // Strict security check: reject unauthorized fields or prototype pollution attempts
    if (!allowedFields.includes(field)) {
      throw new BadRequestError(
        `Invalid sort field "${field}". Allowed sort fields are: [${allowedFields.join(', ')}]`
      );
    }

    if (field.startsWith('$') || field.includes('.')) {
      throw new BadRequestError(`Unsafe sort field path: "${field}"`);
    }

    sortObj[field] = direction;
  }

  return Object.keys(sortObj).length > 0 ? sortObj : defaultSort;
}

/**
 * Safely parses and sanitizes multi-field filter inputs.
 * Blocks all MongoDB query operator injection ($where, $ne, $regex, etc.).
 *
 * @param {Object} query - Express req.query
 * @param {Record<string, { type: 'string'|'number'|'boolean'|'date'|'enum', values?: string[] }>} allowedFilters
 * @returns {Object} Clean MongoDB filter criteria
 */
export function parseFilters(query = {}, allowedFilters = {}) {
  const criteria = {};
  // Check for filter object: query.filter[field] or direct query[field]
  const rawFilterInput = (query.filter && typeof query.filter === 'object') ? query.filter : {};

  for (const [fieldName, config] of Object.entries(allowedFilters)) {
    // Value could come from filter[fieldName] or query[fieldName]
    const rawValue = rawFilterInput[fieldName] !== undefined ? rawFilterInput[fieldName] : query[fieldName];

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }

    // Security check: Reject if rawValue is an unhandled object containing MongoDB operator keys
    if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      const keys = Object.keys(rawValue);
      for (const k of keys) {
        if (k.startsWith('$')) {
          throw new BadRequestError(`Disallowed MongoDB operator "${k}" in filter field "${fieldName}"`);
        }
      }

      // Check for range filters: filter[createdAt][gte], filter[createdAt][lte]
      if (config.type === 'date' || config.type === 'number') {
        const rangeCondition = {};
        if (rawValue.gte !== undefined) {
          rangeCondition.$gte = config.type === 'date' ? new Date(rawValue.gte) : Number(rawValue.gte);
        }
        if (rawValue.gt !== undefined) {
          rangeCondition.$gt = config.type === 'date' ? new Date(rawValue.gt) : Number(rawValue.gt);
        }
        if (rawValue.lte !== undefined) {
          rangeCondition.$lte = config.type === 'date' ? new Date(rawValue.lte) : Number(rawValue.lte);
        }
        if (rawValue.lt !== undefined) {
          rangeCondition.$lt = config.type === 'date' ? new Date(rawValue.lt) : Number(rawValue.lt);
        }
        if (Object.keys(rangeCondition).length > 0) {
          criteria[fieldName] = rangeCondition;
          continue;
        }
      }

      throw new BadRequestError(`Invalid nested object for filter field "${fieldName}"`);
    }

    // Type normalization & validation
    if (config.type === 'boolean') {
      criteria[fieldName] = rawValue === 'true' || rawValue === true;
    } else if (config.type === 'number') {
      const num = Number(rawValue);
      if (isNaN(num)) {
        throw new BadRequestError(`Filter field "${fieldName}" must be a valid number`);
      }
      criteria[fieldName] = num;
    } else if (config.type === 'enum') {
      const strVal = String(rawValue).trim().toLowerCase();
      if (config.values && !config.values.includes(strVal)) {
        throw new BadRequestError(
          `Invalid value "${strVal}" for filter "${fieldName}". Permitted: [${config.values.join(', ')}]`
        );
      }
      criteria[fieldName] = strVal;
    } else if (config.type === 'date') {
      const d = new Date(rawValue);
      if (isNaN(d.getTime())) {
        throw new BadRequestError(`Filter field "${fieldName}" must be a valid ISO date string`);
      }
      criteria[fieldName] = d;
    } else {
      // String
      criteria[fieldName] = String(rawValue).trim();
    }
  }

  return criteria;
}

/**
 * Escapes regex special characters to prevent ReDoS or query injection.
 *
 * @param {string} str
 * @returns {string} Escaped string
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds safe, tenant-scoped search criteria for MongoDB queries.
 *
 * @param {string} searchInput - Search term from client
 * @param {string[]} searchFields - Allowed search field paths
 * @param {string|import('mongoose').Types.ObjectId} organizationId - Tenant ID
 * @returns {Object} MongoDB query filter with strict tenant scoping
 */
export function buildSearchFilter(searchInput, searchFields = ['name', 'description'], organizationId) {
  if (!organizationId) {
    throw new BadRequestError('Tenant organizationId is required to construct search filter');
  }

  const baseFilter = { organizationId };

  if (!searchInput || typeof searchInput !== 'string' || !searchInput.trim()) {
    return baseFilter;
  }

  const trimmed = searchInput.trim();
  if (trimmed.length > MAX_SEARCH_LENGTH) {
    throw new BadRequestError(`Search query exceeds maximum length of ${MAX_SEARCH_LENGTH} characters`);
  }

  const escaped = escapeRegex(trimmed);
  const regex = new RegExp(escaped, 'i');

  baseFilter.$or = searchFields.map(field => ({ [field]: regex }));

  return baseFilter;
}

export default {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  parseFilters,
  buildSearchFilter,
  escapeRegex
};
