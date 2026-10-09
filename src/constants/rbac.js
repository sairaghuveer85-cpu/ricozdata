/**
 * RicozData Frontend RBAC Configuration
 * Mirror of server/config/rbac.js for centralized, type-safe permission checks.
 *
 * IMPORTANT: The backend is the source of truth for authorization.
 * Frontend checks are for UX only (show/hide UI, route guards).
 * Never rely on frontend checks for security — all API routes are protected server-side.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Standardized Roles (must match backend)
// ──────────────────────────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MAIN_ADMIN: 'MAIN_ADMIN',
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
  DATA_STEWARD: 'DATA_STEWARD',
  DATA_ENGINEER: 'DATA_ENGINEER',
  DATA_ANALYST: 'DATA_ANALYST',
  VIEWER: 'VIEWER',
};

// Human-friendly display labels
export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.MAIN_ADMIN]: 'Main Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.EMPLOYEE]: 'Employee',
  [ROLES.DATA_STEWARD]: 'Data Steward',
  [ROLES.DATA_ENGINEER]: 'Data Engineer',
  [ROLES.DATA_ANALYST]: 'Data Analyst',
  [ROLES.VIEWER]: 'Viewer',
};

// Role hierarchy for frontend sorting/checks (higher = more privilege)
export const ROLE_HIERARCHY = {
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
export const PERMISSIONS = {
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
  PERMISSIONS.DATA_SOURCE_READ,
  PERMISSIONS.DATA_SOURCE_CREATE,
  PERMISSIONS.DATA_SOURCE_UPDATE,
  PERMISSIONS.DATA_SOURCE_DELETE,
  PERMISSIONS.DATA_SOURCE_TEST,
  PERMISSIONS.DATA_SOURCE_MANAGE,
  PERMISSIONS.DATASET_READ,
  PERMISSIONS.DATASET_CREATE,
  PERMISSIONS.DATASET_UPDATE,
  PERMISSIONS.DATASET_DELETE,
  PERMISSIONS.QUALITY_READ,
  PERMISSIONS.QUALITY_UPDATE,
  PERMISSIONS.QUALITY_MANAGE,
  PERMISSIONS.LINEAGE_READ,
  PERMISSIONS.LINEAGE_MANAGE,
  PERMISSIONS.GLOSSARY_READ,
  PERMISSIONS.GLOSSARY_CREATE,
  PERMISSIONS.GLOSSARY_UPDATE,
  PERMISSIONS.GLOSSARY_DELETE,
  PERMISSIONS.POLICY_READ,
  PERMISSIONS.POLICY_CREATE,
  PERMISSIONS.POLICY_UPDATE,
  PERMISSIONS.POLICY_DELETE,
  PERMISSIONS.RULE_READ,
  PERMISSIONS.RULE_CREATE,
  PERMISSIONS.RULE_UPDATE,
  PERMISSIONS.RULE_DELETE,
  PERMISSIONS.RULE_EVALUATE,
  PERMISSIONS.COMPLIANCE_READ,
  PERMISSIONS.COMPLIANCE_MANAGE,
  PERMISSIONS.ACTIVITY_READ,
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.SEARCH_READ,
  PERMISSIONS.SETTINGS_MANAGE,
];

// ──────────────────────────────────────────────────────────────────────────────
// Authoritative Role → Permission Matrix (must match backend exactly)
// ──────────────────────────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),

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

  // EMPLOYEE: Full normal RicozData application access
  [ROLES.EMPLOYEE]: [
    ...FULL_APPLICATION_PERMISSIONS,
  ],

  [ROLES.DATA_STEWARD]: [
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
    PERMISSIONS.QUALITY_MANAGE,
    PERMISSIONS.LINEAGE_READ,
    PERMISSIONS.LINEAGE_MANAGE,
    PERMISSIONS.GLOSSARY_READ,
    PERMISSIONS.GLOSSARY_CREATE,
    PERMISSIONS.GLOSSARY_UPDATE,
    PERMISSIONS.GLOSSARY_DELETE,
    PERMISSIONS.POLICY_READ,
    PERMISSIONS.POLICY_CREATE,
    PERMISSIONS.POLICY_UPDATE,
    PERMISSIONS.RULE_READ,
    PERMISSIONS.RULE_CREATE,
    PERMISSIONS.RULE_UPDATE,
    PERMISSIONS.RULE_EVALUATE,
    PERMISSIONS.COMPLIANCE_READ,
    PERMISSIONS.COMPLIANCE_MANAGE,
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

export const LEGACY_ROLE_MAP = {
  'Platform Administrator': ROLES.SUPER_ADMIN,
  'Main Admin': ROLES.MAIN_ADMIN,
  'Security Administrator': ROLES.MAIN_ADMIN,
  'Data Governance Manager': ROLES.MAIN_ADMIN,
  'Data Steward': ROLES.DATA_STEWARD,
  'Data Engineer': ROLES.DATA_ENGINEER,
  'Product Data Owner': ROLES.DATA_ENGINEER,
  'Finance Data Owner': ROLES.DATA_ANALYST,
  'Data Analyst': ROLES.DATA_ANALYST,
  'Marketing Analyst': ROLES.DATA_ANALYST,
  'Sales Operations Manager': ROLES.DATA_ANALYST,
  'Super Admin': ROLES.SUPER_ADMIN,
  'Admin': ROLES.ADMIN,
  'Employee': ROLES.EMPLOYEE,
  'Viewer': ROLES.VIEWER,
};

export function mapLegacyRole(legacyRole) {
  if (!legacyRole) return ROLES.EMPLOYEE;
  const clean = String(legacyRole).trim();
  const upper = clean.toUpperCase();
  if (Object.values(ROLES).includes(upper)) return upper;

  const legacyMap = {
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
  return legacyMap[lower] || LEGACY_ROLE_MAP[legacyRole] || ROLES.EMPLOYEE;
}

/**
 * Get all permissions for a given role
 * @param {string} role
 * @returns {string[]}
 */
