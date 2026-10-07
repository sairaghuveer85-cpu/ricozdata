const mongoose = require('mongoose');
const User = require('../models/User');
const ResourceAccess = require('../models/ResourceAccess');
const Dataset = require('../models/Dataset');
const Policy = require('../models/Policy');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');
const {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  PERMISSIONS,
  getPermissionsForRole,
  roleHasPermission,
} = require('../config/rbac');

/**
 * Evaluates effective access for a user on a specific resource
 * @param {object} user 
 * @param {string} permission 
 * @param {string} resourceType 
 * @param {ObjectId|string} resourceId 
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
async function checkResourceAccess(user, permission, resourceType, resourceId) {
  // 1. SUPER_ADMIN has absolute authority
  if (user.role === ROLES.SUPER_ADMIN) {
    return { allowed: true, reason: 'SUPER_ADMIN full authority' };
  }

  if (resourceType && resourceId && mongoose.Types.ObjectId.isValid(resourceId)) {
    // 2. Explicit RESTRICTION overrides role permissions
    const restriction = await ResourceAccess.findOne({
      resourceType,
      resourceId,
      grantType: 'RESTRICTION',
      $or: [
        { principalType: 'USER', userId: user._id },
        { principalType: 'ROLE', role: user.role },
      ],
      permissions: permission,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    if (restriction) {
      return { allowed: false, reason: `Explicit resource restriction (${restriction.reason || 'Restricted by administrator'})` };
    }

    // 3. Explicit GRANT provides access
    const grant = await ResourceAccess.findOne({
      resourceType,
      resourceId,
      grantType: 'GRANT',
      $or: [
        { principalType: 'USER', userId: user._id },
        { principalType: 'ROLE', role: user.role },
      ],
      permissions: permission,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });

    if (grant) {
      return { allowed: true, reason: `Explicit resource grant (${grant.reason || 'Granted by administrator'})` };
    }

    // 4. Resource ownership allows standard operations
    if (resourceType === 'DATASET') {
      const dataset = await Dataset.findById(resourceId).select('ownerId stewardId');
      if (dataset && (dataset.ownerId?.equals(user._id) || dataset.stewardId?.equals(user._id))) {
        if (['DATASET_READ', 'DATASET_UPDATE'].includes(permission)) {
          return { allowed: true, reason: 'Dataset owner/steward privilege' };
        }
      }
    } else if (resourceType === 'POLICY') {
      const policy = await Policy.findById(resourceId).select('ownerId');
      if (policy && policy.ownerId?.equals(user._id)) {
        if (['POLICY_READ', 'POLICY_UPDATE'].includes(permission)) {
          return { allowed: true, reason: 'Policy owner privilege' };
        }
      }
    }
  }

  // 5. Default RBAC role permission
  const hasRolePerm = roleHasPermission(user.role, permission);
  if (hasRolePerm) {
    return { allowed: true, reason: `Standard RBAC permission for role "${ROLE_LABELS[user.role] || user.role}"` };
  }

  return { allowed: false, reason: `Role "${ROLE_LABELS[user.role] || user.role}" does not have permission "${permission}"` };
}

/**
 * @desc    Get access control overview (roles, users by role, role-permission matrix)
 * @route   GET /api/access-control/overview
 * @access  Private (USER_READ or POLICY_READ)
 */
const getAccessOverview = asyncHandler(async (req, res) => {
  const [users, grantsCount, restrictionsCount] = await Promise.all([
    User.find({ status: 'ACTIVE' }).select('name email role avatar avatarBg department lastLogin').lean(),
    ResourceAccess.countDocuments({ grantType: 'GRANT' }),
    ResourceAccess.countDocuments({ grantType: 'RESTRICTION' }),
  ]);

  const roleCounts = {};
  Object.values(ROLES).forEach((r) => {
    roleCounts[r] = 0;
  });

  users.forEach((u) => {
    if (roleCounts[u.role] !== undefined) {
      roleCounts[u.role] += 1;
    }
  });

  const matrix = Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
    role,
    roleLabel: ROLE_LABELS[role] || role,
    userCount: roleCounts[role] || 0,
    permissionsCount: perms.length,
    permissions: perms,
  }));

  res.json({
    success: true,
    data: {
      roles: Object.values(ROLES).map((r) => ({
        id: r,
        label: ROLE_LABELS[r] || r,
        userCount: roleCounts[r] || 0,
        permissionsCount: (ROLE_PERMISSIONS[r] || []).length,
      })),
      matrix,
      users,
      resourceAccessSummary: {
        activeGrants: grantsCount,
        activeRestrictions: restrictionsCount,
      },
      securityBoundaryNotice: {
        enforcementScope: 'RicozData Application Resources (Metadata, Catalog, Policies, Lineage, Studio)',
        externalDatabaseScope: 'Underlying external database user grants and connection strings are managed by your database administrator. RicozData enforces access within the governance platform.',
      },
    },
  });
});

