import { Router } from 'express';
import {
  createDataSource,
  getDataSources,
  getDataSourceById,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  rotateDataSourceKey,
  discoverDataSourceMetadata,
  syncDataSourceCatalog
} from '../controllers/dataSource.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import {
  dataSourceIdParamSchema,
  createDataSourceSchema,
  updateDataSourceSchema
} from '../schemas/dataSource.schema.js';

const router = Router();

// Protect all DataSource routes with authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Data source CRUD and security operations
router.post(
  '/',
  requirePermission(PERMISSIONS.DATA_SOURCES_CREATE),
  validateRequest(createDataSourceSchema),
  asyncHandler(createDataSource)
);

router.get(
  '/',
  requirePermission(PERMISSIONS.DATA_SOURCES_READ),
  asyncHandler(getDataSources)
);

router.get(
  '/:id',
  validateRequest(dataSourceIdParamSchema),
  requirePermission(PERMISSIONS.DATA_SOURCES_READ),
  asyncHandler(getDataSourceById)
);

router.patch(
  '/:id',
  validateRequest(updateDataSourceSchema),
  requirePermission(PERMISSIONS.DATA_SOURCES_UPDATE),
  asyncHandler(updateDataSource)
);

router.delete(
  '/:id',
  validateRequest(dataSourceIdParamSchema),
  requirePermission(PERMISSIONS.DATA_SOURCES_DELETE),
  asyncHandler(deleteDataSource)
);

// Trusted test connection execution boundary
router.post(
  '/:id/test',
  validateRequest(dataSourceIdParamSchema),
  requirePermission(PERMISSIONS.DATA_SOURCES_TEST),
  asyncHandler(testDataSourceConnection)
);

// Metadata discovery endpoint
router.post(
  '/:id/discover',
  validateRequest(dataSourceIdParamSchema),
  requirePermission(PERMISSIONS.DATA_SOURCES_UPDATE),
  asyncHandler(discoverDataSourceMetadata)
);

// Catalog synchronization endpoint
router.post(
  '/:id/sync',
  validateRequest(dataSourceIdParamSchema),
  requirePermission(PERMISSIONS.DATA_SOURCES_UPDATE),
  asyncHandler(syncDataSourceCatalog)
);

// Explicit key rotation endpoint
router.post(
  '/:id/rotate-key',
  validateRequest(dataSourceIdParamSchema),
  requirePermission(PERMISSIONS.DATA_SOURCES_UPDATE),
  asyncHandler(rotateDataSourceKey)
);

export default router;
