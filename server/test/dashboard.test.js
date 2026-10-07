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
import { Activity } from '../src/models/Activity.js';
import { USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import tokenService from '../src/services/token.service.js';

describe('Step 31 — Real MongoDB Dashboard APIs Verification', () => {
  let server;
  let baseUrl;

  let tenantA;
  let adminA;
  let adminAToken;

  let tenantB;
  let adminB;
  let adminBToken;

  let emptyTenant;
  let emptyAdmin;
  let emptyToken;

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
    await Organization.deleteMany({
      slug: { $in: ['test-dash-alpha', 'test-dash-beta', 'test-dash-empty'] }
    });

    // 1. Setup Tenant Alpha with known real records
    tenantA = await Organization.create({
      name: 'Dashboard Tenant Alpha',
      slug: 'test-dash-alpha',
      domain: 'dash-alpha.ricoz.io'
    });

    adminA = await User.create({
      organizationId: tenantA._id,
      name: 'Dash Admin Alpha',
      email: 'admin@dash-alpha.ricoz.io',
      firstName: 'Dash',
      lastName: 'Alpha',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    const userA2 = await User.create({
      organizationId: tenantA._id,
      name: 'Steward Alpha',
      email: 'steward@dash-alpha.ricoz.io',
      firstName: 'Steward',
      lastName: 'Alpha',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.DATA_STEWARD,
      status: 'active'
    });

    adminAToken = tokenService.generateAccessToken({
      userId: adminA._id,
      organizationId: tenantA._id,
      role: adminA.role,
      tokenVersion: 0
    });

    // Data sources for Alpha: 2 connected, 1 error
    const dsA1 = await DataSource.create({
      organizationId: tenantA._id,
      name: 'Alpha PG Primary',
      type: 'postgresql',
      status: 'connected',
      ownerId: adminA._id
    });

    const dsA2 = await DataSource.create({
      organizationId: tenantA._id,
      name: 'Alpha Snowflake DW',
      type: 'snowflake',
      status: 'connected',
      ownerId: adminA._id
    });

    const dsA3 = await DataSource.create({
      organizationId: tenantA._id,
      name: 'Alpha Failing Oracle',
      type: 'oracle',
      status: 'error',
      ownerId: adminA._id,
      syncStats: {
        lastError: 'Connection timed out on port 1521'
      }
    });

    // Datasets for Alpha: 3 datasets
    await Dataset.create([
      {
        organizationId: tenantA._id,
        dataSourceId: dsA1._id,
        name: 'customers_table',
        type: 'table'
      },
      {
        organizationId: tenantA._id,
        dataSourceId: dsA1._id,
        name: 'transactions_table',
        type: 'table'
      },
      {
        organizationId: tenantA._id,
        dataSourceId: dsA2._id,
        name: 'financial_summary_view',
        type: 'view'
      }
    ]);

    // Activity for Alpha
    await Activity.create({
      organizationId: tenantA._id,
      actorId: adminA._id,
      action: 'data_source.created',
      entityType: 'data_source',
      entityId: dsA1._id,
      metadata: { name: 'Alpha PG Primary' }
    });

    // 2. Setup Tenant Beta with separate records
    tenantB = await Organization.create({
      name: 'Dashboard Tenant Beta',
      slug: 'test-dash-beta',
      domain: 'dash-beta.ricoz.io'
    });

    adminB = await User.create({
      organizationId: tenantB._id,
      name: 'Dash Admin Beta',
      email: 'admin@dash-beta.ricoz.io',
      firstName: 'Dash',
      lastName: 'Beta',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    adminBToken = tokenService.generateAccessToken({
      userId: adminB._id,
      organizationId: tenantB._id,
      role: adminB.role,
      tokenVersion: 0
    });

    const dsB1 = await DataSource.create({
      organizationId: tenantB._id,
      name: 'Beta Mongo Storage',
      type: 'mongodb',
      status: 'connected',
      ownerId: adminB._id
    });

    await Dataset.create({
      organizationId: tenantB._id,
      dataSourceId: dsB1._id,
      name: 'beta_raw_events',
      type: 'collection'
    });

    // 3. Setup Empty Tenant
    emptyTenant = await Organization.create({
      name: 'Dashboard Tenant Empty',
      slug: 'test-dash-empty',
      domain: 'dash-empty.ricoz.io'
    });

    emptyAdmin = await User.create({
      organizationId: emptyTenant._id,
      name: 'Empty Admin',
      email: 'admin@dash-empty.ricoz.io',
      firstName: 'Empty',
      lastName: 'Admin',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    emptyToken = tokenService.generateAccessToken({
      userId: emptyAdmin._id,
      organizationId: emptyTenant._id,
      role: emptyAdmin.role,
      tokenVersion: 0
    });
  });

  after(async () => {
    const orgIds = [tenantA._id, tenantB._id, emptyTenant._id];
    await Organization.deleteMany({ _id: { $in: orgIds } });
    await User.deleteMany({ organizationId: { $in: orgIds } });
    await DataSource.deleteMany({ organizationId: { $in: orgIds } });
    await Dataset.deleteMany({ organizationId: { $in: orgIds } });
    await Activity.deleteMany({ organizationId: { $in: orgIds } });
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // =========================================================================
  // 31.1 SUMMARY ENDPOINT
  // =========================================================================
  test('1. GET /api/v1/dashboard/summary returns real database counts for tenant', async () => {
    const res = await apiRequest('/api/v1/dashboard/summary', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.error, null);

    const summary = res.body.data;
    assert.strictEqual(summary.totalDatasets, 3);
    assert.strictEqual(summary.dataSources.total, 3);
    assert.strictEqual(summary.dataSources.active, 2);
    assert.strictEqual(summary.dataSources.unhealthy, 1);
    assert.strictEqual(summary.dataSources.healthyPercentage, 67); // Math.round(2/3 * 100) = 67%
    assert.strictEqual(summary.users.total, 2);
    assert.strictEqual(summary.users.active, 2);
    assert.strictEqual(summary.activityCount, 1);
  });

  // =========================================================================
  // 31.2 DATA SOURCES METRICS
  // =========================================================================
  test('2. GET /api/v1/dashboard/data-sources returns real health and type distributions', async () => {
    const res = await apiRequest('/api/v1/dashboard/data-sources', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    const data = res.body.data;
    assert.strictEqual(data.total, 3);
    assert.strictEqual(data.healthy, 2);
    assert.strictEqual(data.unhealthy, 1);
    assert.strictEqual(data.byStatus.connected, 2);
    assert.strictEqual(data.byStatus.error, 1);
    assert.strictEqual(data.byStatus.disconnected, 0);

    assert.strictEqual(data.byType.postgresql, 1);
    assert.strictEqual(data.byType.snowflake, 1);
    assert.strictEqual(data.byType.oracle, 1);
  });

  // =========================================================================
  // 31.3 QUALITY METRICS
  // =========================================================================
  test('3. GET /api/v1/dashboard/quality returns honest catalog coverage metrics', async () => {
    const res = await apiRequest('/api/v1/dashboard/quality', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.monitoredDatasets, 3);
    assert.strictEqual(res.body.data.status, 'monitoring_active');
    assert.strictEqual(res.body.data.moduleStatus, 'configured');
  });

  // =========================================================================
  // 31.4 ALERTS AGGREGATION
  // =========================================================================
  test('4. GET /api/v1/dashboard/alerts returns real alerts from failing data sources', async () => {
    const res = await apiRequest('/api/v1/dashboard/alerts', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.totalAlerts, 1);
    assert.strictEqual(res.body.data.alerts[0].severity, 'critical');
    assert.ok(res.body.data.alerts[0].title.includes('Alpha Failing Oracle'));
    assert.ok(res.body.data.alerts[0].message.includes('Connection timed out'));
  });

  // =========================================================================
  // 31.5 RECENT ACTIVITY
  // =========================================================================
  test('5. GET /api/v1/dashboard/activity returns real tenant audit stream with actor', async () => {
    const res = await apiRequest('/api/v1/dashboard/activity', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.total, 1);
    const act = res.body.data.activities[0];
    assert.strictEqual(act.action, 'data_source.created');
    assert.strictEqual(act.actor.name, 'Dash Admin Alpha');
    assert.strictEqual(act.actor.email, 'admin@dash-alpha.ricoz.io');
  });

  // =========================================================================
  // 31.6 STRICT TENANT ISOLATION
  // =========================================================================
  test('6. Multi-Tenant Isolation: Tenant B dashboard metrics isolate completely from Tenant A', async () => {
    const res = await apiRequest('/api/v1/dashboard/summary', {
      headers: {
        Authorization: `Bearer ${adminBToken}`,
        [TENANT_HEADERS.SLUG]: tenantB.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    const summary = res.body.data;
    // Tenant B only has 1 dataset and 1 data source
    assert.strictEqual(summary.totalDatasets, 1);
    assert.strictEqual(summary.dataSources.total, 1);
    assert.strictEqual(summary.dataSources.active, 1);
    assert.strictEqual(summary.dataSources.unhealthy, 0);
    assert.strictEqual(summary.dataSources.healthyPercentage, 100);
    assert.strictEqual(summary.users.total, 1);
    assert.strictEqual(summary.activityCount, 0);

    // Tenant B alerts should be 0
    const alertsRes = await apiRequest('/api/v1/dashboard/alerts', {
      headers: {
        Authorization: `Bearer ${adminBToken}`,
        [TENANT_HEADERS.SLUG]: tenantB.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(alertsRes.status, 200);
    assert.strictEqual(alertsRes.body.data.totalAlerts, 0);
    assert.strictEqual(alertsRes.body.data.alerts.length, 0);
  });

  // =========================================================================
  // 31.7 EMPTY DATABASE BEHAVIOR
  // =========================================================================
  test('7. Empty Tenant Behavior: Fresh tenant with 0 assets returns clean zeroes without crashing', async () => {
    const res = await apiRequest('/api/v1/dashboard/summary', {
      headers: {
        Authorization: `Bearer ${emptyToken}`,
        [TENANT_HEADERS.SLUG]: emptyTenant.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.totalDatasets, 0);
    assert.strictEqual(res.body.data.dataSources.total, 0);
    assert.strictEqual(res.body.data.dataSources.active, 0);
    assert.strictEqual(res.body.data.dataSources.unhealthy, 0);
    assert.strictEqual(res.body.data.dataSources.healthyPercentage, 100);
    assert.strictEqual(res.body.data.users.total, 1); // Only the admin user
    assert.strictEqual(res.body.data.activityCount, 0);
  });

  // =========================================================================
  // 31.8 AUTHENTICATION & SECURITY
  // =========================================================================
  test('8. Dashboard Security: Unauthenticated requests rejected with 401', async () => {
    const res = await apiRequest('/api/v1/dashboard/summary');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.data, null);
  });
});
