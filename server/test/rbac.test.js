import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Session } from '../src/models/Session.js';
import { USER_STATUS, USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  canAssignRole
} from '../src/constants/permissions.js';
import { hashPassword } from '../src/utils/crypto.js';
import tokenService from '../src/services/token.service.js';

describe('Step 10 — Role-Based Access Control (RBAC), Permissions & Privilege Escalation Defense', () => {
  let server;
  let baseUrl;
  let orgAlpha;
  let orgBeta;
  let adminUserAlpha;
  let stewardUserAlpha;
  let viewerUserAlpha;
  let adminUserBeta;
  let adminAlphaToken;
  let stewardAlphaToken;
  let viewerAlphaToken;
  let adminBetaToken;

  const validPassword = 'SecurePassword123!';

  async function apiRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = { ...options.headers };
    if (headers[TENANT_HEADERS.SLUG] && !headers[TENANT_HEADERS.INTERNAL_SECRET] && !options.skipInternalSecret) {
      headers[TENANT_HEADERS.INTERNAL_SECRET] = config.tenant.trustedInternalSecret;
    }
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

  before(async () => {
    await connectDB();

    const testSlugs = ['test-rbac-alpha', 'test-rbac-beta'];
    const existingOrgs = await Organization.find({ slug: { $in: testSlugs } });
    const orgIds = existingOrgs.map((o) => o._id);

    await Session.deleteMany({ organizationId: { $in: orgIds } });
    await User.deleteMany({ organizationId: { $in: orgIds } });
    await Organization.deleteMany({ _id: { $in: orgIds } });

    orgAlpha = await Organization.create({
      name: 'RBAC Alpha Corp',
      slug: 'test-rbac-alpha',
      status: 'active'
    });

    orgBeta = await Organization.create({
      name: 'RBAC Beta Corp',
      slug: 'test-rbac-beta',
      status: 'active'
    });

    // Create users in Tenant Alpha
    adminUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Admin Alice',
      email: 'admin.alice@alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerified: true
    });

    stewardUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Steward Stan',
      email: 'steward.stan@alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.DATA_STEWARD,
      status: USER_STATUS.ACTIVE,
      emailVerified: true
    });

    viewerUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Viewer Vicky',
      email: 'viewer.vicky@alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.VIEWER,
      status: USER_STATUS.ACTIVE,
      emailVerified: true
    });

    // Create admin in Tenant Beta
    adminUserBeta = await User.create({
      organizationId: orgBeta._id,
      name: 'Beta Bob',
      email: 'admin.bob@beta.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerified: true
    });

    // Generate JWT access tokens
    adminAlphaToken = tokenService.generateAccessToken(adminUserAlpha);
    stewardAlphaToken = tokenService.generateAccessToken(stewardUserAlpha);
    viewerAlphaToken = tokenService.generateAccessToken(viewerUserAlpha);
    adminBetaToken = tokenService.generateAccessToken(adminUserBeta);

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
  // 10.1 PERMISSION MATRIX UNIT VALIDATION
  // =========================================================================
  test('1. Centralized permission matrix structure and granularity', () => {
    assert.ok(PERMISSIONS.USERS_READ);
    assert.ok(PERMISSIONS.USERS_CREATE);
    assert.ok(PERMISSIONS.USERS_UPDATE);
    assert.ok(PERMISSIONS.USERS_DELETE);
    assert.ok(PERMISSIONS.USERS_SUSPEND);
    assert.ok(PERMISSIONS.USERS_MANAGE_ROLES);
    assert.ok(PERMISSIONS.CATALOG_READ);
    assert.ok(PERMISSIONS.DATA_SOURCES_TEST);

    // ADMIN has all permissions
    assert.strictEqual(hasPermission(USER_ROLES.ADMIN, PERMISSIONS.USERS_CREATE), true);
    assert.strictEqual(hasPermission(USER_ROLES.ADMIN, PERMISSIONS.USERS_MANAGE_ROLES), true);

    // DATA_STEWARD has governance and read permissions, but NOT user administration
    assert.strictEqual(hasPermission(USER_ROLES.DATA_STEWARD, PERMISSIONS.CATALOG_READ), true);
    assert.strictEqual(hasPermission(USER_ROLES.DATA_STEWARD, PERMISSIONS.DATA_SOURCES_READ), true);
    assert.strictEqual(hasPermission(USER_ROLES.DATA_STEWARD, PERMISSIONS.USERS_READ), true);
    assert.strictEqual(hasPermission(USER_ROLES.DATA_STEWARD, PERMISSIONS.USERS_MANAGE_ROLES), false);
    assert.strictEqual(hasPermission(USER_ROLES.DATA_STEWARD, PERMISSIONS.USERS_DELETE), false);

    // VIEWER has read-only permissions
    assert.strictEqual(hasPermission(USER_ROLES.VIEWER, PERMISSIONS.ORGANIZATION_READ), true);
    assert.strictEqual(hasPermission(USER_ROLES.VIEWER, PERMISSIONS.USERS_READ), true);
    assert.strictEqual(hasPermission(USER_ROLES.VIEWER, PERMISSIONS.CATALOG_READ), true);
    assert.strictEqual(hasPermission(USER_ROLES.VIEWER, PERMISSIONS.USERS_CREATE), false);
    assert.strictEqual(hasPermission(USER_ROLES.VIEWER, PERMISSIONS.USERS_UPDATE), false);
    assert.strictEqual(hasPermission(USER_ROLES.VIEWER, PERMISSIONS.USERS_DELETE), false);
    assert.strictEqual(hasPermission(USER_ROLES.VIEWER, PERMISSIONS.ORGANIZATION_UPDATE), false);
  });

  // =========================================================================
  // 10.2 & 10.3 ROUTE GUARD AUTHORIZATION
  // =========================================================================
  test('2. Viewer allowed permitted reads: GET /api/organizations/me and GET /api/users succeed with 200', async () => {
    const orgRes = await apiRequest('/api/organizations/me', {
      headers: {
        Authorization: `Bearer ${viewerAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      }
    });
    assert.strictEqual(orgRes.status, 200);
    assert.strictEqual(orgRes.body.success, true);
    assert.strictEqual(orgRes.body.data.slug, orgAlpha.slug);

    const usersRes = await apiRequest('/api/users', {
      headers: {
        Authorization: `Bearer ${viewerAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      }
    });
    assert.strictEqual(usersRes.status, 200);
    assert.strictEqual(usersRes.body.success, true);
  });

  test('3. Viewer denied admin actions: POST /api/users/invitations fails with 403 Forbidden', async () => {
    const res = await apiRequest('/api/users/invitations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${viewerAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: {
        email: 'blocked.invite@alpha.com',
        role: USER_ROLES.VIEWER
      }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /lacks required permission|access denied/i);
  });

  test('4. Viewer denied role changes: PATCH /api/users/:id/role fails with 403 Forbidden', async () => {
    const res = await apiRequest(`/api/users/${viewerUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${viewerAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.ADMIN }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('5. Viewer denied user deletion: DELETE /api/users/:id fails with 403 Forbidden', async () => {
    const res = await apiRequest(`/api/users/${stewardUserAlpha._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${viewerAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('6. Data steward allowed reads but denied role management and user deletion', async () => {
    // Read succeeds
    const readRes = await apiRequest('/api/users', {
      headers: {
        Authorization: `Bearer ${stewardAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      }
    });
    assert.strictEqual(readRes.status, 200);

    // Role modification denied
    const roleRes = await apiRequest(`/api/users/${viewerUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${stewardAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.ADMIN }
    });
    assert.strictEqual(roleRes.status, 403);

    // User deletion denied
    const deleteRes = await apiRequest(`/api/users/${viewerUserAlpha._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${stewardAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      }
    });
    assert.strictEqual(deleteRes.status, 403);
  });

  test('7. Admin allowed administrative operations: invites, role updates, and member management', async () => {
    // Create new user for admin to manage
    const targetUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'To Promote',
      email: 'topromote@alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.VIEWER,
      status: USER_STATUS.ACTIVE
    });

    // Admin updates role to DATA_STEWARD
    const roleRes = await apiRequest(`/api/users/${targetUser._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.DATA_STEWARD }
    });
    assert.strictEqual(roleRes.status, 200);
    assert.strictEqual(roleRes.body.data.role, USER_ROLES.DATA_STEWARD);

    // Verify in MongoDB
    const updatedUser = await User.findById(targetUser._id);
    assert.strictEqual(updatedUser.role, USER_ROLES.DATA_STEWARD);
  });

  // =========================================================================
  // 10.4 PRIVILEGE ESCALATION DEFENSE
  // =========================================================================
  test('8. Self-role escalation defense: Admin cannot modify their own role', async () => {
    const res = await apiRequest(`/api/users/${adminUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.OWNER }
    });
    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /cannot modify their own role/i);
  });

  test('9. Admin cannot promote another user to OWNER', async () => {
    const res = await apiRequest(`/api/users/${viewerUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.OWNER }
    });
    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /not authorized to grant role/i);
  });

  test('10. Unsupported role assignment rejected with 400', async () => {
    const res = await apiRequest(`/api/users/${viewerUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: 'super_root_god_mode' }
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /invalid role/i);
  });

  // =========================================================================
  // 10.5 TENANT + RBAC COMPOSITION
  // =========================================================================
  test('11. Cross-tenant RBAC defense: Admin of Tenant B cannot modify users in Tenant A', async () => {
    // Admin Bob has ADMIN role, but belongs to Tenant Beta
    // If Bob targets Tenant Alpha's boundary with his Beta token:
    const crossRes = await apiRequest(`/api/users/${viewerUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminBetaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.ADMIN }
    });

    // Mismatched tenant token must be rejected with 403 Forbidden
    assert.strictEqual(crossRes.status, 403);
  });

  test('12. Direct API bypass protection: Direct API call with viewer token or missing auth cannot modify roles', async () => {
    // 1. Direct API call with unauthorized viewer token (bypassing frontend UI)
    const viewerBypassRes = await apiRequest(`/api/users/${viewerUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${viewerAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.ADMIN }
    });
    assert.strictEqual(viewerBypassRes.status, 403);
    assert.strictEqual(viewerBypassRes.body.success, false);

    // 2. Direct API call without authentication token
    const unauthBypassRes = await apiRequest(`/api/users/${viewerUserAlpha._id}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer invalid_bypass_token_12345',
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: { role: USER_ROLES.ADMIN }
    });
    assert.strictEqual(unauthBypassRes.status, 401);
  });

  test('13. Manipulated payload organizationId cannot alter target organization', async () => {
    const res = await apiRequest(`/api/users/${viewerUserAlpha._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAlphaToken}`,
        [TENANT_HEADERS.SLUG]: orgAlpha.slug
      },
      body: {
        name: 'Vicky Modified',
        organizationId: orgBeta._id.toString() // Malicious injection
      }
    });

    // Must be rejected with 403 payload isolation violation
    assert.strictEqual(res.status, 403);
  });
});
