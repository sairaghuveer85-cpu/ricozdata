import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Dataset } from '../src/models/Dataset.js';
import { DataSource } from '../src/models/DataSource.js';
import { CacheService, CACHE_TTLS } from '../src/services/CacheService.js';
import * as dashboardController from '../src/controllers/dashboard.controller.js';

test('Step 34 — Caching & Performance Verification', async (t) => {
  await connectDB();
  CacheService.resetStats();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userAId = new mongoose.Types.ObjectId();

  await Organization.create([
    { _id: orgAId, name: 'Cache Org A', slug: 'cache-org-a-' + Date.now() },
    { _id: orgBId, name: 'Cache Org B', slug: 'cache-org-b-' + Date.now() }
  ]);

  await User.create({
    _id: userAId,
    organizationId: orgAId,
    name: 'Cache User',
    email: 'cache.user@alpha.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const dsA = await DataSource.create({
    organizationId: orgAId,
    name: 'Cache DataSource',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'analytics' },
    status: 'ACTIVE',
    createdBy: userAId
  });

  const datasetA = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: dsA._id,
    name: 'customers_cache_test',
    status: 'ACTIVE'
  });

  await t.test('34.1 Cache Set, Get & TTL: Stores and retrieves tenant data with TTL enforcement', async () => {
    const key = CacheService.buildKey(orgAId, 'test', 'sample_1');
    await CacheService.set(key, { message: 'hello_world', count: 42 }, 1); // 1s TTL

    const cached = await CacheService.get(key);
    assert.deepStrictEqual(cached, { message: 'hello_world', count: 42 });

    // Wait 1.1s for expiration
    await new Promise(r => setTimeout(r, 1100));
    const expired = await CacheService.get(key);
    assert.strictEqual(expired, null);
  });

  await t.test('34.2 Strict Tenant Isolation: Tenant A cannot read Tenant B cache keys even with identical IDs', async () => {
    const commonId = 'resource_123';
    const keyA = CacheService.buildKey(orgAId, 'resource', commonId);
    const keyB = CacheService.buildKey(orgBId, 'resource', commonId);

    assert.notStrictEqual(keyA, keyB);
    assert.ok(keyA.startsWith(`tenant:${orgAId}`));
    assert.ok(keyB.startsWith(`tenant:${orgBId}`));

    await CacheService.set(keyA, { secret: 'org_a_confidential' }, 60);

    // Tenant B queries their own key with the same resource id
    const valB = await CacheService.get(keyB);
    assert.strictEqual(valB, null);

    // Tenant A gets their own data
    const valA = await CacheService.get(keyA);
    assert.strictEqual(valA.secret, 'org_a_confidential');
  });

  await t.test('34.3 Cache Stampede Protection: Coalescing collapses 10 concurrent requests to single database fetch', async () => {
    let databaseFetchCount = 0;
    const stampedeKey = CacheService.buildKey(orgAId, 'expensive_computation', 'metrics');

    const expensiveDatabaseFetch = async () => {
      databaseFetchCount++;
      await new Promise(r => setTimeout(r, 50)); // simulate 50ms database calculation
      return { totalRevenue: 1_000_000, computedAt: Date.now() };
    };

    // Fire 10 concurrent requests at the exact same moment
    const promises = Array.from({ length: 10 }, () =>
      CacheService.coalesce(stampedeKey, expensiveDatabaseFetch, 30)
    );

    const results = await Promise.all(promises);

    // All 10 callers receive identical valid result
    assert.strictEqual(results.length, 10);
    assert.strictEqual(results[0].totalRevenue, 1_000_000);
    for (const res of results) {
      assert.strictEqual(res.totalRevenue, 1_000_000);
    }

    // Crucial: The underlying database fetch executed ONLY once!
    assert.strictEqual(databaseFetchCount, 1);
  });

  await t.test('34.4 Invalidation: Mutations wipe relevant cache namespace cleanly', async () => {
    const dsKey = CacheService.datasetKey(orgAId, datasetA._id);
    await CacheService.set(dsKey, { name: 'customers_cache_test' }, 60);

    const before = await CacheService.get(dsKey);
    assert.ok(before);

    // Invalidate dataset
    await CacheService.invalidateDataset(orgAId, datasetA._id);

    const after = await CacheService.get(dsKey);
    assert.strictEqual(after, null);
  });

  await t.test('34.5 Integrated Dashboard Caching: Speeds up repeated dashboard queries', async () => {
    let resData;
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // First request: Cache miss -> queries DB and populates cache
    await dashboardController.getDashboardSummary(
      { organizationId: orgAId },
      mockRes
    );
    assert.ok(resData.success);
    assert.strictEqual(resData.data.totalDatasets, 1);

    const statsAfterMiss = CacheService.getStats();
    assert.ok(statsAfterMiss.misses >= 1);

    // Second request: Cache hit -> served from cache
    await dashboardController.getDashboardSummary(
      { organizationId: orgAId },
      mockRes
    );
    assert.ok(resData.success);

    const statsAfterHit = CacheService.getStats();
    assert.ok(statsAfterHit.hits >= 1);
  });

  // Cleanup
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ _id: userAId });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
  CacheService.resetStats();

  await disconnectDB();
});
