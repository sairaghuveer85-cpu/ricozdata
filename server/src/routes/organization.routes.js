import { Router } from 'express';
import { getMe, updateMe } from '../controllers/organization.controller.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { enforcePayloadIsolation } from '../middleware/tenantIsolation.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = Router();

// All organization management routes require an active tenant context
router.use(requireTenant);

// GET /api/organizations/me or /current - Retrieve current tenant metadata
router.get('/me', requirePermission(PERMISSIONS.ORGANIZATION_READ), getMe);
router.get('/current', requirePermission(PERMISSIONS.ORGANIZATION_READ), getMe);

// PATCH /api/organizations/me or /current - Update current tenant settings with payload isolation
router.patch('/me', requirePermission(PERMISSIONS.ORGANIZATION_UPDATE), enforcePayloadIsolation, updateMe);
router.patch('/current', requirePermission(PERMISSIONS.ORGANIZATION_UPDATE), enforcePayloadIsolation, updateMe);

export default router;
