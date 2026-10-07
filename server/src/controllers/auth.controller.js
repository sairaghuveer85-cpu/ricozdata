import authService from '../services/auth.service.js';
import authProviderRegistry from './../services/auth/providerRegistry.js';
import Organization from '../models/Organization.js';
import tokenService from '../services/token.service.js';
import sessionService from '../services/session.service.js';
import { BadRequestError, UnauthorizedError, TenantRequiredError } from '../utils/errors.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Controller handling authentication endpoints for RicozData.
 */
class AuthController {
  /**
   * Helper to resolve tenant organizationId from request context, payload, or tenant slug.
   */
  async resolveTenantId(req) {
    let orgId = req.organizationId || req.body?.organizationId || req.query?.organizationId;
    if (!orgId) {
      const slugCandidate =
        req.headers['x-tenant-slug'] ||
        req.body?.tenantSlug ||
        req.body?.slug ||
        req.query?.tenant ||
        req.query?.slug;
      if (slugCandidate && typeof slugCandidate === 'string') {
        const org = await Organization.findOne({
          slug: slugCandidate.toLowerCase().trim(),
          status: 'active'
        });
        if (org) {
          orgId = org._id.toString();
        }
      }
    }
    if (!orgId) {
      throw new TenantRequiredError('Tenant organization is required. Provide via subdomain or header.');
    }
    return String(orgId);
  }

