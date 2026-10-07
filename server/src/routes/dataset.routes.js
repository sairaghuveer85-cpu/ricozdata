import { Router } from 'express';
import {
  createDataset,
  getDatasets,
  getDatasetById,
  updateDataset,
  deleteDataset,
  triggerDatasetProfile,
  getLatestDatasetProfile,
  getDatasetProfileHistory,
  executeDatasetQuery,
  getDatasetPreview
} from '../controllers/dataset.controller.js';
import { getDatasetLineage } from '../controllers/lineage.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import {
  datasetIdParamSchema,
  createDatasetSchema,
  updateDatasetSchema,
  queryDatasetSchema
} from '../schemas/dataset.schema.js';

const router = Router();

// Protect all dataset routes with authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

router.post(
  '/',
  requirePermission(PERMISSIONS.DATASETS_CREATE),
  validateRequest(createDatasetSchema),
  asyncHandler(createDataset)
);

router.get(
  '/',
  requirePermission(PERMISSIONS.DATASETS_READ),
  asyncHandler(getDatasets)
);

// Profiling routes
router.post(
  '/:id/profile',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_MANAGE),
  asyncHandler(triggerDatasetProfile)
);

router.get(
  '/:id/profile',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getLatestDatasetProfile)
);

router.get(
  '/:id/profile/history',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.QUALITY_READ),
  asyncHandler(getDatasetProfileHistory)
);

// Dataset Lineage graph
router.get(
  '/:id/lineage',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.LINEAGE_READ),
  asyncHandler(getDatasetLineage)
);

// Interactive safe read-only SQL studio query
router.post(
  '/:id/query',
  validateRequest(queryDatasetSchema),
  requirePermission(PERMISSIONS.DATASETS_READ),
  asyncHandler(executeDatasetQuery)
);

// Live bounded data preview
router.get(
  '/:id/preview',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.DATASETS_READ),
  asyncHandler(getDatasetPreview)
);

router.get(
  '/:id',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.DATASETS_READ),
  asyncHandler(getDatasetById)
);

router.patch(
  '/:id',
  validateRequest(updateDatasetSchema),
  requirePermission(PERMISSIONS.DATASETS_UPDATE),
  asyncHandler(updateDataset)
);

router.delete(
  '/:id',
  validateRequest(datasetIdParamSchema),
  requirePermission(PERMISSIONS.DATASETS_DELETE),
  asyncHandler(deleteDataset)
);

export default router;
