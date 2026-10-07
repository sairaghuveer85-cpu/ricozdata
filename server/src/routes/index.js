import { Router } from 'express';
import healthRoutes from './health.routes.js';
import organizationRoutes from './organization.routes.js';
import userRoutes from './user.routes.js';
import authRoutes from './auth.routes.js';
import dataSourceRoutes from './dataSource.routes.js';

import v1Routes from './v1/index.js';
import datasetRoutes from './dataset.routes.js';
import searchRoutes from './search.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import qualityRoutes from './quality.routes.js';
import lineageRoutes from './lineage.routes.js';
import glossaryRoutes from './glossary.routes.js';
import governanceRoutes from './governance.routes.js';
import auditRoutes from './audit.routes.js';
import jobRoutes from './job.routes.js';

const router = Router();

// Base API information endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    name: 'RicozData Enterprise API',
    version: '1.0.0',
    description: 'Enterprise Data Governance and Intelligence Platform',
    currentVersion: '/api/v1',
    endpoints: {
      v1: '/api/v1',
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      organizations: '/api/v1/organizations',
      dataSources: '/api/v1/data-sources',
      datasets: '/api/v1/datasets',
      quality: '/api/v1/quality',
      lineage: '/api/v1/lineage',
      glossary: '/api/v1/glossary',
      governance: '/api/v1/governance',
      auditLogs: '/api/v1/audit-logs',
      jobs: '/api/v1/jobs',
      search: '/api/v1/search',
      dashboard: '/api/v1/dashboard',
      docs: '/api/v1/docs'
    }
  });
});

// Primary Version 1 API
router.use('/v1', v1Routes);

// Thin backwards-compatibility routing for legacy unversioned /api endpoints
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/users', userRoutes);
router.use('/data-sources', dataSourceRoutes);
router.use('/datasets', datasetRoutes);
router.use('/quality', qualityRoutes);
router.use('/lineage', lineageRoutes);
router.use('/glossary', glossaryRoutes);
router.use('/governance', governanceRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/audit', auditRoutes);
router.use('/jobs', jobRoutes);
router.use('/search', searchRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
