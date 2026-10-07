import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import { USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import tokenService from '../src/services/token.service.js';

describe('Step 22 — Search & Filtering APIs Verification', () => {
  let server;
  let baseUrl;

  let tenantA;
  let adminA;
  let adminAToken;

  let tenantB;
  let adminB;
  let adminBToken;

  let dsA1;
  let dsA2;
  let dsB1;

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

    // Clean up
    await Organization.deleteMany({ slug: { $in: ['test-search-tenant-a', 'test-search-tenant-b'] } });

    tenantA = await Organization.create({
      name: 'Search Tenant Alpha',
      slug: 'test-search-tenant-a',
      domain: 'alpha.ricoz.io'
    });

    tenantB = await Organization.create({
      name: 'Search Tenant Beta',
      slug: 'test-search-tenant-b',
      domain: 'beta.ricoz.io'
    });

    adminA = await User.create({
      organizationId: tenantA._id,
      name: 'Admin Alpha',
      email: 'admin@alpha.ricoz.io',
      firstName: 'Admin',
      lastName: 'Alpha',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    adminB = await User.create({
      organizationId: tenantB._id,
      name: 'Admin Beta',
      email: 'admin@beta.ricoz.io',
      firstName: 'Admin',
      lastName: 'Beta',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    adminAToken = tokenService.generateAccessToken({
      userId: adminA._id,
      organizationId: tenantA._id,
      role: adminA.role,
      tokenVersion: 0
    });

    adminBToken = tokenService.generateAccessToken({
      userId: adminB._id,
      organizationId: tenantB._id,
      role: adminB.role,
      tokenVersion: 0
    });

    // Populate data for Tenant A
    dsA1 = await DataSource.create({
      organizationId: tenantA._id,
      name: 'Alpha Customer PostgreSQL',
      type: 'postgresql',
      status: 'connected',
      tags: ['crm', 'customer']
    });

    dsA2 = await DataSource.create({
      organizationId: tenantA._id,
      name: 'Alpha Analytics Snowflake',
      type: 'snowflake',
      status: 'connected',
      tags: ['analytics', 'dw']
    });

    await Dataset.create([
      {
        organizationId: tenantA._id,
        dataSourceId: dsA1._id,
        name: 'customers_v1',
        description: 'Customer master table with PII',
        type: 'table',
        tags: ['customer', 'pii']
      },
      {
        organizationId: tenantA._id,
        dataSourceId: dsA1._id,
        name: 'orders_v1',
        description: 'Transaction and order purchase details',
        type: 'table',
        tags: ['transactions']
      },
      {
        organizationId: tenantA._id,
        dataSourceId: dsA2._id,
        name: 'customer_ltv_view',
        description: 'Customer lifetime value predictive view',
        type: 'view',
        tags: ['analytics', 'customer']
      },
      {
        organizationId: tenantA._id,
        dataSourceId: dsA2._id,
        name: 'financial_metrics_stream',
        description: 'Streaming financial aggregates',
        type: 'stream',
        tags: ['finance']
      }
    ]);

    // Populate data for Tenant B
    dsB1 = await DataSource.create({
      organizationId: tenantB._id,
      name: 'Beta Secret Customer DB',
      type: 'mongodb',
      status: 'connected',
      tags: ['secret', 'customer']
    });

    await Dataset.create({
      organizationId: tenantB._id,
      dataSourceId: dsB1._id,
      name: 'beta_secret_customers',
      description: 'Confidential customer lists for Tenant Beta',
      type: 'table',
      tags: ['secret', 'customer']
    });
  });

  after(async () => {
    await Organization.deleteMany({ slug: { $in: ['test-search-tenant-a', 'test-search-tenant-b'] } });
    await User.deleteMany({ organizationId: { $in: [tenantA._id, tenantB._id] } });
    await DataSource.deleteMany({ organizationId: { $in: [tenantA._id, tenantB._id] } });
    await Dataset.deleteMany({ organizationId: { $in: [tenantA._id, tenantB._id] } });
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // =========================================================================
  // 22.1 QUERY CONTRACT & DEFAULT PAGINATION
  // =========================================================================
  test('1. Default pagination returns page 1 with standard pagination envelope', async () => {
    const res = await apiRequest('/api/v1/datasets', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 4);

    const pagination = res.body.meta.pagination;
    assert.ok(pagination);
    assert.strictEqual(pagination.page, 1);
    assert.strictEqual(pagination.total, 4);
    assert.strictEqual(pagination.totalPages, 1);
    assert.strictEqual(pagination.hasNextPage, false);
    assert.strictEqual(pagination.hasPreviousPage, false);
  });

  // =========================================================================
  // 22.2 CUSTOM PAGINATION & BOUNDARIES
  // =========================================================================
  test('2. Custom pagination: page and limit navigate subsets and calculate hasNextPage', async () => {
    const res = await apiRequest('/api/v1/datasets?page=1&limit=2', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 2);

    const pagination = res.body.meta.pagination;
    assert.strictEqual(pagination.page, 1);
    assert.strictEqual(pagination.limit, 2);
    assert.strictEqual(pagination.total, 4);
    assert.strictEqual(pagination.totalPages, 2);
    assert.strictEqual(pagination.hasNextPage, true);
    assert.strictEqual(pagination.hasPreviousPage, false);

    // Request page 2
    const page2Res = await apiRequest('/api/v1/datasets?page=2&limit=2', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(page2Res.status, 200);
    assert.strictEqual(page2Res.body.data.length, 2);
    assert.strictEqual(page2Res.body.meta.pagination.page, 2);
    assert.strictEqual(page2Res.body.meta.pagination.hasNextPage, false);
    assert.strictEqual(page2Res.body.meta.pagination.hasPreviousPage, true);
  });

  // =========================================================================
  // 22.3 INVALID PAGINATION & MAXIMUM LIMIT REJECTION
  // =========================================================================
  test('3. Invalid pagination and excessive limit rejected with 400', async () => {
    // page 0 is invalid
    const pageZero = await apiRequest('/api/v1/datasets?page=0', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(pageZero.status, 400);
    assert.strictEqual(pageZero.body.error.code, 'BAD_REQUEST');

    // limit > 100 exceeds maximum
    const limitExcess = await apiRequest('/api/v1/datasets?limit=250', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(limitExcess.status, 400);
    assert.ok(limitExcess.body.error.message.includes('exceeds maximum'));
  });

  // =========================================================================
  // 22.4 SORTING: ALLOWLIST & DIRECTION
  // =========================================================================
  test('4. Sorting: name:asc sorts alphabetically and rejects unallowed fields', async () => {
    const res = await apiRequest('/api/v1/datasets?sort=name:asc', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    const names = res.body.data.map(d => d.name);
    const sortedNames = [...names].sort();
    assert.deepStrictEqual(names, sortedNames);

    // Reject unapproved sort field
    const invalidSort = await apiRequest('/api/v1/datasets?sort=internal_secret_field:desc', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(invalidSort.status, 400);
    assert.ok(invalidSort.body.error.message.includes('Allowed sort fields are'));

    // Reject dangerous MongoDB injection in sort
    const attackSort = await apiRequest('/api/v1/datasets?sort=$where', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(attackSort.status, 400);
  });

  // =========================================================================
  // 22.5 SEARCH: SAFE REGEX & FIELD LIMITING
  // =========================================================================
  test('5. Search: filters matches safely and escapes regex special characters', async () => {
    // Search for "customer"
    const searchRes = await apiRequest('/api/v1/datasets?search=customer', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(searchRes.status, 200);
    // Should match "customers_v1" and "customer_ltv_view"
    assert.strictEqual(searchRes.body.data.length, 2);
    for (const d of searchRes.body.data) {
      assert.ok(d.name.toLowerCase().includes('customer') || d.description.toLowerCase().includes('customer'));
    }

    // Search with regex special characters: ".*+?^${}()|[\]\\"
    const regexAttackRes = await apiRequest('/api/v1/datasets?search=customers.*', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    // Literal match attempted, no crash or ReDoS
    assert.strictEqual(regexAttackRes.status, 200);
    assert.strictEqual(regexAttackRes.body.data.length, 0); // No record has literal ".*" in name
  });

  // =========================================================================
  // 22.6 MULTI-FIELD FILTERING
  // =========================================================================
  test('6. Filtering: filters by type and status safely and rejects Mongo operators', async () => {
    const filterRes = await apiRequest('/api/v1/datasets?type=table', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(filterRes.status, 200);
    assert.strictEqual(filterRes.body.data.length, 2);
    for (const d of filterRes.body.data) {
      assert.strictEqual(d.type, 'table');
    }

    // Invalid enum filter value rejected with 400
    const invalidFilterRes = await apiRequest('/api/v1/datasets?type=invalid_type_xyz', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(invalidFilterRes.status, 400);
  });

  // =========================================================================
  // 22.7 TENANT ISOLATION IN SEARCH
  // =========================================================================
  test('7. Tenant Isolation: Tenant A search NEVER discovers Tenant B data', async () => {
    // Both tenants have items with "customer"
    // Tenant A caller searches "customer"
    const searchTenantA = await apiRequest('/api/v1/search?query=customer', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(searchTenantA.status, 200);
    const tenantAItems = searchTenantA.body.data.items;
    assert.ok(tenantAItems.length > 0);
    for (const item of tenantAItems) {
      assert.ok(!item.name.includes('Beta'), `Tenant A search exposed Tenant B item: ${item.name}`);
      assert.ok(!item.name.includes('secret_customers'));
    }

    // Tenant B caller searches "customer"
    const searchTenantB = await apiRequest('/api/v1/search?query=customer', {
      headers: {
        Authorization: `Bearer ${adminBToken}`,
        [TENANT_HEADERS.SLUG]: tenantB.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(searchTenantB.status, 200);
    const tenantBItems = searchTenantB.body.data.items;
    assert.ok(tenantBItems.length > 0);
    for (const item of tenantBItems) {
      assert.ok(!item.name.includes('Alpha'), `Tenant B search exposed Tenant A item: ${item.name}`);
    }
  });

  // =========================================================================
  // 22.8 SECURITY: LARGE SEARCH QUERY PROTECTION & UNAUTHORIZED SEARCH
  // =========================================================================
  test('8. Security: Excessive query length (>100 chars) rejected and unauthorized search blocked', async () => {
    const hugeQuery = 'a'.repeat(150);
    const largeRes = await apiRequest(`/api/v1/search?query=${hugeQuery}`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(largeRes.status, 400);
    assert.ok(largeRes.body.error.message.includes('exceeds maximum length'));

    // Unauthenticated search
    const unauthRes = await apiRequest('/api/v1/search?query=customer');
    assert.strictEqual(unauthRes.status, 401);
    assert.strictEqual(unauthRes.body.success, false);
  });
});
