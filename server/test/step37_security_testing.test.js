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
import { Activity } from '../src/models/Activity.js';
import { Job } from '../src/models/Job.js';
import tokenService from '../src/services/token.service.js';
import { hashPassword } from '../src/utils/crypto.js';
import { validateCustomSql, validateSafeRegex, validateSafeHost } from '../src/utils/securityValidators.js';
import { escapeRegex, parseFilters } from '../src/services/query.service.js';
import { closeQueuesAndWorkers } from '../src/jobs/QueueManager.js';
import { CacheService } from '../src/services/CacheService.js';
import { USER_ROLES } from '../src/constants/user.js';

describe('Step 37 — Comprehensive Security Testing Suite', () => {
  let server;
  let baseUrl;

  let tenantA;
  let tenantB;

  let userAdmin;
  let userViewer;
  let userAnalyst;
  let userDataEng;
  let userDataSteward;

  let tokenAdmin;
  let tokenViewer;
  let tokenAnalyst;
  let tokenDataEng;
  let tokenDataSteward;

  let testDsA;
  let testDatasetA;

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

    // Create Test Tenants
    tenantA = await Organization.create({
      name: 'Security Test Tenant A',
      slug: `sec-a-${Date.now()}`
    });

    tenantB = await Organization.create({
      name: 'Security Test Tenant B',
      slug: `sec-b-${Date.now()}`
    });

    // Create Users for RBAC Matrix in Tenant A
    userAdmin = await User.create({
      organizationId: tenantA._id,
      name: 'Sec Admin',
      email: `admin.sec.${Date.now()}@test.com`,
      passwordHash: hashPassword('SecPass123!'),
      role: USER_ROLES.ADMIN,
      isEmailVerified: true
    });
    tokenAdmin = tokenService.generateAccessToken({
      userId: userAdmin._id,
      organizationId: tenantA._id,
      role: USER_ROLES.ADMIN,
      tokenVersion: 0
    });

    userViewer = await User.create({
      organizationId: tenantA._id,
      name: 'Sec Viewer',
      email: `viewer.sec.${Date.now()}@test.com`,
      passwordHash: hashPassword('SecPass123!'),
      role: USER_ROLES.VIEWER,
      isEmailVerified: true
    });
    tokenViewer = tokenService.generateAccessToken({
      userId: userViewer._id,
      organizationId: tenantA._id,
      role: USER_ROLES.VIEWER,
      tokenVersion: 0
    });

    userAnalyst = await User.create({
      organizationId: tenantA._id,
      name: 'Sec Analyst',
      email: `analyst.sec.${Date.now()}@test.com`,
      passwordHash: hashPassword('SecPass123!'),
      role: USER_ROLES.ANALYST,
      isEmailVerified: true
    });
    tokenAnalyst = tokenService.generateAccessToken({
      userId: userAnalyst._id,
      organizationId: tenantA._id,
      role: USER_ROLES.ANALYST,
      tokenVersion: 0
    });

    userDataEng = await User.create({
      organizationId: tenantA._id,
      name: 'Sec DataEng',
      email: `dataeng.sec.${Date.now()}@test.com`,
      passwordHash: hashPassword('SecPass123!'),
      role: USER_ROLES.DATA_ENGINEER,
      isEmailVerified: true
    });
    tokenDataEng = tokenService.generateAccessToken({
      userId: userDataEng._id,
      organizationId: tenantA._id,
      role: USER_ROLES.DATA_ENGINEER,
      tokenVersion: 0
    });

    userDataSteward = await User.create({
      organizationId: tenantA._id,
      name: 'Sec Steward',
      email: `steward.sec.${Date.now()}@test.com`,
      passwordHash: hashPassword('SecPass123!'),
      role: USER_ROLES.DATA_STEWARD,
      isEmailVerified: true
    });
    tokenDataSteward = tokenService.generateAccessToken({
      userId: userDataSteward._id,
      organizationId: tenantA._id,
      role: USER_ROLES.DATA_STEWARD,
      tokenVersion: 0
    });

    // Seed DataSource in Tenant A with AES-256-GCM encrypted credentials
    testDsA = new DataSource({
      organizationId: tenantA._id,
      name: 'Sec PostgreSQL DS',
      type: 'postgresql',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'ricoz_test',
        schema: 'public'
      },
      status: 'ACTIVE',
      createdBy: userAdmin._id
    });
    testDsA.setCredentials({ username: 'postgres', password: 'RealSecretPassword987!' });
    await testDsA.save();

    // Seed Dataset in Tenant A
    testDatasetA = await Dataset.create({
      organizationId: tenantA._id,
      dataSourceId: testDsA._id,
      name: 'sec_customers',
      type: 'table',
      schema: 'public',
      status: 'ACTIVE',
      createdBy: userAdmin._id
    });
  });

  after(async () => {
    const orgIds = [tenantA._id, tenantB._id];
    await Organization.deleteMany({ _id: { $in: orgIds } });
    await User.deleteMany({ organizationId: { $in: orgIds } });
    await DataSource.deleteMany({ organizationId: { $in: orgIds } });
    await Dataset.deleteMany({ organizationId: { $in: orgIds } });
    await QualityRule.deleteMany({ organizationId: { $in: orgIds } });
    await Job.deleteMany({ organizationId: { $in: orgIds } });
    await Activity.deleteMany({ organizationId: { $in: orgIds } }, { allowAuditRetentionPurge: true });

    await closeQueuesAndWorkers();
    CacheService.resetStats();

    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  // =========================================================================
  // 37.3 SQL INJECTION NEGATIVE TESTING
  // =========================================================================

  test('37.3 SQL Injection: Rejection of destructive queries, stacked statements, comments, system tables', () => {
    const attacks = [
      { name: 'Stacked Statement', sql: 'SELECT 1; DROP TABLE customers;' },
      { name: 'Inline Comment Injection', sql: 'SELECT * FROM customers -- WHERE id = 1' },
      { name: 'Block Comment Injection', sql: 'SELECT * FROM customers /* comment */' },
      { name: 'DDL Drop Table', sql: 'DROP TABLE customers' },
      { name: 'DDL Alter Table', sql: 'ALTER TABLE customers ADD COLUMN hack text' },
      { name: 'DDL Truncate', sql: 'TRUNCATE TABLE customers' },
      { name: 'DML Delete', sql: 'DELETE FROM customers WHERE 1=1' },
      { name: 'DML Update', sql: "UPDATE users SET role = 'owner'" },
      { name: 'DML Insert', sql: "INSERT INTO users (email) VALUES ('hacker@evil.com')" },
      { name: 'Privilege Escalation Grant', sql: 'GRANT ALL PRIVILEGES ON ALL TABLES TO PUBLIC' },
      { name: 'System Table pg_shadow', sql: 'SELECT usename, passwd FROM pg_shadow' },
      { name: 'System Table pg_authid', sql: 'SELECT rolname, rolpassword FROM pg_authid' },
      { name: 'Sleep / Benchmark DoS', sql: 'SELECT pg_sleep(10)' },
      { name: 'Multiple Statements without space', sql: 'SELECT 1;DELETE FROM users;' },
      { name: 'Overly long SQL query payload', sql: 'SELECT ' + 'x'.repeat(2500) }
    ];

    for (const attack of attacks) {
      const res = validateCustomSql(attack.sql);
      assert.strictEqual(
        res.valid,
        false,
        `Expected attack "${attack.name}" to be rejected by validateCustomSql, but was accepted`
      );
      assert.ok(res.error, `Attack "${attack.name}" must return informative security error message`);
    }

    // Verify legitimate read-only query passes
    const validQuery = 'SELECT COUNT(*) AS total_records, 0 AS failed_records FROM customers WHERE email IS NULL';
    const validRes = validateCustomSql(validQuery);
    assert.strictEqual(validRes.valid, true, 'Legitimate read-only quality check SQL must pass validation');
  });

  // =========================================================================
  // 37.4 NOSQL INJECTION NEGATIVE TESTING
  // =========================================================================

  test('37.4 NoSQL Injection: Protection against MongoDB query operators in query params and body', async () => {
    const allowedFilters = {
      status: { type: 'enum', values: ['active', 'inactive', 'pending'] },
      name: { type: 'string' }
    };

    // 1. Direct MongoDB operator object injection ($ne, $gt, $where, $regex)
    const injectionQueries = [
      { filter: { status: { $ne: null } } },
      { filter: { status: { $gt: '' } } },
      { filter: { name: { $where: 'sleep(1000)' } } },
      { filter: { name: { $regex: '.*' } } }
    ];

    for (const query of injectionQueries) {
      assert.throws(
        () => parseFilters(query, allowedFilters),
        /Disallowed MongoDB operator/,
        'Expected operator injection to throw BadRequestError'
      );
    }

    // 2. HTTP Request boundary: Attempting NoSQL injection via API query parameters
    const res = await api('/api/v1/datasets?filter[status][$ne]=null', {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    // Either the query service throws a structured 400 Bad Request or query parser strips it safely
    assert.ok(
      res.status === 400 || res.status === 200,
      `API should safely handle NoSQL filter injection. Received status: ${res.status}`
    );
    if (res.status === 400) {
      assert.strictEqual(res.body.success, false);
    }

    // 3. Regex escaping verification: special characters in search input are escaped
    const dangerousSearch = '^.*(?=.*[a-z])(evil)+$';
    const escaped = escapeRegex(dangerousSearch);
    assert.ok(escaped.includes('\\^'));
    assert.ok(escaped.includes('\\.'));
    assert.ok(escaped.includes('\\*'));
    assert.ok(escaped.includes('\\('));
  });

  // =========================================================================
  // 37.5 SSRF NETWORK POLICY TESTING
  // =========================================================================

  test('37.5 SSRF: Rejection of cloud metadata addresses, link-local, unroutable IPs, and invalid hosts', async () => {
    const ssrfTargets = [
      { host: '169.254.169.254', reason: 'AWS/Azure EC2 Instance Metadata Service' },
      { host: 'metadata.google.internal', reason: 'GCP Instance Metadata Host' },
      { host: '169.254.169.253', reason: 'Cloud Link-Local DNS Resolver' },
      { host: '169.254.1.1', reason: 'Link-Local IPv4 Range' },
      { host: '0.0.0.0', reason: 'Unroutable wildcard host' },
      { host: '240.0.0.1', reason: 'Reserved Class E address' },
      { host: 'localhost; evil.com', reason: 'Command / delimiter injection in host' }
    ];

    for (const target of ssrfTargets) {
      const res = validateSafeHost(target.host, { allowLocal: true });
      assert.strictEqual(
        res.valid,
        false,
        `Expected SSRF target "${target.host}" (${target.reason}) to be blocked`
      );
      assert.ok(res.error, `SSRF target "${target.host}" must return a rejection error`);
    }

    // HTTP boundary SSRF test: attempt creating a DataSource pointing to AWS metadata IP
    const dsRes = await api('/api/v1/data-sources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: {
        name: 'Evil Metadata DS',
        type: 'postgresql',
        configuration: {
          host: '169.254.169.254',
          port: 5432,
          database: 'meta'
        }
      }
    });

    assert.strictEqual(dsRes.status, 400, 'DataSource creation pointing to cloud metadata IP must return 400');
    assert.strictEqual(dsRes.body.success, false);
    assert.ok(
      JSON.stringify(dsRes.body).toLowerCase().includes('metadata') ||
      JSON.stringify(dsRes.body).toLowerCase().includes('ssrf') ||
      JSON.stringify(dsRes.body).toLowerCase().includes('prohibited')
    );
  });

  // =========================================================================
  // 37.6 AUTHORIZATION & PRIVILEGE ESCALATION MATRIX
  // =========================================================================

  test('37.6 Authorization Matrix: Rigorous enforcement of RBAC boundaries and privilege escalation blocks', async () => {
    // 1. VIEWER cannot create a data source -> 403 Forbidden
    const viewerCreateDs = await api('/api/v1/data-sources', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenViewer}` },
      body: {
        name: 'Viewer Unauthorized DS',
        type: 'postgresql',
        configuration: { host: 'localhost', port: 5432, database: 'test' }
      }
    });
    assert.strictEqual(viewerCreateDs.status, 403, 'Viewer creating data source must return 403');
    assert.strictEqual(viewerCreateDs.body.success, false);

    // 2. VIEWER cannot delete a data source -> 403 Forbidden
    const viewerDeleteDs = await api(`/api/v1/data-sources/${testDsA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenViewer}` }
    });
    assert.strictEqual(viewerDeleteDs.status, 403, 'Viewer deleting data source must return 403');

    // 3. ANALYST cannot delete a dataset -> 403 Forbidden
    const analystDeleteDs = await api(`/api/v1/datasets/${testDatasetA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAnalyst}` }
    });
    assert.strictEqual(analystDeleteDs.status, 403, 'Analyst deleting dataset must return 403');

    // 4. DATA_ENGINEER cannot modify user roles -> 403 Forbidden
    const deChangeRole = await api(`/api/v1/users/${userViewer._id}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDataEng}` },
      body: { role: 'admin' }
    });
    assert.strictEqual(deChangeRole.status, 403, 'Data Engineer modifying user role must return 403');

    // 5. Self-privilege escalation: User cannot modify their own role
    const selfEscalate = await api(`/api/v1/users/${userViewer._id}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenViewer}` },
      body: { role: 'admin' }
    });
    assert.strictEqual(selfEscalate.status, 403, 'User attempting self-role escalation must return 403');

    // 6. Cross-Tenant Isolation: User from Tenant A accessing Tenant B's resource
    const dsTenantB = await DataSource.create({
      organizationId: tenantB._id,
      name: 'Tenant B Confidential DS',
      type: 'postgresql',
      configuration: { host: 'localhost', port: 5432, database: 'secret_b' }
    });

    const crossTenantGet = await api(`/api/v1/data-sources/${dsTenantB._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(
      crossTenantGet.status,
      404,
      'Cross-tenant resource access must fail-closed with 404 Not Found'
    );
  });

  // =========================================================================
  // 37.7 CREDENTIAL SECURITY & LEAKAGE TESTING
  // =========================================================================

  test('37.7 Credential Security: Plaintext secrets, passwords, and encryption keys never leak in APIs or models', async () => {
    // 1. Fetching DataSource by ID through API
    const res = await api(`/api/v1/data-sources/${testDsA._id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });

    assert.strictEqual(res.status, 200);
    const bodyStr = JSON.stringify(res.body);

    // Plaintext password must NOT appear anywhere in the HTTP response
    assert.strictEqual(
      bodyStr.includes('RealSecretPassword987!'),
      false,
      'Plaintext password leaked in DataSource API response!'
    );

    // Raw encrypted data / iv / authTag internals must not be exposed to frontend
    assert.strictEqual(
      res.body.data.credentials?.password,
      undefined,
      'Password field must be undefined in response'
    );
    assert.strictEqual(
      res.body.data.credentials?.encryptedData,
      undefined,
      'encryptedData ciphertext must not be returned in API response'
    );

    // 2. Listing DataSources
    const listRes = await api('/api/v1/data-sources', {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const listBodyStr = JSON.stringify(listRes.body);
    assert.strictEqual(
      listBodyStr.includes('RealSecretPassword987!'),
      false,
      'Plaintext password leaked in DataSource list API!'
    );

    // 3. User API response must never return passwordHash
    const userRes = await api('/api/v1/users', {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    const userBodyStr = JSON.stringify(userRes.body);
    assert.strictEqual(
      userBodyStr.includes('passwordHash'),
      false,
      'User response leaked passwordHash!'
    );
    assert.strictEqual(
      userBodyStr.includes('SecPass123!'),
      false,
      'User response leaked plaintext password!'
    );
  });

  // =========================================================================
  // 37.8 REGEX / REDOS PROTECTION
  // =========================================================================

  test('37.8 Regex / ReDoS Protection: Pathological patterns and nested quantifiers rejected safely', () => {
    const pathologicalPatterns = [
      '(a+)+',
      '(a*)*',
      '(a+b+)+',
      '(a|a)+',
      '.*.*',
      '.+.+',
      '\\d+\\d+',
      '\\w+\\w+',
      'a'.repeat(250) // Length overflow
    ];

    for (const pat of pathologicalPatterns) {
      const res = validateSafeRegex(pat);
      assert.strictEqual(
        res.valid,
        false,
        `Expected pathological regex "${pat}" to be rejected by validateSafeRegex`
      );
      assert.ok(res.error, 'ReDoS validator must return structured error');
    }

    // Verify legitimate regex passes
    const safePattern = '^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$';
    const safeRes = validateSafeRegex(safePattern);
    assert.strictEqual(safeRes.valid, true, 'Safe email regex must pass validation');
  });

  // =========================================================================
  // 37.9 DOS & RESOURCE ABUSE
  // =========================================================================

  test('37.9 Resource Abuse & Bound Constraints: Extreme page sizes, oversized queries, payload limits', async () => {
    // 1. Extreme pagination request (limit > 100) -> 400 Bad Request
    const resPaging = await api('/api/v1/datasets?page=1&limit=500000', {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(resPaging.status, 400, 'Extreme page limit must return 400');
    assert.strictEqual(resPaging.body.success, false);

    // 2. Extreme search query length (> 100 characters) -> 400 Bad Request
    const resLongQuery = await api(`/api/v1/search?query=${'A'.repeat(150)}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(resLongQuery.status, 400, 'Search query > 100 characters must return 400');
    assert.strictEqual(resLongQuery.body.success, false);

    // 3. Oversized JSON body payload -> 413 Payload Too Large
    // Express JSON parser limit is typically 100kb - 10mb. Let's send a 12MB payload to test limit
    const hugeBody = JSON.stringify({
      name: 'Oversized DS',
      payload: 'X'.repeat(12 * 1024 * 1024) // 12MB
    });

    const resOversized = await fetch(`${baseUrl}/api/v1/data-sources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: hugeBody
    });

    assert.strictEqual(
      resOversized.status,
      413,
      `Oversized body payload must be rejected with 413 Payload Too Large. Received: ${resOversized.status}`
    );
  });
});
