import mongoose from 'mongoose';
import Invitation from '../models/Invitation.js';
import User from '../models/User.js';
import { INVITATION_STATUS, USER_STATUS, USER_ROLES } from '../constants/user.js';
import { canAssignRole } from '../constants/permissions.js';
import { generateSecureToken, hashToken, hashPassword } from '../utils/crypto.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError
} from '../utils/errors.js';
import emailService from './email.service.js';
import logger from '../utils/logger.js';

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Service managing team invitation creation, hashing, single-use acceptance, and revocation.
 */

/**
 * Creates a team invitation with a cryptographically hashed single-use token.
 */
export async function createInvitation(
  organizationId,
  inviterId,
  { email, role = USER_ROLES.VIEWER, department = '', expiresInDays = 7 },
  caller = null
) {
  if (!organizationId) {
    throw new BadRequestError('organizationId is required');
  }

  if (!email || !emailRegex.test(email)) {
    throw new BadRequestError('A valid email address is required for invitation');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate role against permitted enum
  if (!role || !Object.values(USER_ROLES).includes(role)) {
    throw new BadRequestError(
      `Invalid role: "${role}". Must be one of: ${Object.values(USER_ROLES).join(', ')}`
    );
  }

  // Privilege escalation check: Caller cannot invite with a role outside their authority
  if (caller && caller.role && !canAssignRole(caller.role, role)) {
    throw new ForbiddenError(`Role "${caller.role}" is not authorized to invite members with role "${role}"`);
  }

  // 1. Check if user already exists as an active member in this tenant
  const existingUser = await User.findOne({ organizationId, email: normalizedEmail });
  if (existingUser && existingUser.status === USER_STATUS.ACTIVE) {
    throw new ConflictError(`User "${normalizedEmail}" is already an active member of this organization`);
  }

  // 2. Prevent duplicate pending unexpired invitations for the same email
  const existingPending = await Invitation.findOne({
    organizationId,
    email: normalizedEmail,
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() }
  });

  if (existingPending) {
    throw new ConflictError(
      `A pending invitation already exists for "${normalizedEmail}" in this organization`
    );
  }

  // 3. Generate raw token (64 hex characters) and compute SHA-256 hash for database
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + Math.max(1, parseInt(expiresInDays, 10) || 7) * 24 * 60 * 60 * 1000);

  const invitation = await Invitation.create({
    organizationId,
    email: normalizedEmail,
    role,
    department: String(department).trim(),
    tokenHash, // Stored securely as SHA-256 hash, rawToken is never persisted
    inviterId: inviterId || null,
    status: INVITATION_STATUS.PENDING,
    expiresAt
  });

  // Dispatches invitation email asynchronously
  emailService.sendInvitationEmail({
    to: normalizedEmail,
    inviterName: 'Administrator',
    organizationName: 'RicozData Platform',
    token: rawToken,
    role
  }).catch(err => {
    logger.warn(`[InvitationService] Non-blocking email dispatch failure: ${err.message}`);
  });

  // Return invitation doc along with rawToken for delivery (email/response)
  return {
    invitation,
    rawToken
  };
}

/**
 * Retrieves all invitations for the specified organization.
 */
export async function getInvitations(organizationId, { status } = {}) {
  if (!organizationId) {
    throw new BadRequestError('organizationId is required');
  }

  const filter = { organizationId };
  if (status && Object.values(INVITATION_STATUS).includes(status)) {
    filter.status = status;
  }

  const invitations = await Invitation.find(filter)
    .sort({ createdAt: -1 })
    .populate('inviterId', 'name email');

  return invitations;
}

/**
 * Accepts an invitation using the raw token, enforcing single-use and expiration checks.
 * Activates or creates the user in the invitation's organization.
 */
export async function acceptInvitation(rawToken, { name, password }) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new BadRequestError('Valid invitation token is required');
  }

  if (!name || name.trim().length < 2) {
    throw new BadRequestError('Full name (at least 2 characters) is required');
  }

  if (!password || password.length < 8) {
    throw new BadRequestError('Password must be at least 8 characters long');
  }

  // Compute hash of candidate token to lookup in database
  const tokenHash = hashToken(rawToken.trim());

  const invitation = await Invitation.findOne({ tokenHash }).select('+tokenHash');

  if (!invitation) {
    throw new NotFoundError('Invalid invitation token');
  }

  // Enforce single-use
  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new BadRequestError('This invitation has already been accepted (single-use token)');
  }

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    throw new BadRequestError('This invitation has been revoked by an administrator');
  }

  // Check expiration
  if (invitation.isExpired() || invitation.status === INVITATION_STATUS.EXPIRED) {
    invitation.status = INVITATION_STATUS.EXPIRED;
    await invitation.save();
    throw new BadRequestError('This invitation has expired');
  }

  // Hash password using enterprise scrypt KDF
  const hashedPassword = hashPassword(password);

  // Check if placeholder user exists or create new active tenant user
  let user = await User.findOne({
    organizationId: invitation.organizationId,
    email: invitation.email
  });

  if (user) {
    user.name = name.trim();
    user.passwordHash = hashedPassword;
    user.role = invitation.role;
    user.department = invitation.department || user.department;
    user.status = USER_STATUS.ACTIVE;
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
  } else {
    user = await User.create({
      organizationId: invitation.organizationId,
      name: name.trim(),
      email: invitation.email,
      passwordHash: hashedPassword,
      role: invitation.role,
      department: invitation.department || '',
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date()
    });
  }

  // Mark invitation as accepted and invalidate token
  invitation.status = INVITATION_STATUS.ACCEPTED;
  invitation.acceptedAt = new Date();
  await invitation.save();

  return user;
}

/**
 * Revokes a pending invitation within the tenant boundary.
 */
export async function revokeInvitation(organizationId, invitationId) {
  if (!organizationId || !invitationId) {
    throw new BadRequestError('organizationId and invitationId are required');
  }

  if (!mongoose.Types.ObjectId.isValid(invitationId)) {
    throw new BadRequestError(`Invalid invitation ID format: "${invitationId}"`);
  }

  const invitation = await Invitation.findOne({ _id: invitationId, organizationId });

  if (!invitation) {
    throw new NotFoundError('Invitation not found in this organization');
  }

  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new BadRequestError('Cannot revoke an already accepted invitation');
  }

  invitation.status = INVITATION_STATUS.REVOKED;
  invitation.revokedAt = new Date();
  await invitation.save();

  return invitation;
}

export default {
  createInvitation,
  getInvitations,
  acceptInvitation,
  revokeInvitation
};
