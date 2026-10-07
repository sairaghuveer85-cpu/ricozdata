import { Router } from 'express';
import { unifiedSearch } from '../controllers/search.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Protect all search routes with authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

// Unified search across datasets and data sources
router.get(
  '/',
  requirePermission(PERMISSIONS.CATALOG_READ),
  asyncHandler(unifiedSearch)
);

export default router;
