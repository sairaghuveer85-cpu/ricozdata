import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Invitation from '../models/Invitation.js';
import config from '../config/env.js';
import { USER_STATUS, USER_ROLES, INVITATION_STATUS } from '../constants/user.js';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateSecureToken,
  hashToken,
  generateOtp,
  hashOtp,
  verifyOtp
} from '../utils/crypto.js';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TenantRequiredError
} from '../utils/errors.js';
import emailService from './email.service.js';
import authProviderRegistry from './auth/providerRegistry.js';
import logger from '../utils/logger.js';

// Pre-computed dummy hash to prevent timing attacks when email does not exist
const DUMMY_HASH = '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * Validates password complexity:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - At least one letter and at least one number or special character
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    throw new BadRequestError('Password must be a non-empty string');
  }
  if (password.length < 8) {
    throw new BadRequestError('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    throw new BadRequestError('Password cannot exceed 128 characters');
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSpecial = /[\d\W_]/.test(password);
  if (!hasLetter || !hasDigitOrSpecial) {
    throw new BadRequestError('Password must contain at least one letter and at least one number or symbol');
  }
}

/**
 * Enterprise Authentication Service for RicozData.
 */
class AuthService {
  /**
   * Registers a new user within a tenant context.
   */
  async register({ organizationId, name, email, password, department = '' }) {
    if (!organizationId) {
      throw new TenantRequiredError('Tenant organizationId is required for user registration');
    }

    // Verify tenant organization exists and is active
    const org = await Organization.findById(organizationId);
    if (!org) {
      throw new NotFoundError('Target organization not found');
    }
    if (org.status !== 'active') {
      throw new ForbiddenError(`Organization status is "${org.status}". Registration is unavailable.`);
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new BadRequestError('Name must be at least 2 characters long');
    }

    if (!email || typeof email !== 'string') {
      throw new BadRequestError('Valid email address is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new BadRequestError('Invalid email format');
    }

    validatePasswordStrength(password);

    // Tenant-scoped uniqueness check
    const existing = await User.findOne({ organizationId, email: normalizedEmail });
    if (existing) {
      throw new ConflictError(`A user with email "${normalizedEmail}" already exists in this organization`);
    }

    // Secure bcrypt hash
    const passwordHash = hashPassword(password);

    // Generate initial email verification token & OTP
    const rawVerificationToken = generateSecureToken(32);
    const verificationOtp = generateOtp(6);
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = new User({
      organizationId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: USER_ROLES.ANALYST, // Safe default member role
      status: USER_STATUS.ACTIVE,
      department: department ? String(department).trim() : '',
      emailVerified: false,
      emailVerificationTokenHash: hashToken(rawVerificationToken),
      emailVerificationOtpHash: hashOtp(verificationOtp),
      emailVerificationExpiresAt: verificationExpiresAt,
      emailVerificationAttempts: 0,
      emailVerificationSentAt: new Date()
    });

    await user.save();
    logger.info(`[AuthService] Registered new user "${normalizedEmail}" in organization "${organizationId}"`);

    // Asynchronously dispatch verification email
    emailService.sendVerificationEmail({
      to: normalizedEmail,
      name: user.name,
      token: rawVerificationToken,
      otp: verificationOtp
    }).catch(err => {
      logger.warn(`[AuthService] Non-blocking verification email error: ${err.message}`);
    });

    return {
      user,
      verificationToken: rawVerificationToken // Provided during registration response for dev/test workflows
    };
  }

  /**
   * Authenticates user credentials within tenant context.
   */
  async login({ organizationId, email, password }) {
    if (!organizationId) {
      throw new TenantRequiredError('Tenant organizationId is required for login');
    }

    if (!email || !password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Query user explicitly selecting passwordHash
    const user = await User.findOne({
      organizationId,
      email: normalizedEmail
    }).select('+passwordHash');

    // Anti-enumeration: always run verifyPassword even if user not found to normalize response timing
    if (!user) {
      verifyPassword(password, DUMMY_HASH);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Handle account lifecycle statuses
    if (user.status === USER_STATUS.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact your organization administrator.');
    }

    if (user.status === USER_STATUS.DEACTIVATED) {
      throw new ForbiddenError('This account is deactivated. Please contact support to reactivate.');
    }

    if (user.status === USER_STATUS.INVITED && !user.passwordHash) {
      throw new UnauthorizedError('Account invitation is pending. Please complete account setup using your invitation link.');
    }

    // Verify password candidate
    const isValid = user.isValidPassword(password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Transparent password migration: upgrade legacy scrypt or low-cost hashes to modern bcrypt
    if (needsRehash(user.passwordHash)) {
      user.passwordHash = hashPassword(password);
      logger.info(`[AuthService] Transparently upgraded password hash for user "${user._id}" to bcrypt(12)`);
    }

    // Update login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    logger.info(`[AuthService] User "${normalizedEmail}" logged in successfully (org: "${organizationId}")`);

    // Prepare auth tokens interface for Step 09 (JWT & Refresh token foundation)
    const authSession = this.createAuthSession(user);

    return {
      user,
      session: authSession
    };
  }

  /**
   * Requests a password reset token.
   * Defends against account enumeration by always returning an identical generic success message.
   */
  async requestPasswordReset({ organizationId, email }) {
    if (!organizationId) {
      throw new TenantRequiredError('Tenant organizationId is required for password reset');
    }

    const genericResponse = {
      message: 'If an account exists with that email in this organization, password reset instructions have been sent.'
    };

    if (!email || typeof email !== 'string') {
      return genericResponse;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ organizationId, email: normalizedEmail });

    if (!user || user.status === USER_STATUS.DEACTIVATED) {
      return genericResponse;
    }

    // Generate 32-byte cryptographically secure token
    const rawResetToken = generateSecureToken(32);
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store only SHA-256 hash in MongoDB
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    logger.info(`[AuthService] Generated password reset token for "${normalizedEmail}" (expires in 1h)`);

    // Dispatch email
    emailService.sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
      token: rawResetToken
    }).catch(err => {
      logger.warn(`[AuthService] Non-blocking reset email error: ${err.message}`);
    });

    return {
      ...genericResponse,
      _testToken: config.isTest ? rawResetToken : undefined // Only exposed in test environments
    };
  }

  /**
   * Resets password using a validated reset token.
   */
  async resetPassword({ token, newPassword }) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestError('Password reset token is required');
    }

    validatePasswordStrength(newPassword);

    const tokenHash = hashToken(token.trim());

    // Locate user by active, unexpired token hash
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() }
    }).select('+passwordHash +passwordResetTokenHash');

    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    // Set new password with bcrypt
    user.passwordHash = hashPassword(newPassword);

    // Single-use: immediately invalidate reset token
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;

    await user.save();
    logger.info(`[AuthService] Successfully reset password for user "${user._id}"`);

    return {
      message: 'Password has been successfully reset. You may now log in with your new credentials.'
    };
  }

  /**
   * Verifies user email via URL token or 6-digit OTP code.
   */
  async verifyEmail({ token, otp, email, organizationId }) {
    // 1. Verification via URL token
    if (token) {
      const tokenHash = hashToken(String(token).trim());
      const user = await User.findOne({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gt: new Date() }
      }).select('+emailVerificationTokenHash');

      if (!user) {
        throw new BadRequestError('Invalid or expired email verification token');
      }

      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      user.emailVerificationTokenHash = null;
      user.emailVerificationOtpHash = null;
      user.emailVerificationExpiresAt = null;
      user.emailVerificationAttempts = 0;
      await user.save();

      logger.info(`[AuthService] Verified email for user "${user.email}" via token`);
      return { message: 'Email address has been successfully verified.', user };
    }

    // 2. Verification via 6-digit OTP
    if (otp) {
      if (!organizationId) {
        throw new TenantRequiredError('Tenant organizationId is required for OTP verification');
      }
      if (!email) {
        throw new BadRequestError('Email is required for OTP verification');
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await User.findOne({
        organizationId,
        email: normalizedEmail
      }).select('+emailVerificationOtpHash +emailVerificationTokenHash');

      if (!user) {
        throw new BadRequestError('Invalid or expired verification code');
      }

      if (user.emailVerified) {
        return { message: 'Email address is already verified.', user };
      }

      if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
        throw new BadRequestError('Verification code has expired. Please request a new code.');
      }

      // Check brute-force attempt limit (max 5 attempts)
      if (user.emailVerificationAttempts >= 5) {
        throw new BadRequestError('Maximum verification attempts exceeded. Please request a new code.');
      }

      const isOtpValid = verifyOtp(otp, user.emailVerificationOtpHash);
      if (!isOtpValid) {
        user.emailVerificationAttempts += 1;
        await user.save();
        const remaining = 5 - user.emailVerificationAttempts;
        throw new BadRequestError(`Invalid verification code. ${remaining} attempts remaining.`);
      }

      // Successful verification
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      user.emailVerificationTokenHash = null;
      user.emailVerificationOtpHash = null;
      user.emailVerificationExpiresAt = null;
      user.emailVerificationAttempts = 0;
      await user.save();

      logger.info(`[AuthService] Verified email for user "${user.email}" via OTP`);
      return { message: 'Email address has been successfully verified.', user };
    }

    throw new BadRequestError('Either verification token or 6-digit OTP code must be provided');
  }

  /**
   * Resends email verification code/token with cooldown rate-limiting.
   */
  async resendVerification({ organizationId, email }) {
    if (!organizationId) {
      throw new TenantRequiredError('Tenant organizationId is required to resend verification');
    }

    const genericResponse = {
      message: 'If an unverified account exists with that email, a new verification link has been sent.'
    };

    if (!email || typeof email !== 'string') {
      return genericResponse;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ organizationId, email: normalizedEmail });

    if (!user) {
      return genericResponse;
    }

    if (user.emailVerified) {
      return { message: 'Email address is already verified.' };
    }

    // Cooldown check (60 seconds)
    if (user.emailVerificationSentAt) {
      const elapsedMs = Date.now() - new Date(user.emailVerificationSentAt).getTime();
      if (elapsedMs < 60 * 1000) {
        const waitSec = Math.ceil((60000 - elapsedMs) / 1000);
        throw new BadRequestError(`Please wait ${waitSec} seconds before requesting another verification code.`);
      }
    }

    const rawVerificationToken = generateSecureToken(32);
    const verificationOtp = generateOtp(6);

    user.emailVerificationTokenHash = hashToken(rawVerificationToken);
    user.emailVerificationOtpHash = hashOtp(verificationOtp);
    user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.emailVerificationAttempts = 0;
    user.emailVerificationSentAt = new Date();
    await user.save();

    emailService.sendVerificationEmail({
      to: normalizedEmail,
      name: user.name,
      token: rawVerificationToken,
      otp: verificationOtp
    }).catch(err => {
      logger.warn(`[AuthService] Non-blocking resend verification email error: ${err.message}`);
    });

    return {
      ...genericResponse,
      _testToken: config.isTest ? rawVerificationToken : undefined,
      _testOtp: config.isTest ? verificationOtp : undefined
    };
  }

  /**
   * Handles Google OAuth authorization code callback.
   * Performs CSRF state validation, identity exchange, tenant safety checks, and safe account linking.
   */
  async handleGoogleCallback({ code, state }) {
    const googleProvider = authProviderRegistry.get('google');

    // Verify HMAC-signed OAuth state and extract tenant context
    const statePayload = googleProvider.verifyState(state);
    const organizationId = statePayload.orgId;

    // Exchange authorization code with Google
    const profile = await googleProvider.exchangeCodeForProfile(code);
    const { googleId, email, name, avatarUrl } = profile;

    // Verify target organization exists and is active
    const org = await Organization.findById(organizationId);
    if (!org || org.status !== 'active') {
      throw new ForbiddenError('Target organization is invalid or inactive');
    }

    // Check if an existing account with this googleId exists in another organization
    const crossOrgUser = await User.findOne({
      googleId,
      organizationId: { $ne: organizationId }
    });
    if (crossOrgUser) {
      // Disallow cross-tenant Google account injection
      logger.warn(`[AuthService] Prevented cross-tenant Google account linking for googleId ${googleId}`);
      throw new ForbiddenError('This Google identity is associated with another organization');
    }

    // Step 1: Look for user by googleId within target tenant
    let user = await User.findOne({ organizationId, googleId });

    // Step 2: If not found by googleId, check by normalized email within tenant
    if (!user) {
      user = await User.findOne({ organizationId, email });

      if (user) {
        // Safe Account Linking:
        // If user already linked to a different googleId, reject
        if (user.googleId && user.googleId !== googleId) {
          throw new ConflictError('This account is already linked to a different Google account');
        }

        // Link existing account to this Google identity
        user.googleId = googleId;
        user.emailVerified = true;
        if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
        if (avatarUrl && !user.profile?.avatarUrl) {
          user.profile = { ...(user.profile || {}), avatarUrl };
        }
        await user.save();
        logger.info(`[AuthService] Safely linked Google ID to existing user "${email}" in org "${organizationId}"`);
      } else {
        // Step 3: Invite-First Enterprise Onboarding
        // Check if an unexpired pending invitation exists for this email in the target organization
        const pendingInvite = await Invitation.findOne({
          organizationId,
          email,
          status: INVITATION_STATUS.PENDING,
          expiresAt: { $gt: new Date() }
        });

        if (pendingInvite) {
          // Auto-fulfill invitation: create active member with invited role and department
          user = new User({
            organizationId,
            name,
            email,
            authProvider: 'google',
            googleId,
            role: pendingInvite.role || USER_ROLES.VIEWER,
            department: pendingInvite.department || '',
            status: USER_STATUS.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            profile: { avatarUrl }
          });
          await user.save();

          // Mark invitation accepted
          pendingInvite.status = INVITATION_STATUS.ACCEPTED;
          pendingInvite.acceptedAt = new Date();
          await pendingInvite.save();

          logger.info(`[AuthService] Accepted pending invitation for "${email}" via Google OAuth in org "${organizationId}"`);
        } else if (!config.isProduction) {
          // Development/Testing fallback: auto-provision new test account
          user = new User({
            organizationId,
            name,
            email,
            authProvider: 'google',
            googleId,
            role: USER_ROLES.VIEWER,
            status: USER_STATUS.ACTIVE,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            profile: { avatarUrl }
          });
          await user.save();
          logger.info(`[AuthService] [DevMode] Created new user via Google OAuth "${email}" in org "${organizationId}"`);
        } else {
          // Production: Reject uninvited self-registration attempts
          logger.warn(`[AuthService] Rejected uninvited Google sign-in attempt for "${email}" in org "${organizationId}"`);
          throw new ForbiddenError(
            `No enterprise account or pending invitation found for "${email}" in this organization. Please contact your administrator for an invitation.`
          );
        }
      }
    }

    // Account status check
    if (user.status === USER_STATUS.SUSPENDED) {
      throw new ForbiddenError('Your account has been suspended. Please contact your organization administrator.');
    }
    if (user.status === USER_STATUS.DEACTIVATED) {
      throw new ForbiddenError('This account has been deactivated.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const session = this.createAuthSession(user);

    return {
      user,
      session,
      returnUrl: statePayload.returnUrl
    };
  }

  /**
   * Prepares clean session / authentication structure for Step 09.
   */
  createAuthSession(user) {
    return {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      tokenType: 'Bearer',
      expiresIn: config.jwt.expiresIn,
      issuedAt: new Date()
    };
  }
}

export const authService = new AuthService();
export default authService;
