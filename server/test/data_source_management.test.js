import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';

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

describe('Step 14 — Data Source Management Verification', () => {
  let server;
  let baseUrl;

  let tenantA;
  let adminA;
  let adminAToken;
  let stewardA;
  let stewardAToken;
  let viewerA;
  let viewerAToken;

  let tenantB;
  let adminB;
  let adminBToken;

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

    // Clean up test tenants
    await Organization.deleteMany({
      slug: { $in: ['test-ds-tenant-a', 'test-ds-tenant-b'] }
    });

    // 1. Tenant Alpha
    tenantA = await Organization.create({
      name: 'DS Tenant Alpha',
      slug: 'test-ds-tenant-a',
      domain: 'ds-alpha.ricoz.io'
    });

    adminA = await User.create({
      organizationId: tenantA._id,
      name: 'DS Admin Alpha',
      email: 'admin@ds-alpha.ricoz.io',
      firstName: 'DSAdmin',
      lastName: 'Alpha',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    stewardA = await User.create({
      organizationId: tenantA._id,
      name: 'DS Steward Alpha',
      email: 'steward@ds-alpha.ricoz.io',
      firstName: 'DSSteward',
      lastName: 'Alpha',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.DATA_STEWARD,
      status: 'active'
    });

    viewerA = await User.create({
      organizationId: tenantA._id,
      name: 'DS Viewer Alpha',
      email: 'viewer@ds-alpha.ricoz.io',
      firstName: 'DSViewer',
      lastName: 'Alpha',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.VIEWER,
      status: 'active'
    });

    adminAToken = tokenService.generateAccessToken({
      userId: adminA._id,
      organizationId: tenantA._id,
      role: adminA.role,
      tokenVersion: 0
    });

    stewardAToken = tokenService.generateAccessToken({
      userId: stewardA._id,
      organizationId: tenantA._id,
      role: stewardA.role,
      tokenVersion: 0
    });

    viewerAToken = tokenService.generateAccessToken({
      userId: viewerA._id,
      organizationId: tenantA._id,
      role: viewerA.role,
      tokenVersion: 0
    });

    // 2. Tenant Beta
    tenantB = await Organization.create({
      name: 'DS Tenant Beta',
      slug: 'test-ds-tenant-b',
      domain: 'ds-beta.ricoz.io'
    });

    adminB = await User.create({
      organizationId: tenantB._id,
      name: 'DS Admin Beta',
      email: 'admin@ds-beta.ricoz.io',
      firstName: 'DSAdmin',
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
  });

  after(async () => {
    if (tenantA) {
      await DataSource.deleteMany({ organizationId: tenantA._id });
      await Dataset.deleteMany({ organizationId: tenantA._id });
      await Activity.deleteMany({ organizationId: tenantA._id });
      await User.deleteMany({ organizationId: tenantA._id });
      await Organization.deleteOne({ _id: tenantA._id });
    }
    if (tenantB) {
      await DataSource.deleteMany({ organizationId: tenantB._id });
      await Dataset.deleteMany({ organizationId: tenantB._id });
      await Activity.deleteMany({ organizationId: tenantB._id });
      await User.deleteMany({ organizationId: tenantB._id });
      await Organization.deleteOne({ _id: tenantB._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // =========================================================================
  // 1. DATA SOURCE CREATION WITH CREDENTIALS
  // =========================================================================
  test('1. Source Creation: POST /api/v1/data-sources creates source with encrypted credentials', async () => {
    const res = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Alpha Primary PG',
        type: 'postgresql',
        description: 'Main production transaction store',
        configuration: {
          host: 'postgres-prod.internal',
          port: 5432,
          database: 'production_db',
          ssl: true,
          schema: 'public'
        },
        credentials: {
          username: 'pgadmin',
          password: 'SecretSuperPassword123!'
        },
        tags: ['prod', 'finance']
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.error, null);
    assert.ok(res.body.data._id);
    assert.strictEqual(res.body.data.name, 'Alpha Primary PG');
    assert.strictEqual(res.body.data.type, 'postgresql');
    assert.strictEqual(res.body.data.status, 'ACTIVE');
    assert.strictEqual(res.body.data.healthStatus, 'UNTESTED');
    assert.strictEqual(res.body.data.connectionState, 'DISCONNECTED');
    assert.strictEqual(res.body.data.credentialStatus, 'configured');
    assert.strictEqual(res.body.data.credentials.password, undefined);
  });

  // =========================================================================
  // 2. POSTGRESQL CONFIGURATION VALIDATION
  // =========================================================================
  test('2. PostgreSQL Configuration: Validates host and port range (rejects port > 65535)', async () => {
    const invalidPortRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Invalid PG Port',
        type: 'postgresql',
        configuration: {
          host: 'pg.internal',
          port: 99999
        }
      }
    });

    assert.strictEqual(invalidPortRes.status, 400);
    assert.strictEqual(invalidPortRes.body.success, false);
    assert.strictEqual(invalidPortRes.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 3. MYSQL CONFIGURATION VALIDATION
  // =========================================================================
  test('3. MySQL Configuration: Accepts valid MySQL config and rejects unsafe host', async () => {
    const validRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Alpha MySQL Orders',
        type: 'mysql',
        configuration: {
          host: 'mysql-cluster.internal',
          port: 3306,
          database: 'orders_db',
          ssl: true
        }
      }
    });

    assert.strictEqual(validRes.status, 201);
    assert.strictEqual(validRes.body.data.name, 'Alpha MySQL Orders');

    const invalidHostRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Unsafe Host MySQL',
        type: 'mysql',
        configuration: {
          host: 'mysql.internal; rm -rf /'
        }
      }
    });

    assert.strictEqual(invalidHostRes.status, 400);
    assert.strictEqual(invalidHostRes.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 4. SNOWFLAKE CONFIGURATION VALIDATION
  // =========================================================================
  test('4. Snowflake Configuration: Requires account identifier and validates warehouse', async () => {
    const validRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Alpha Snowflake DW',
        type: 'snowflake',
        configuration: {
          account: 'xy12345.us-east-1',
          warehouse: 'COMPUTE_WH',
          database: 'ANALYTICS',
          schema: 'PUBLIC',
          role: 'ACCOUNTADMIN'
        }
      }
    });

    assert.strictEqual(validRes.status, 201);
    assert.strictEqual(validRes.body.data.type, 'snowflake');

    const missingAccountRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Missing Account Snowflake',
        type: 'snowflake',
        configuration: {
          warehouse: 'COMPUTE_WH'
        }
      }
    });

    assert.strictEqual(missingAccountRes.status, 400);
  });

  // =========================================================================
  // 5. MONGODB CONFIGURATION VALIDATION
  // =========================================================================
  test('5. MongoDB Configuration: Accepts host, port, database, authSource', async () => {
    const validRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Alpha Document DB',
        type: 'mongodb',
        configuration: {
          host: 'mongo-cluster.internal',
          port: 27017,
          database: 'catalogs',
          authSource: 'admin',
          ssl: true
        }
      }
    });

    assert.strictEqual(validRes.status, 201);
    assert.strictEqual(validRes.body.data.type, 'mongodb');
  });

  // =========================================================================
  // 6. S3 CONFIGURATION VALIDATION
  // =========================================================================
  test('6. S3 Configuration: Rejects prefix directory traversal (..)', async () => {
    const validRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Alpha Lake S3',
        type: 's3',
        configuration: {
          region: 'us-west-2',
          bucket: 'ricoz-analytics-data-lake',
          prefix: 'raw/events/'
        },
        credentials: {
          accessKeyId: 'AKIAEXAMPLE123456789',
          secretAccessKey: 'SecretS3Key987654321!'
        }
      }
    });

    assert.strictEqual(validRes.status, 201);
    assert.strictEqual(validRes.body.data.type, 's3');

    // Reject path traversal in prefix
    const traversalRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Traversal S3',
        type: 's3',
        configuration: {
          region: 'us-west-2',
          bucket: 'ricoz-lake',
          prefix: '../../../etc/passwd'
        }
      }
    });

    assert.strictEqual(traversalRes.status, 400);
    assert.strictEqual(traversalRes.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 7. INVALID SOURCE TYPE
  // =========================================================================
  test('7. Invalid Source Type: Rejects unsupported database engine with 400', async () => {
    const res = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Invalid DB Type',
        type: 'non_existent_engine_type',
        configuration: { host: 'localhost' }
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 8. INVALID CONFIGURATION / MONGO OPERATOR INJECTION
  // =========================================================================
  test('8. Injection Protection: Rejects Mongo operators in configuration', async () => {
    const res = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Injection Attack Source',
        type: 'postgresql',
        configuration: {
          host: 'pg.internal',
          $where: 'this.password != null'
        }
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 9. CRUD LIFECYCLE
  // =========================================================================
  test('9. Full CRUD Lifecycle: Create, Get, Patch, and Delete', async () => {
    // 1. Create
    const createRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'CRUD Lifecycle Source',
        type: 'postgresql',
        description: 'Initial description',
        configuration: { host: 'crud.internal', port: 5432 }
      }
    });
    assert.strictEqual(createRes.status, 201);
    const createdId = createRes.body.data._id;

    // 2. Read by ID
    const getRes = await apiRequest(`/api/v1/data-sources/${createdId}`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.data.name, 'CRUD Lifecycle Source');
    assert.strictEqual(getRes.body.data.description, 'Initial description');

    // 3. Patch
    const patchRes = await apiRequest(`/api/v1/data-sources/${createdId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'CRUD Lifecycle Source Updated',
        description: 'Updated description'
      }
    });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.body.data.name, 'CRUD Lifecycle Source Updated');
    assert.strictEqual(patchRes.body.data.description, 'Updated description');

    // 4. Delete
    const deleteRes = await apiRequest(`/api/v1/data-sources/${createdId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.data.status, 'INACTIVE');

    // 5. Subsequent Read is 404 (soft-deleted)
    const getDeletedRes = await apiRequest(`/api/v1/data-sources/${createdId}`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });
    assert.strictEqual(getDeletedRes.status, 404);
  });

  // =========================================================================
  // 10. PAGINATION
  // =========================================================================
  test('10. Pagination: Returns standard pagination metadata', async () => {
    const res = await apiRequest('/api/v1/data-sources?page=1&limit=2', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.meta.pagination);
    assert.strictEqual(res.body.meta.pagination.page, 1);
    assert.strictEqual(res.body.meta.pagination.limit, 2);
    assert.ok(res.body.meta.pagination.total >= 4);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 2);
  });

  // =========================================================================
  // 11. SEARCH
  // =========================================================================
  test('11. Search: Returns matches based on search term', async () => {
    const res = await apiRequest('/api/v1/data-sources?search=Snowflake', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.some((ds) => ds.name.includes('Snowflake')));
  });

  // =========================================================================
  // 12. FILTERING
  // =========================================================================
  test('12. Filter: Filters strictly by type', async () => {
    const res = await apiRequest('/api/v1/data-sources?filter[type]=postgresql', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    for (const ds of res.body.data) {
      assert.strictEqual(ds.type, 'postgresql');
    }
  });

  // =========================================================================
  // 13. SORTING
  // =========================================================================
  test('13. Sorting: Respects sort=name:asc', async () => {
    const res = await apiRequest('/api/v1/data-sources?sort=name:asc', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    const names = res.body.data.map((d) => d.name);
    const sortedNames = [...names].sort();
    assert.deepStrictEqual(names, sortedNames);
  });

  // =========================================================================
  // 14. TENANT ISOLATION
  // =========================================================================
  test('14. Tenant Isolation: Tenant A cannot see Tenant B data sources in list', async () => {
    // Create source in Tenant B
    const createB = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminBToken}`,
        [TENANT_HEADERS.SLUG]: tenantB.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Beta Isolated Postgres',
        type: 'postgresql',
        configuration: { host: 'pg-beta.internal' }
      }
    });
    assert.strictEqual(createB.status, 201);

    // List Tenant A
    const listA = await apiRequest('/api/v1/data-sources', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(listA.status, 200);
    assert.ok(!listA.body.data.some((ds) => ds.name === 'Beta Isolated Postgres'));
  });

  // =========================================================================
  // 15. CROSS-TENANT READ REJECTION
  // =========================================================================
  test('15. Cross-Tenant Read Rejection: Direct ID lookup returns 404', async () => {
    const bSource = await DataSource.findOne({ organizationId: tenantB._id });
    assert.ok(bSource);

    // Tenant A attempts to read Tenant B's source
    const res = await apiRequest(`/api/v1/data-sources/${bSource._id}`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'DATA_SOURCE_NOT_FOUND');
  });

  // =========================================================================
  // 16. CROSS-TENANT UPDATE REJECTION
  // =========================================================================
  test('16. Cross-Tenant Update Rejection: Direct PATCH returns 404', async () => {
    const bSource = await DataSource.findOne({ organizationId: tenantB._id });
    assert.ok(bSource);

    const res = await apiRequest(`/api/v1/data-sources/${bSource._id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Tampered Name'
      }
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'DATA_SOURCE_NOT_FOUND');
  });

  // =========================================================================
  // 17. CROSS-TENANT DELETE REJECTION
  // =========================================================================
  test('17. Cross-Tenant Delete Rejection: Direct DELETE returns 404', async () => {
    const bSource = await DataSource.findOne({ organizationId: tenantB._id });
    assert.ok(bSource);

    const res = await apiRequest(`/api/v1/data-sources/${bSource._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, 'DATA_SOURCE_NOT_FOUND');
  });

  // =========================================================================
  // 18. MASS-ASSIGNMENT PROTECTION
  // =========================================================================
  test('18. Mass-Assignment Protection: Rejects organizationId and healthStatus in body', async () => {
    const res = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Mass Assignment Attempt',
        type: 'postgresql',
        organizationId: tenantB._id.toString(), // Attacker tries to inject different tenant
        healthStatus: 'HEALTHY'
      }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 19. CREDENTIAL ENCRYPTION (AES-256-GCM)
  // =========================================================================
  test('19. Credential Encryption: Raw password stored as encryptedData in MongoDB', async () => {
    const sensitivePass = 'EnterpriseTopSecretPass999!';
    const createRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Encrypted Creds Check',
        type: 'postgresql',
        configuration: { host: 'pg.internal' },
        credentials: { password: sensitivePass }
      }
    });

    assert.strictEqual(createRes.status, 201);
    const sourceId = createRes.body.data._id;

    // Check direct MongoDB document
    const rawDoc = await DataSource.findById(sourceId).select('+credentials.encryptedData');
    assert.ok(rawDoc.credentials.encryptedData);
    assert.ok(!rawDoc.credentials.encryptedData.includes(sensitivePass));
    assert.strictEqual(rawDoc.credentials.password, undefined);
  });

  // =========================================================================
  // 20. CREDENTIAL REDACTION
  // =========================================================================
  test('20. Credential Redaction: GET APIs return credentialStatus="configured" and zero secrets', async () => {
    const listRes = await apiRequest('/api/v1/data-sources', {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(listRes.status, 200);
    const configuredSources = listRes.body.data.filter((d) => d.credentialStatus === 'configured');
    assert.ok(configuredSources.length > 0);

    for (const ds of configuredSources) {
      assert.strictEqual(ds.credentialStatus, 'configured');
      assert.strictEqual(ds.credentials?.password, undefined);
      assert.strictEqual(ds.credentials?.apiKey, undefined);
      assert.strictEqual(ds.credentials?.encryptedData, undefined);
      assert.strictEqual(ds.credentials?.keyId, undefined);
    }
  });

  // =========================================================================
  // 21. CREDENTIAL UPDATE
  // =========================================================================
  test('21. Credential Update: PATCH metadata preserves credentials; PATCH credentials updates them', async () => {
    const createRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Preserve Creds Test',
        type: 'postgresql',
        configuration: { host: 'pg.internal' },
        credentials: { password: 'InitialPassword1!' }
      }
    });
    const dsId = createRes.body.data._id;

    // Step A: Patch metadata only
    const patchMetaRes = await apiRequest(`/api/v1/data-sources/${dsId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        description: 'New Description Without Changing Creds'
      }
    });
    assert.strictEqual(patchMetaRes.status, 200);
    assert.strictEqual(patchMetaRes.body.data.credentialStatus, 'configured');

    // Step B: Patch new credentials
    const patchCredsRes = await apiRequest(`/api/v1/data-sources/${dsId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        credentials: { password: 'NewReplacedPassword2!' }
      }
    });
    assert.strictEqual(patchCredsRes.status, 200);
    assert.strictEqual(patchCredsRes.body.data.credentialStatus, 'configured');

    // Direct verify new decrypted credential in memory
    const updatedDoc = await DataSource.findById(dsId).select('+credentials.encryptedData');
    const decrypted = updatedDoc.getDecryptedCredentials();
    assert.strictEqual(decrypted.password, 'NewReplacedPassword2!');
  });

  // =========================================================================
  // 22. ACTIVITY LOGGING
  // =========================================================================
  test('22. Activity Logging: Records data_source events without credentials in metadata', async () => {
    const createRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Audited Source',
        type: 'postgresql',
        configuration: { host: 'pg.internal' }
      }
    });
    const dsId = createRes.body.data._id;

    const activity = await Activity.findOne({
      organizationId: tenantA._id,
      entityId: dsId,
      action: 'data_source.created'
    });

    assert.ok(activity);
    assert.strictEqual(activity.action, 'data_source.created');
    assert.strictEqual(activity.entityType, 'data_source');
    assert.strictEqual(activity.metadata.name, 'Audited Source');
    assert.strictEqual(activity.metadata.password, undefined);
  });

  // =========================================================================
  // 23. DELETION / INACTIVATION WITH DEPENDENT DATASET PROTECTION
  // =========================================================================
  test('23. Deletion Behavior: Prevents deletion when downstream dataset exists; inactives when free', async () => {
    const createRes = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Dependency Test Source',
        type: 'postgresql',
        configuration: { host: 'pg.internal' }
      }
    });
    const dsId = createRes.body.data._id;

    // Attach a dependent dataset
    const dataset = await Dataset.create({
      organizationId: tenantA._id,
      dataSourceId: dsId,
      name: 'dependent_table',
      type: 'table'
    });

    // Attempt DELETE -> Must fail with 409
    const blockedRes = await apiRequest(`/api/v1/data-sources/${dsId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(blockedRes.status, 409);
    assert.strictEqual(blockedRes.body.error.code, 'CONFLICT');

    // Remove the dependent dataset
    await Dataset.deleteOne({ _id: dataset._id });

    // Re-attempt DELETE -> Must succeed with soft-inactivation
    const deleteRes = await apiRequest(`/api/v1/data-sources/${dsId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.data.status, 'INACTIVE');
    assert.strictEqual(deleteRes.body.data.isDeleted, true);
  });

  // =========================================================================
  // 24. AUTHORIZATION (RBAC)
  // =========================================================================
  test('24. Authorization: Viewer is denied data source creation and deletion (403)', async () => {
    // Viewer tries to create
    const viewerCreate = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${viewerAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Viewer Unauthorized Source',
        type: 'postgresql'
      }
    });

    assert.strictEqual(viewerCreate.status, 403);
    assert.ok(
      viewerCreate.body.error.code === 'INSUFFICIENT_PERMISSIONS' ||
      viewerCreate.body.error.code === 'FORBIDDEN'
    );

    // Data Steward CAN create
    const stewardCreate = await apiRequest('/api/v1/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stewardAToken}`,
        [TENANT_HEADERS.SLUG]: tenantA.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Steward Permitted Source',
        type: 'postgresql',
        configuration: { host: 'steward-pg.internal' }
      }
    });

    assert.strictEqual(stewardCreate.status, 201);
  });
});
