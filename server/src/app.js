import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/env.js';
import cookieParser from 'cookie-parser';
import requestLogger from './middleware/requestLogger.js';
import correlationIdMiddleware from './middleware/correlationId.js';
import { prometheusMiddleware } from './metrics/prometheus.js';
import notFoundHandler from './middleware/notFoundHandler.js';
import errorHandler from './middleware/errorHandler.js';
import apiRouter from './routes/index.js';
import healthzRoutes from './routes/healthz.routes.js';
import metricsRoutes from './routes/metrics.routes.js';

import hpp from 'hpp';
import { generalApiLimiter } from './middleware/rateLimiter.js';
import tenantContextMiddleware from './middleware/tenantContext.js';

// Initialize Express application
const app = express();

// Trust proxy configuration: only trust upstream proxy in production
app.set('trust proxy', config.isProduction ? 1 : false);

// Security HTTP headers hardened with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// Cross-Origin Resource Sharing (CORS) configured for frontend
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Whitelist configured client URL, localhost in dev, or same origin
    const allowedOrigins = [
      config.clientUrl,
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];

    if (allowedOrigins.includes(origin) || (config.isDevelopment && (origin.includes('localhost:') || origin.includes('127.0.0.1:')))) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not permitted by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Organization-Id',
    'X-Tenant-Slug',
    'X-Tenant-Id',
    'X-Correlation-ID',
    'X-Request-ID',
    'X-Internal-Secret',
    'X-Caller-Role',
    'X-Caller-Id'
  ]
};

app.use(cors(corsOptions));

// Correlation ID & Prometheus HTTP monitoring early in the pipeline
app.use(correlationIdMiddleware);
app.use(prometheusMiddleware);

// Cookie parsing middleware
app.use(cookieParser());

// HTTP Parameter Pollution (HPP) defense against duplicate query parameters
app.use(hpp({
  whitelist: ['filter', 'sort', 'status', 'role', 'domain', 'tags', 'page', 'limit']
}));

// HTTP request logging
app.use(requestLogger);

// Operational probe routes: /healthz, /readyz, /metrics
app.use('/', healthzRoutes);
app.use('/', metricsRoutes);

// Body parsing middleware with hardened size boundaries
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// General platform API rate limiter
app.use('/api', generalApiLimiter);

// Multi-tenant resolution middleware (resolves req.organizationId, req.organization, req.tenant)
app.use(tenantContextMiddleware());

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'RicozData Platform API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api',
    healthCheck: '/api/health'
  });
});

// API Routes
app.use('/api', apiRouter);

// 404 Handler for unrecognized routes
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

export default app;