export function getPermissionsForRole(role) {
  const normalizedRole = mapLegacyRole(role);
  return ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * Check if a role has a specific permission
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function roleHasPermission(role, permission) {
  const normalizedRole = mapLegacyRole(role);
  const perms = ROLE_PERMISSIONS[normalizedRole];
  return perms ? perms.includes(permission) : false;
}

export function roleGte(roleA, roleB) {
  const normA = mapLegacyRole(roleA);
  const normB = mapLegacyRole(roleB);
  return (ROLE_HIERARCHY[normA] ?? 0) >= (ROLE_HIERARCHY[normB] ?? 0);
}

export function canManageRole(requesterRole, targetRole) {
  const reqNorm = mapLegacyRole(requesterRole);
  const tgtNorm = mapLegacyRole(targetRole);
  if (reqNorm === tgtNorm) return false;
  if (reqNorm !== ROLES.SUPER_ADMIN && reqNorm !== ROLES.MAIN_ADMIN && reqNorm !== ROLES.ADMIN) {
    return false;
  }
  if (tgtNorm === ROLES.SUPER_ADMIN && reqNorm !== ROLES.SUPER_ADMIN) return false;
  if ((tgtNorm === ROLES.MAIN_ADMIN || tgtNorm === ROLES.ADMIN) && reqNorm !== ROLES.SUPER_ADMIN) return false;
  return roleGte(reqNorm, tgtNorm) && (ROLE_HIERARCHY[reqNorm] ?? 0) > (ROLE_HIERARCHY[tgtNorm] ?? 0);
}

/**
 * Get display label for a role
 * @param {string} role
 * @returns {string}
 */
export function getRoleLabel(role) {
  const normalizedRole = mapLegacyRole(role);
  return ROLE_LABELS[normalizedRole] || role;
}

/**
 * Get all standardized roles
 * @returns {string[]}
 */
export function getAllRoles() {
  return Object.values(ROLES);
}

/**
 * Validate a role string
 * @param {string} role
 * @returns {boolean}
 */
export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

/**
 * Validate a permission string
 * @param {string} permission
 * @returns {boolean}
 */
export function isValidPermission(permission) {
  return Object.values(PERMISSIONS).includes(permission);
}

/**
 * Route-level permission mapping (mirrors backend ROUTE_PERMISSIONS)
 */
export const ROUTE_PERMISSIONS = {
  '/api/datasets': { GET: PERMISSIONS.DATASET_READ, POST: PERMISSIONS.DATASET_CREATE, PUT: PERMISSIONS.DATASET_UPDATE, DELETE: PERMISSIONS.DATASET_DELETE },
  '/api/quality': { GET: PERMISSIONS.QUALITY_READ, POST: PERMISSIONS.QUALITY_UPDATE, PUT: PERMISSIONS.QUALITY_UPDATE, DELETE: PERMISSIONS.QUALITY_MANAGE },
  '/api/quality/issues': { GET: PERMISSIONS.QUALITY_READ, POST: PERMISSIONS.QUALITY_UPDATE, PUT: PERMISSIONS.QUALITY_UPDATE, DELETE: PERMISSIONS.QUALITY_MANAGE },
  '/api/lineage': { GET: PERMISSIONS.LINEAGE_READ, POST: PERMISSIONS.LINEAGE_MANAGE, PUT: PERMISSIONS.LINEAGE_MANAGE, DELETE: PERMISSIONS.LINEAGE_MANAGE },
  '/api/glossary': { GET: PERMISSIONS.GLOSSARY_READ, POST: PERMISSIONS.GLOSSARY_CREATE, PUT: PERMISSIONS.GLOSSARY_UPDATE, DELETE: PERMISSIONS.GLOSSARY_DELETE },
  '/api/policies': { GET: PERMISSIONS.POLICY_READ, POST: PERMISSIONS.POLICY_CREATE, PUT: PERMISSIONS.POLICY_UPDATE, DELETE: PERMISSIONS.POLICY_DELETE },
  '/api/activities': { GET: PERMISSIONS.ACTIVITY_READ, POST: PERMISSIONS.ACTIVITY_READ },
  '/api/dashboard': { GET: PERMISSIONS.DASHBOARD_READ },
  '/api/search': { GET: PERMISSIONS.SEARCH_READ },
  '/api/users': { GET: PERMISSIONS.USER_READ, POST: PERMISSIONS.USER_CREATE, PUT: PERMISSIONS.USER_UPDATE, DELETE: PERMISSIONS.USER_DELETE },
};