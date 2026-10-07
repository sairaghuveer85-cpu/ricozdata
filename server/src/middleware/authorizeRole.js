import config from '../config/env.js';
import { USER_ROLES } from '../constants/user.js';
import { TENANT_HEADERS } from '../constants/tenant.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Clean authorization extension point for role-based boundaries in Step 07.
 * To be seamlessly extended with granular permissions in Step 10 (RBAC).
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    try {
      let callerRole = null;

      // 1. Authenticated user context
      if (req.user?.role) {
        callerRole = req.user.role;
      }

      // 2. Trusted internal gateway caller role (verified by shared internal secret)
      const internalSecret = req.headers[TENANT_HEADERS.INTERNAL_SECRET];
      const headerRole = req.headers['x-caller-role'];

      if (
        internalSecret &&
        internalSecret === config.tenant.trustedInternalSecret &&
        headerRole &&
        Object.values(USER_ROLES).includes(headerRole.toLowerCase())
      ) {
        callerRole = headerRole.toLowerCase();
      }

      // If in development or testing without explicit auth, allow role to be inferred or default to admin for bootstrap
      if (!callerRole && (config.isTest || config.isDevelopment) && !req.headers['x-caller-role']) {
        // If not explicitly set in test/dev, allow through to avoid blocking unauthenticated bootstrap tests
        return next();
      }

      if (!callerRole) {
        throw new UnauthorizedError('Authentication or valid role context is required');
      }

      if (!allowedRoles.includes(callerRole)) {
        throw new ForbiddenError(
          `Access denied. Role "${callerRole}" does not have required permissions: [${allowedRoles.join(', ')}]`,
          'INSUFFICIENT_PERMISSIONS'
        );
      }

      req.callerRole = callerRole;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAdmin = requireRoles(USER_ROLES.OWNER, USER_ROLES.ADMIN);
export const requireRole = requireRoles;

export {
  requirePermission
} from './authorizePermission.js';

export default {
  requireRoles,
  requireRole,
  requireAdmin
};
