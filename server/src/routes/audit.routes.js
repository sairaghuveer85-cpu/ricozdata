import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);

router.get(
  '/',
  requirePermission(PERMISSIONS.ACTIVITIES_READ),
  asyncHandler(getAuditLogs)
);

export default router;
