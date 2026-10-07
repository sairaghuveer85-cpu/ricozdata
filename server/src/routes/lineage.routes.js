import { Router } from 'express';
import {
  createLineage,
  getDatasetLineage,
  getUpstreamLineage,
  getDownstreamLineage,
  deleteLineage
} from '../controllers/lineage.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createLineageEdgeSchema,
  datasetLineageParamSchema,
  lineageIdParamSchema
} from '../schemas/lineage.schema.js';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);

router.post(
  '/',
  validateRequest(createLineageEdgeSchema),
  requirePermission(PERMISSIONS.LINEAGE_MANAGE),
  asyncHandler(createLineage)
);

router.get(
  '/upstream/:id',
  validateRequest(datasetLineageParamSchema),
  requirePermission(PERMISSIONS.LINEAGE_READ),
  asyncHandler(getUpstreamLineage)
);

router.get(
  '/downstream/:id',
  validateRequest(datasetLineageParamSchema),
  requirePermission(PERMISSIONS.LINEAGE_READ),
  asyncHandler(getDownstreamLineage)
);

router.get(
  '/datasets/:id',
  validateRequest(datasetLineageParamSchema),
  requirePermission(PERMISSIONS.LINEAGE_READ),
  asyncHandler(getDatasetLineage)
);

router.delete(
  '/:id',
  validateRequest(lineageIdParamSchema),
  requirePermission(PERMISSIONS.LINEAGE_MANAGE),
  asyncHandler(deleteLineage)
);

export default router;
