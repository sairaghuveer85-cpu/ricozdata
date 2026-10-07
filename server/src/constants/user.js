/**
 * User and Invitation constants and lifecycle transition definitions for RicozData.
 */

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  INVITED: 'invited',
  DEACTIVATED: 'deactivated'
});

export const USER_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  DATA_STEWARD: 'data_steward',
  DATA_ENGINEER: 'data_engineer',
  ANALYST: 'analyst',
  VIEWER: 'viewer'
});

export const INVITATION_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked'
});

/**
 * Permitted status transitions matrix for user lifecycle management.
 * Disallows nonsensical or backwards transitions (e.g. active -> invited).
 */
export const VALID_STATUS_TRANSITIONS = Object.freeze({
  [USER_STATUS.INVITED]: [USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED, USER_STATUS.DEACTIVATED],
  [USER_STATUS.ACTIVE]: [USER_STATUS.SUSPENDED, USER_STATUS.DEACTIVATED],
  [USER_STATUS.SUSPENDED]: [USER_STATUS.ACTIVE, USER_STATUS.DEACTIVATED],
  [USER_STATUS.DEACTIVATED]: [USER_STATUS.ACTIVE]
});

/**
 * Validates whether a requested user status transition is permitted.
 */
export function isValidStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  return Array.isArray(allowed) && allowed.includes(targetStatus);
}

export default {
  USER_STATUS,
  USER_ROLES,
  INVITATION_STATUS,
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition
};
