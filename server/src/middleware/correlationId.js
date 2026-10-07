import crypto from 'crypto';

const SAFE_CORRELATION_ID_REGEX = /^[a-zA-Z0-9_\-:.]{1,64}$/;

/**
 * Middleware that establishes a traceable correlation ID for every inbound request.
 * Safely accepts valid client-supplied correlation IDs or generates a collision-resistant ID.
 * Prevents log injection and high-cardinality abuse.
 */
export function correlationIdMiddleware(req, res, next) {
  const clientHeader = req.headers['x-correlation-id'] || req.headers['x-request-id'];

  let correlationId = null;

  if (typeof clientHeader === 'string') {
    const trimmed = clientHeader.trim();
    if (SAFE_CORRELATION_ID_REGEX.test(trimmed)) {
      correlationId = trimmed;
    }
  }

  if (!correlationId) {
    correlationId = `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

export default correlationIdMiddleware;
