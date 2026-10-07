import crypto from 'node:crypto';
import config from '../../config/env.js';
import { BadRequestError, UnauthorizedError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

/**
 * Enterprise Google OAuth 2.0 Provider implementation.
 * Handles:
 * - Authorization code flow initiation with cryptographically signed, tamper-proof state
 * - State token verification defending against CSRF and tenant injection
 * - Secure code-for-token exchange directly with Google OAuth token endpoint
 * - Profile extraction with normalized email and stable googleId
 */
export class GoogleOAuthProvider {
  constructor(customConfig = {}) {
    this.clientId = customConfig.clientId || config.oauth.google.clientId;
    this.clientSecret = customConfig.clientSecret || config.oauth.google.clientSecret;
    this.redirectUri = customConfig.callbackUrl || config.oauth.google.callbackUrl;
    this.signingSecret = config.jwt.secret || 'ricoz_oauth_state_signing_key_2026';
  }

  /**
   * Checks if Google OAuth has credentials configured.
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  /**
   * Generates a signed, tamper-proof OAuth state token encoding tenant context and CSRF nonce.
   * @param {string} organizationId Tenant organization ID
   * @param {string} [returnUrl] Optional controlled post-auth redirect target
   * @returns {string} Hex-encoded signed state
   */
  generateState(organizationId, returnUrl = null) {
    if (!organizationId) {
      throw new BadRequestError('Tenant organizationId is required to initiate OAuth flow');
    }

    const payload = {
      orgId: String(organizationId),
      csrf: crypto.randomBytes(16).toString('hex'),
      ts: Date.now(),
      returnUrl: returnUrl || null
    };

    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payloadB64)
      .digest('base64url');

    return `${payloadB64}.${signature}`;
  }

  /**
   * Verifies and extracts state payload. Throws on tampering, expiration, or invalid format.
   * @param {string} stateString
   * @returns {{ orgId: string, csrf: string, ts: number, returnUrl: string|null }}
   */
  verifyState(stateString) {
    if (!stateString || typeof stateString !== 'string' || !stateString.includes('.')) {
      throw new UnauthorizedError('Invalid or missing OAuth state parameter');
    }

    const [payloadB64, signature] = stateString.split('.');
    if (!payloadB64 || !signature) {
      throw new UnauthorizedError('Malformed OAuth state parameter');
    }

    // Timing-safe signature verification
    const expectedSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(payloadB64)
      .digest('base64url');

    const b1 = Buffer.from(signature);
    const b2 = Buffer.from(expectedSig);
    if (b1.length !== b2.length || !crypto.timingSafeEqual(b1, b2)) {
      throw new UnauthorizedError('OAuth state signature verification failed (CSRF or tampering detected)');
    }

    try {
      const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);

      // Verify expiration (10 minutes)
      const maxAgeMs = 10 * 60 * 1000;
      if (!payload.ts || Date.now() - payload.ts > maxAgeMs) {
        throw new UnauthorizedError('OAuth state has expired. Please initiate login again.');
      }

      if (!payload.orgId) {
        throw new UnauthorizedError('OAuth state missing tenant identifier');
      }

      return payload;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Corrupt OAuth state payload');
    }
  }

  /**
   * Constructs the Google OAuth 2.0 Authorization URL.
   * @param {string} state Signed state parameter
   * @returns {string} Fully qualified Google Auth URL
   */
  getAuthorizationUrl(state) {
    if (!this.clientId) {
      throw new BadRequestError('Google OAuth Client ID is not configured on this server');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for Google user profile directly with Google OAuth API.
   * @param {string} code Authorization code from callback
   * @returns {Promise<{ googleId: string, email: string, emailVerified: boolean, name: string, avatarUrl: string }>}
   */
  async exchangeCodeForProfile(code) {
    if (!this.isConfigured()) {
      throw new BadRequestError('Google OAuth is not configured with client credentials');
    }

    // Step 1: Exchange code for token
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const bodyParams = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code'
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString()
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      logger.error(`[GoogleOAuth] Token exchange failed with status ${tokenRes.status}: ${errorText}`);
      throw new UnauthorizedError('Failed to exchange authorization code with Google');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new UnauthorizedError('Google OAuth token response missing access_token');
    }

    // Step 2: Fetch user profile
    const userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
    const userRes = await fetch(userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userRes.ok) {
      throw new UnauthorizedError('Failed to fetch user profile from Google');
    }

    const profileData = await userRes.json();
    if (!profileData.id || !profileData.email) {
      throw new UnauthorizedError('Incomplete user profile returned by Google');
    }

    return {
      googleId: String(profileData.id),
      email: String(profileData.email).trim().toLowerCase(),
      emailVerified: Boolean(profileData.verified_email),
      name: profileData.name || 'Google User',
      avatarUrl: profileData.picture || ''
    };
  }
}

export default GoogleOAuthProvider;
