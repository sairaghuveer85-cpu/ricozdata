import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import jwt from 'jsonwebtoken';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { USER_STATUS, USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import { hashPassword } from '../src/utils/crypto.js';
import tokenService from '../src/services/token.service.js';
import sessionService from '../src/services/session.service.js';
import authProviderRegistry from '../src/services/auth/providerRegistry.js';

describe('Step 09 — Enterprise JWT Security, Session Management & Google OAuth Migration', () => {
  let server;
  let baseUrl;
  let orgAlpha;
  let orgBeta;
  let activeUserAlpha;
  let activeUserBeta;
  let suspendedUserAlpha;

  const validPassword = 'SecurePassword123!';

  // Helper for HTTP requests
  async function apiRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = { ...options.headers };
    let body = options.body;

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual'
    });

    let resBody = null;
    const text = await response.text();
    try {
      resBody = JSON.parse(text);
    } catch {
      resBody = text;
    }

    // Extract cookies
    const setCookie = response.headers.get('set-cookie');

    return {
      status: response.status,
      headers: response.headers,
      body: resBody,
      setCookie
    };
  }

  // Helper to extract cookie value
  function extractCookie(cookieHeader, name) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? match[1] : null;
  }

  before(async () => {
    await connectDB();

    // Clean up test data
    const testSlugs = ['test-step9-alpha', 'test-step9-beta'];
    const existingOrgs = await Organization.find({ slug: { $in: testSlugs } });
    const orgIds = existingOrgs.map((o) => o._id);

    await Session.deleteMany({ organizationId: { $in: orgIds } });
    await User.deleteMany({ organizationId: { $in: orgIds } });
    await Organization.deleteMany({ _id: { $in: orgIds } });

    // Seed test organizations
    orgAlpha = await Organization.create({
      name: 'Step9 Alpha Corp',
      slug: 'test-step9-alpha',
      status: 'active'
    });

    orgBeta = await Organization.create({
      name: 'Step9 Beta Corp',
      slug: 'test-step9-beta',
      status: 'active'
    });

    // Seed active users
    activeUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Alice Alpha',
      email: 'alice@step9alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerified: true
    });

    activeUserBeta = await User.create({
      organizationId: orgBeta._id,
      name: 'Bob Beta',
      email: 'bob@step9beta.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.DATA_STEWARD,
      status: USER_STATUS.ACTIVE,
      emailVerified: true
    });

    suspendedUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Sam Suspended',
      email: 'sam@step9alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.VIEWER,
      status: USER_STATUS.SUSPENDED
    });

    // Ephemeral HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (orgAlpha && orgBeta) {
      await Session.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
      await User.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
      await Organization.deleteMany({ _id: { $in: [orgAlpha._id, orgBeta._id] } });
    }
    await disconnectDB();
  });

  // =========================================================================
  // 09.1 ACCESS TOKENS
  // =========================================================================
  test('1. Valid access token: signed with dedicated secret and minimal claims', () => {
    const token = tokenService.generateAccessToken(activeUserAlpha);
    assert.ok(token);
    assert.strictEqual(typeof token, 'string');

    const decoded = tokenService.verifyAccessToken(token);
    assert.strictEqual(decoded.userId, activeUserAlpha._id.toString());
    assert.strictEqual(decoded.organizationId, orgAlpha._id.toString());
    assert.strictEqual(decoded.role, USER_ROLES.ADMIN);
    assert.strictEqual(decoded.iss, 'ricozdata');
    assert.strictEqual(decoded.aud, 'ricozdata-api');
    assert.strictEqual(decoded.passwordHash, undefined, 'No sensitive data in claims');
  });

  test('2. Missing access token: /api/auth/me without authorization header returns 401', async () => {
    const res = await apiRequest('/api/auth/me');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Authentication token required/i);
  });

  test('3. Malformed access token: corrupted token string returns 401', async () => {
    const res = await apiRequest('/api/auth/me', {
      headers: { Authorization: 'Bearer this.is.not.a.valid.jwt' }
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /invalid/i);
  });

  test('4. Expired access token: rejected when expired', async () => {
    // Generate token that expires immediately
    const expiredToken = tokenService.generateAccessToken(activeUserAlpha, { expiresIn: '1ms' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.throws(() => {
      tokenService.verifyAccessToken(expiredToken);
    }, /expired/i);

    const res = await apiRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res.status, 401);
    assert.match(res.body.message, /expired/i);
  });

  test('5. Wrong signature: token signed with foreign key returns 401', async () => {
    const fakeSecret = 'a_completely_different_foreign_secret_key_12345';
    const fakeToken = jwt.sign(
      {
        sub: activeUserAlpha._id.toString(),
        userId: activeUserAlpha._id.toString(),
        organizationId: orgAlpha._id.toString(),
        role: activeUserAlpha.role
      },
      fakeSecret,
      { algorithm: 'HS256', issuer: 'ricozdata', audience: 'ricozdata-api' }
    );

    const res = await apiRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${fakeToken}` }
    });
    assert.strictEqual(res.status, 401);
    assert.match(res.body.message, /invalid signature|verification failed/i);
  });

  test('6. Wrong issuer / audience: token with mismatched issuer/audience returns 401', async () => {
    const wrongIssuerToken = jwt.sign(
      {
        sub: activeUserAlpha._id.toString(),
        userId: activeUserAlpha._id.toString(),
        organizationId: orgAlpha._id.toString(),
        role: activeUserAlpha.role
      },
      config.jwt.secret,
      { algorithm: 'HS256', issuer: 'untrusted-issuer', audience: 'ricozdata-api' }
    );

    const res = await apiRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${wrongIssuerToken}` }
    });
    assert.strictEqual(res.status, 401);
    assert.match(res.body.message, /jwt issuer invalid|verification failed/i);
  });

  // =========================================================================
  // 09.2 & 09.3 SESSION MODEL & REFRESH TOKENS
  // =========================================================================
  test('7. Database never stores raw refresh tokens: only SHA-256 hash stored in Session collection', async () => {
    const { session, rawRefreshToken } = await sessionService.createSession({
      userId: activeUserAlpha._id,
      organizationId: orgAlpha._id
    });

    assert.ok(session._id);
    assert.ok(rawRefreshToken);
    assert.notStrictEqual(rawRefreshToken, session.tokenHash);

    // Query directly from MongoDB to verify stored structure
    const dbRecord = await Session.findById(session._id).select('+tokenHash');
    assert.ok(dbRecord);
    assert.notStrictEqual(dbRecord.tokenHash, rawRefreshToken);
    assert.strictEqual(dbRecord.tokenHash.length, 64, 'SHA-256 hex hash length must be 64 characters');
  });

  // =========================================================================
  // 09.4 REFRESH TOKEN ROTATION
  // =========================================================================
  test('8. Refresh rotation: POST /api/auth/refresh rotates token, invalidates previous session, and returns new access token', async () => {
    // Perform login to get initial session and cookie
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'alice@step9alpha.com',
        password: validPassword
      }
    });

    assert.strictEqual(loginRes.status, 200);
    assert.ok(loginRes.body.data.accessToken);
    assert.ok(loginRes.setCookie);

    const initialCookie = extractCookie(loginRes.setCookie, 'ricoz_refresh_token');
    assert.ok(initialCookie);

    // Now call /api/auth/refresh with that cookie
    const refreshRes = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `ricoz_refresh_token=${initialCookie}`
      }
    });

    assert.strictEqual(refreshRes.status, 200);
    assert.strictEqual(refreshRes.body.success, true);
    assert.ok(refreshRes.body.data.accessToken);

    const rotatedCookie = extractCookie(refreshRes.setCookie, 'ricoz_refresh_token');
    assert.ok(rotatedCookie);
    assert.notStrictEqual(rotatedCookie, initialCookie, 'Rotated cookie must differ from initial cookie');

    // Verify initial cookie is now marked rotated in database
    const oldSessions = await Session.find({ userId: activeUserAlpha._id, revokedReason: 'rotated' });
    assert.ok(oldSessions.length > 0);
  });

  test('9. Previous refresh token rejected: using previously rotated token fails', async () => {
    // Create a session and rotate it
    const { rawRefreshToken: tokenV1 } = await sessionService.createSession({
      userId: activeUserAlpha._id,
      organizationId: orgAlpha._id
    });

    // First rotation succeeds
    const rotated = await sessionService.rotateSession(tokenV1);
    assert.ok(rotated.accessToken);

    // Using tokenV1 again must fail
    const res = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `ricoz_refresh_token=${tokenV1}`
      }
    });

    assert.strictEqual(res.status, 401);
  });

  // =========================================================================
  // 09.5 REUSE DETECTION
  // =========================================================================
  test('10. Refresh token reuse detection: replaying rotated token revokes entire token family', async () => {
    // 1. Establish session chain
    const { session: s1, rawRefreshToken: token1 } = await sessionService.createSession({
      userId: activeUserAlpha._id,
      organizationId: orgAlpha._id
    });
    const familyId = s1.tokenFamilyId;

    // 2. Rotate to token2
    const { newRefreshToken: token2 } = await sessionService.rotateSession(token1);

    // 3. Rotate to token3
    const { newRefreshToken: token3 } = await sessionService.rotateSession(token2);

    // Currently token3 is active in familyId
    const activeBefore = await Session.find({ tokenFamilyId: familyId, revokedAt: null });
    assert.strictEqual(activeBefore.length, 1);

    // 4. Attacker attempts to replay token1 (already rotated)
    const attackRes = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `ricoz_refresh_token=${token1}`
      }
    });

    assert.strictEqual(attackRes.status, 401);
    assert.match(attackRes.body.message, /reuse detected|terminated/i);

    // 5. Verify ALL sessions in this family were revoked with 'compromised_reuse_detected'
    const compromisedSessions = await Session.find({
      tokenFamilyId: familyId,
      revokedReason: 'compromised_reuse_detected'
    });
    assert.ok(compromisedSessions.length >= 1);

    // 6. Verify token3 (legitimate client's current token) is now also unusable
    const legitRes = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: `ricoz_refresh_token=${token3}`
      }
    });
    assert.strictEqual(legitRes.status, 401);
  });

  // =========================================================================
  // 09.6 & 09.8 LOGOUT & LOGOUT-ALL
  // =========================================================================
  test('11. Logout: POST /api/auth/logout revokes session and clears refresh cookie', async () => {
    const { rawRefreshToken } = await sessionService.createSession({
      userId: activeUserAlpha._id,
      organizationId: orgAlpha._id
    });

    const res = await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: `ricoz_refresh_token=${rawRefreshToken}`
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.match(res.body.message, /logged out/i);

    // Verify cookie was cleared
    assert.ok(res.setCookie);
    assert.ok(res.setCookie.includes('ricoz_refresh_token=;') || res.setCookie.includes('Max-Age=0') || res.setCookie.includes('Expires='));

    // Attempting to refresh with that token fails
    const refreshRes = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `ricoz_refresh_token=${rawRefreshToken}` }
    });
    assert.strictEqual(refreshRes.status, 401);
  });

  test('12. Logout-all: POST /api/auth/logout-all revokes all sessions for user in tenant', async () => {
    // Create multiple sessions for Alice
    const { rawRefreshToken: rt1 } = await sessionService.createSession({
      userId: activeUserAlpha._id,
      organizationId: orgAlpha._id
    });
    const { rawRefreshToken: rt2 } = await sessionService.createSession({
      userId: activeUserAlpha._id,
      organizationId: orgAlpha._id
    });

    const accessToken = tokenService.generateAccessToken(activeUserAlpha);

    const res = await apiRequest('/api/auth/logout-all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Verify both sessions are now revoked in DB
    const activeSessions = await Session.find({
      userId: activeUserAlpha._id,
      organizationId: orgAlpha._id,
      revokedAt: null
    });
    assert.strictEqual(activeSessions.length, 0);

    // Both refresh tokens fail
    const tryRt1 = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `ricoz_refresh_token=${rt1}` }
    });
    assert.strictEqual(tryRt1.status, 401);

    const tryRt2 = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `ricoz_refresh_token=${rt2}` }
    });
    assert.strictEqual(tryRt2.status, 401);
  });

  // =========================================================================
  // /me ENDPOINT & CROSS-TENANT ISOLATION
  // =========================================================================
  test('13. Authorized /me: returns authenticated user profile and tenant metadata', async () => {
    const accessToken = tokenService.generateAccessToken(activeUserAlpha);

    const res = await apiRequest('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.email, 'alice@step9alpha.com');
    assert.strictEqual(res.body.data.user.role, USER_ROLES.ADMIN);
    assert.strictEqual(res.body.data.user.organizationId, orgAlpha._id.toString());
  });

  test('14. Cross-tenant token misuse: Token from Tenant A rejected on Tenant B with 403', async () => {
    // Generate valid access token for Alice (Tenant Alpha)
    const alphaToken = tokenService.generateAccessToken(activeUserAlpha);

    // Alice attempts to use her token against Tenant Beta's boundary
    const res = await apiRequest('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${alphaToken}`,
        [TENANT_HEADERS.SLUG]: orgBeta.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /target tenant organization|cross-tenant|tenant conflict/i);
  });

  test('15. Suspended user token rejection: suspended user cannot access /me even with valid token', async () => {
    const suspendedToken = tokenService.generateAccessToken(suspendedUserAlpha);

    const res = await apiRequest('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${suspendedToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /suspended/i);
  });

  // =========================================================================
  // 09.7 GOOGLE OAUTH SECURITY MIGRATION
  // =========================================================================
  test('16. Google OAuth establishes secure session and sets HTTP-only cookie', async () => {
    const googleProvider = authProviderRegistry.get('google');
    const state = googleProvider.generateState(orgAlpha._id);

    const originalExchange = googleProvider.exchangeCodeForProfile;
    googleProvider.exchangeCodeForProfile = async () => ({
      googleId: 'google_step9_user_998877',
      email: 'google.step9@alpha.com',
      emailVerified: true,
      name: 'Google Step9 User',
      avatarUrl: 'https://example.com/avatar.jpg'
    });

    try {
      const res = await apiRequest(`/api/auth/google/callback?code=mock_code_step9&state=${encodeURIComponent(state)}`, {
        headers: { Accept: 'application/json' }
      });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.accessToken, 'Access token returned for JSON caller');
      assert.ok(res.setCookie, 'Refresh cookie set');

      const cookieVal = extractCookie(res.setCookie, 'ricoz_refresh_token');
      assert.ok(cookieVal);

      // Verify session exists in DB
      const dbSession = await Session.findOne({ userId: res.body.data.user._id });
      assert.ok(dbSession);
      assert.strictEqual(dbSession.organizationId.toString(), orgAlpha._id.toString());
    } finally {
      googleProvider.exchangeCodeForProfile = originalExchange;
    }
  });

  test('17. Google OAuth does not expose identity in URL on browser redirect', async () => {
    const googleProvider = authProviderRegistry.get('google');
    const state = googleProvider.generateState(orgAlpha._id);

    const originalExchange = googleProvider.exchangeCodeForProfile;
    googleProvider.exchangeCodeForProfile = async () => ({
      googleId: 'google_step9_browser_user_112233',
      email: 'browser.user@alpha.com',
      emailVerified: true,
      name: 'Browser User',
      avatarUrl: 'https://example.com/avatar.jpg'
    });

    try {
      // Simulate browser request (Accept: text/html)
      const res = await apiRequest(`/api/auth/google/callback?code=mock_code_step9_browser&state=${encodeURIComponent(state)}`, {
        headers: { Accept: 'text/html' }
      });

      assert.strictEqual(res.status, 302, 'Redirect to frontend callback');
      const location = res.headers.get('location');
      assert.ok(location);

      // Security check: Must NOT contain identity parameters in URL query
      assert.strictEqual(location.includes('userId='), false, 'Location must NOT contain userId');
      assert.strictEqual(location.includes('email='), false, 'Location must NOT contain email');
      assert.strictEqual(location.includes('role='), false, 'Location must NOT contain role');
      assert.strictEqual(location.includes('name='), false, 'Location must NOT contain name');
      assert.ok(location.includes('status=success'));

      // Refresh cookie must be set on the redirect response
      const cookieVal = extractCookie(res.setCookie, 'ricoz_refresh_token');
      assert.ok(cookieVal, 'Refresh cookie must be present on HTTP 302 redirect');
    } finally {
      googleProvider.exchangeCodeForProfile = originalExchange;
    }
  });
});
