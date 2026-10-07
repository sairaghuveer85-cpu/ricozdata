import { Router } from 'express';
import {
  getDashboardSummary,
  getDataSourceMetrics,
  getQualityMetrics,
  getAlerts,
  getRecentActivity,
  getQualityOverview,
  getHighDemandDatasets
} from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Protect all dashboard routes with authentication and tenant context
router.use(requireAuth);
router.use(requireTenant);

router.get(
  '/summary',
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  asyncHandler(getDashboardSummary)
);

router.get(
  '/data-sources',
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  asyncHandler(getDataSourceMetrics)
);

router.get(
  '/quality',
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  asyncHandler(getQualityMetrics)
);

router.get(
  '/quality-overview',
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  asyncHandler(getQualityOverview)
);

router.get(
  '/alerts',
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  asyncHandler(getAlerts)
);

router.get(
  '/activity',
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  asyncHandler(getRecentActivity)
);

router.get(
  '/high-demand',
  requirePermission(PERMISSIONS.ORGANIZATION_READ),
  asyncHandler(getHighDemandDatasets)
);

export default router;

