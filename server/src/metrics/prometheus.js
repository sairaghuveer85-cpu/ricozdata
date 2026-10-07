import client from 'prom-client';

// Create a dedicated Prometheus Registry
export const register = new client.Registry();

// Add standard NodeJS default process metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'ricoz_'
});

// HTTP Request Count (Low-cardinality labels only)
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// HTTP Request Duration Histogram
export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// Active In-Flight Requests Gauge
export const httpActiveRequests = new client.Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests currently in-flight',
  registers: [register]
});

// Redis Cache Hits & Misses
export const cacheHitsTotal = new client.Counter({
  name: 'ricoz_cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register]
});

export const cacheMissesTotal = new client.Counter({
  name: 'ricoz_cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register]
});

// Background Queue Metrics
export const queueJobsTotal = new client.Counter({
  name: 'ricoz_queue_jobs_total',
  help: 'Total background jobs processed',
  labelNames: ['job_type', 'status'],
  registers: [register]
});

export const queueJobDurationSeconds = new client.Histogram({
  name: 'ricoz_queue_job_duration_seconds',
  help: 'Duration of background job execution in seconds',
  labelNames: ['job_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

export const queueDepthGauge = new client.Gauge({
  name: 'ricoz_queue_depth',
  help: 'Current depth of queued jobs waiting for execution',
  labelNames: ['queue_name'],
  registers: [register]
});

/**
 * Normalizes HTTP route to avoid high-cardinality label explosion with ObjectIds/UUIDs.
 */
function normalizeRoute(req) {
  if (req.route && req.route.path) {
    const base = req.baseUrl || '';
    return `${base}${req.route.path}`;
  }
  // Strip query string and mask 24-hex MongoDB ObjectIds or UUIDs in path
  const path = req.path || '/';
  return path
    .replace(/[0-9a-fA-F]{24}/g, ':id')
    .replace(/[0-9a-fA-F-]{36}/g, ':uuid')
    .replace(/\/\d+/g, '/:numId');
}

/**
 * Express middleware to record HTTP metrics.
 */
export function prometheusMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/healthz' || req.path === '/readyz') {
    return next();
  }

  httpActiveRequests.inc();
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    httpActiveRequests.dec();
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1_000_000_000;

    const route = normalizeRoute(req);
    const method = req.method;
    const statusCode = String(res.statusCode);

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);
  });

  next();
}

export default {
  register,
  prometheusMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpActiveRequests,
  cacheHitsTotal,
  cacheMissesTotal,
  queueJobsTotal,
  queueJobDurationSeconds,
  queueDepthGauge
};
