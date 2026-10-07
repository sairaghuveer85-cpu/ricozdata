import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization, ORGANIZATION_STATUS } from '../src/models/Organization.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import {
  tenantFind,
  tenantFindOne,
  tenantFindById,
  tenantUpdateOne,
  tenantDeleteOne,
  withTenant
} from '../src/middleware/tenantIsolation.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';

describe('Step 06 — Organization / Multi-Tenant System Verification', () => {
  let server;
  let baseUrl;
  let orgAlpha;
  let orgBeta;
  let orgSuspended;
  let orgPending;
  let dsAlpha;
  let dsBeta;
  let datasetAlpha;
  let datasetBeta;

  before(async () => {
    // 1. Connect to live MongoDB
    await connectDB();

    // 2. Clear any lingering test organizations from previous runs
    const testSlugs = ['test-alpha-corp', 'test-beta-corp', 'test-suspended-org', 'test-pending-org', 'test-duplicate-slug'];
    await Organization.deleteMany({ slug: { $in: testSlugs } });

    // 3. Seed test organizations with various lifecycle statuses
    orgAlpha = await Organization.create({
      name: 'Alpha Corp Test',
      slug: 'test-alpha-corp',
      status: ORGANIZATION_STATUS.ACTIVE,
      settings: { tier: 'growth', dataRetentionDays: 30 }
    });

    orgBeta = await Organization.create({
      name: 'Beta Corp Test',
      slug: 'test-beta-corp',
      status: ORGANIZATION_STATUS.ACTIVE,
      settings: { tier: 'enterprise', dataRetentionDays: 60 }
    });

    orgSuspended = await Organization.create({
      name: 'Suspended Org Test',
      slug: 'test-suspended-org',
      status: ORGANIZATION_STATUS.SUSPENDED
    });

    orgPending = await Organization.create({
      name: 'Pending Org Test',
      slug: 'test-pending-org',
      status: ORGANIZATION_STATUS.PENDING
    });

    // 4. Seed tenant-owned DataSources and Datasets for isolation testing
    dsAlpha = await DataSource.create({
      organizationId: orgAlpha._id,
      name: 'Alpha PostgreSQL Warehouse',
      type: 'postgresql',
      status: 'connected'
    });

    dsBeta = await DataSource.create({
      organizationId: orgBeta._id,
      name: 'Beta Snowflake Warehouse',
      type: 'snowflake',
      status: 'connected'
    });

    datasetAlpha = await Dataset.create({
      organizationId: orgAlpha._id,
      dataSourceId: dsAlpha._id,
      name: 'alpha_orders',
      type: 'table',
      classification: 'internal'
    });

    datasetBeta = await Dataset.create({
      organizationId: orgBeta._id,
      dataSourceId: dsBeta._id,
      name: 'beta_customer_pii',
      type: 'table',
      classification: 'restricted'
    });

    // 5. Start HTTP test server on ephemeral port (0)
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Clean up test data
    if (orgAlpha && orgBeta) {
      await Dataset.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
      await DataSource.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
      await Organization.deleteMany({
        _id: { $in: [orgAlpha._id, orgBeta._id, orgSuspended._id, orgPending._id] }
      });
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await disconnectDB();
  });

  // ============================================================================
  // 1 & 2. Organization Schema & Slug Validation
  // ============================================================================
  test('1. Organization schema validates ACTIVE, SUSPENDED, and PENDING statuses', () => {
    assert.strictEqual(orgAlpha.status, 'active');
    assert.strictEqual(orgSuspended.status, 'suspended');
    assert.strictEqual(orgPending.status, 'pending');
  });

  test('2. Unique slug constraint prevents duplicate organizations in MongoDB', async () => {
    let caughtError = null;
    try {
      await Organization.create({
        name: 'Alpha Imposter',
        slug: 'test-alpha-corp', // Collides with orgAlpha
        status: 'active'
      });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Must reject duplicate slug creation');
    assert.strictEqual(caughtError.code, 11000, 'Must throw duplicate key error (code 11000)');
  });

  // ============================================================================
  // 3 & 4. Subdomain-based Tenant Resolution
  // ============================================================================
  test('3 & 4. Valid subdomain resolves tenant on GET /api/organizations/me', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: {
        'x-forwarded-host': 'test-alpha-corp.localhost',
        Host: 'test-alpha-corp.localhost'
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.slug, 'test-alpha-corp');
    assert.strictEqual(body.data.name, 'Alpha Corp Test');
    assert.strictEqual(body.data._id, orgAlpha._id.toString());
  });

  test('5. Unknown subdomain rejects request with 404 TENANT_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: {
        'x-forwarded-host': 'nonexistent-tenant-slug.localhost',
        Host: 'nonexistent-tenant-slug.localhost'
      }
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TENANT_NOT_FOUND');
  });

  // ============================================================================
  // 6 & 7. Tenant Status Access Policies (Suspended / Pending)
  // ============================================================================
  test('6. Suspended tenant access is strictly rejected with 403 TENANT_SUSPENDED', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: {
        'x-forwarded-host': 'test-suspended-org.localhost',
        Host: 'test-suspended-org.localhost'
      }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TENANT_SUSPENDED');
    assert.ok(body.error.message.includes('suspended'));
  });

  test('7. Pending tenant access is rejected with 403 TENANT_PENDING', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: {
        'x-forwarded-host': 'test-pending-org.localhost',
        Host: 'test-pending-org.localhost'
      }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TENANT_PENDING');
  });

  // ============================================================================
  // 8 & 9. Trusted Header Routing vs Untrusted Client Impersonation
  // ============================================================================
  test('8. Trusted internal header with valid gateway secret resolves tenant', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: {
        [TENANT_HEADERS.SLUG]: 'test-beta-corp',
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.slug, 'test-beta-corp');
    assert.strictEqual(body.data._id, orgBeta._id.toString());
  });

  test('9. Untrusted client header WITHOUT gateway secret cannot impersonate tenant', async () => {
    // Attempting to inject X-Tenant-Slug without internal secret
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: {
        [TENANT_HEADERS.SLUG]: 'test-beta-corp'
        // Missing or invalid X-Internal-Secret
      }
    });

    // Because host has no subdomain and header is untrusted, no tenant context is established
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TENANT_CONTEXT_REQUIRED');
  });

  // ============================================================================
  // 10. Conflict Detection Across Resolution Sources
  // ============================================================================
  test('10. Conflicting tenant sources (subdomain vs header) are rejected with 403', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: {
        'x-forwarded-host': 'test-alpha-corp.localhost', // Resolves Org Alpha
        Host: 'test-alpha-corp.localhost',
        [TENANT_HEADERS.SLUG]: 'test-beta-corp', // Resolves Org Beta
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TENANT_CONTEXT_CONFLICT');
  });

  // ============================================================================
  // 11 & 12. Payload Isolation & Mass Assignment Protection
  // ============================================================================
  test('11. Client payload organizationId cannot override or switch tenant context', async () => {
    // Caller requests as Alpha, but injects Beta's organizationId in body
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      method: 'PATCH',
      headers: {
        'x-forwarded-host': 'test-alpha-corp.localhost',
        Host: 'test-alpha-corp.localhost',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId: orgBeta._id.toString(), // Attacker tries cross-tenant override
        name: 'Hacked Organization Name'
      })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TENANT_PAYLOAD_MISMATCH');
  });

  test('12. Valid tenant update modifies settings safely and returns updated doc', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      method: 'PATCH',
      headers: {
        'x-forwarded-host': 'test-alpha-corp.localhost',
        Host: 'test-alpha-corp.localhost',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Alpha Corp Renamed',
        settings: {
          dataRetentionDays: 45,
          features: { advancedGovernance: true }
        }
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.name, 'Alpha Corp Renamed');
    assert.strictEqual(body.data.settings.dataRetentionDays, 45);
    assert.strictEqual(body.data.settings.features.advancedGovernance, true);

    // Verify slug and _id were not modified
    assert.strictEqual(body.data.slug, 'test-alpha-corp');
    assert.strictEqual(body.data._id, orgAlpha._id.toString());
  });

  // ============================================================================
  // 13, 14, 15. Real Database Multi-Tenant Query & CRUD Isolation
  // ============================================================================
  test('13. Tenant-scoped read isolation: Tenant A cannot read Tenant B datasets', async () => {
    // Construct fake requests representing Org Alpha and Org Beta
    const reqAlpha = { organizationId: orgAlpha._id.toString() };
    const reqBeta = { organizationId: orgBeta._id.toString() };

    const alphaDatasets = await tenantFind(Dataset, reqAlpha);
    const betaDatasets = await tenantFind(Dataset, reqBeta);

    assert.strictEqual(alphaDatasets.length, 1);
    assert.strictEqual(alphaDatasets[0].name, 'alpha_orders');
    assert.strictEqual(alphaDatasets[0].organizationId.toString(), orgAlpha._id.toString());

    assert.strictEqual(betaDatasets.length, 1);
    assert.strictEqual(betaDatasets[0].name, 'beta_customer_pii');
    assert.strictEqual(betaDatasets[0].organizationId.toString(), orgBeta._id.toString());
  });

  test('14. Tenant-scoped update isolation: Tenant A cannot update Tenant B data', async () => {
    const reqAlpha = { organizationId: orgAlpha._id.toString() };

    // Tenant Alpha attempts to update Dataset B by specifying its _id
    const updateResult = await tenantUpdateOne(
      Dataset,
      reqAlpha,
      { _id: datasetBeta._id },
      { $set: { description: 'Tampered by Alpha' } }
    );

    // 0 documents matched because organizationId constraint didn't match Dataset B
    assert.strictEqual(updateResult.matchedCount, 0);
    assert.strictEqual(updateResult.modifiedCount, 0);

    // Verify Dataset B in database is untouched
    const freshDatasetBeta = await Dataset.findById(datasetBeta._id);
    assert.notStrictEqual(freshDatasetBeta.description, 'Tampered by Alpha');
  });

  test('15. Tenant-scoped delete isolation: Tenant A cannot delete Tenant B data', async () => {
    const reqAlpha = { organizationId: orgAlpha._id.toString() };

    // Tenant Alpha attempts to delete Dataset B
    const deleteResult = await tenantDeleteOne(Dataset, reqAlpha, { _id: datasetBeta._id });

    // 0 documents deleted
    assert.strictEqual(deleteResult.deletedCount, 0);

    // Verify Dataset B still exists in database
    const freshDatasetBeta = await Dataset.findById(datasetBeta._id);
    assert.ok(freshDatasetBeta, 'Dataset B must remain intact');
  });

  test('16. ID Tampering Defense: Looking up Tenant B resource with Tenant A context returns null', async () => {
    const reqAlpha = { organizationId: orgAlpha._id.toString() };

    // Attacker guesses or enumerates Dataset B's ObjectId
    const foreignLookup = await tenantFindById(Dataset, reqAlpha, datasetBeta._id);

    // Must return null, completely hiding existence of the resource
    assert.strictEqual(foreignLookup, null, 'Foreign resource lookup must return null');
  });
});
