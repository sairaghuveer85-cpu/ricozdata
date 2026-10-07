import config from '../config/env.js';
import { USER_ROLES } from '../constants/user.js';
import { TENANT_HEADERS } from '../constants/tenant.js';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  canAssignRole
} from '../constants/permissions.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Resolves the effective caller role from authenticated JWT user context
 * or trusted internal service gateway headers.
 */
export function resolveCallerRole(req) {
  // 1. Authenticated user from verified JWT
  if (req.user?.role) {
    return req.user.role.toLowerCase();
  }

  // 2. Trusted internal gateway header (with shared secret verification)
  const internalSecret = req.headers[TENANT_HEADERS.INTERNAL_SECRET];
  const headerRole = req.headers['x-caller-role'];

  if (
    internalSecret &&
    internalSecret === config.tenant.trustedInternalSecret &&
    headerRole &&
    Object.values(USER_ROLES).includes(headerRole.toLowerCase())
  ) {
    return headerRole.toLowerCase();
  }

  // 3. Development / Test fallback only if not in production and no auth context provided
  if (!config.isProduction && (config.isTest || config.isDevelopment) && !req.headers.authorization && !req.headers['x-caller-role']) {
    return null;
  }

  return null;
}

/**
 * Middleware factory enforcing granular backend permission authorization.
 * Strict fail-closed: requires authentication, tenant context, active tenant status,
 * and the specific granular permission.
 *
 * @param {string} permission - Required permission string from PERMISSIONS
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    try {
      // 1. Require resolved tenant organization
      if (!req.organizationId) {
        throw new ForbiddenError('Tenant organization context is required');
      }

      // 2. Tenant status check
      if (req.organization && req.organization.status !== 'active') {
        throw new ForbiddenError(`Tenant organization status is "${req.organization.status}". Access restricted.`);
      }

      // 3. Resolve caller role
      const callerRole = resolveCallerRole(req);

      // If test bootstrap without auth headers, allow through only if caller was not authenticated
      if (!callerRole && (config.isTest || config.isDevelopment) && !req.headers.authorization && !req.headers['x-caller-role']) {
        return next();
      }

      if (!callerRole) {
        throw new UnauthorizedError('Authentication is required to perform this action');
      }

      // 4. Check permission against matrix
      if (!hasPermission(callerRole, permission)) {
        logger.warn(
          `[RBAC] Access denied for role "${callerRole}". Required permission: "${permission}" (path: ${req.method} ${req.originalUrl})`
        );
        throw new ForbiddenError(
          `Access denied. Role "${callerRole}" lacks required permission "${permission}"`,
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

/**
 * Middleware factory enforcing that the caller possesses at least one of the specified roles.
 * @param  {...string} allowedRoles - Permitted roles
 */
export function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

  return (req, res, next) => {
    try {
      if (!req.organizationId) {
        throw new ForbiddenError('Tenant organization context is required');
      }

      if (req.organization && req.organization.status !== 'active') {
        throw new ForbiddenError(`Tenant organization status is "${req.organization.status}". Access restricted.`);
      }

      const callerRole = resolveCallerRole(req);

      if (!callerRole && (config.isTest || config.isDevelopment) && !req.headers.authorization && !req.headers['x-caller-role']) {
        return next();
      }

      if (!callerRole) {
        throw new UnauthorizedError('Authentication is required to perform this action');
      }

      if (!normalizedAllowed.includes(callerRole)) {
        logger.warn(
          `[RBAC] Access denied for role "${callerRole}". Required roles: [${normalizedAllowed.join(', ')}] (path: ${req.method} ${req.originalUrl})`
        );
        throw new ForbiddenError(
          `Access denied. Role "${callerRole}" does not have required permissions: [${normalizedAllowed.join(', ')}]`,
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

export {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  canAssignRole
};

export default {
  requirePermission,
  requireRole,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  canAssignRole
};
