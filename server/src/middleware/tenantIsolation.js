import { TenantPayloadMismatchError, TenantRequiredError } from '../utils/errors.js';

/**
 * Middleware that strictly prevents clients from manipulating or injecting another tenant's organizationId
 * in the request body. Enforces that any payload matches the trusted req.organizationId.
 */
export function enforcePayloadIsolation(req, res, next) {
  if (!req.organizationId) {
    return next(new TenantRequiredError());
  }

  if (req.body && typeof req.body === 'object') {
    const payloadOrgId = req.body.organizationId || req.body.tenantId;

    if (payloadOrgId && String(payloadOrgId) !== String(req.organizationId)) {
      return next(
        new TenantPayloadMismatchError(
          `Payload specifies organizationId "${payloadOrgId}", which does not match trusted tenant context "${req.organizationId}"`
        )
      );
    }

    // Lock organizationId in request body to trusted tenant context
    req.body.organizationId = req.organizationId;
  }

  next();
}

/**
 * Helper to produce a query filter guaranteed to be scoped to the trusted tenant.
 * Throws immediately if tenant context is missing.
 */
export function withTenant(req, filter = {}) {
  const orgId = req.organizationId;
  if (!orgId) {
    throw new TenantRequiredError('Cannot construct tenant-scoped query without active tenant context');
  }

  return {
    ...filter,
    organizationId: orgId
  };
}

/**
 * Executes a tenant-isolated find query.
 */
export function tenantFind(model, req, filter = {}, projection = null, options = {}) {
  const scopedFilter = withTenant(req, filter);
  return model.find(scopedFilter, projection, options);
}

/**
 * Executes a tenant-isolated findOne query.
 */
export function tenantFindOne(model, req, filter = {}, projection = null, options = {}) {
  const scopedFilter = withTenant(req, filter);
  return model.findOne(scopedFilter, projection, options);
}

/**
 * Executes a tenant-isolated lookup by resource ID.
 * NEVER uses model.findById directly to avoid cross-tenant data leaks.
 */
export function tenantFindById(model, req, resourceId, projection = null, options = {}) {
  const scopedFilter = withTenant(req, { _id: resourceId });
  return model.findOne(scopedFilter, projection, options);
}

/**
 * Executes a tenant-isolated updateOne query.
 */
export function tenantUpdateOne(model, req, filter = {}, update = {}, options = {}) {
  const scopedFilter = withTenant(req, filter);
  return model.updateOne(scopedFilter, update, options);
}

/**
 * Executes a tenant-isolated deleteOne query.
 */
export function tenantDeleteOne(model, req, filter = {}) {
  const scopedFilter = withTenant(req, filter);
  return model.deleteOne(scopedFilter);
}

export default {
  enforcePayloadIsolation,
  withTenant,
  tenantFind,
  tenantFindOne,
  tenantFindById,
  tenantUpdateOne,
  tenantDeleteOne
};
