import { Router } from 'express';
import healthRoutes from '../health.routes.js';
import authRoutes from '../auth.routes.js';
import organizationRoutes from '../organization.routes.js';
import userRoutes from '../user.routes.js';
import dataSourceRoutes from '../dataSource.routes.js';
import datasetRoutes from '../dataset.routes.js';
import searchRoutes from '../search.routes.js';
import dashboardRoutes from '../dashboard.routes.js';
import docsRoutes from '../docs.routes.js';
import qualityRoutes from '../quality.routes.js';
import lineageRoutes from '../lineage.routes.js';
import glossaryRoutes from '../glossary.routes.js';
import governanceRoutes from '../governance.routes.js';
import auditRoutes from '../audit.routes.js';
import jobRoutes from '../job.routes.js';

const router = Router();

// Version 1 Root Information
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'RicozData API v1',
      version: '1.0.0',
      description: 'Enterprise Data Governance Platform v1 Endpoints',
      endpoints: {
        health: '/api/v1/health',
        readiness: '/api/v1/health/ready',
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
    },
    error: null,
    meta: {
      version: 'v1',
      status: 'active'
    }
  });
});

// Mount Version 1 Sub-Routers
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
router.use('/docs', docsRoutes);

// Catalog sync alias
router.post('/catalog/sync/:id', (req, res, next) => {
  req.url = `/${req.params.id}/sync`;
  return dataSourceRoutes(req, res, next);
});

export default router;
