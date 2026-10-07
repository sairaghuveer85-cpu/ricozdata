import { updateTenant } from '../services/tenant.service.js';

/**
 * Controller for tenant/organization endpoints.
 */

/**
 * GET /api/organizations/me
 * Retrieves current resolved organization/tenant metadata.
 */
export async function getMe(req, res, next) {
  try {
    // req.organization is already resolved and validated by tenantContext & requireTenant
    const organization = req.organization;

    res.status(200).json({
      success: true,
      data: organization
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/organizations/me
 * Updates current resolved organization settings with mass assignment defense.
 */
export async function updateMe(req, res, next) {
  try {
    // Strictly updates the tenant resolved in req.organizationId - client cannot specify target org
    const updated = await updateTenant(req.organizationId, req.body);

    res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getMe,
  updateMe
};
