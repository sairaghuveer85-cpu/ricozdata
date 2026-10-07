/**
 * Centralized Enterprise API Response Envelope Utilities for RicozData.
 * Standardizes successful and error response structures across all endpoints.
 *
 * Success Envelope:
 * {
 *   "success": true,
 *   "data": {},
 *   "error": null,
 *   "meta": {}
 * }
 *
 * Error Envelope:
 * {
 *   "success": false,
 *   "data": null,
 *   "error": {
 *     "code": "...",
 *     "message": "...",
 *     "details": {}
 *   },
 *   "meta": {}
 * }
 */

/**
 * Sends a standardized success JSON response.
 *
 * @param {import('express').Response} res
 * @param {*} [data={}] - Response payload
 * @param {Object} [meta={}] - Pagination, filtering, or system metadata
 * @param {number} [statusCode=200] - HTTP status code
 * @param {string} [message=null] - Optional human-readable message
 * @returns {import('express').Response}
 */
export function sendSuccess(res, data = {}, meta = {}, statusCode = 200, message = null, extra = {}) {
  const envelope = {
    success: true,
    data: data !== undefined ? data : {},
    error: null,
    meta: meta || {},
    ...extra
  };

  if (message) {
    envelope.message = message;
  }

  return res.status(statusCode).json(envelope);
}

/**
 * Sends a standardized paginated success JSON response.
 *
 * @param {import('express').Response} res
 * @param {Array} data - Array of paginated items
 * @param {Object} pagination - Pagination metadata { page, limit, total, totalPages, hasNextPage, hasPreviousPage }
 * @param {Object} [meta={}] - Additional metadata
 * @param {number} [statusCode=200]
 * @param {Object} [extra={}]
 * @returns {import('express').Response}
 */
export function sendPaginated(res, data = [], pagination = {}, meta = {}, statusCode = 200, extra = {}) {
  return res.status(statusCode).json({
    success: true,
    data: Array.isArray(data) ? data : [],
    error: null,
    meta: {
      pagination,
      ...meta
    },
    ...extra
  });
}

/**
 * Sends a standardized error JSON response.
 *
 * @param {import('express').Response} res
 * @param {string} code - Stable error code string (e.g. 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param {string} message - Human-readable error message
 * @param {number} [statusCode=400] - HTTP status code
 * @param {Object|Array} [details={}] - Additional structured diagnostic details
 * @param {Object} [meta={}] - Additional metadata
 * @param {Object} [extra={}] - Extra properties for backwards compatibility
 * @returns {import('express').Response}
 */
export function sendError(res, code = 'BAD_REQUEST', message = 'Request could not be processed', statusCode = 400, details = {}, meta = {}, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      details: details || {}
    },
    meta: meta || {},
    message, // Backward compatibility for legacy tests asserting res.body.message
    ...extra
  });
}

/**
 * Express middleware that decorates `res` with helper methods:
 * `res.sendSuccess(data, meta, statusCode, message)`
 * `res.sendPaginated(data, pagination, meta, statusCode)`
 * `res.sendError(code, message, statusCode, details, meta)`
 */
export function responseDecorator(req, res, next) {
  res.sendSuccess = (data, meta, statusCode, message) => sendSuccess(res, data, meta, statusCode, message);
  res.sendPaginated = (data, pagination, meta, statusCode) => sendPaginated(res, data, pagination, meta, statusCode);
  res.sendError = (code, message, statusCode, details, meta) => sendError(res, code, message, statusCode, details, meta);
  next();
}

export default {
  sendSuccess,
  sendPaginated,
  sendError,
  responseDecorator
};
