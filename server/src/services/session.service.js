import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';
import tokenService from './token.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Parses time string (e.g. '30d', '7d', '15m', '1h') to milliseconds.
 */
function parseDurationToMs(str, defaultMs = 30 * 24 * 60 * 60 * 1000) {
  if (!str || typeof str !== 'string') return defaultMs;
  const match = str.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return defaultMs;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return defaultMs;
  }
}

/**
 * Enterprise Session & Refresh Token Service for RicozData.
 * Implements token families, automatic rotation, revocation, and reuse detection.
 */
class SessionService {
  /**
   * Returns standardized secure HTTP-only cookie configuration.
   */
  getCookieOptions() {
    const refreshDurationMs = parseDurationToMs(config.jwt.refreshExpiresIn, 30 * 24 * 60 * 60 * 1000);
    return {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: refreshDurationMs
    };
  }

  /**
   * Returns options for clearing the refresh token cookie.
   */
  getClearCookieOptions() {
    return {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      path: '/'
    };
  }

  /**
   * Establishes a new authenticated session and issues a cryptographically random refresh token.
   */
  async createSession({ userId, organizationId, userAgent = '', ipAddress = '', tokenFamilyId = null }) {
    if (!userId || !organizationId) {
      throw new Error('userId and organizationId are required to create a session');
    }

    const rawRefreshToken = generateSecureToken(32);
    const tokenHash = hashToken(rawRefreshToken);
    const familyId = tokenFamilyId || generateSecureToken(16);

    const refreshDurationMs = parseDurationToMs(config.jwt.refreshExpiresIn, 30 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + refreshDurationMs);

    const session = new Session({
      userId,
      organizationId,
      tokenHash,
      tokenFamilyId: familyId,
      expiresAt,
      userAgent: userAgent ? String(userAgent).slice(0, 500) : '',
      ipAddress: ipAddress ? String(ipAddress).slice(0, 100) : ''
    });

    await session.save();

    logger.debug(`[SessionService] Established new session for user "${userId}" (family: "${familyId}")`);

    return {
      session,
      rawRefreshToken
    };
  }

  /**
   * Performs refresh token rotation with strict reuse detection.
   * Every refresh operation rotates the token and invalidates the previous one.
   * If an already rotated or revoked token is presented, reuse detection revokes the entire family.
   */
  async rotateSession(rawRefreshToken, { userAgent = '', ipAddress = '' } = {}) {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedError('Refresh token is required');
    }

    const tokenHash = hashToken(rawRefreshToken.trim());

    // Look up session by token hash
    const session = await Session.findOne({ tokenHash });

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // =========================================================================
    // 09.5 REUSE DETECTION:
    // If a previously rotated or revoked token is presented, someone may have stolen it.
    // Immediately revoke the ENTIRE token family.
    // =========================================================================
    if (session.revokedAt) {
      logger.warn(
        `[SessionService] [SECURITY ALERT] Refresh token reuse detected! Token family "${session.tokenFamilyId}" compromised. Revoking entire chain.`
      );

      // Invalidate all active sessions in the compromised token family
      await Session.updateMany(
        {
          tokenFamilyId: session.tokenFamilyId,
          revokedAt: null
        },
        {
          revokedAt: new Date(),
          revokedReason: 'compromised_reuse_detected'
        }
      );

      throw new UnauthorizedError(
        'Suspicious refresh token reuse detected. All sessions in this chain have been terminated for security.'
      );
    }

    // Check expiration
    if (session.isExpired()) {
      session.revokedAt = new Date();
      session.revokedReason = 'expired';
      await session.save();
      throw new UnauthorizedError('Refresh token has expired');
    }

    // Verify user account is still valid and active
    const user = await User.findById(session.userId);
    if (!user || user.status === 'suspended' || user.status === 'deactivated') {
      session.revokedAt = new Date();
      session.revokedReason = 'user_inactive';
      await session.save();
      throw new ForbiddenError('User account is inactive or suspended');
    }

    // Verify organization is still active
    const org = await Organization.findById(session.organizationId);
    if (!org || org.status !== 'active') {
      session.revokedAt = new Date();
      session.revokedReason = 'tenant_inactive';
      await session.save();
      throw new ForbiddenError('Organization is inactive or suspended');
    }

    // =========================================================================
    // 09.4 ROTATION:
    // Generate new refresh token in the same family, replace previous session
    // =========================================================================
    const newRawRefreshToken = generateSecureToken(32);
    const newHash = hashToken(newRawRefreshToken);

    const refreshDurationMs = parseDurationToMs(config.jwt.refreshExpiresIn, 30 * 24 * 60 * 60 * 1000);
    const newExpiresAt = new Date(Date.now() + refreshDurationMs);

    const newSession = new Session({
      userId: session.userId,
      organizationId: session.organizationId,
      tokenHash: newHash,
      tokenFamilyId: session.tokenFamilyId,
      expiresAt: newExpiresAt,
      userAgent: userAgent ? String(userAgent).slice(0, 500) : session.userAgent,
      ipAddress: ipAddress ? String(ipAddress).slice(0, 100) : session.ipAddress
    });

    await newSession.save();

    // Revoke previous session and link to the replacement
    session.revokedAt = new Date();
    session.revokedReason = 'rotated';
    session.replacedBy = newSession._id.toString();
    session.lastUsedAt = new Date();
    await session.save();

    // Issue short-lived access token
    const accessToken = tokenService.generateAccessToken(user);

    logger.debug(
      `[SessionService] Successfully rotated refresh token for user "${user._id}" (family: "${session.tokenFamilyId}")`
    );

    return {
      accessToken,
      newRefreshToken: newRawRefreshToken,
      session: newSession,
      user
    };
  }

  /**
   * Revokes a single session by its raw refresh token (e.g. single logout).
   */
  async revokeSession(rawRefreshToken, reason = 'user_logout') {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') return;
    const tokenHash = hashToken(rawRefreshToken.trim());
    await Session.findOneAndUpdate(
      { tokenHash, revokedAt: null },
      {
        revokedAt: new Date(),
        revokedReason: reason
      }
    );
  }

  /**
   * Revokes all active sessions for a user within an organization (e.g. logout all devices).
   */
  async revokeAllUserSessions(userId, organizationId, reason = 'logout_all') {
    if (!userId || !organizationId) return;
    const query = {
      userId,
      organizationId,
      revokedAt: null
    };

    const result = await Session.updateMany(query, {
      revokedAt: new Date(),
      revokedReason: reason
    });

    logger.info(
      `[SessionService] Revoked ${result.modifiedCount} sessions for user "${userId}" in org "${organizationId}" (reason: ${reason})`
    );

    return result.modifiedCount;
  }
}

export const sessionService = new SessionService();
export default sessionService;
