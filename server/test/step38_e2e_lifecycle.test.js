import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import { QualityRule } from '../src/models/QualityRule.js';
import { QualityRun } from '../src/models/QualityRun.js';
import { QualityIssue } from '../src/models/QualityIssue.js';
import { DataProfile } from '../src/models/DataProfile.js';
import { LineageEdge } from '../src/models/LineageEdge.js';
import { GlossaryTerm } from '../src/models/GlossaryTerm.js';
import { MaskingPolicy } from '../src/models/MaskingPolicy.js';
import { Activity } from '../src/models/Activity.js';
import { Job } from '../src/models/Job.js';
import tokenService from '../src/services/token.service.js';
import { hashPassword } from '../src/utils/crypto.js';
import { closeQueuesAndWorkers } from '../src/jobs/QueueManager.js';
import { CacheService } from '../src/services/CacheService.js';
import { USER_ROLES } from '../src/constants/user.js';

describe('Step 38 — Integration & Real End-to-End PostgreSQL Lifecycle', () => {
  let server;
  let baseUrl;

  let tenant;
  let adminUser;
  let token;

  const pgHost = process.env.POSTGRES_TEST_HOST || 'localhost';
  const pgPort = parseInt(process.env.POSTGRES_TEST_PORT || '5432', 10);
  const pgDb = process.env.POSTGRES_TEST_DB || 'ricoz_test';
  const pgUser = process.env.POSTGRES_TEST_USER || 'postgres';
  const pgPass = process.env.POSTGRES_TEST_PASSWORD || '1818';

  let createdDsId;
  let customersDatasetId;
  let productsDatasetId;

  async function api(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    let body = options.body;
    if (body && typeof body === 'object' && !(typeof body === 'string')) {
      body = JSON.stringify(body);
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual'
    });

    let payload = null;
    const text = await res.text();
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }

    return {
      status: res.status,
      headers: res.headers,
      body: payload
    };
  }

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    tenant = await Organization.create({
      name: 'E2E Real PostgreSQL Tenant',
      slug: `e2e-pg-${Date.now()}`
    });

    adminUser = await User.create({
      organizationId: tenant._id,
      name: 'E2E Lead Admin',
      email: `admin.e2e.${Date.now()}@ricozdata.io`,
      passwordHash: hashPassword('ProductionStrength123!'),
      role: USER_ROLES.ADMIN,
      isEmailVerified: true
    });

    token = tokenService.generateAccessToken({
      userId: adminUser._id,
      organizationId: tenant._id,
      role: USER_ROLES.ADMIN,
      tokenVersion: 0
    });
  });

  after(async () => {
    const orgIds = [tenant._id];
    await Organization.deleteMany({ _id: { $in: orgIds } });
    await User.deleteMany({ organizationId: { $in: orgIds } });
    await DataSource.deleteMany({ organizationId: { $in: orgIds } });
    await Dataset.deleteMany({ organizationId: { $in: orgIds } });
    await QualityRule.deleteMany({ organizationId: { $in: orgIds } });
    await QualityRun.deleteMany({ organizationId: { $in: orgIds } });
    await QualityIssue.deleteMany({ organizationId: { $in: orgIds } });
    await DataProfile.deleteMany({ organizationId: { $in: orgIds } });
    await LineageEdge.deleteMany({ organizationId: { $in: orgIds } });
    await GlossaryTerm.deleteMany({ organizationId: { $in: orgIds } });
    await MaskingPolicy.deleteMany({ organizationId: { $in: orgIds } });
    await Job.deleteMany({ organizationId: { $in: orgIds } });
    await Activity.deleteMany({ organizationId: { $in: orgIds } }, { allowAuditRetentionPurge: true });

    await closeQueuesAndWorkers();
    CacheService.resetStats();

    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // =========================================================================
  // 38.1 REAL BACKEND HEALTH & METRICS
  // =========================================================================

  test('38.1 Real Backend Startup, Health Probes, and Prometheus Metrics', async () => {
    // 1. Health probe
    const health = await api('/healthz');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'healthy');

    // 2. Readiness probe
    const ready = await api('/readyz');
    assert.strictEqual(ready.status, 200);
    assert.strictEqual(ready.body.status, 'ready');
    assert.strictEqual(ready.body.dependencies.database.status, 'connected');

    // 3. Prometheus metrics endpoint
    const metrics = await api('/metrics');
    assert.strictEqual(metrics.status, 200);
    assert.ok(typeof metrics.body === 'string' && (metrics.body.includes('http_requests_total') || metrics.body.includes('ricoz_')));
  });

  // =========================================================================
  // 38.2 REAL POSTGRESQL END-TO-END FLOW (24 STEPS)
  // =========================================================================

  test('38.2 Complete Real PostgreSQL Lifecycle across all platform layers', async () => {
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1. Create PostgreSQL DataSource through real API
    // 2. Store credentials through existing AES-256-GCM encryption
    const createDsRes = await api('/api/v1/data-sources', {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: 'Real Local PostgreSQL Prod Test',
        type: 'postgresql',
        configuration: {
          host: pgHost,
          port: pgPort,
          database: pgDb,
          schema: 'public'
        },
        credentials: {
          username: pgUser,
          password: pgPass
        }
      }
    });

    assert.strictEqual(createDsRes.status, 201, 'DataSource creation failed');
    assert.strictEqual(createDsRes.body.success, true);
    createdDsId = createDsRes.body.data._id;
    assert.ok(createdDsId, 'DataSource ID was not returned');

    // Verify 38.3: Plaintext password is NEVER returned in response
    const jsonResponse = JSON.stringify(createDsRes.body);
    assert.strictEqual(jsonResponse.includes(pgPass), false, 'Secret password leaked in API response!');

    // Verify 38.3: Credentials encrypted at rest in MongoDB
    const rawDsDoc = await DataSource.findById(createdDsId).select('+credentials.encryptedData');
    assert.ok(rawDsDoc.credentials?.encryptedData, 'Credentials not encrypted in database');
    assert.strictEqual(rawDsDoc.credentials.encryptedData.includes(pgPass), false);

    // 3. Test connection
    // 4. Executes SELECT 1 against PostgreSQL localhost:5432
    const testConnRes = await api(`/api/v1/data-sources/${createdDsId}/test`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(testConnRes.status, 200, 'Test connection endpoint failed');
    assert.strictEqual(testConnRes.body.success, true);
    assert.strictEqual(testConnRes.body.data.status, 'connected');
    assert.strictEqual(testConnRes.body.data.healthStatus, 'HEALTHY');
    assert.ok(testConnRes.body.data.details?.serverVersion?.includes('PostgreSQL'));

    // 5. Discover metadata
    const discoverRes = await api(`/api/v1/data-sources/${createdDsId}/discover`, {
      method: 'POST',
      headers: authHeaders,
      body: { schema: 'public' }
    });
    assert.strictEqual(discoverRes.status, 200);
    assert.strictEqual(discoverRes.body.success, true);
    const discoveredTables = discoverRes.body.data.tables.map((t) => t.name);
    assert.ok(discoveredTables.includes('customers'), 'Metadata discovery did not find customers');
    assert.ok(discoveredTables.includes('products'), 'Metadata discovery did not find products');

    // 6. Create/sync catalog datasets
    const syncRes = await api(`/api/v1/data-sources/${createdDsId}/sync`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(syncRes.status, 200);
    assert.strictEqual(syncRes.body.success, true);
    assert.strictEqual(syncRes.body.data.status, 'SUCCESS');
    assert.strictEqual(syncRes.body.data.discoveredCount, 2);

    // 7. Verify actual Dataset records created in MongoDB
    const dsListRes = await api('/api/v1/datasets', { headers: authHeaders });
    assert.strictEqual(dsListRes.status, 200);
    const datasets = dsListRes.body.data;
    assert.strictEqual(datasets.length, 2, 'Catalog did not contain exactly 2 synced datasets');

    const customersDs = datasets.find((d) => d.name === 'customers');
    const productsDs = datasets.find((d) => d.name === 'products');
    assert.ok(customersDs, 'customers dataset record not found in MongoDB');
    assert.ok(productsDs, 'products dataset record not found in MongoDB');
    customersDatasetId = customersDs._id;
    productsDatasetId = productsDs._id;

    // Verify columns on customers dataset
    const custDetailRes = await api(`/api/v1/datasets/${customersDatasetId}`, { headers: authHeaders });
    assert.strictEqual(custDetailRes.status, 200);
    const columnNames = custDetailRes.body.data.columns.map((c) => c.name);
    assert.ok(columnNames.includes('customer_id'));
    assert.ok(columnNames.includes('email'));

    // 8. Create quality rules on customers dataset
    const ruleRes1 = await api(`/api/v1/quality/datasets/${customersDatasetId}/rules`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: 'Email Cannot Be Null',
        ruleType: 'NULL_CHECK',
        targetColumn: 'email',
        severity: 'HIGH',
        configuration: { allowEmptyString: false }
      }
    });
    assert.strictEqual(ruleRes1.status, 201);

    const ruleRes2 = await api(`/api/v1/quality/datasets/${customersDatasetId}/rules`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: 'Customer ID Must Be Unique',
        ruleType: 'UNIQUENESS',
        targetColumn: 'customer_id',
        severity: 'CRITICAL',
        configuration: {}
      }
    });
    assert.strictEqual(ruleRes2.status, 201);

    // 9. Run quality check against real PostgreSQL database
    // 10. Verify quality score
    // 11. Verify quality snapshot
    const runRes = await api(`/api/v1/quality/datasets/${customersDatasetId}/run`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(runRes.status, 200);
    assert.strictEqual(runRes.body.success, true);
    assert.ok(['SUCCESS', 'PASSED'].includes(runRes.body.data.status));
    assert.strictEqual(typeof runRes.body.data.score, 'number');
    assert.ok(runRes.body.data.score >= 0 && runRes.body.data.score <= 100);

    // 12. Verify quality run record & snapshot in database
    const qualityRuns = await QualityRun.find({ datasetId: customersDatasetId });
    assert.ok(qualityRuns.length >= 1, 'Quality run was not recorded in MongoDB');

    // 13. Profile dataset against real PostgreSQL table
    const startProfileRes = await api(`/api/v1/datasets/${customersDatasetId}/profile`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(startProfileRes.status, 200);
    assert.strictEqual(startProfileRes.body.success, true);

    // 14. Verify profile snapshot
    const profileRes = await api(`/api/v1/datasets/${customersDatasetId}/profile`, {
      headers: authHeaders
    });
    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileRes.body.success, true);
    assert.ok(profileRes.body.data.datasetId);

    // 15. Apply classification to customers dataset
    const patchRes = await api('/api/v1/governance/classification', {
      method: 'POST',
      headers: authHeaders,
      body: {
        datasetId: String(customersDatasetId),
        column: 'email',
        classification: 'PII'
      }
    });
    assert.strictEqual(patchRes.status, 200);

    // 16. Apply masking policy
    const maskRes = await api('/api/v1/governance/masking-policies', {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: 'Email Redaction Mask',
        datasetId: String(customersDatasetId),
        column: 'email',
        maskingType: 'REDACT',
        roles: ['viewer', 'analyst']
      }
    });
    assert.strictEqual(maskRes.status, 201);

    // 17. Verify compliance report
    const compRes = await api('/api/v1/governance/compliance-report', { headers: authHeaders });
    assert.strictEqual(compRes.status, 200);
    assert.strictEqual(compRes.body.success, true);

    // 18. Create lineage relationship between customers and products
    const lineageRes = await api('/api/v1/lineage', {
      method: 'POST',
      headers: authHeaders,
      body: {
        upstreamDatasetId: String(customersDatasetId),
        downstreamDatasetId: String(productsDatasetId),
        relationshipType: 'JOINED'
      }
    });
    assert.strictEqual(lineageRes.status, 201);

    // 19. Link glossary term
    const glossaryRes = await api('/api/v1/glossary', {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: 'Customer Account Entity',
        definition: 'Represents verified registered customers with KYC data'
      }
    });
    assert.strictEqual(glossaryRes.status, 201);
    const termId = glossaryRes.body.data._id;
    const linkRes = await api(`/api/v1/glossary/${termId}/link`, {
      method: 'POST',
      headers: authHeaders,
      body: { datasetId: String(customersDatasetId) }
    });
    assert.strictEqual(linkRes.status, 200);

    // 20. Verify audit trail
    const auditRes = await api('/api/v1/audit', { headers: authHeaders });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.body.data.length > 0, 'Audit trail did not capture lifecycle activities');
    // Ensure audit trail does NOT contain plaintext password
    assert.strictEqual(JSON.stringify(auditRes.body).includes(pgPass), false);

    // 21. Trigger background job
    // 22. Verify job acceptance
    const jobRes = await api('/api/v1/jobs/enqueue', {
      method: 'POST',
      headers: authHeaders,
      body: {
        jobType: 'data_profiling',
        resourceId: String(customersDatasetId),
        resourceType: 'dataset'
      }
    });
    assert.strictEqual(jobRes.status, 202);
    assert.strictEqual(jobRes.body.success, true);

    // 23. Verify cache invalidation & stats
    await CacheService.set('test-cache-key', { foo: 'bar' }, 60);
    const cachedVal = await CacheService.get('test-cache-key');
    assert.ok(cachedVal);
    await CacheService.del('test-cache-key');
    const deletedVal = await CacheService.get('test-cache-key');
    assert.strictEqual(deletedVal, null);

    // 24. Verify metrics endpoint updated
    const finalMetrics = await api('/metrics');
    assert.strictEqual(finalMetrics.status, 200);
    assert.ok(typeof finalMetrics.body === 'string' && (finalMetrics.body.includes('http_requests_total') || finalMetrics.body.includes('ricoz_')));
  });

  // =========================================================================
  // 38.4 FAILURE SCENARIOS E2E
  // =========================================================================

  test('38.4 Failure Scenarios: Wrong credentials, invalid host/port, bad database fail safely without leaks', async () => {
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1. Wrong PostgreSQL Password
    const wrongPassDs = await api('/api/v1/data-sources', {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: 'Wrong Password DS',
        type: 'postgresql',
        configuration: {
          host: pgHost,
          port: pgPort,
          database: pgDb,
          schema: 'public'
        },
        credentials: {
          username: pgUser,
          password: 'CompletelyWrongPassword_XYZ999!'
        }
      }
    });
    assert.strictEqual(wrongPassDs.status, 201);
    const wrongPassId = wrongPassDs.body.data._id;

    // Test connection with wrong password
    const testFailRes = await api(`/api/v1/data-sources/${wrongPassId}/test`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(testFailRes.status, 200);
    assert.strictEqual(testFailRes.body.success, false);
    assert.strictEqual(testFailRes.body.data.status, 'error');
    // Ensure failure message NEVER leaks the attempted password
    assert.strictEqual(JSON.stringify(testFailRes.body).includes('CompletelyWrongPassword_XYZ999!'), false);

    // 2. Bad Database Name
    const badDbDs = await api('/api/v1/data-sources', {
      method: 'POST',
      headers: authHeaders,
      body: {
        name: 'Nonexistent DB DS',
        type: 'postgresql',
        configuration: {
          host: pgHost,
          port: pgPort,
          database: 'nonexistent_database_12345',
          schema: 'public'
        },
        credentials: {
          username: pgUser,
          password: pgPass
        }
      }
    });
    assert.strictEqual(badDbDs.status, 201);
    const badDbId = badDbDs.body.data._id;

    const testBadDbRes = await api(`/api/v1/data-sources/${badDbId}/test`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(testBadDbRes.status, 200);
    assert.strictEqual(testBadDbRes.body.success, false);
    assert.strictEqual(testBadDbRes.body.data.status, 'error');
  });

  // =========================================================================
  // 38.5 IDEMPOTENCY E2E
  // =========================================================================

  test('38.5 Idempotency: Repeated catalog sync does NOT duplicate datasets', async () => {
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Initial count of datasets for this tenant
    const countBefore = await Dataset.countDocuments({ organizationId: tenant._id });

    // Repeated Sync 1
    const sync1 = await api(`/api/v1/data-sources/${createdDsId}/sync`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(sync1.status, 200);
    assert.strictEqual(sync1.body.data.createdCount, 0, 'Sync created duplicates on second run');

    // Repeated Sync 2
    const sync2 = await api(`/api/v1/data-sources/${createdDsId}/sync`, {
      method: 'POST',
      headers: authHeaders
    });
    assert.strictEqual(sync2.status, 200);
    assert.strictEqual(sync2.body.data.createdCount, 0, 'Sync created duplicates on third run');

    // Verify dataset count remains unchanged
    const countAfter = await Dataset.countDocuments({ organizationId: tenant._id });
    assert.strictEqual(countAfter, countBefore, 'Dataset count increased after repeated catalog syncs');
  });
});
