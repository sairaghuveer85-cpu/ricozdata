import { TenantRequiredError } from '../utils/errors.js';
import { validateTenantStatus } from '../services/tenant.service.js';

/**
 * Middleware that strictly enforces that a valid, active tenant context has been resolved.
 * Must be mounted on tenant-scoped routes.
 */
export function requireTenant(req, res, next) {
  if (!req.organizationId || !req.organization) {
    return next(
      new TenantRequiredError(
        'This endpoint requires a valid organization/tenant context. Provide a valid tenant subdomain or trusted credentials.'
      )
    );
  }

  try {
    validateTenantStatus(req.organization);
    next();
  } catch (error) {
    next(error);
  }
}

export default requireTenant;
