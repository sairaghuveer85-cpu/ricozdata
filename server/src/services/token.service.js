import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Enterprise Token Service for RicozData.
 * Handles signing, verification, and decoding of short-lived JWT access tokens.
 */
class TokenService {
  /**
   * Generates a short-lived signed JWT access token.
   * @param {Object} user - User document or identity object
   * @param {Object} options - Override options (e.g. expiresIn)
   * @returns {string} Signed JWT string
   */
  generateAccessToken(user, options = {}) {
    if (!user) {
      throw new Error('User identity is required to generate access token');
    }

    const userId = String(user._id || user.id || user.userId);
    const organizationId = String(user.organizationId);
    const role = user.role;

    if (!userId || !organizationId || !role) {
      throw new Error('User ID, organization ID, and role are required claims for access token');
    }

    // Minimal secure claims — never include sensitive credentials or states
    const payload = {
      sub: userId,
      userId,
      organizationId,
      role
    };

    const signOptions = {
      algorithm: 'HS256',
      expiresIn: options.expiresIn || config.jwt.expiresIn || '15m',
      issuer: options.issuer || config.jwt.issuer || 'ricozdata',
      audience: options.audience || config.jwt.audience || 'ricozdata-api',
      jwtid: crypto.randomUUID()
    };

    return jwt.sign(payload, config.jwt.secret, signOptions);
  }

  /**
   * Verifies and decodes a signed JWT access token.
   * Fails closed on expired, malformed, tampered, or mismatched tokens.
   * @param {string} token - Raw JWT string
   * @param {Object} options - Verification options
   * @returns {Object} Decoded payload
   */
  verifyAccessToken(token, options = {}) {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Access token is missing or invalid');
    }

    const verifyOptions = {
      algorithms: ['HS256'],
      issuer: options.issuer !== undefined ? options.issuer : (config.jwt.issuer || 'ricozdata'),
      audience: options.audience !== undefined ? options.audience : (config.jwt.audience || 'ricozdata-api')
    };

    try {
      const decoded = jwt.verify(token, config.jwt.secret, verifyOptions);
      return decoded;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token has expired', 'TOKEN_EXPIRED');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedError(`Access token is invalid: ${err.message}`, 'TOKEN_INVALID');
      }
      if (err.name === 'NotBeforeError') {
        throw new UnauthorizedError('Access token is not active yet', 'TOKEN_NOT_ACTIVE');
      }
      throw new UnauthorizedError('Access token verification failed', 'AUTH_FAILED');
    }
  }

  /**
   * Decodes a token without verifying signature (for inspection only).
   */
  decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }
}

export const tokenService = new TokenService();
export default tokenService;
