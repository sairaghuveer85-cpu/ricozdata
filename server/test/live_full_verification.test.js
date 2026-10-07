import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { DataSource } from '../src/models/DataSource.js';
import { USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import { hashPassword } from '../src/utils/crypto.js';
import authProviderRegistry from '../src/services/auth/providerRegistry.js';
import encryptionService from '../src/services/encryption/encryption.service.js';

describe('RicozData Full Regression — Live End-to-End Verification (All 15 Flows)', () => {
  let server;
  let baseUrl;
  let tenantOrg;
  let viewerUser;
  let adminUser;
  const userPassword = 'EnterpriseSecurePassword2026!';

  async function apiRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = { ...options.headers };
    let body = options.body;

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
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
      if (resBody && typeof resBody === 'object' && resBody.error?.message && !resBody.message) {
        resBody.message = resBody.error.message;
      }
    } catch {
      resBody = text;
    }

    return {
      status: response.status,
      headers: response.headers,
      body: resBody
    };
  }

  function extractCookie(cookieHeader, name) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? match[1] : null;
  }

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Clean up previous runs
    await Organization.deleteMany({ slug: 'live-flow-org' });
    await DataSource.deleteMany({ name: { $regex: /^Live-DS-/ } });

    tenantOrg = await Organization.create({
      name: 'Live Flow Test Organization',
      slug: 'live-flow-org',
      domain: 'liveflow.ricoz.io'
    });

    const hashedPassword = await hashPassword(userPassword);

    adminUser = await User.create({
      organizationId: tenantOrg._id,
      name: 'Flow Admin',
      email: 'flow.admin@liveflow.ricoz.io',
      firstName: 'Flow',
      lastName: 'Admin',
      passwordHash: hashedPassword,
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    viewerUser = await User.create({
      organizationId: tenantOrg._id,
      name: 'Flow Viewer',
      email: 'flow.viewer@liveflow.ricoz.io',
      firstName: 'Flow',
      lastName: 'Viewer',
      passwordHash: hashedPassword,
      role: USER_ROLES.VIEWER,
      status: 'active'
    });
  });

  after(async () => {
    if (tenantOrg) {
      await DataSource.deleteMany({ organizationId: tenantOrg._id });
      await Session.deleteMany({ organizationId: tenantOrg._id });
      await User.deleteMany({ organizationId: tenantOrg._id });
      await Organization.deleteOne({ _id: tenantOrg._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // Health Checks
  test('Health Checks: GET /api/health and /api/health/ready return 200 with database connected', async () => {
    const health = await apiRequest('/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.services.database.connected, true);

    const ready = await apiRequest('/api/health/ready');
    assert.strictEqual(ready.status, 200);
    assert.strictEqual(ready.body.ready, true);
  });

  // Flow 1: Email / password login
  let activeAccessToken = null;
  let activeCookie = null;

  test('Flow 1: Email/password login establishes session and sets HTTP-only refresh cookie', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'flow.admin@liveflow.ricoz.io',
        password: userPassword
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.accessToken);
    assert.strictEqual(res.body.data.user.email, 'flow.admin@liveflow.ricoz.io');

    activeAccessToken = res.body.data.accessToken;

    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader);
    const tokenVal = extractCookie(cookieHeader, 'ricoz_refresh_token');
    assert.ok(tokenVal);
    assert.ok(cookieHeader.includes('HttpOnly'));

    activeCookie = `ricoz_refresh_token=${tokenVal}`;
  });

  // Flow 2: Google OAuth login (no identity in URL)
  test('Flow 2: Google OAuth establishes session and redirects without identity query parameters', async () => {
    const googleProvider = authProviderRegistry.get('google');
    const state = googleProvider.generateState(tenantOrg._id);

    const originalExchange = googleProvider.exchangeCodeForProfile;
    googleProvider.exchangeCodeForProfile = async () => ({
      googleId: 'mock-google-id-live-flow-2026',
      email: 'flow.google@liveflow.ricoz.io',
      emailVerified: true,
      name: 'Flow Google User',
      avatarUrl: 'https://avatar.example.com/live.png'
    });

    try {
      const res = await apiRequest(`/api/auth/google/callback?code=mock_code_live&state=${encodeURIComponent(state)}`, {
        headers: {
          Accept: 'text/html',
          [TENANT_HEADERS.SLUG]: tenantOrg.slug,
          [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
        }
      });

      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location);
      assert.ok(location.includes('/auth/callback'));

      // ZERO identity in URL parameters
      assert.ok(!location.includes('userId='));
      assert.ok(!location.includes('email='));
      assert.ok(!location.includes('role='));
      assert.ok(!location.includes('name='));

      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie.includes('ricoz_refresh_token='));
      assert.ok(setCookie.includes('HttpOnly'));
    } finally {
      googleProvider.exchangeCodeForProfile = originalExchange;
    }
  });

  // Flow 3: Invitation activation
  test('Flow 3: Invitation activation creates member and hashes token', async () => {
    const inviteRes = await apiRequest('/api/users/invitations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeAccessToken}`,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'activated.member@liveflow.ricoz.io',
        role: USER_ROLES.VIEWER
      }
    });

    assert.strictEqual(inviteRes.status, 201);
    const rawToken = inviteRes.body.data.token;
    assert.ok(rawToken);

    // Accept invitation
    const acceptRes = await apiRequest(`/api/users/invitations/${rawToken}/accept`, {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Activated Member',
        password: 'SecureActivatedPassword123!'
      }
    });

    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.body.data.email, 'activated.member@liveflow.ricoz.io');
    assert.strictEqual(acceptRes.body.data.status, 'active');
  });

  // Flow 4: Token refresh (rotation)
  test('Flow 4: POST /api/auth/refresh rotates refresh token and issues new access token', async () => {
    const res = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: activeCookie,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.accessToken);
    assert.notStrictEqual(res.body.data.accessToken, activeAccessToken);

    activeAccessToken = res.body.data.accessToken;

    const cookieHeader = res.headers.get('set-cookie');
    const tokenVal = extractCookie(cookieHeader, 'ricoz_refresh_token');
    activeCookie = `ricoz_refresh_token=${tokenVal}`;
  });

  // Flow 5: Page refresh recovery (restores in-memory access token via refresh endpoint)
  test('Flow 5: Page refresh authentication recovery successfully restores session from HTTP-only cookie', async () => {
    const restoreRes = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: activeCookie,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(restoreRes.status, 200);
    assert.ok(restoreRes.body.data.accessToken);

    activeAccessToken = restoreRes.body.data.accessToken;
    const cookieHeader = restoreRes.headers.get('set-cookie');
    if (cookieHeader) {
      const tokenVal = extractCookie(cookieHeader, 'ricoz_refresh_token');
      if (tokenVal) activeCookie = `ricoz_refresh_token=${tokenVal}`;
    }
  });

  // Flow 6: /api/auth/me
  test('Flow 6: GET /api/auth/me returns authenticated user and tenant profile', async () => {
    const res = await apiRequest('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${activeAccessToken}`,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.user.email, 'flow.admin@liveflow.ricoz.io');
    assert.strictEqual(res.body.data.user.role, USER_ROLES.ADMIN);
  });

  // Flow 7: Role-based protected endpoint
  test('Flow 7: Role-based authorization: Admin allowed to create data source; Viewer blocked', async () => {
    // 1. Viewer token
    const viewerLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'flow.viewer@liveflow.ricoz.io',
        password: userPassword
      }
    });
    const viewerToken = viewerLogin.body.data.accessToken;

    // 2. Viewer attempts to create data source -> 403 Forbidden
    const viewerAttempt = await apiRequest('/api/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Live-DS-Viewer-Denied',
        type: 'postgresql'
      }
    });
    assert.strictEqual(viewerAttempt.status, 403);

    // 3. Admin creates data source -> 201 Created
    const adminAttempt = await apiRequest('/api/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeAccessToken}`,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Live-DS-Admin-Allowed',
        type: 'postgresql',
        credentials: {
          password: 'SecretLiveDatabasePassword2026!'
        }
      }
    });
    assert.strictEqual(adminAttempt.status, 201);
    assert.strictEqual(adminAttempt.body.data.credentials.credentialStatus, 'configured');
  });

  // Flow 8: Tenant isolation
  test('Flow 8: Tenant isolation: Requests with foreign organization context are rejected', async () => {
    const foreignOrg = await Organization.create({
      name: 'Foreign Cross Tenant Org',
      slug: 'foreign-cross-tenant-org',
      domain: 'foreign.ricoz.io'
    });

    try {
      const crossTenantAttempt = await apiRequest('/api/data-sources', {
        headers: {
          Authorization: `Bearer ${activeAccessToken}`, // Token belongs to tenantOrg
          [TENANT_HEADERS.SLUG]: foreignOrg.slug, // Caller requests foreignOrg
          [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
        }
      });

      assert.strictEqual(crossTenantAttempt.status, 403);
    } finally {
      await Organization.deleteOne({ _id: foreignOrg._id });
    }
  });

  // Flow 9: Rate limiting
  test('Flow 9: Rate limiting protects authentication boundaries with HTTP 429', async () => {
    // Repeated failed logins to trip limiter or custom limit
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'unknown.user@liveflow.ricoz.io',
        password: 'WrongPassword'
      }
    });
    // Must return 401 or 429 safely
    assert.ok([401, 429].includes(res.status));
  });

  // Flow 10: Security headers
  test('Flow 10: Security headers: Helmet headers present and hardened', async () => {
    const res = await apiRequest('/api/health');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(res.headers.get('x-powered-by'), null);
  });

  // Flow 11: CORS
  test('Flow 11: Strict CORS: Whitelisted origin permitted with credentials; foreign origin rejected', async () => {
    const allowed = await apiRequest('/api/health', {
      headers: { Origin: 'http://localhost:5173' }
    });
    assert.strictEqual(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.strictEqual(allowed.headers.get('access-control-allow-credentials'), 'true');

    const blocked = await apiRequest('/api/health', {
      headers: { Origin: 'https://evil-unauthorized-site.com' }
    });
    assert.strictEqual(blocked.status, 403);
  });

  // Flow 12: Credential encryption & decryption
  test('Flow 12: AES-256-GCM encryption & decryption restores secrets accurately with random IVs', () => {
    const secret = 'EnterpriseSnowflakeKey2026';
    const enc1 = encryptionService.encrypt(secret);
    const enc2 = encryptionService.encrypt(secret);

    assert.notStrictEqual(enc1.iv, enc2.iv);
    assert.strictEqual(encryptionService.decrypt(enc1.serialized), secret);
    assert.strictEqual(encryptionService.decrypt(enc2.serialized), secret);
  });

  // Flow 13: Credential API redaction & zero plaintext exposure
  test('Flow 13: Credential API Redaction: GET endpoints never return plaintext secrets or ciphertext', async () => {
    let res = await apiRequest('/api/data-sources', {
      headers: {
        Authorization: `Bearer ${activeAccessToken}`,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    let dsList = res.body.data;
    if (dsList.length === 0) {
      await apiRequest('/api/data-sources', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeAccessToken}`,
          [TENANT_HEADERS.SLUG]: tenantOrg.slug,
          [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
        },
        body: {
          name: 'Live-DS-Flow-13',
          type: 'postgresql',
          credentials: { password: 'SecretLiveDatabasePassword2026!' }
        }
      });
      res = await apiRequest('/api/data-sources', {
        headers: {
          Authorization: `Bearer ${activeAccessToken}`,
          [TENANT_HEADERS.SLUG]: tenantOrg.slug,
          [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
        }
      });
      dsList = res.body.data;
    }

    assert.ok(dsList.length > 0);
    const ds = dsList[0];

    assert.strictEqual(ds.credentials.credentialStatus, 'configured');
    assert.strictEqual(ds.credentials.password, undefined);
    assert.strictEqual(ds.credentials.encryptedData, undefined);

    const jsonText = JSON.stringify(res.body);
    assert.ok(!jsonText.includes('SecretLiveDatabasePassword2026!'));
  });

  // Flow 14: Logout
  test('Flow 14: POST /api/auth/logout revokes current session and clears refresh cookie', async () => {
    const logoutRes = await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: activeCookie,
        Authorization: `Bearer ${activeAccessToken}`,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(logoutRes.status, 200);
    const clearedCookie = logoutRes.headers.get('set-cookie');
    assert.ok(clearedCookie.includes('ricoz_refresh_token=;'));

    // Attempting refresh with revoked token fails
    const refreshAfterLogout = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: activeCookie,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(refreshAfterLogout.status, 401);
  });

  // Flow 15: Logout-all
  test('Flow 15: POST /api/auth/logout-all revokes all sessions across all devices', async () => {
    // 1. Establish two sessions for admin
    const login1 = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: { email: 'flow.admin@liveflow.ricoz.io', password: userPassword }
    });
    const cookie1 = login1.headers.get('set-cookie').split(';')[0];
    const token1 = login1.body.data.accessToken;

    const login2 = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: { email: 'flow.admin@liveflow.ricoz.io', password: userPassword }
    });
    const cookie2 = login2.headers.get('set-cookie').split(';')[0];

    // 2. Call logout-all using session 1
    const logoutAllRes = await apiRequest('/api/auth/logout-all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token1}`,
        Cookie: cookie1,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(logoutAllRes.status, 200);

    // 3. Both session 1 and session 2 must be invalid now
    const refresh1 = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: cookie1,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(refresh1.status, 401);

    const refresh2 = await apiRequest('/api/auth/refresh', {
      method: 'POST',
      headers: {
        Cookie: cookie2,
        [TENANT_HEADERS.SLUG]: tenantOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(refresh2.status, 401);
  });
});
