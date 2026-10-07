import mongoose from 'mongoose';
import Organization, { ORGANIZATION_STATUS } from '../models/Organization.js';
import {
  TenantNotFoundError,
  TenantSuspendedError,
  TenantPendingError,
  ForbiddenError,
  BadRequestError
} from '../utils/errors.js';

/**
 * Validates tenant status lifecycle rules.
 * Enforces access controls for ACTIVE, SUSPENDED, PENDING, and ARCHIVED organizations.
 */
export function validateTenantStatus(organization, allowPending = false) {
  if (!organization) {
    throw new TenantNotFoundError();
  }

  const status = (organization.status || '').toLowerCase();

  switch (status) {
    case ORGANIZATION_STATUS.ACTIVE:
      return true;

    case ORGANIZATION_STATUS.SUSPENDED:
      throw new TenantSuspendedError(
        `Organization "${organization.name}" is currently suspended. Access denied.`
      );

    case ORGANIZATION_STATUS.PENDING:
      if (allowPending) {
        return true;
      }
      throw new TenantPendingError(
        `Organization "${organization.name}" is pending activation.`
      );

    case ORGANIZATION_STATUS.ARCHIVED:
      throw new ForbiddenError(
        `Organization "${organization.name}" has been archived and is read-only.`,
        'TENANT_ARCHIVED'
      );

    default:
      throw new ForbiddenError(
        `Organization "${organization.name}" has an invalid status: ${status}`,
        'TENANT_STATUS_INVALID'
      );
  }
}

/**
 * Resolves an organization by its unique URL slug.
 */
export async function getTenantBySlug(slug, { validateStatus = true, allowPending = false } = {}) {
  if (!slug || typeof slug !== 'string') {
    return null;
  }

  const normalizedSlug = slug.toLowerCase().trim();
  const organization = await Organization.findOne({ slug: normalizedSlug });

  if (!organization) {
    return null;
  }

  if (validateStatus) {
    validateTenantStatus(organization, allowPending);
  }

  return organization;
}

/**
 * Resolves an organization by its ObjectId.
 */
export async function getTenantById(organizationId, { validateStatus = true, allowPending = false } = {}) {
  if (!organizationId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw new BadRequestError(`Invalid organization ID format: "${organizationId}"`);
  }

  const organization = await Organization.findById(organizationId);

  if (!organization) {
    return null;
  }

  if (validateStatus) {
    validateTenantStatus(organization, allowPending);
  }

  return organization;
}

/**
 * Updates an organization while strictly guarding against mass assignment vulnerabilities.
 */
export async function updateTenant(organizationId, updatePayload) {
  const organization = await getTenantById(organizationId, { validateStatus: true });

  if (!organization) {
    throw new TenantNotFoundError();
  }

  if (!updatePayload || typeof updatePayload !== 'object') {
    throw new BadRequestError('Invalid update payload');
  }

  // Explicit field whitelist - strictly prevents mass assignment of _id, slug, status, timestamps
  if (updatePayload.name !== undefined) {
    const name = String(updatePayload.name).trim();
    if (name.length < 2 || name.length > 100) {
      throw new BadRequestError('Organization name must be between 2 and 100 characters');
    }
    organization.name = name;
  }

  if (updatePayload.settings && typeof updatePayload.settings === 'object') {
    const s = updatePayload.settings;

    if (s.dataRetentionDays !== undefined) {
      const days = parseInt(s.dataRetentionDays, 10);
      if (isNaN(days) || days < 7) {
        throw new BadRequestError('dataRetentionDays must be an integer of at least 7');
      }
      organization.settings.dataRetentionDays = days;
    }

    if (s.features && typeof s.features === 'object') {
      const allowedFeatures = ['lineageEnabled', 'qualityAlertsEnabled', 'glossaryEnabled', 'advancedGovernance'];
      for (const feat of allowedFeatures) {
        if (s.features[feat] !== undefined) {
          organization.settings.features[feat] = Boolean(s.features[feat]);
        }
      }
    }
  }

  await organization.save();
  return organization;
}

export default {
  validateTenantStatus,
  getTenantBySlug,
  getTenantById,
  updateTenant
};
