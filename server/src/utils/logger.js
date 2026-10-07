/**
 * Production-ready structured logger for RicozData platform.
 * Provides leveled logging, ISO timestamps, request correlation,
 * and rigorous secret redaction.
 */

const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  http: 4,
  debug: 5
};

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'secret',
  'jwt_secret',
  'jwtsecret',
  'token',
  'refreshtoken',
  'authorization',
  'apikey',
  'encrypteddata',
  'credentials',
  'credential',
  'connectionurl'
];

/**
 * Deep recursive secret scrubber
 */
function sanitizeMeta(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      code: obj.code,
      stack: process.env.NODE_ENV === 'production' ? undefined : obj.stack
    };
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeMeta(item));
  }

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase().replace(/[^a-z]/g, '');
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
      clean[k] = '***REDACTED***';
    } else if (v && typeof v === 'object') {
      clean[k] = sanitizeMeta(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

const currentLevel = () => {
  const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase();
  return LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.info;
};

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Formats log messages: emits single-line JSON in production, formatted text in development
 */
const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const sanitized = sanitizeMeta(meta);

  if (isProduction()) {
    const logObj = {
      timestamp,
      level,
      message,
      service: 'ricozdata-backend',
      environment: process.env.NODE_ENV || 'production',
      correlationId: sanitized?.correlationId || sanitized?.requestId || undefined,
      organizationId: sanitized?.organizationId || undefined,
      actorId: sanitized?.actorId || undefined,
      route: sanitized?.route || sanitized?.path || undefined,
      method: sanitized?.method || undefined,
      statusCode: sanitized?.statusCode || undefined,
      durationMs: sanitized?.durationMs || undefined,
      ...(typeof sanitized === 'object' && sanitized !== null ? sanitized : {})
    };
    return JSON.stringify(logObj);
  }

  // Development/Test formatted string
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (meta instanceof Error) {
    return `${prefix}: ${message}\n${meta.stack || meta.message}`;
  }
  if (meta && Object.keys(meta).length > 0) {
    try {
      return `${prefix}: ${message} ${JSON.stringify(sanitized)}`;
    } catch {
      return `${prefix}: ${message}`;
    }
  }
  return `${prefix}: ${message}`;
};

export const logger = {
  fatal: (message, meta) => {
    if (currentLevel() >= LOG_LEVELS.fatal) {
      console.error(formatMessage('fatal', message, meta));
    }
  },
  error: (message, meta) => {
    if (currentLevel() >= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
  warn: (message, meta) => {
    if (currentLevel() >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  info: (message, meta) => {
    if (currentLevel() >= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },
  http: (message, meta) => {
    if (currentLevel() >= LOG_LEVELS.http) {
      console.log(formatMessage('http', message, meta));
    }
  },
  debug: (message, meta) => {
    if (currentLevel() >= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  }
};

export default logger;