/**
 * @desc    Inspect effective access for a specific resource
 * @route   GET /api/access-control/inspect
 * @access  Private (USER_READ or POLICY_READ)
 */
const inspectResourceAccess = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.query;

  if (!resourceType || !resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
    return res.status(400).json({ success: false, message: 'Valid resourceType and resourceId are required' });
  }

  let resourceName = 'Unknown Resource';
  let owner = null;

  if (resourceType === 'DATASET') {
    const ds = await Dataset.findById(resourceId).populate('ownerId', 'name email');
    if (ds) {
      resourceName = ds.name;
      owner = ds.ownerId ? ds.ownerId.name : ds.owner;
    }
  } else if (resourceType === 'POLICY') {
    const pol = await Policy.findById(resourceId).populate('ownerId', 'name email');
    if (pol) {
      resourceName = pol.name;
      owner = pol.ownerId ? pol.ownerId.name : pol.owner;
    }
  }

  const resourceRules = await ResourceAccess.find({
    resourceType,
    resourceId: new mongoose.Types.ObjectId(resourceId),
  })
    .populate('userId', 'name email role')
    .populate('grantedBy', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      resourceType,
      resourceId,
      resourceName,
      owner,
      rules: resourceRules,
      precedenceModel: [
        '1. SUPER_ADMIN full access',
        '2. Explicit resource RESTRICTION (Deny)',
        '3. Explicit resource GRANT (Allow)',
        '4. Resource ownership (Owner/Steward permissions)',
        '5. Default Role-Based Access Control (RBAC)',
      ],
    },
  });
});

/**
 * @desc    Create resource-level grant or restriction
 * @route   POST /api/access-control/grants
 * @access  Private (ACCESS_MANAGE)
 */
const createResourceAccessGrant = asyncHandler(async (req, res) => {
  const {
    resourceType,
    resourceId,
    grantType = 'GRANT',
    principalType = 'USER',
    userId,
    role,
    permissions = [],
    reason,
    expiresAt,
  } = req.body;

  if (!resourceType || !resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
    return res.status(400).json({ success: false, message: 'Valid resourceType and resourceId are required' });
  }

  if (principalType === 'USER' && (!userId || !mongoose.Types.ObjectId.isValid(userId))) {
    return res.status(400).json({ success: false, message: 'Valid userId is required for USER principal' });
  }

  if (principalType === 'ROLE' && (!role || !Object.values(ROLES).includes(role))) {
    return res.status(400).json({ success: false, message: 'Valid role is required for ROLE principal' });
  }

  if (!Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({ success: false, message: 'At least one permission must be specified' });
  }

  const access = await ResourceAccess.create({
    resourceType,
    resourceId,
    grantType,
    principalType,
    userId: principalType === 'USER' ? userId : undefined,
    role: principalType === 'ROLE' ? role : undefined,
    permissions,
    reason: reason ? reason.trim() : 'Configured via Access Control console',
    grantedBy: req.user._id,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });

  // Audit activity
  try {
    await Activity.create({
      title: `Created resource ${grantType}: on ${resourceType} for ${principalType === 'USER' ? 'User' : role}`,
      type: 'policy',
      actorId: req.user._id,
      metadata: {
        action: 'RESOURCE_ACCESS_CONFIGURED',
        resourceType,
        resourceId,
        grantType,
        principalType,
        permissions,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  const populated = await ResourceAccess.findById(access._id)
    .populate('userId', 'name email role')
    .populate('grantedBy', 'name email');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

/**
 * @desc    Revoke resource-level grant or restriction
 * @route   DELETE /api/access-control/grants/:id
 * @access  Private (ACCESS_MANAGE)
 */
const deleteResourceAccessGrant = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid grant ID format' });
  }

  const grant = await ResourceAccess.findByIdAndDelete(id);
  if (!grant) {
    return res.status(404).json({ success: false, message: 'Resource access grant not found' });
  }

  res.json({
    success: true,
    message: 'Resource access rule revoked successfully',
  });
});

module.exports = {
  getAccessOverview,
  inspectResourceAccess,
  createResourceAccessGrant,
  deleteResourceAccessGrant,
  checkResourceAccess,
};
