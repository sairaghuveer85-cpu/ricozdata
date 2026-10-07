import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import tokenService from '../src/services/token.service.js';

describe('Step 12 — Validation & Error Handling Verification', () => {
  let server;
  let baseUrl;
  let testOrg;
  let adminUser;
  let adminToken;
  let viewerUser;
  let viewerToken;

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
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    await Organization.deleteMany({ slug: 'test-validation-org' });
    await DataSource.deleteMany({ name: { $regex: /^Val-Test-/ } });

    testOrg = await Organization.create({
      name: 'Validation Test Org',
      slug: 'test-validation-org',
      domain: 'validation.ricoz.io'
    });

    adminUser = await User.create({
      organizationId: testOrg._id,
      name: 'Validation Admin',
      email: 'admin@validation.ricoz.io',
      firstName: 'Validation',
      lastName: 'Admin',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    viewerUser = await User.create({
      organizationId: testOrg._id,
      name: 'Validation Viewer',
      email: 'viewer@validation.ricoz.io',
      firstName: 'Validation',
      lastName: 'Viewer',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.VIEWER,
      status: 'active'
    });

    adminToken = tokenService.generateAccessToken({
      userId: adminUser._id,
      organizationId: testOrg._id,
      role: adminUser.role,
      tokenVersion: 0
    });

    viewerToken = tokenService.generateAccessToken({
      userId: viewerUser._id,
      organizationId: testOrg._id,
      role: viewerUser.role,
      tokenVersion: 0
    });
  });

  after(async () => {
    await Organization.deleteMany({ slug: 'test-validation-org' });
    await User.deleteMany({ organizationId: testOrg._id });
    await DataSource.deleteMany({ organizationId: testOrg._id });
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // =========================================================================
  // 12.1 VALIDATION: VALID REQUEST
  // =========================================================================
  test('1. Valid request passes validation and receives 201 with standard envelope', async () => {
    const res = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Val-Test-Valid-PG',
        type: 'postgresql',
        connectionConfig: { host: 'pg.internal', port: 5432 },
        tags: ['prod', 'finance']
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.error, null);
    assert.ok(res.body.data._id);
    assert.strictEqual(res.body.data.name, 'Val-Test-Valid-PG');
    assert.strictEqual(res.body.data.type, 'postgresql');
  });

  // =========================================================================
  // 12.2 VALIDATION: MALFORMED EMAIL & MISSING REQUIRED FIELDS
  // =========================================================================
  test('2. Missing required fields and malformed email rejected with 400 and structured details', async () => {
    // Missing required fields on data source creation
    const missingRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        // missing name and type
      }
    });

    assert.strictEqual(missingRes.status, 400);
    assert.strictEqual(missingRes.body.success, false);
    assert.strictEqual(missingRes.body.data, null);
    assert.strictEqual(missingRes.body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(missingRes.body.error.details));

    // Malformed email on user invitation
    const malformedEmailRes = await apiRequest('/api/v1/users/invitations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'not-a-valid-email-format',
        role: 'analyst'
      }
    });

    assert.strictEqual(malformedEmailRes.status, 400);
    assert.strictEqual(malformedEmailRes.body.success, false);
    assert.strictEqual(malformedEmailRes.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 12.3 VALIDATION: INVALID OBJECTID PARAMETER
  // =========================================================================
  test('3. Invalid MongoDB ObjectId parameter rejected with 400 INVALID_IDENTIFIER or VALIDATION_ERROR', async () => {
    const invalidIdRes = await apiRequest('/api/v1/data-sources/not-an-objectid-1234', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(invalidIdRes.status, 400);
    assert.strictEqual(invalidIdRes.body.success, false);
    assert.strictEqual(invalidIdRes.body.data, null);
    assert.ok(
      invalidIdRes.body.error.code === 'INVALID_IDENTIFIER' ||
      invalidIdRes.body.error.code === 'VALIDATION_ERROR'
    );
  });

  // =========================================================================
  // 12.4 VALIDATION: INVALID ENUM VALUES
  // =========================================================================
  test('4. Invalid enum values rejected with 400', async () => {
    const invalidTypeRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Val-Test-Invalid-Type',
        type: 'nonexistent_database_type_xyz'
      }
    });

    assert.strictEqual(invalidTypeRes.status, 400);
    assert.strictEqual(invalidTypeRes.body.success, false);
    assert.strictEqual(invalidTypeRes.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 12.5 ERROR HANDLING: DUPLICATE RECORD (409)
  // =========================================================================
  test('5. Duplicate record creation returns 409 without leaking MongoDB internals', async () => {
    const dupRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Val-Test-Valid-PG', // already created in test 1
        type: 'postgresql'
      }
    });

    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.body.success, false);
    assert.strictEqual(dupRes.body.data, null);
    assert.ok(dupRes.body.error.code === 'DUPLICATE_NAME' || dupRes.body.error.code === 'DUPLICATE_KEY_CONFLICT');
    // Ensure raw MongoDB error internals like collection name or driver messages are not leaked
    assert.strictEqual(typeof dupRes.body.error.message, 'string');
    assert.ok(!dupRes.body.error.message.includes('E11000'));
  });

  // =========================================================================
  // 12.6 ERROR HANDLING: UNAUTHORIZED (401) & FORBIDDEN (403)
  // =========================================================================
  test('6. Authentication (401) and Authorization (403) errors follow standard envelope', async () => {
    // 401 Missing token
    const unauthRes = await apiRequest('/api/v1/data-sources');
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.body.success, false);
    assert.strictEqual(unauthRes.body.data, null);
    assert.ok(unauthRes.body.error);

    // 403 Viewer attempting admin mutation
    const forbiddenRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Viewer-Blocked-DS',
        type: 'mysql'
      }
    });

    assert.strictEqual(forbiddenRes.status, 403);
    assert.strictEqual(forbiddenRes.body.success, false);
    assert.strictEqual(forbiddenRes.body.data, null);
    assert.ok(
      forbiddenRes.body.error.code === 'FORBIDDEN' ||
      forbiddenRes.body.error.code === 'INSUFFICIENT_PERMISSIONS'
    );
  });

  // =========================================================================
  // 12.7 ERROR HANDLING: NONEXISTENT RESOURCE (404)
  // =========================================================================
  test('7. Nonexistent resources return structured 404 with error envelope', async () => {
    const res = await apiRequest('/api/v1/data-sources/60d0fe4f5311236168a109ca', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.data, null);
    assert.ok(res.body.error.code);
    assert.ok(res.body.error.message);
    assert.ok(typeof res.body.meta === 'object');
  });

  // =========================================================================
  // 12.8 ERROR HANDLING: MALFORMED JSON (400)
  // =========================================================================
  test('8. Malformed JSON payload returns 400 INVALID_JSON_BODY with standard envelope', async () => {
    const res = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: '{"invalid_json": true, missing_closing_brace'
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.data, null);
    assert.strictEqual(res.body.error.code, 'INVALID_JSON_BODY');
    assert.strictEqual(typeof res.body.error.message, 'string');
    assert.ok(typeof res.body.meta === 'object');
  });

  // =========================================================================
  // 12.9 SECURITY: ZERO INFORMATION LEAKAGE (NO STACK TRACES, SECRETS, OR INTERNALS)
  // =========================================================================
  test('9. Security: Error responses strictly never leak stack traces, secrets, or Mongo internals', async () => {
    const errRes = await apiRequest('/api/v1/nonexistent-route-for-testing-1234');
    assert.strictEqual(errRes.status, 404);
    assert.strictEqual(errRes.body.success, false);
    assert.strictEqual(errRes.body.data, null);

    // Verify no stack trace in response
    assert.strictEqual(errRes.body.error.stack, undefined);
    assert.strictEqual(errRes.body.stack, undefined);

    // Verify string serialization does not contain sensitive leakage keywords
    const responseString = JSON.stringify(errRes.body);
    assert.ok(!responseString.includes('jwt_secret'));
    assert.ok(!responseString.includes('passwordHash'));
    assert.ok(!responseString.includes('encryptedData'));
  });
});
