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

describe('Step 11 — API Architecture (Versioning, Standard Envelopes & Modular Routing)', () => {
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

    await Organization.deleteMany({ slug: 'api-arch-test-org' });
    testOrg = await Organization.create({
      name: 'API Architecture Test Org',
      slug: 'api-arch-test-org',
      domain: 'apiarch.ricoz.io'
    });

    adminUser = await User.create({
      organizationId: testOrg._id,
      name: 'Arch Admin',
      email: 'admin@apiarch.ricoz.io',
      firstName: 'Arch',
      lastName: 'Admin',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });
    adminToken = tokenService.generateAccessToken(adminUser);

    viewerUser = await User.create({
      organizationId: testOrg._id,
      name: 'Arch Viewer',
      email: 'viewer@apiarch.ricoz.io',
      firstName: 'Arch',
      lastName: 'Viewer',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.VIEWER,
      status: 'active'
    });
    viewerToken = tokenService.generateAccessToken(viewerUser);
  });

  after(async () => {
    if (testOrg) {
      await DataSource.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // =========================================================================
  // 11.1 VERSIONING (/api/v1)
  // =========================================================================
  test('1. Versioning: GET /api/v1 returns version 1 metadata and status active', async () => {
    const res = await apiRequest('/api/v1');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.meta.version, 'v1');
    assert.ok(res.body.data.endpoints.auth);
    assert.ok(res.body.data.endpoints.dataSources);
    assert.ok(res.body.data.endpoints.datasets);
    assert.ok(res.body.data.endpoints.dashboard);
    assert.ok(res.body.data.endpoints.search);
  });

  test('2. Versioning: Versioned health endpoints GET /api/v1/health and /api/v1/health/ready respond with 200', async () => {
    const healthRes = await apiRequest('/api/v1/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.success, true);
    assert.strictEqual(healthRes.body.services.database.connected, true);

    const readyRes = await apiRequest('/api/v1/health/ready');
    assert.strictEqual(readyRes.status, 200);
    assert.strictEqual(readyRes.body.ready, true);
  });

  // =========================================================================
  // 11.2 STANDARD RESPONSE ENVELOPE
  // =========================================================================
  test('3. Success Envelope: Successful requests adhere to { success: true, data, error: null, meta }', async () => {
    const res = await apiRequest('/api/v1/data-sources', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data !== undefined);
    assert.strictEqual(res.body.error, null);
    assert.ok(typeof res.body.meta === 'object');
  });

  test('4. Error Envelope: Error responses adhere to { success: false, data: null, error: { code, message, details }, meta }', async () => {
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
    assert.ok(res.body.error);
    assert.strictEqual(typeof res.body.error.code, 'string');
    assert.strictEqual(typeof res.body.error.message, 'string');
    assert.ok(typeof res.body.error.details === 'object');
    assert.ok(typeof res.body.meta === 'object');
  });

  // =========================================================================
  // 11.3 HTTP STATUS CODES
  // =========================================================================
  test('5. HTTP Semantics: 201 Created on creation, 400 Bad Request on validation failure, 401 on missing auth', async () => {
    // 401 Unauthorized
    const unauthRes = await apiRequest('/api/v1/data-sources');
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.body.success, false);

    // 400 Bad Request
    const badReqRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        // Missing required fields 'name' and 'type'
      }
    });
    assert.strictEqual(badReqRes.status, 400);
    assert.strictEqual(badReqRes.body.error.code, 'VALIDATION_ERROR');

    // 201 Created
    const createRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Arch-Test-Postgres',
        type: 'postgresql',
        connectionConfig: { host: 'localhost', port: 5432 }
      }
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.success, true);
    assert.ok(createRes.body.data._id);
  });

  // =========================================================================
  // 11.4 BACKWARD COMPATIBILITY
  // =========================================================================
  test('6. Compatibility: Legacy /api endpoints continue to operate identically through thin compatibility routing', async () => {
    const unversionedHealth = await apiRequest('/api/health');
    assert.strictEqual(unversionedHealth.status, 200);

    const unversionedList = await apiRequest('/api/data-sources', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(unversionedList.status, 200);
    assert.strictEqual(unversionedList.body.success, true);
  });

  // =========================================================================
  // 11.5 TENANT CONTEXT & RBAC PRESERVATION UNDER /api/v1
  // =========================================================================
  test('7. Security Preservation: /api/v1 enforces tenant context and role permissions', async () => {
    // Viewer is rejected with 403 on create data source under /api/v1
    const viewerDenied = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${viewerToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Viewer-Attempt',
        type: 'mysql'
      }
    });
    assert.strictEqual(viewerDenied.status, 403);
    assert.ok(
      viewerDenied.body.error.code === 'FORBIDDEN' || viewerDenied.body.error.code === 'INSUFFICIENT_PERMISSIONS',
      `Expected error code to be FORBIDDEN or INSUFFICIENT_PERMISSIONS, got ${viewerDenied.body.error.code}`
    );
  });

  // =========================================================================
  // 11.6 SWAGGER DOCS ROUTE
  // =========================================================================
  test('8. Documentation: GET /api/v1/docs/openapi.json returns valid OpenAPI 3.0 specification', async () => {
    const docsRes = await apiRequest('/api/v1/docs/openapi.json');
    assert.strictEqual(docsRes.status, 200);
    assert.strictEqual(docsRes.body.openapi, '3.0.3');
    assert.strictEqual(docsRes.body.info.title, 'RicozData Enterprise API');
    assert.ok(docsRes.body.paths['/health']);
    assert.ok(docsRes.body.paths['/data-sources']);
    assert.ok(docsRes.body.components.schemas.SuccessEnvelope);
    assert.ok(docsRes.body.components.schemas.ErrorEnvelope);
  });
});
