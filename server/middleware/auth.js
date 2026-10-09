const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  ROLES,
  roleHasPermission,
  getPermissionsForRole,
  isValidRole,
  isValidPermission,
} = require('../config/rbac');

/**
 * Authentication Middleware: Validates JWT Bearer token and attaches user to req.user.
 * Rejects requests without valid tokens or with inactive/suspended accounts.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-jwt-key-1234567890');

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      // Check account status
      const userStatus = (user.status || 'ACTIVE').toUpperCase();
      if (userStatus === 'INACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Your account is inactive. Please contact a platform administrator.'
        });
      }
      if (userStatus === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended for security review.'
        });
      }

      // Ensure user has valid organizationId (lazy default fallback for legacy data)
      if (!user.organizationId) {
        try {
          const { ensureDefaultOrganization } = require('../services/organizationService');
          const defOrg = await ensureDefaultOrganization();
          user.organizationId = defOrg._id;
          await User.updateOne({ _id: user._id }, { $set: { organizationId: defOrg._id } });
        } catch (orgErr) {
          console.warn('Fallback organization resolution warning:', orgErr.message);
        }
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth verification error:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

/**
 * Authorization Middleware: Checks if the authenticated user has a specific granular permission.
 * Returns 403 Forbidden with standard message if missing permission.
 *
 * @param {string} permission - The permission required (from PERMISSIONS)
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const hasPerm = roleHasPermission(userRole, permission);

    if (!hasPerm) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
        requiredPermission: permission,
        role: userRole
      });
    }

    next();
  };
};

/**
 * Authorization Middleware: Checks if the authenticated user has one of the allowed roles.
 * Returns 403 Forbidden with standard message if role not in list.
 *
 * @param {string|string[]} roles - Allowed role or array of allowed roles
 */
const requireRole = (roles) => {
  const roleList = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userRole = req.user.role;
    if (!roleList.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
        requiredRoles: roleList,
        role: userRole
      });
    }

    next();
  };
};

/**
 * Admin check middleware (backward compatibility)
 */
const admin = (req, res, next) => {
  if (req.user && (req.user.role === ROLES.SUPER_ADMIN || req.user.role === ROLES.ADMIN || req.user.role?.toLowerCase().includes('admin'))) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin' });
  }
};

module.exports = {
  protect,
  requireAuth: protect,
  requirePermission,
  requireRole,
  admin
};