  /**
   * POST /api/auth/register
   */
  register = async (req, res, next) => {
    try {
      const organizationId = await this.resolveTenantId(req);
      const { name, email, password, department } = req.body;

      const result = await authService.register({
        organizationId,
        name,
        email,
        password,
        department
      });

      return res.status(201).json({
        success: true,
        message: 'User registered successfully. Please verify your email.',
        data: {
          user: result.user,
          verificationToken: config.isTest ? result.verificationToken : undefined
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/login
   * Validates credentials, creates server session, sets HTTP-only refresh cookie,
   * and issues short-lived JWT access token.
   */
  login = async (req, res, next) => {
    try {
      const organizationId = await this.resolveTenantId(req);
      const { email, password } = req.body;

      const result = await authService.login({
        organizationId,
        email,
        password
      });

      // 09.3 & 09.8: Establish server session in MongoDB
      const { session, rawRefreshToken } = await sessionService.createSession({
        userId: result.user._id,
        organizationId: result.user.organizationId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      });

      // 09.1: Generate short-lived JWT access token
      const accessToken = tokenService.generateAccessToken(result.user);

      // 09.2: Set secure HTTP-only refresh cookie
      res.cookie('ricoz_refresh_token', rawRefreshToken, sessionService.getCookieOptions());

      return res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: {
          user: result.user,
          accessToken,
          tokenType: 'Bearer',
          expiresIn: config.jwt.expiresIn,
          session: {
            ...result.session,
            accessToken,
            sessionId: session._id
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/refresh
   * Rotates refresh token, invalidates previous session, and returns new short-lived access token.
   * If token reuse is detected, revokes entire session family.
   */
  refresh = async (req, res, next) => {
    try {
      const rawRefreshToken = req.cookies?.ricoz_refresh_token || req.body?.refreshToken;
      if (!rawRefreshToken) {
        throw new UnauthorizedError('Refresh token required. Provide via HTTP-only cookie or payload.');
      }

      const { accessToken, newRefreshToken, user } = await sessionService.rotateSession(
        rawRefreshToken,
        {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        }
      );

      // Set new rotated refresh token in HTTP-only cookie
      res.cookie('ricoz_refresh_token', newRefreshToken, sessionService.getCookieOptions());

      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: config.jwt.expiresIn,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            organizationId: user.organizationId
          }
        }
      });
    } catch (error) {
      // Clear cookie on failure to prevent stale loops
      res.clearCookie('ricoz_refresh_token', sessionService.getClearCookieOptions());
      next(error);
    }
  };

  /**
   * POST /api/auth/logout
   * Revokes the current session and clears HTTP-only refresh cookie.
   */
  logout = async (req, res, next) => {
    try {
      const rawRefreshToken = req.cookies?.ricoz_refresh_token || req.body?.refreshToken;
      if (rawRefreshToken) {
        await sessionService.revokeSession(rawRefreshToken, 'user_logout');
      }

      res.clearCookie('ricoz_refresh_token', sessionService.getClearCookieOptions());

      return res.status(200).json({
        success: true,
        message: 'Successfully logged out'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/logout-all
   * Revokes all active sessions for the authenticated user and clears refresh cookie.
   */
  logoutAll = async (req, res, next) => {
    try {
      const userId = req.user?._id || req.user?.id || req.userId;
      const organizationId = req.user?.organizationId || req.organizationId;

      if (userId && organizationId) {
        await sessionService.revokeAllUserSessions(userId, organizationId, 'logout_all');
      }

      res.clearCookie('ricoz_refresh_token', sessionService.getClearCookieOptions());

      return res.status(200).json({
        success: true,
        message: 'All user sessions have been revoked successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/me
   * Returns current authenticated user and organization context.
   */
  me = async (req, res, next) => {
    try {
      const user = req.user;
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            department: user.department,
            organizationId: user.organizationId,
            profile: user.profile,
            emailVerified: user.emailVerified,
            lastLoginAt: user.lastLoginAt
          },
          organization: req.organization || null
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/forgot-password
   */
  forgotPassword = async (req, res, next) => {
    try {
      const organizationId = await this.resolveTenantId(req);
      const { email } = req.body;

      const result = await authService.requestPasswordReset({
        organizationId,
        email
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        data: config.isTest && result._testToken ? { testToken: result._testToken } : undefined
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/reset-password
   */
  resetPassword = async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;

      const result = await authService.resetPassword({
        token,
        newPassword
      });

      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/verify-email
   */
  verifyEmail = async (req, res, next) => {
    try {
      const { token, otp, email } = req.body;
      const organizationId = req.organizationId || req.body.organizationId || null;

      const result = await authService.verifyEmail({
        token,
        otp,
        email,
        organizationId
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/auth/resend-verification
   */
  resendVerification = async (req, res, next) => {
    try {
      const organizationId = await this.resolveTenantId(req);
      const { email } = req.body;

      const result = await authService.resendVerification({
        organizationId,
        email
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        data: config.isTest ? { testToken: result._testToken, testOtp: result._testOtp } : undefined
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/google
   * Initiates Google OAuth 2.0 authorization code flow.
   */
  initiateGoogleAuth = async (req, res, next) => {
    try {
      let organizationId = req.organizationId || req.query?.organizationId;

      if (!organizationId && (req.query?.tenant || req.query?.slug)) {
        const org = await Organization.findOne({ slug: req.query.tenant || req.query.slug, status: 'active' });
        if (org) organizationId = org._id.toString();
      }

      // Explicitly DEVELOPMENT-ONLY fallback:
      // In production, Google OAuth must NOT arbitrarily assign a new user to a default organization.
      if (!organizationId && !config.isProduction) {
        const defaultOrg =
          (await Organization.findOne({ slug: 'ricoz-demo', status: 'active' })) ||
          (await Organization.findOne({ status: 'active' }));
        if (defaultOrg) {
          organizationId = defaultOrg._id.toString();
          logger.debug(`[AuthController] Using development-only fallback tenant: "${defaultOrg.slug}"`);
        }
      }

      if (!organizationId) {
        throw new TenantRequiredError(
          'Tenant organization is required to initiate Google authentication. Please sign in via your organization workspace URL (e.g. your-org.ricozdata.io) or specify organization identifier.'
        );
      }

      const googleProvider = authProviderRegistry.get('google');
      const state = googleProvider.generateState(organizationId, req.query.returnUrl);
      const authUrl = googleProvider.getAuthorizationUrl(state);

      // Support direct redirect for browsers or JSON for API clients
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          data: {
            authUrl,
            state
          }
        });
      }

      return res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/auth/google/callback
   * Handles Google OAuth 2.0 redirect callback.
   * Establishes server session, sets HTTP-only refresh cookie, and redirects cleanly
   * WITHOUT sensitive parameters in the query string.
   */
  googleCallback = async (req, res, next) => {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        throw new BadRequestError(`Google OAuth error: ${oauthError}`);
      }

      if (!code || !state) {
        throw new BadRequestError('Missing authorization code or state from Google callback');
      }

      const result = await authService.handleGoogleCallback({ code, state });

      // 09.3: Establish authenticated server session
      const { session, rawRefreshToken } = await sessionService.createSession({
        userId: result.user._id,
        organizationId: result.user.organizationId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      });

      // 09.1: Generate short-lived JWT access token
      const accessToken = tokenService.generateAccessToken(result.user);

      // 09.2: Set secure HTTP-only refresh cookie
      res.cookie('ricoz_refresh_token', rawRefreshToken, sessionService.getCookieOptions());

      // If client requested JSON response (e.g. testing or API caller)
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: 'Google authentication successful',
          data: {
            user: result.user,
            accessToken,
            session: {
              ...result.session,
              accessToken,
              sessionId: session._id
            },
            returnUrl: result.returnUrl
          }
        });
      }

      // 09.7: Browser redirect to configured frontend client URL
      // REMOVED any security-sensitive identity data (no userId, email, role, or name)
      const clientBase = config.clientUrl || 'http://localhost:5173';
      const redirectParams = new URLSearchParams({
        status: 'success'
      });
      if (result.returnUrl && result.returnUrl.startsWith('/')) {
        redirectParams.set('returnUrl', result.returnUrl);
      }

      const redirectTarget = `${clientBase}/auth/callback?${redirectParams.toString()}`;

      return res.redirect(redirectTarget);
    } catch (error) {
      logger.error(`[AuthController] Google OAuth callback error: ${error.message}`);
      // For browser requests, redirect to frontend with error parameter
      if (!req.headers.accept || !req.headers.accept.includes('application/json')) {
        const clientBase = config.clientUrl || 'http://localhost:5173';
        return res.redirect(`${clientBase}/auth/callback?status=error&message=${encodeURIComponent(error.message)}`);
      }
      next(error);
    }
  };

  /**
   * GET /api/auth/providers
   * Returns supported identity providers and configuration status.
   */
  listProviders = async (req, res, next) => {
    try {
      const providers = authProviderRegistry.getStatus();
      return res.status(200).json({
        success: true,
        data: {
          providers,
          supported: authProviderRegistry.listSupported()
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
export default authController;
