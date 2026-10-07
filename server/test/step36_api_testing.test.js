import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';

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
import jwt from 'jsonwebtoken';
import config from '../src/config/env.js';
import tokenService from '../src/services/token.service.js';
import { hashPassword } from '../src/utils/crypto.js';
import { closeQueuesAndWorkers } from '../src/jobs/QueueManager.js';
import { CacheService } from '../src/services/CacheService.js';

describe('Step 36 — Comprehensive API Testing Suite', () => {
  let server;
  let baseUrl;

  let tenantA;
  let adminA;
  let tokenA;
  let expiredTokenA;

  let tenantB;
  let adminB;
  let tokenB;

  let testDsA;
  let testDatasetA;

  async function api(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof String)) {
      body = JSON.stringify(body);
    }

    const t0 = performance.now();
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual'
    });
    const duration = performance.now() - t0;

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
      body: payload,
      duration
    };
  }

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Tenant A
    tenantA = await Organization.create({
      name: 'Step36 Tenant Alpha',
      slug: `step36-alpha-${Date.now()}`
    });

    adminA = await User.create({
      organizationId: tenantA._id,
      name: 'Alpha Admin',
      email: `admin.alpha.${Date.now()}@alpha.com`,
      passwordHash: hashPassword('StrongPassword123!'),
      role: 'admin',
      isEmailVerified: true
    });

    tokenA = tokenService.generateAccessToken({
      userId: adminA._id,
      organizationId: tenantA._id,
      role: 'admin',
      tokenVersion: 0
    });

    // Generate genuinely expired token
    expiredTokenA = jwt.sign(
      {
        sub: String(adminA._id),
        userId: String(adminA._id),
        organizationId: String(tenantA._id),
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) - 300 // expired 5 minutes ago
      },
      config.jwt.secret
    );

    // Tenant B
    tenantB = await Organization.create({
      name: 'Step36 Tenant Beta',
      slug: `step36-beta-${Date.now()}`
    });

    adminB = await User.create({
      organizationId: tenantB._id,
      name: 'Beta Admin',
      email: `admin.beta.${Date.now()}@beta.com`,
      passwordHash: hashPassword('StrongPassword123!'),
      role: 'admin',
      isEmailVerified: true
    });

    tokenB = tokenService.generateAccessToken({
      userId: adminB._id,
      organizationId: tenantB._id,
      role: 'admin',
      tokenVersion: 0
    });

    // Create a real DataSource for Tenant A
    testDsA = await DataSource.create({
      organizationId: tenantA._id,
      name: 'Alpha Postgres Master',
      type: 'postgresql',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'ricoz_test',
        schema: 'public',
        ssl: false
      },
      credentials: {
        encryptedData: 'dummy_enc_data_blob',
        iv: '1234567890123456',
        authTag: '1234567890123456',
        keyVersion: 'KEY_V1'
      }
    });

    // Create a real Dataset for Tenant A
    testDatasetA = await Dataset.create({
      organizationId: tenantA._id,
      dataSourceId: testDsA._id,
      name: 'customers',
      schemaName: 'public',
      fullyQualifiedName: 'public.customers',
      type: 'table',
      origin: 'DISCOVERED',
      syncStatus: 'ACTIVE',
      columns: [
        { name: 'id', dataType: 'integer', isPrimaryKey: true, nullable: false },
        { name: 'name', dataType: 'varchar', nullable: false },
        { name: 'email', dataType: 'varchar', nullable: true, classification: 'pii' }
      ]
    });
  });

  after(async () => {
    const orgIds = [tenantA._id, tenantB._id];
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
  // 36.1 & 36.2 AUTHENTICATION MATRIX & CORE API AREAS
  // =========================================================================

  test('36.1 Authentication Matrix: Unauthenticated, Invalid, Expired, Valid & Cross-Tenant', async () => {
    const testEndpoint = `/api/v1/datasets/${testDatasetA._id}`;

    // 1. No authentication -> 401
    const resNoAuth = await api(testEndpoint);
    assert.strictEqual(resNoAuth.status, 401);
    assert.strictEqual(resNoAuth.body.success, false);
    assert.ok(resNoAuth.body.error?.message?.includes('token required') || resNoAuth.body.error?.code === 'AUTHENTICATION_REQUIRED');

    // 2. Invalid JWT signature -> 401
    const resInvalid = await api(testEndpoint, {
      headers: { Authorization: 'Bearer totally.invalid.tampered-jwt-token' }
    });
    assert.strictEqual(resInvalid.status, 401);
    assert.strictEqual(resInvalid.body.success, false);

    // 3. Expired JWT -> 401
    const resExpired = await api(testEndpoint, {
      headers: { Authorization: `Bearer ${expiredTokenA}` }
    });
    assert.strictEqual(resExpired.status, 401);
    assert.strictEqual(resExpired.body.success, false);

    // 4. Valid JWT -> 200
    const resValid = await api(testEndpoint, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(resValid.status, 200);
    assert.strictEqual(resValid.body.success, true);
    assert.strictEqual(resValid.body.data.name, 'customers');

    // 5. Valid JWT from wrong tenant (Tenant B accessing Tenant A's dataset) -> 404 (Fail-closed isolation)
    const resCrossTenant = await api(testEndpoint, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(resCrossTenant.status, 404);
    assert.strictEqual(resCrossTenant.body.success, false);
  });

  test('36.2 Core API Endpoints Verification across all domains', async () => {
    const headers = { Authorization: `Bearer ${tokenA}` };

    // 1. Health Endpoints
    const healthz = await api('/healthz');
    assert.strictEqual(healthz.status, 200);
    assert.strictEqual(healthz.body.status, 'healthy');

    const readyz = await api('/readyz');
    assert.strictEqual(readyz.status, 200);
    assert.strictEqual(readyz.body.status, 'ready');

    const metrics = await api('/metrics');
    assert.strictEqual(metrics.status, 200);
    assert.ok(typeof metrics.body === 'string' && metrics.body.includes('http_requests_total'));

    // 2. Organization Endpoints
    const orgRes = await api('/api/v1/organizations/current', { headers });
    assert.strictEqual(orgRes.status, 200);
    assert.strictEqual(orgRes.body.data.slug, tenantA.slug);

    // 3. User Endpoints
    const userRes = await api('/api/v1/users', { headers });
    assert.strictEqual(userRes.status, 200);
    assert.ok(Array.isArray(userRes.body.users || userRes.body.data));

    // 4. DataSource Endpoints
    const dsList = await api('/api/v1/data-sources', { headers });
    assert.strictEqual(dsList.status, 200);
    assert.ok(dsList.body.data.some((ds) => ds.name === 'Alpha Postgres Master'));

    // 5. Dataset Endpoints
    const dsGet = await api(`/api/v1/datasets/${testDatasetA._id}`, { headers });
    assert.strictEqual(dsGet.status, 200);
    assert.strictEqual(dsGet.body.data.name, 'customers');

    // 6. Search / Catalog Endpoints
    const searchRes = await api('/api/v1/search?query=customers', { headers });
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchRes.body.data.items.some((i) => i.name === 'customers'));

    // 7. Dashboard Endpoints
    const dashRes = await api('/api/v1/dashboard/summary', { headers });
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.body.data.totalDatasets, 1);

    // 8. Quality Rules & Runs Endpoints
    const qRuleRes = await api(`/api/v1/quality/datasets/${testDatasetA._id}/rules`, {
      method: 'POST',
      headers,
      body: {
        name: 'Check customer email nulls',
        ruleType: 'NULL_CHECK',
        dimension: 'completeness',
        severity: 'HIGH',
        parameters: { column: 'email' }
      }
    });
    assert.strictEqual(qRuleRes.status, 201);
    const ruleId = qRuleRes.body.data._id;

    const qRulesList = await api(`/api/v1/quality/datasets/${testDatasetA._id}/rules`, { headers });
    assert.strictEqual(qRulesList.status, 200);
    assert.ok(qRulesList.body.data.some((r) => r._id === ruleId));

    // 9. Profiling Endpoints
    await DataProfile.create({
      organizationId: tenantA._id,
      dataSourceId: testDsA._id,
      datasetId: testDatasetA._id,
      rowCount: 4,
      columnCount: 3,
      columns: [
        { columnName: 'id', dataType: 'integer', nullCount: 0, distinctCount: 4 },
        { columnName: 'name', dataType: 'varchar', nullCount: 0, distinctCount: 4 },
        { columnName: 'email', dataType: 'varchar', nullCount: 0, distinctCount: 4 }
      ]
    });

    const profRes = await api(`/api/v1/datasets/${testDatasetA._id}/profile`, { headers });
    assert.strictEqual(profRes.status, 200);
    assert.strictEqual(profRes.body.data.rowCount, 4);

    // 10. Lineage Endpoints
    const targetDataset = await Dataset.create({
      organizationId: tenantA._id,
      dataSourceId: testDsA._id,
      name: 'customer_marts',
      type: 'table'
    });

    const lineagePost = await api('/api/v1/lineage', {
      method: 'POST',
      headers,
      body: {
        upstreamDatasetId: String(testDatasetA._id),
        downstreamDatasetId: String(targetDataset._id),
        relationshipType: 'DERIVED'
      }
    });
    assert.strictEqual(lineagePost.status, 201);

    const lineageGraph = await api(`/api/v1/lineage/datasets/${testDatasetA._id}`, { headers });
    assert.strictEqual(lineageGraph.status, 200);
    assert.ok(lineageGraph.body.data.nodes.length >= 2);

    // 11. Business Glossary Endpoints
    const termRes = await api('/api/v1/glossary', {
      method: 'POST',
      headers,
      body: {
        term: 'Customer Identification Number',
        definition: 'Primary unique identifier for all global accounts.',
        linkedDatasets: [{ datasetId: String(testDatasetA._id), column: 'id' }]
      }
    });
    assert.strictEqual(termRes.status, 201);

    const termList = await api('/api/v1/glossary', { headers });
    assert.strictEqual(termList.status, 200);
    assert.ok(termList.body.data.some((t) => t.name === 'Customer Identification Number' || t.term === 'Customer Identification Number'));

    // 12. Governance & Compliance Endpoints
    const compRes = await api('/api/v1/governance/compliance-report', { headers });
    assert.strictEqual(compRes.status, 200);
    assert.ok(compRes.body.data.summary);
    assert.strictEqual(typeof compRes.body.data.summary.totalDatasets, 'number');

    // 13. Audit Log Endpoints
    const auditRes = await api('/api/v1/audit', { headers });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body.data));

    // 14. Background Jobs Endpoints
    const jobRes = await api('/api/v1/jobs/enqueue', {
      method: 'POST',
      headers,
      body: {
        jobType: 'data_profiling',
        resourceId: String(testDatasetA._id),
        resourceType: 'dataset'
      }
    });
    assert.strictEqual(jobRes.status, 202);
    assert.strictEqual(jobRes.body.data.status, 'QUEUED');
  });

  // =========================================================================
  // 36.3 & 36.4 VALIDATION & RESPONSE ENVELOPE CONTRACT TESTING
  // =========================================================================

  test('36.3 Validation Testing: Rejects malformed input with structured errors', async () => {
    const headers = { Authorization: `Bearer ${tokenA}` };

    // 1. Missing required fields in DataSource creation
    const resMissing = await api('/api/v1/data-sources', {
      method: 'POST',
      headers,
      body: { type: 'postgresql' } // missing name, configuration, credentials
    });
    assert.strictEqual(resMissing.status, 400);
    assert.strictEqual(resMissing.body.success, false);
    assert.ok(resMissing.body.error);

    // 2. Malformed ObjectId parameter
    const resBadId = await api('/api/v1/data-sources/not-a-valid-hex-id-1234', { headers });
    assert.strictEqual(resBadId.status, 400);
    assert.strictEqual(resBadId.body.success, false);

    // 3. Invalid enum value
    const resBadEnum = await api('/api/v1/data-sources', {
      method: 'POST',
      headers,
      body: {
        name: 'Bad Type DS',
        type: 'unsupported_quantum_database',
        configuration: { host: 'localhost' },
        credentials: { username: 'test', password: 'password' }
      }
    });
    assert.strictEqual(resBadEnum.status, 400);
    assert.strictEqual(resBadEnum.body.success, false);

    // 4. Negative pagination strictly rejected
    const resNegPage = await api('/api/v1/datasets?page=-5&limit=-10', { headers });
    assert.strictEqual(resNegPage.status, 400);
    assert.strictEqual(resNegPage.body.success, false);

    // 5. Oversized string payload / Header injection
    const resInj = await api('/api/v1/search?query=' + 'A'.repeat(500), { headers });
    assert.strictEqual(resInj.status, 400); // Exceeds max length limit
    assert.strictEqual(resInj.body.success, false);
  });

  test('36.4 Response Envelope Contract: Standard shape { success, data, error, meta }', async () => {
    const headers = { Authorization: `Bearer ${tokenA}` };

    // Successful response shape
    const resSuccess = await api('/api/v1/datasets', { headers });
    assert.strictEqual(resSuccess.status, 200);
    assert.strictEqual(typeof resSuccess.body.success, 'boolean');
    assert.strictEqual(resSuccess.body.success, true);
    assert.ok(Array.isArray(resSuccess.body.data));
    assert.strictEqual(resSuccess.body.error, null);
    assert.ok(resSuccess.body.meta);
    assert.ok(resSuccess.body.meta.pagination);

    // Error response shape
    const resError = await api('/api/v1/datasets/60d0fe4f5311236168a109ca', { headers });
    assert.strictEqual(resError.status, 404);
    assert.strictEqual(resError.body.success, false);
    assert.strictEqual(resError.body.data, null);
    assert.ok(resError.body.error);
    assert.strictEqual(typeof resError.body.error.code, 'string');
    assert.strictEqual(typeof resError.body.error.message, 'string');
  });

  // =========================================================================
  // 36.6 API PERFORMANCE & LATENCY MEASUREMENT
  // =========================================================================

  test('36.6 Performance Audit: Real measured latency on critical endpoints', async () => {
    const headers = { Authorization: `Bearer ${tokenA}` };

    const endpoints = [
      { name: 'Health Probe (/healthz)', path: '/healthz', auth: false },
      { name: 'Readiness Probe (/readyz)', path: '/readyz', auth: false },
      { name: 'Prometheus Metrics (/metrics)', path: '/metrics', auth: false },
      { name: 'Dashboard Summary', path: '/api/v1/dashboard/summary', auth: true },
      { name: 'Dataset List', path: '/api/v1/datasets', auth: true },
      { name: 'Dataset Search', path: '/api/v1/datasets?search=customers', auth: true },
      { name: 'Unified Search', path: '/api/v1/search?query=customers', auth: true },
      { name: 'Audit Events', path: '/api/v1/audit', auth: true },
      { name: 'Compliance Report', path: '/api/v1/governance/compliance-report', auth: true }
    ];

    const measurements = [];
    for (const ep of endpoints) {
      const res = await api(ep.path, ep.auth ? { headers } : {});
      assert.strictEqual(res.status, 200);
      measurements.push({
        endpoint: ep.name,
        latencyMs: Math.round(res.duration * 10) / 10
      });
      // Operational baseline: all core read APIs must respond in under 500ms
      assert.ok(res.duration < 500, `${ep.name} took too long: ${res.duration}ms`);
    }

    console.log('\n--- Step 36 Real API Latency Measurements ---');
    measurements.forEach((m) => {
      console.log(`  ${m.endpoint.padEnd(35)} : ${m.latencyMs} ms`);
    });
  });
});
