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
  MAIN_ADMIN: 'MAIN_ADMIN',
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
  DATA_STEWARD: 'DATA_STEWARD',
  DATA_ENGINEER: 'DATA_ENGINEER',
  DATA_ANALYST: 'DATA_ANALYST',
  VIEWER: 'VIEWER',
};

// Human-friendly display labels for UI
const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.MAIN_ADMIN]: 'Main Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.EMPLOYEE]: 'Employee',
  [ROLES.DATA_STEWARD]: 'Data Steward',
  [ROLES.DATA_ENGINEER]: 'Data Engineer',
  [ROLES.DATA_ANALYST]: 'Data Analyst',
  [ROLES.VIEWER]: 'Viewer',
};

// Role hierarchy for privilege escalation checks (higher = more privilege)
const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 7,
  [ROLES.MAIN_ADMIN]: 6,
  [ROLES.ADMIN]: 6,
  [ROLES.EMPLOYEE]: 5,
  [ROLES.DATA_STEWARD]: 4,
  [ROLES.DATA_ENGINEER]: 3,
  [ROLES.DATA_ANALYST]: 2,
  [ROLES.VIEWER]: 1,
};

// ──────────────────────────────────────────────────────────────────────────────
// Granular Permissions Catalog (26 permissions across 7 domains)
// ──────────────────────────────────────────────────────────────────────────────
const PERMISSIONS = {
  // Data Sources
  DATA_SOURCE_READ: 'DATA_SOURCE_READ',
  DATA_SOURCE_CREATE: 'DATA_SOURCE_CREATE',
  DATA_SOURCE_UPDATE: 'DATA_SOURCE_UPDATE',
  DATA_SOURCE_DELETE: 'DATA_SOURCE_DELETE',
  DATA_SOURCE_TEST: 'DATA_SOURCE_TEST',
  DATA_SOURCE_MANAGE: 'DATA_SOURCE_MANAGE',

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

  // Users & Employee Management (Main Admin only)
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

// Common full-application permissions for normal RicozData operations
const FULL_APPLICATION_PERMISSIONS = [
  // Data Sources (full access)
  PERMISSIONS.DATA_SOURCE_READ,
  PERMISSIONS.DATA_SOURCE_CREATE,
  PERMISSIONS.DATA_SOURCE_UPDATE,
  PERMISSIONS.DATA_SOURCE_DELETE,
  PERMISSIONS.DATA_SOURCE_TEST,
  PERMISSIONS.DATA_SOURCE_MANAGE,
  // Datasets (full access)
  PERMISSIONS.DATASET_READ,
  PERMISSIONS.DATASET_CREATE,
  PERMISSIONS.DATASET_UPDATE,
  PERMISSIONS.DATASET_DELETE,
  // Quality (full access)
  PERMISSIONS.QUALITY_READ,
  PERMISSIONS.QUALITY_UPDATE,
  PERMISSIONS.QUALITY_MANAGE,
  // Lineage (full access)
  PERMISSIONS.LINEAGE_READ,
  PERMISSIONS.LINEAGE_MANAGE,
  // Glossary (full access)
  PERMISSIONS.GLOSSARY_READ,
  PERMISSIONS.GLOSSARY_CREATE,
  PERMISSIONS.GLOSSARY_UPDATE,
  PERMISSIONS.GLOSSARY_DELETE,
  // Policies (full access)
  PERMISSIONS.POLICY_READ,
  PERMISSIONS.POLICY_CREATE,
  PERMISSIONS.POLICY_UPDATE,
  PERMISSIONS.POLICY_DELETE,
  // Governance Rules (full access)
  PERMISSIONS.RULE_READ,
  PERMISSIONS.RULE_CREATE,
  PERMISSIONS.RULE_UPDATE,
  PERMISSIONS.RULE_DELETE,
  PERMISSIONS.RULE_EVALUATE,
  // Compliance (full access)
  PERMISSIONS.COMPLIANCE_READ,
  PERMISSIONS.COMPLIANCE_MANAGE,
  // Platform (full access)
  PERMISSIONS.ACTIVITY_READ,
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.SEARCH_READ,
  PERMISSIONS.SETTINGS_MANAGE,
];

// ──────────────────────────────────────────────────────────────────────────────
// Authoritative Role → Permission Matrix
// ──────────────────────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS), // Full access to everything including SYSTEM_MANAGE

  // MAIN_ADMIN & ADMIN: Full application access + Exclusive Employee Account Management
  [ROLES.MAIN_ADMIN]: [
    ...FULL_APPLICATION_PERMISSIONS,
    PERMISSIONS.ACCESS_MANAGE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
  ],

  [ROLES.ADMIN]: [
    ...FULL_APPLICATION_PERMISSIONS,
    PERMISSIONS.ACCESS_MANAGE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
  ],

  // EMPLOYEE: Full access to all normal RicozData features.
  // NO access to employee creation or account administration.
  [ROLES.EMPLOYEE]: [
    ...FULL_APPLICATION_PERMISSIONS,
  ],

  [ROLES.DATA_STEWARD]: [
    // Data Sources
    PERMISSIONS.DATA_SOURCE_READ,
    PERMISSIONS.DATA_SOURCE_CREATE,
    PERMISSIONS.DATA_SOURCE_UPDATE,
    PERMISSIONS.DATA_SOURCE_DELETE,
    PERMISSIONS.DATA_SOURCE_TEST,
    // Datasets
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.DATASET_CREATE,
    PERMISSIONS.DATASET_UPDATE,
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
    // Governance Rules
    PERMISSIONS.RULE_READ,
    PERMISSIONS.RULE_CREATE,
    PERMISSIONS.RULE_UPDATE,
    PERMISSIONS.RULE_EVALUATE,
    // Compliance
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.COMPLIANCE_MANAGE,
    // Platform
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
  ],

  [ROLES.DATA_ENGINEER]: [
    PERMISSIONS.DATA_SOURCE_READ,
    PERMISSIONS.DATA_SOURCE_CREATE,
    PERMISSIONS.DATA_SOURCE_UPDATE,
    PERMISSIONS.DATA_SOURCE_DELETE,
    PERMISSIONS.DATA_SOURCE_TEST,
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.DATASET_CREATE,
    PERMISSIONS.DATASET_UPDATE,
    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.QUALITY_UPDATE,
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.LINEAGE_MANAGE,
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.POLICY_READ,
    PERMISSIONS.RULE_READ,
    PERMISSIONS.RULE_EVALUATE,
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
  ],

  [ROLES.DATA_ANALYST]: [
    PERMISSIONS.DATA_SOURCE_READ,
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.DATASET_CREATE,
    PERMISSIONS.DATASET_UPDATE,
    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.POLICY_READ,
    PERMISSIONS.RULE_READ,
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.ACTIVITY_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.SEARCH_READ,
  ],

  [ROLES.VIEWER]: [
    // Read-only across all domains
    PERMISSIONS.DATA_SOURCE_READ,
    PERMISSIONS.DATASET_READ,
    PERMISSIONS.QUALITY_READ,
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.POLICY_READ,
    PERMISSIONS.RULE_READ,
    PERMISSIONS.COMPLIANCE_READ,
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
  const normalizedRole = mapLegacyRole(role);
  return ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * Check if a role has a specific permission
 */
function roleHasPermission(role, permission) {
  const normalizedRole = mapLegacyRole(role);
  const perms = ROLE_PERMISSIONS[normalizedRole];
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
  const normA = mapLegacyRole(roleA);
  const normB = mapLegacyRole(roleB);
  const hierarchyA = ROLE_HIERARCHY[normA] ?? 0;
  const hierarchyB = ROLE_HIERARCHY[normB] ?? 0;
  return hierarchyA >= hierarchyB;
}

/**
 * Check if roleA can manage roleB (prevents privilege escalation)
 * - Cannot manage self
 * - Cannot manage SUPER_ADMIN unless you are SUPER_ADMIN
 * - Cannot manage MAIN_ADMIN unless you are SUPER_ADMIN
 * - Only SUPER_ADMIN, MAIN_ADMIN, and ADMIN can manage other roles
 * - Can only manage roles strictly lower in hierarchy
 */
function canManageRole(requesterRole, targetRole) {
  const reqNorm = mapLegacyRole(requesterRole);
  const tgtNorm = mapLegacyRole(targetRole);
  if (reqNorm === tgtNorm) return false; // Cannot self-manage

  // Only SUPER_ADMIN, MAIN_ADMIN, and ADMIN can manage roles
  if (reqNorm !== ROLES.SUPER_ADMIN && reqNorm !== ROLES.MAIN_ADMIN && reqNorm !== ROLES.ADMIN) {
    return false;
  }

  // Only SUPER_ADMIN can manage SUPER_ADMIN
  if (tgtNorm === ROLES.SUPER_ADMIN && reqNorm !== ROLES.SUPER_ADMIN) return false;

  // Only SUPER_ADMIN can manage MAIN_ADMIN
  if ((tgtNorm === ROLES.MAIN_ADMIN || tgtNorm === ROLES.ADMIN) && reqNorm !== ROLES.SUPER_ADMIN) {
    return false;
  }

  return roleGte(reqNorm, tgtNorm) && (ROLE_HIERARCHY[reqNorm] ?? 0) > (ROLE_HIERARCHY[tgtNorm] ?? 0);
}

/**
 * Get display label for a role
 */
function getRoleLabel(role) {
  const normalizedRole = mapLegacyRole(role);
  return ROLE_LABELS[normalizedRole] || normalizedRole;
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
  if (!role) return false;
  const norm = String(role).trim().toUpperCase();
  return Object.values(ROLES).includes(norm);
}

/**
 * Validate permission string
 */
function isValidPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission);
}

