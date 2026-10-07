/**
 * RicozData Production RBAC Configuration
 * Single source of truth for Role → Permission mappings (backend).
 * All authorization decisions must derive from this module.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Standardized Machine-Readable Roles (6 roles)
// ──────────────────────────────────────────────────────────────────────────────
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  DATA_STEWARD: 'DATA_STEWARD',
  DATA_ENGINEER: 'DATA_ENGINEER',
  DATA_ANALYST: 'DATA_ANALYST',
  VIEWER: 'VIEWER',
};

// Human-friendly display labels for UI
const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.DATA_STEWARD]: 'Data Steward',
  [ROLES.DATA_ENGINEER]: 'Data Engineer',
  [ROLES.DATA_ANALYST]: 'Data Analyst',
  [ROLES.VIEWER]: 'Viewer',
};

// Role hierarchy for privilege escalation checks (higher = more privilege)
const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 6,
  [ROLES.ADMIN]: 5,
  [ROLES.DATA_STEWARD]: 4,
  [ROLES.DATA_ENGINEER]: 3,
  [ROLES.DATA_ANALYST]: 2,
  [ROLES.VIEWER]: 1,
};

// ──────────────────────────────────────────────────────────────────────────────
// Granular Permissions Catalog (26 permissions across 7 domains)
// ──────────────────────────────────────────────────────────────────────────────
const PERMISSIONS = {
  // Datasets
  DATASET_READ: 'DATASET_READ',
  DATASET_CREATE: 'DATASET_CREATE',
  DATASET_UPDATE: 'DATASET_UPDATE',
  DATASET_DELETE: 'DATASET_DELETE',

  // Quality
  QUALITY_READ: 'QUALITY_READ',
  QUALITY_UPDATE: 'QUALITY_UPDATE',
  QUALITY_MANAGE: 'QUALITY_MANAGE',

  // Lineage
  LINEAGE_READ: 'LINEAGE_READ',
  LINEAGE_MANAGE: 'LINEAGE_MANAGE',

  // Glossary
  GLOSSARY_READ: 'GLOSSARY_READ',
  GLOSSARY_CREATE: 'GLOSSARY_CREATE',
  GLOSSARY_UPDATE: 'GLOSSARY_UPDATE',
  GLOSSARY_DELETE: 'GLOSSARY_DELETE',

  // Policies
  POLICY_READ: 'POLICY_READ',
  POLICY_CREATE: 'POLICY_CREATE',
  POLICY_UPDATE: 'POLICY_UPDATE',
  POLICY_DELETE: 'POLICY_DELETE',

  // Governance Rules
  RULE_READ: 'RULE_READ',
  RULE_CREATE: 'RULE_CREATE',
  RULE_UPDATE: 'RULE_UPDATE',
  RULE_DELETE: 'RULE_DELETE',
  RULE_EVALUATE: 'RULE_EVALUATE',

  // Compliance
  COMPLIANCE_READ: 'COMPLIANCE_READ',
  COMPLIANCE_MANAGE: 'COMPLIANCE_MANAGE',

  // Access Control Management
  ACCESS_MANAGE: 'ACCESS_MANAGE',

  // Users
  USER_READ: 'USER_READ',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',

  // Platform
  ACTIVITY_READ: 'ACTIVITY_READ',
  DASHBOARD_READ: 'DASHBOARD_READ',
  SEARCH_READ: 'SEARCH_READ',
  SETTINGS_MANAGE: 'SETTINGS_MANAGE',
  SYSTEM_MANAGE: 'SYSTEM_MANAGE',
};

// ──────────────────────────────────────────────────────────────────────────────
// Authoritative Role → Permission Matrix
// ──────────────────────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS), // Full access to everything

  [ROLES.ADMIN]: [
    // Datasets
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.DATASET_CREATE,
    PERMISSIONS.DATASET_UPDATE,
    PERMISSIONS.DATASET_DELETE,
    // Quality
    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.QUALITY_UPDATE,
    PERMISSIONS.QUALITY_MANAGE,
    // Lineage
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.LINEAGE_MANAGE,
    // Glossary
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.GLOSSARY_CREATE,
    PERMISSIONS.GLOSSARY_UPDATE,
    PERMISSIONS.GLOSSARY_DELETE,
    // Policies
    PERMISSIONS.POLICY_READ,
    PERMISSIONS.POLICY_CREATE,
    PERMISSIONS.POLICY_UPDATE,
    PERMISSIONS.POLICY_DELETE,
    // Governance Rules
    PERMISSIONS.RULE_READ,
    PERMISSIONS.RULE_CREATE,
    PERMISSIONS.RULE_UPDATE,
    PERMISSIONS.RULE_DELETE,
    PERMISSIONS.RULE_EVALUATE,
    // Compliance
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.COMPLIANCE_MANAGE,
    // Access Management
    PERMISSIONS.ACCESS_MANAGE,
    // Users (but NOT SUPER_ADMIN management)
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    // Platform
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
    PERMISSIONS.SETTINGS_MANAGE,
    // NOT: SYSTEM_MANAGE (reserved for SUPER_ADMIN)
  ],

  [ROLES.DATA_STEWARD]: [
    // Datasets: full CRUD on owned/stewarded
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.DATASET_CREATE,
    PERMISSIONS.DATASET_UPDATE,
    // NOT: DATASET_DELETE
    // Quality: full management
    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.QUALITY_UPDATE,
    PERMISSIONS.QUALITY_MANAGE,
    // Lineage: read + manage for owned datasets
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.LINEAGE_MANAGE,
    // Glossary: full CRUD
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.GLOSSARY_CREATE,
    PERMISSIONS.GLOSSARY_UPDATE,
    PERMISSIONS.GLOSSARY_DELETE,
    // Policies: read + create/update for owned
    PERMISSIONS.POLICY_READ,
    PERMISSIONS.POLICY_CREATE,
    PERMISSIONS.POLICY_UPDATE,
    // Governance Rules
    PERMISSIONS.RULE_READ,
    PERMISSIONS.RULE_CREATE,
    PERMISSIONS.RULE_UPDATE,
    PERMISSIONS.RULE_EVALUATE,
    // Compliance
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.COMPLIANCE_MANAGE,
    // NOT: POLICY_DELETE, ACCESS_MANAGE
    // Users: read only
    PERMISSIONS.USER_READ,
    // Platform
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
    // NOT: SETTINGS_MANAGE, SYSTEM_MANAGE
  ],

  [ROLES.DATA_ENGINEER]: [
    // Datasets: read + create + update (no delete)
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.DATASET_CREATE,
    PERMISSIONS.DATASET_UPDATE,
    // Quality: read + update
    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.QUALITY_UPDATE,
    // Lineage: full management
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.LINEAGE_MANAGE,
    // Glossary: read only
    PERMISSIONS.GLOSSARY_READ,
    // Policies: read only
    PERMISSIONS.POLICY_READ,
    // Governance Rules: read + evaluate
    PERMISSIONS.RULE_READ,
    PERMISSIONS.RULE_EVALUATE,
    // Compliance: read only
    PERMISSIONS.COMPLIANCE_READ,
    // Users: read only
    PERMISSIONS.USER_READ,
    // Platform
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
  ],

  [ROLES.DATA_ANALYST]: [
    // Datasets: read + create + update (for favorites/bookmarks)
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.DATASET_CREATE,
    PERMISSIONS.DATASET_UPDATE,
    // Quality: read only
    PERMISSIONS.QUALITY_READ,
    // Lineage: read only
    PERMISSIONS.LINEAGE_READ,
    // Glossary: read only
    PERMISSIONS.GLOSSARY_READ,
    // Policies: read only
    PERMISSIONS.POLICY_READ,
    // Governance Rules: read only
    PERMISSIONS.RULE_READ,
    // Compliance: read only
    PERMISSIONS.COMPLIANCE_READ,
    // Users: read only
    PERMISSIONS.USER_READ,
    // Platform
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
  ],

  [ROLES.VIEWER]: [
    // Read-only across all domains
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.POLICY_READ,
    PERMISSIONS.RULE_READ,
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
  ],
};

// ──────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get all permissions for a given role (including inherited via hierarchy)
 */
