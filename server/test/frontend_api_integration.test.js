import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import tokenService from '../src/services/token.service.js';

describe('Step 32 — Frontend API Integration & OpenAPI Contract Verification', () => {
  let server;
  let baseUrl;
  let testOrg;
  let adminUser;
  let adminToken;

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

    await Organization.deleteMany({ slug: 'test-contract-org' });

    testOrg = await Organization.create({
      name: 'Contract Verification Org',
      slug: 'test-contract-org',
      domain: 'contract.ricoz.io'
    });

    adminUser = await User.create({
      organizationId: testOrg._id,
      name: 'Contract Admin',
      email: 'admin@contract.ricoz.io',
      firstName: 'Contract',
      lastName: 'Admin',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    adminToken = tokenService.generateAccessToken({
      userId: adminUser._id,
      organizationId: testOrg._id,
      role: adminUser.role,
      tokenVersion: 0
    });
  });

  after(async () => {
    await Organization.deleteMany({ slug: 'test-contract-org' });
    await User.deleteMany({ organizationId: testOrg._id });
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // =========================================================================
  // 32.1 OPENAPI SPECIFICATION GENERATION & COMPLIANCE
  // =========================================================================
  test('1. OpenAPI: GET /api/v1/docs/openapi.json exposes complete OpenAPI 3.0 specification', async () => {
    const res = await apiRequest('/api/v1/docs/openapi.json');
    assert.strictEqual(res.status, 200);

    const spec = res.body;
    assert.strictEqual(spec.openapi, '3.0.3');
    assert.strictEqual(spec.info.title, 'RicozData Enterprise API');
    assert.strictEqual(spec.info.version, '1.0.0');

    // Schemas verification
    const schemas = spec.components.schemas;
    assert.ok(schemas.User);
    assert.ok(schemas.Organization);
    assert.ok(schemas.DataSource);
    assert.ok(schemas.Dataset);
    assert.ok(schemas.DashboardSummary);
    assert.ok(schemas.SuccessEnvelope);
    assert.ok(schemas.ErrorEnvelope);
    assert.ok(schemas.PaginationMeta);

    // Paths verification
    assert.ok(spec.paths['/health']);
    assert.ok(spec.paths['/auth/login']);
    assert.ok(spec.paths['/users']);
    assert.ok(spec.paths['/organizations/me']);
    assert.ok(spec.paths['/data-sources']);
    assert.ok(spec.paths['/datasets']);
    assert.ok(spec.paths['/search']);
    assert.ok(spec.paths['/dashboard/summary']);
  });

  // =========================================================================
  // 32.2 SWAGGER UI DOCUMENTATION ROUTE
  // =========================================================================
  test('2. Documentation: GET /api/v1/docs/ serves interactive Swagger documentation UI', async () => {
    const res = await apiRequest('/api/v1/docs/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body, 'string');
    assert.ok(res.body.includes('swagger-ui'));
  });

  // =========================================================================
  // 32.3 STRICT CORS WITH CREDENTIALS
  // =========================================================================
  test('3. CORS: Allows http://localhost:5173 with credentials and denies unapproved origins', async () => {
    // Approved frontend origin
    const validOriginRes = await apiRequest('/api/v1/health', {
      headers: {
        Origin: 'http://localhost:5173'
      }
    });
    assert.strictEqual(validOriginRes.status, 200);
    assert.strictEqual(validOriginRes.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.strictEqual(validOriginRes.headers.get('access-control-allow-credentials'), 'true');

    // Unapproved malicious origin
    const badOriginRes = await apiRequest('/api/v1/health', {
      headers: {
        Origin: 'http://malicious-phishing-site.com'
      }
    });
    // In our CORS configuration, unapproved origin receives CORS error or no allow-origin header
    const allowOrigin = badOriginRes.headers.get('access-control-allow-origin');
    assert.ok(allowOrigin !== 'http://malicious-phishing-site.com');
  });

  // =========================================================================
  // 32.4 CONTRACT CONSISTENCY: DASHBOARD SUMMARY
  // =========================================================================
  test('4. API Contract: GET /api/v1/dashboard/summary adheres to documented schema', async () => {
    const res = await apiRequest('/api/v1/dashboard/summary', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.error, null);

    const data = res.body.data;
    assert.strictEqual(typeof data.totalDatasets, 'number');
    assert.strictEqual(typeof data.dataSources.total, 'number');
    assert.strictEqual(typeof data.dataSources.active, 'number');
    assert.strictEqual(typeof data.dataSources.unhealthy, 'number');
    assert.strictEqual(typeof data.dataSources.healthyPercentage, 'number');
    assert.strictEqual(typeof data.users.total, 'number');
    assert.strictEqual(typeof data.users.active, 'number');
    assert.strictEqual(typeof data.activityCount, 'number');
    assert.strictEqual(typeof data.timestamp, 'string');
  });

  // =========================================================================
  // 32.5 CONTRACT CONSISTENCY: SEARCH ENDPOINT
  // =========================================================================
  test('5. API Contract: GET /api/v1/search adheres to documented schema', async () => {
    const res = await apiRequest('/api/v1/search?query=test', {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.error, null);
    assert.ok(Array.isArray(res.body.data.items));
    assert.ok(res.body.data.counts);
    assert.strictEqual(typeof res.body.data.counts.total, 'number');
    assert.ok(res.body.meta.pagination);
  });
});
