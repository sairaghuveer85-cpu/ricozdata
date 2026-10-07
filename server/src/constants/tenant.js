/**
 * Multi-tenant constants and enumeration definitions for RicozData platform.
 */

export const ORGANIZATION_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
  ARCHIVED: 'archived'
});

export const TENANT_HEADERS = Object.freeze({
  SLUG: 'x-tenant-slug',
  ID: 'x-tenant-id',
  INTERNAL_SECRET: 'x-internal-secret'
});

export const TENANT_RESOLUTION_SOURCE = Object.freeze({
  AUTHENTICATED: 'authenticated',
  TRUSTED_HEADER: 'trusted_header',
  SUBDOMAIN: 'subdomain',
  NONE: 'none'
});

export default {
  ORGANIZATION_STATUS,
  TENANT_HEADERS,
  TENANT_RESOLUTION_SOURCE
};