function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role has a specific permission
 */
function roleHasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

/**
 * Get all roles that have a specific permission
 */
function getRolesWithPermission(permission) {
  return Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.includes(permission))
    .map(([role]) => role);
}

/**
 * Compare role hierarchy: returns true if roleA >= roleB in privilege
 */
function roleGte(roleA, roleB) {
  const hierarchyA = ROLE_HIERARCHY[roleA] ?? 0;
  const hierarchyB = ROLE_HIERARCHY[roleB] ?? 0;
  return hierarchyA >= hierarchyB;
}

/**
 * Check if roleA can manage roleB (prevents privilege escalation)
 * - Cannot manage self
 * - Cannot manage SUPER_ADMIN unless you are SUPER_ADMIN
 * - Can only manage roles strictly lower in hierarchy
 */
function canManageRole(requesterRole, targetRole) {
  if (requesterRole === targetRole) return false; // Cannot self-manage
  if (targetRole === ROLES.SUPER_ADMIN && requesterRole !== ROLES.SUPER_ADMIN) return false; // Only SUPER_ADMIN can manage SUPER_ADMIN
  return roleGte(requesterRole, targetRole) && ROLE_HIERARCHY[requesterRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * Get display label for a role
 */
function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

/**
 * Get all standardized roles
 */
function getAllRoles() {
  return Object.values(ROLES);
}

/**
 * Get all permissions
 */
function getAllPermissions() {
  return Object.values(PERMISSIONS);
}

/**
 * Validate role string
 */
function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

/**
 * Validate permission string
 */
function isValidPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission);
}

/**
 * Map legacy role names to standardized roles
 */
function mapLegacyRole(legacyRole) {
  if (!legacyRole) return ROLES.DATA_ANALYST;
  if (Object.values(ROLES).includes(legacyRole)) return legacyRole;

  const legacyRoleMap = {
    'Platform Administrator': ROLES.SUPER_ADMIN,
    'Security Administrator': ROLES.ADMIN,
    'Data Governance Manager': ROLES.ADMIN,
    'Data Steward': ROLES.DATA_STEWARD,
    'Data Engineer': ROLES.DATA_ENGINEER,
    'Product Data Owner': ROLES.DATA_ENGINEER,
    'Finance Data Owner': ROLES.DATA_ANALYST,
    'Data Analyst': ROLES.DATA_ANALYST,
    'Marketing Analyst': ROLES.DATA_ANALYST,
    'Sales Operations Manager': ROLES.DATA_ANALYST,
    'Super Admin': ROLES.SUPER_ADMIN,
    'Admin': ROLES.ADMIN,
    'Viewer': ROLES.VIEWER,
  };

  return legacyRoleMap[legacyRole] || ROLES.DATA_ANALYST;
}

module.exports = {
  ROLES,
  ROLE_LABELS,
  ROLE_HIERARCHY,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  roleHasPermission,
  getRolesWithPermission,
  roleGte,
  canManageRole,
  getRoleLabel,
  getAllRoles,
  getAllPermissions,
  isValidRole,
  isValidPermission,
  mapLegacyRole,
};