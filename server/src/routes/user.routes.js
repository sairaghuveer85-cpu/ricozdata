import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import invitationController from '../controllers/invitation.controller.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { enforcePayloadIsolation } from '../middleware/tenantIsolation.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

import { validateRequest } from '../middleware/validate.js';
import {
  userIdParamSchema,
  inviteUserSchema,
  acceptInviteSchema,
  updateUserRoleSchema,
  updateUserStatusSchema
} from '../schemas/user.schema.js';

const router = Router();

// ==============================================================================
// 1. Public / Token-scoped Acceptance Endpoint
// (Does not require prior tenant session - token securely resolves the tenant)
// ==============================================================================
router.post('/invitations/:token/accept', validateRequest(acceptInviteSchema), invitationController.acceptInvitation);

// ==============================================================================
// 2. Tenant-scoped User & Invitation Management
// All endpoints below this middleware strictly require an active tenant context
// ==============================================================================
router.use(requireTenant);

// User profile endpoints for current caller
router.get('/me', userController.getMe);
router.patch('/me', enforcePayloadIsolation, userController.updateMe);

// Team invitation endpoints
router.post('/invitations', requirePermission(PERMISSIONS.USERS_CREATE), enforcePayloadIsolation, validateRequest(inviteUserSchema), invitationController.createInvitation);
router.get('/invitations', requirePermission(PERMISSIONS.USERS_READ), invitationController.listInvitations);
router.delete('/invitations/:id', requirePermission(PERMISSIONS.USERS_DELETE), invitationController.revokeInvitation);

// Organization member management endpoints
router.get('/', requirePermission(PERMISSIONS.USERS_READ), userController.listUsers);
router.get('/:id', validateRequest(userIdParamSchema), requirePermission(PERMISSIONS.USERS_READ), userController.getUserById);
router.patch('/:id', validateRequest(userIdParamSchema), requirePermission(PERMISSIONS.USERS_UPDATE), enforcePayloadIsolation, userController.updateUser);
router.patch('/:id/status', validateRequest(updateUserStatusSchema), requirePermission(PERMISSIONS.USERS_SUSPEND), enforcePayloadIsolation, userController.updateUserStatus);
router.patch('/:id/role', validateRequest(updateUserRoleSchema), requirePermission(PERMISSIONS.USERS_MANAGE_ROLES), enforcePayloadIsolation, userController.updateUserRole);
router.delete('/:id', validateRequest(userIdParamSchema), requirePermission(PERMISSIONS.USERS_DELETE), userController.deleteUser);

export default router;
