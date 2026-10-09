// RicozData Enterprise Governance Server - Phase 8 Ready
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { seedData } = require('./seed/seed');
const Dataset = require('./models/Dataset');

const path = require('path');

// Load environment variables from server root and cwd
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const app = express();

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow API consumers flexibility
    crossOriginEmbedderPolicy: false,
  })
);

// Body parser with safe limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Parse allowed CORS origins
const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173';
const configuredOrigins = rawClientUrls
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5000',
];

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
  ? configuredOrigins
  : Array.from(new Set([...configuredOrigins, ...defaultDevOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin) || (!isProduction && /^http:\/\/localhost:\d+$/.test(origin))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS policy rejection: Origin ${origin} not permitted`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

const isDevOrTest = process.env.NODE_ENV !== 'production';

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || (isDevOrTest ? 2000 : 300),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDevOrTest && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || (isDevOrTest ? 500 : 30),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDevOrTest && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
});

app.use(['/api', '/api/v1'], apiLimiter);
app.use(['/api/auth/login', '/api/v1/auth/login'], authLimiter);
app.use(['/api/auth/register', '/api/v1/auth/register'], authLimiter);

// Health check endpoint (Public, does not expose secrets)
const healthHandler = (req, res) => {
  res.status(200).json({
    success: true,
    status: 'operational',
    service: 'RicozData Enterprise Governance API',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
};
app.get(['/api/health', '/api/v1/health'], healthHandler);

// Mount application routers under both /api and /api/v1 for complete version compatibility
const authRoutes = require('./routes/auth');
const datasetRoutes = require('./routes/datasets');
const qualityRoutes = require('./routes/quality');
const lineageRoutes = require('./routes/lineage');
const glossaryRoutes = require('./routes/glossary');
const policyRoutes = require('./routes/policies');
const activityRoutes = require('./routes/activities');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');
const userRoutes = require('./routes/users');
const dataSourceRoutes = require('./routes/dataSources');
const governanceRuleRoutes = require('./routes/governanceRules');
const governanceFindingRoutes = require('./routes/governanceFindings');
const accessControlRoutes = require('./routes/accessControl');
const complianceRoutes = require('./routes/compliance');

const apiRouters = [
  ['/auth', authRoutes],
  ['/datasets', datasetRoutes],
  ['/quality', qualityRoutes],
  ['/lineage', lineageRoutes],
  ['/glossary', glossaryRoutes],
  ['/policies', policyRoutes],
  ['/governance-rules', governanceRuleRoutes],
  ['/governance-findings', governanceFindingRoutes],
  ['/access-control', accessControlRoutes],
  ['/compliance', complianceRoutes],
  ['/activities', activityRoutes],
  ['/dashboard', dashboardRoutes],
  ['/search', searchRoutes],
  ['/users', userRoutes],
  ['/data-sources', dataSourceRoutes],
];

for (const [subPath, router] of apiRouters) {
  app.use(`/api${subPath}`, router);
  app.use(`/api/v1${subPath}`, router);
}

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

// Connect to database and start server
connectDB()
  .then(async () => {
    // Never auto-seed demo data on normal startup. Only run if explicitly opted in via AUTO_SEED=true.
    if (process.env.AUTO_SEED === 'true') {
      try {
        const datasetCount = await Dataset.countDocuments();
        if (datasetCount === 0) {
          console.log('AUTO_SEED=true: Running initial idempotent seed...');
          await seedData();
        }
      } catch (seedErr) {
        console.warn('Startup seed check notice:', seedErr.message);
      }
    }

    try {
      const { ensureDefaultOrganization } = require('./services/organizationService');
      await ensureDefaultOrganization();
    } catch (orgErr) {
      console.warn('Initial default organization bootstrap notice:', orgErr.message);
    }

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`Health check available at: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize server:', err.message);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection Error: ${err.message}`);
  if (server) {
    server.close(() => process.exit(1));
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception Error: ${err.message}`);
  if (server) {
    server.close(() => process.exit(1));
  }
});

module.exports = app;
