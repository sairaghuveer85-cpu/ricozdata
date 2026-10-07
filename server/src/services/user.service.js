import mongoose from 'mongoose';
import User from '../models/User.js';
import { USER_STATUS, USER_ROLES, isValidStatusTransition } from '../constants/user.js';
import { canAssignRole } from '../constants/permissions.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError
} from '../utils/errors.js';
import CacheService from './CacheService.js';

/**
 * Service managing user accounts, profiles, and lifecycle operations strictly scoped to a tenant.
 */

/**
 * Retrieves a paginated list of users within the specified organization.
 */
export async function getUsers(organizationId, { page = 1, limit = 50, role, status, search } = {}) {
  if (!organizationId) {
    throw new BadRequestError('organizationId is required');
  }

  const filter = { organizationId };

  if (role && Object.values(USER_ROLES).includes(role)) {
    filter.role = role;
  }

  if (status && Object.values(USER_STATUS).includes(status)) {
    filter.status = status;
  }

  if (search && typeof search === 'string') {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: new RegExp(escaped, 'i') },
      { email: new RegExp(escaped, 'i') },
      { department: new RegExp(escaped, 'i') }
    ];
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    User.countDocuments(filter)
  ]);

  return {
    users,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit)
  };
}

/**
 * Retrieves a user by ID strictly within the tenant boundary.
 * Never performs un-scoped findById.
 */
export async function getUserById(organizationId, userId) {
  if (!organizationId || !userId) {
    throw new BadRequestError('organizationId and userId are required');
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new BadRequestError(`Invalid user ID format: "${userId}"`);
  }

  const user = await User.findOne({ _id: userId, organizationId });

  if (!user) {
    throw new NotFoundError(`User not found in this organization`);
  }

  return user;
}

/**
 * Updates a user's profile with strict allowlisting against mass assignment.
 */
export async function updateUserProfile(organizationId, userId, updateData) {
  const user = await getUserById(organizationId, userId);

  if (!updateData || typeof updateData !== 'object') {
    throw new BadRequestError('Invalid update payload');
  }

  // Reject explicit tampering attempts on protected system fields
  const protectedFields = [
    '_id',
    'passwordHash',
    'role',
    'status',
    'emailVerified',
    'emailVerifiedAt',
    'lastLoginAt',
    'createdAt',
    'updatedAt'
  ];

  for (const field of protectedFields) {
    if (updateData[field] !== undefined) {
      throw new BadRequestError(`Field "${field}" cannot be modified through profile update`);
    }
  }

  // Reject organizationId modifications
  if (updateData.organizationId !== undefined && String(updateData.organizationId) !== String(organizationId)) {
    throw new BadRequestError('Field "organizationId" cannot be modified through profile update');
  }

  // Allowlisted root field updates
  if (updateData.name !== undefined) {
    const name = String(updateData.name).trim();
    if (name.length < 2 || name.length > 100) {
      throw new BadRequestError('Name must be between 2 and 100 characters');
    }
    user.name = name;
  }

  if (updateData.department !== undefined) {
    user.department = String(updateData.department).trim();
    if (user.profile) {
      user.profile.department = user.department;
    }
  }

  // Profile nested fields allowlist
  if (updateData.profile && typeof updateData.profile === 'object') {
    const p = updateData.profile;
    if (p.avatarUrl !== undefined) user.profile.avatarUrl = String(p.avatarUrl).trim();
    if (p.title !== undefined) user.profile.title = String(p.title).trim();
    if (p.phone !== undefined) user.profile.phone = String(p.phone).trim();
    if (p.bio !== undefined) user.profile.bio = String(p.bio).trim();
    if (p.department !== undefined) {
      user.profile.department = String(p.department).trim();
      user.department = user.profile.department;
    }
  }

  // Account Settings allowlist
  if (updateData.settings && typeof updateData.settings === 'object') {
    const s = updateData.settings;
    if (s.theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(s.theme)) {
        throw new BadRequestError('Theme must be light, dark, or system');
      }
      user.settings.theme = s.theme;
    }

    if (s.timezone !== undefined) {
      user.settings.timezone = String(s.timezone).trim();
    }

    if (s.locale !== undefined) {
      user.settings.locale = String(s.locale).trim();
    }

    if (s.notifications && typeof s.notifications === 'object') {
      const n = s.notifications;
      if (n.emailAlerts !== undefined) user.settings.notifications.emailAlerts = Boolean(n.emailAlerts);
      if (n.securityAlerts !== undefined) user.settings.notifications.securityAlerts = Boolean(n.securityAlerts);
      if (n.weeklyDigest !== undefined) user.settings.notifications.weeklyDigest = Boolean(n.weeklyDigest);
      if (n.slackAlerts !== undefined) user.settings.notifications.slackAlerts = Boolean(n.slackAlerts);
    }
  }

  await user.save();
  return user;
}

/**
 * Transitions a user's lifecycle status according to the valid status transition matrix.
 */
export async function updateUserStatus(organizationId, userId, newStatus, caller = null) {
  const user = await getUserById(organizationId, userId);

  if (!newStatus || !Object.values(USER_STATUS).includes(newStatus)) {
    throw new BadRequestError(
      `Invalid target status: "${newStatus}". Must be one of: ${Object.values(USER_STATUS).join(', ')}`
    );
  }

  // Prevent self-suspension
  if (caller && caller._id && caller._id.toString() === userId.toString() && newStatus === USER_STATUS.SUSPENDED) {
    throw new BadRequestError('Cannot suspend your own account');
  }

  if (!isValidStatusTransition(user.status, newStatus)) {
    throw new BadRequestError(
      `Invalid status transition: cannot transition user from "${user.status}" to "${newStatus}"`
    );
  }

  user.status = newStatus;
  await user.save();
  await CacheService.invalidateDashboard(organizationId);
  return user;
}

/**
 * Updates a user's role while enforcing administrative safety boundaries.
 */
export async function updateUserRole(organizationId, userId, newRole, caller = null) {
  const user = await getUserById(organizationId, userId);

  if (!newRole || !Object.values(USER_ROLES).includes(newRole)) {
    throw new BadRequestError(`Invalid role: "${newRole}". Must be one of: ${Object.values(USER_ROLES).join(', ')}`);
  }

  // Prevent self-promotion or changing your own role
  const callerId = caller?._id ? caller._id.toString() : (caller?.id ? caller.id.toString() : null);
  if (callerId && callerId === userId.toString()) {
    throw new ForbiddenError('Users cannot modify their own role');
  }

  // Privilege escalation protection: verify caller has authority to assign this role
  if (caller?.role && !canAssignRole(caller.role, newRole)) {
    throw new ForbiddenError(`Caller role "${caller.role}" is not authorized to grant role "${newRole}"`);
  }

  user.role = newRole;
  await user.save();
  return user;
}

/**
 * Soft deletes / deactivates a user within the tenant boundary.
 */
export async function deleteUser(organizationId, userId, caller = null) {
  const user = await getUserById(organizationId, userId);

  // Prevent self-deletion
  if (caller && caller._id && caller._id.toString() === userId.toString()) {
    throw new BadRequestError('Cannot delete your own account');
  }

  // Transition to suspended / deactivated for soft lifecycle handling
  user.status = USER_STATUS.DEACTIVATED;
  await user.save();
  await CacheService.invalidateDashboard(organizationId);

  return {
    success: true,
    message: `User ${user.email} has been deactivated`
  };
}

export default {
  getUsers,
  getUserById,
  updateUserProfile,
  updateUserStatus,
  updateUserRole,
  deleteUser
};
