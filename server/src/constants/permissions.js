import { USER_ROLES } from './user.js';

/**
 * Centralized Authoritative Granular Permission Definitions for RicozData.
 * Organized by domain according to enterprise governance architecture.
 */
export const PERMISSIONS = Object.freeze({
  // Organization Domain
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',
  ORGANIZATION_DELETE: 'organization.delete',

  // Users & Identity Domain
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_SUSPEND: 'users.suspend',
  USERS_MANAGE_ROLES: 'users.manage_roles',

  // Catalog Domain
  CATALOG_READ: 'catalog.read',
  CATALOG_CREATE: 'catalog.create',
  CATALOG_UPDATE: 'catalog.update',
  CATALOG_DELETE: 'catalog.delete',

  // Datasets Domain
  DATASETS_READ: 'datasets.read',
  DATASETS_CREATE: 'datasets.create',
  DATASETS_UPDATE: 'datasets.update',
  DATASETS_DELETE: 'datasets.delete',

  // Data Sources Domain
  DATA_SOURCES_READ: 'dataSources.read',
  DATA_SOURCES_CREATE: 'dataSources.create',
  DATA_SOURCES_UPDATE: 'dataSources.update',
  DATA_SOURCES_DELETE: 'dataSources.delete',
  DATA_SOURCES_TEST: 'dataSources.test',

  // Quality Domain
  QUALITY_READ: 'quality.read',
  QUALITY_MANAGE: 'quality.manage',

  // Lineage Domain
  LINEAGE_READ: 'lineage.read',
  LINEAGE_MANAGE: 'lineage.manage',

  // Glossary Domain
  GLOSSARY_READ: 'glossary.read',
  GLOSSARY_MANAGE: 'glossary.manage',

  // Governance & Policies Domain
  GOVERNANCE_READ: 'governance.read',
  GOVERNANCE_MANAGE: 'governance.manage',

  // Activities & Audit Domain
  ACTIVITIES_READ: 'activities.read',

  // Reports Domain
  REPORTS_READ: 'reports.read',
  REPORTS_CREATE: 'reports.create',

  // Settings & Configuration Domain
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage'
});

/**
 * All permissions list for admin/owner roles
 */
const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

/**
 * Granular Role Permission Matrix
 */
export const ROLE_PERMISSIONS = Object.freeze({
  // OWNER: Total access
  [USER_ROLES.OWNER]: ALL_PERMISSIONS,

  // ADMIN: Broad enterprise management
  [USER_ROLES.ADMIN]: ALL_PERMISSIONS,

  // DATA_STEWARD: Data governance, catalog, quality, and lineage management
  [USER_ROLES.DATA_STEWARD]: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.USERS_READ,

    PERMISSIONS.CATALOG_READ,
    PERMISSIONS.CATALOG_CREATE,
    PERMISSIONS.CATALOG_UPDATE,
    PERMISSIONS.CATALOG_DELETE,

    PERMISSIONS.DATASETS_READ,
    PERMISSIONS.DATASETS_CREATE,
    PERMISSIONS.DATASETS_UPDATE,
    PERMISSIONS.DATASETS_DELETE,

    PERMISSIONS.DATA_SOURCES_READ,
    PERMISSIONS.DATA_SOURCES_CREATE,
    PERMISSIONS.DATA_SOURCES_UPDATE,
    PERMISSIONS.DATA_SOURCES_DELETE,
    PERMISSIONS.DATA_SOURCES_TEST,

    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.QUALITY_MANAGE,

    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.LINEAGE_MANAGE,

    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.GLOSSARY_MANAGE,

    PERMISSIONS.GOVERNANCE_READ,
    PERMISSIONS.GOVERNANCE_MANAGE,

    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.SETTINGS_READ
  ]),

  // DATA_ENGINEER: Technical data source, dataset and quality pipeline operations
  [USER_ROLES.DATA_ENGINEER]: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.USERS_READ,

    PERMISSIONS.CATALOG_READ,
    PERMISSIONS.CATALOG_CREATE,
    PERMISSIONS.CATALOG_UPDATE,

    PERMISSIONS.DATASETS_READ,
    PERMISSIONS.DATASETS_CREATE,
    PERMISSIONS.DATASETS_UPDATE,

    PERMISSIONS.DATA_SOURCES_READ,
    PERMISSIONS.DATA_SOURCES_CREATE,
    PERMISSIONS.DATA_SOURCES_UPDATE,
    PERMISSIONS.DATA_SOURCES_TEST,

    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.QUALITY_MANAGE,

    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.LINEAGE_MANAGE,

    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.REPORTS_READ
  ]),

  // ANALYST: Analysis and read with report generation
  [USER_ROLES.ANALYST]: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.USERS_READ,

    PERMISSIONS.CATALOG_READ,
    PERMISSIONS.DATASETS_READ,
    PERMISSIONS.DATA_SOURCES_READ,

    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.GOVERNANCE_READ,

    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_CREATE
  ]),

  // VIEWER: Read-only access across platform resources
  [USER_ROLES.VIEWER]: Object.freeze([
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.USERS_READ,

    PERMISSIONS.CATALOG_READ,
    PERMISSIONS.DATASETS_READ,
    PERMISSIONS.DATA_SOURCES_READ,

    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.GOVERNANCE_READ,

    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.REPORTS_READ
  ])
});

/**
 * Returns whether a given role holds the specified permission.
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS[role.toLowerCase()];
  return Array.isArray(permissions) && permissions.includes(permission);
}

/**
 * Returns whether a given role holds all required permissions.
 */
export function hasAllPermissions(role, requiredPermissions) {
  if (!role || !Array.isArray(requiredPermissions)) return false;
  return requiredPermissions.every((p) => hasPermission(role, p));
}

/**
 * Returns whether a given role holds any of the required permissions.
 */
export function hasAnyPermission(role, requiredPermissions) {
  if (!role || !Array.isArray(requiredPermissions)) return false;
  return requiredPermissions.some((p) => hasPermission(role, p));
}

/**
 * Returns all permissions granted to a role.
 */
export function getRolePermissions(role) {
  if (!role) return [];
  return ROLE_PERMISSIONS[role.toLowerCase()] || [];
}

/**
 * Privilege Escalation Defense:
 * Validates whether a caller with callerRole is permitted to assign targetRole.
 */
export function canAssignRole(callerRole, targetRole) {
  if (!callerRole || !targetRole) return false;
  const normalizedCaller = callerRole.toLowerCase();
  const normalizedTarget = targetRole.toLowerCase();

  // Non-admins / non-owners cannot assign any role
  if (normalizedCaller !== USER_ROLES.OWNER && normalizedCaller !== USER_ROLES.ADMIN) {
    return false;
  }

  // Admin cannot assign OWNER role
  if (normalizedCaller === USER_ROLES.ADMIN && normalizedTarget === USER_ROLES.OWNER) {
    return false;
  }

  // Must be a valid supported role
  return Object.values(USER_ROLES).includes(normalizedTarget);
}

export default {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  canAssignRole
};
