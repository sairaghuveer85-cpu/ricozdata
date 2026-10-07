import logger from '../utils/logger.js';
import config from '../config/env.js';
import { AppError } from '../utils/errors.js';

/**
 * Production-ready centralized error handling middleware for Express.
 * Formats all exceptions into consistent structured JSON responses.
 */
export function errorHandler(err, req, res, next) {
  // Prevent double sending if headers are already sent
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal server error occurred';
  let details = err.details || null;

  // 1. JSON parsing syntax error in request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON_BODY';
    message = 'Malformed JSON payload provided in request body';
  }

  // 2. Mongoose validation error
  else if (err.name === 'ValidationError' && err.errors) {
    statusCode = 422;
    errorCode = 'VALIDATION_ERROR';
    message = 'Data validation failed';
    details = Object.keys(err.errors).map(field => ({
      field,
      message: err.errors[field].message,
      value: err.errors[field].value
    }));
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_IDENTIFIER';
    message = `Invalid ${err.path || 'identifier'} format provided: "${err.value}"`;
  }

  // 4. MongoDB duplicate key error (code 11000)
  else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY_CONFLICT';
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    message = `A resource with the specified unique field (${fields.join(', ')}) already exists.`;
    details = err.keyValue;
  }

  // 5. Payload too large (413)
  else if (err.type === 'entity.too.large' || err.status === 413) {
    statusCode = 413;
    errorCode = 'PAYLOAD_TOO_LARGE';
    message = 'Request entity too large. Payload exceeds permitted size limit.';
  }

  // 6. Zod validation error
  else if (err.name === 'ZodError' || (err.issues && Array.isArray(err.issues))) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = (err.issues || []).map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }));
  }

  // 7. JWT verification error
  else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid or expired token provided';
  }

  // 8. CORS origin rejection
  else if (err.message && err.message.includes('not permitted by CORS policy')) {
    statusCode = 403;
    errorCode = 'CORS_ORIGIN_DENIED';
    message = err.message;
  }

  // Log error based on severity
  if (statusCode >= 500) {
    logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl} - ${err.message}`, err);
  } else {
    logger.warn(`[Client Error ${statusCode}] ${req.method} ${req.originalUrl} - ${message}`);
  }

  const response = {
    success: false,
    data: null,
    error: {
      code: errorCode,
      message,
      details: details || {}
    },
    meta: {},
    message // Preserved for backwards compatibility with tests asserting res.body.message
  };

  // Stack traces are logged server-side via logger and NEVER leaked in HTTP response envelope

  res.status(statusCode).json(response);
}

export default errorHandler;
