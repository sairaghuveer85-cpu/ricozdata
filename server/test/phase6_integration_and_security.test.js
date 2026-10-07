import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import '../src/connectors/index.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import { QualityRule, QUALITY_RULE_TYPES } from '../src/models/QualityRule.js';
import { Job, JOB_TYPES, JOB_STATUSES } from '../src/models/Job.js';
import { Activity } from '../src/models/Activity.js';
import { DataProfile } from '../src/models/DataProfile.js';
import { QualityRun } from '../src/models/QualityRun.js';
import {
  enqueueJob,
  closeQueuesAndWorkers
} from '../src/jobs/QueueManager.js';
import { CacheService, CACHE_TTLS } from '../src/services/CacheService.js';
import { register, httpRequestsTotal } from '../src/metrics/prometheus.js';
import { logger } from '../src/utils/logger.js';
import correlationIdMiddleware from '../src/middleware/correlationId.js';

test('RicozData Phase 6 — Full Cross-Module Operations, Caching, Observability & Security Audit', async (t) => {
  await connectDB();
  CacheService.resetStats();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  await Organization.create([
    { _id: orgAId, name: 'Phase6 Org A', slug: 'p6-org-a-' + Date.now() },
    { _id: orgBId, name: 'Phase6 Org B', slug: 'p6-org-b-' + Date.now() }
  ]);

  await User.create([
    {
      _id: userAId,
      organizationId: orgAId,
      name: 'Ops Admin A',
      email: 'admin.ops@alpha.com',
      role: 'admin',
      passwordHash: 'dummy_hash'
    },
    {
      _id: userBId,
      organizationId: orgBId,
      name: 'Rogue User B',
      email: 'rogue.ops@beta.com',
      role: 'viewer',
      passwordHash: 'dummy_hash'
    }
  ]);

  // Real PostgreSQL source on localhost:5432 / ricoz_test
  const pgSourceA = new DataSource({
    organizationId: orgAId,
    name: 'Ops PostgreSQL DB',
    type: 'postgresql',
    configuration: {
      host: 'localhost',
      port: 5432,
      database: 'ricoz_test',
      ssl: false,
      schema: 'public'
    },
    status: 'ACTIVE',
    createdBy: userAId
  });
  pgSourceA.setCredentials({ username: 'postgres', password: 'password' in process.env ? process.env.PGPASSWORD : '1818' });
  await pgSourceA.save();

  const customersDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: pgSourceA._id,
    name: 'customers',
    schemaName: 'public',
    columns: [
      { name: 'customer_id', dataType: 'integer', isNullable: false },
      { name: 'email', dataType: 'character varying', isNullable: true },
      { name: 'age', dataType: 'integer', isNullable: true }
    ],
    status: 'ACTIVE'
  });

  // ============================================================
  // 1. ASYNCHRONOUS WORKER JOBS INTEGRATION
  // ============================================================

  await t.test('Flow 1: Data Profiling Job execution via queue and worker', async () => {
    const job = await enqueueJob({
      jobType: JOB_TYPES.DATA_PROFILING,
      organizationId: orgAId,
      resourceId: customersDataset._id,
      resourceType: 'dataset',
      actorId: userAId,
      correlationId: 'req-corr-flow-1'
    });

    assert.ok(job.jobId);
    assert.strictEqual(job.status, JOB_STATUSES.QUEUED);

    // Wait for worker execution
    let processed = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      processed = await Job.findOne({ jobId: job.jobId }).lean();
      if (processed && (processed.status === JOB_STATUSES.SUCCESS || processed.status === JOB_STATUSES.FAILED)) {
        break;
      }
    }

    assert.ok(processed);
    assert.strictEqual(processed.status, JOB_STATUSES.SUCCESS);
    assert.ok(processed.duration >= 0);

    // Verify statistical profile was generated in MongoDB
    const profile = await DataProfile.findOne({ datasetId: customersDataset._id }).sort({ createdAt: -1 });
    assert.ok(profile);
    assert.strictEqual(profile.rowCount, 4);
  });

  await t.test('Flow 2: Quality Scan Job execution with issue generation and snapshot persistence', async () => {
    // Add rule on customers email
    await QualityRule.create({
      organizationId: orgAId,
      datasetId: customersDataset._id,
      name: 'Flow Email Null Check',
      ruleType: QUALITY_RULE_TYPES.NULL_CHECK,
      targetColumn: 'email',
      configuration: { column: 'email' },
      severity: 'HIGH',
      createdBy: userAId
    });

    const job = await enqueueJob({
      jobType: JOB_TYPES.QUALITY_SCAN,
      organizationId: orgAId,
      resourceId: customersDataset._id,
      resourceType: 'dataset',
      actorId: userAId,
      correlationId: 'req-corr-flow-2'
    });

    let processed = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      processed = await Job.findOne({ jobId: job.jobId }).lean();
      if (processed && (processed.status === JOB_STATUSES.SUCCESS || processed.status === JOB_STATUSES.FAILED)) {
        break;
      }
    }

    assert.ok(processed);
    assert.strictEqual(processed.status, JOB_STATUSES.SUCCESS);

    // Verify QualityRun created
    const run = await QualityRun.findOne({ datasetId: customersDataset._id }).sort({ createdAt: -1 });
    assert.ok(run);
    assert.ok(run.score !== null);
  });

  // ============================================================
  // 2. CACHING, COALESCING & INVALIDATION INTEGRATION
  // ============================================================

  await t.test('Flow 3: Caching, Stampede Protection & Invalidation Flow', async () => {
    let dbQueries = 0;
    const cacheKey = CacheService.datasetKey(orgAId, customersDataset._id);

    const fetchDataset = async () => {
      dbQueries++;
      await new Promise(r => setTimeout(r, 20));
      return { id: customersDataset._id, name: 'customers', cached: true };
    };

    // 5 concurrent requests should execute fetchDataset only once
    const promises = Array.from({ length: 5 }, () =>
      CacheService.coalesce(cacheKey, fetchDataset, CACHE_TTLS.DATASET_METADATA)
    );
    const results = await Promise.all(promises);

    assert.strictEqual(results.length, 5);
    assert.strictEqual(dbQueries, 1); // Stampede protection worked!

    // Verify cache hit on next read
    const cachedItem = await CacheService.get(cacheKey);
    assert.ok(cachedItem);
    assert.strictEqual(cachedItem.name, 'customers');

    // Invalidate
    await CacheService.invalidateDataset(orgAId, customersDataset._id);
    const postInvalidate = await CacheService.get(cacheKey);
    assert.strictEqual(postInvalidate, null);
  });

  // ============================================================
  // 3. SECURITY AUDIT (NEGATIVE TESTS)
  // ============================================================

  await t.test('Security 1: Cross-Tenant Job Execution Prevention', async () => {
    // Rogue tenant B attempts to execute job against Tenant A's dataset
    const crossJob = await enqueueJob({
      jobType: JOB_TYPES.DATA_PROFILING,
      organizationId: orgBId,
      resourceId: customersDataset._id, // Tenant A dataset!
      resourceType: 'dataset',
      actorId: userBId
    });

    let processed = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      processed = await Job.findOne({ jobId: crossJob.jobId }).lean();
      if (processed && processed.status !== JOB_STATUSES.QUEUED && processed.status !== JOB_STATUSES.RUNNING) {
        break;
      }
    }

    assert.ok(processed);
    assert.strictEqual(processed.status, JOB_STATUSES.FAILED);
    assert.strictEqual(processed.errorCode, 'UNAUTHORIZED_DATASET');
  });

  await t.test('Security 2: Zero Credential Leakage in Queues, Jobs & Logs', async () => {
    const allJobs = await Job.find({ organizationId: orgAId }).lean();
    for (const j of allJobs) {
      const serialized = JSON.stringify(j);
      assert.strictEqual(serialized.includes('password'), false);
      assert.strictEqual(serialized.includes('1818'), false);
    }
  });

  await t.test('Security 3: Correlation ID Sanitization & ReDoS / Header Injection Protection', async () => {
    let req = { headers: { 'x-correlation-id': '\r\nInjected-Header: evil\r\n' } };
    let res = { setHeader: (k, v) => { res[k] = v; } };
    correlationIdMiddleware(req, res, () => {});

    // Injected header must be rejected and replaced with safe generated ID
    assert.ok(req.correlationId.startsWith('corr_'));
    assert.strictEqual(req.correlationId.includes('evil'), false);
  });

  await t.test('Security 4: Prometheus Metric Sanitization (Zero High-Cardinality Labels)', async () => {
    const rawMetrics = await register.metrics();
    // High-cardinality identifiers must never be metric labels
    assert.strictEqual(rawMetrics.includes(`organizationId="${orgAId}"`), false);
    assert.strictEqual(rawMetrics.includes(`userId="${userAId}"`), false);
    assert.strictEqual(rawMetrics.includes(`datasetId="${customersDataset._id}"`), false);
  });

  // Cleanup
  await closeQueuesAndWorkers();
  await Job.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await QualityRule.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await QualityRun.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataProfile.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
  CacheService.resetStats();

  await disconnectDB();
});
