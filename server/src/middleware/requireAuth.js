import tokenService from '../services/token.service.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Enterprise Authentication Middleware for RicozData.
 * Validates short-lived JWT access tokens and binds authenticated user + tenant context.
 * Strict fail-closed design.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token required. Provide valid Bearer token.', 'AUTH_REQUIRED');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedError('Malformed authorization header. Bearer token empty.', 'TOKEN_EMPTY');
    }

    // Verify JWT signature, expiration, issuer, audience
    const decoded = tokenService.verifyAccessToken(token);

    // Cross-tenant verification:
    // If request already resolved a tenant (via subdomain or header), verify access token belongs to the SAME tenant!
    if (req.organizationId && String(req.organizationId) !== String(decoded.organizationId)) {
      logger.warn(
        `[requireAuth] [SECURITY ALERT] Cross-tenant token mismatch! Token org "${decoded.organizationId}" vs request org "${req.organizationId}"`
      );
      throw new ForbiddenError(
        'Access token does not match the target tenant organization',
        'CROSS_TENANT_MISMATCH'
      );
    }

    // Load active user and verify account status
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new UnauthorizedError('Authenticated user account no longer exists', 'USER_NOT_FOUND');
    }

    if (user.status === 'suspended') {
      throw new ForbiddenError('Your account has been suspended. Please contact your administrator.', 'ACCOUNT_SUSPENDED');
    }

    if (user.status === 'deactivated') {
      throw new ForbiddenError('This account has been deactivated.', 'ACCOUNT_DEACTIVATED');
    }

    // Bind authenticated identity and verified tenant context to request
    req.user = user;
    req.userId = user._id.toString();
    req.organizationId = user.organizationId.toString();
    req.tokenPayload = decoded;

    // Ensure canonical tenant organization is bound for downstream requireTenant middleware
    if (!req.organization && user.organizationId) {
      const org = await Organization.findById(user.organizationId);
      if (org) {
        req.organization = org;
        req.tenant = org;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export default requireAuth;