/**
 * Map legacy or unnormalized role names to standardized uppercase roles
 */
function mapLegacyRole(legacyRole) {
  if (!legacyRole) return ROLES.EMPLOYEE;
  const clean = String(legacyRole).trim();
  const upper = clean.toUpperCase();

  // If already a valid standardized role
  if (Object.values(ROLES).includes(upper)) return upper;

  const legacyRoleMap = {
    'platform administrator': ROLES.SUPER_ADMIN,
    'main admin': ROLES.MAIN_ADMIN,
    'main_admin': ROLES.MAIN_ADMIN,
    'security administrator': ROLES.MAIN_ADMIN,
    'data governance manager': ROLES.MAIN_ADMIN,
    'data steward': ROLES.DATA_STEWARD,
    'data engineer': ROLES.DATA_ENGINEER,
    'product data owner': ROLES.DATA_ENGINEER,
    'finance data owner': ROLES.DATA_ANALYST,
    'data analyst': ROLES.DATA_ANALYST,
    'marketing analyst': ROLES.DATA_ANALYST,
    'sales operations manager': ROLES.DATA_ANALYST,
    'super admin': ROLES.SUPER_ADMIN,
    'admin': ROLES.ADMIN,
    'employee': ROLES.EMPLOYEE,
    'viewer': ROLES.VIEWER,
  };

  const lower = clean.toLowerCase();
  return legacyRoleMap[lower] || ROLES.EMPLOYEE;
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