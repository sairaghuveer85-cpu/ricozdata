import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import '../src/connectors/index.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import { Job, JOB_TYPES, JOB_STATUSES } from '../src/models/Job.js';
import {
  enqueueJob,
  cancelJob,
  getQueueMetrics,
  closeQueuesAndWorkers
} from '../src/jobs/QueueManager.js';
import { ScheduleManager, SCHEDULE_CADENCES } from '../src/jobs/ScheduleManager.js';
import * as jobController from '../src/controllers/job.controller.js';

test('Step 33 — Background Jobs & Scheduling Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  await Organization.create([
    { _id: orgAId, name: 'Job Org A', slug: 'job-org-a-' + Date.now() },
    { _id: orgBId, name: 'Job Org B', slug: 'job-org-b-' + Date.now() }
  ]);

  await User.create([
    {
      _id: userAId,
      organizationId: orgAId,
      name: 'Job Admin',
      email: 'admin.job@alpha.com',
      role: 'admin',
      passwordHash: 'dummy_hash'
    },
    {
      _id: userBId,
      organizationId: orgBId,
      name: 'Rogue User B',
      email: 'rogue.job@beta.com',
      role: 'viewer',
      passwordHash: 'dummy_hash'
    }
  ]);

  const dsA = new DataSource({
    organizationId: orgAId,
    name: 'Job Test PostgreSQL',
    type: 'postgresql',
    configuration: { host: 'localhost', port: 5432, database: 'ricoz_test', schema: 'public' },
    status: 'ACTIVE',
    createdBy: userAId
  });
  dsA.setCredentials({ username: 'postgres', password: '1818' });
  await dsA.save();

  const datasetA = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: dsA._id,
    name: 'customers',
    schemaName: 'public',
    columns: [
      { name: 'customer_id', dataType: 'integer' },
      { name: 'email', dataType: 'character varying' }
    ],
    status: 'ACTIVE'
  });

  let createdJob = null;

  await t.test('33.1 Queue Creation & Job Enqueue: Enqueues data_profiling job with tenant context and zero credentials', async () => {
    createdJob = await enqueueJob({
      jobType: JOB_TYPES.DATA_PROFILING,
      organizationId: orgAId,
      resourceId: datasetA._id,
      resourceType: 'dataset',
      actorId: userAId,
      correlationId: 'req-corr-job-123'
    });

    assert.ok(createdJob._id);
    assert.ok(createdJob.jobId.startsWith('job_'));
    assert.strictEqual(createdJob.organizationId.toString(), orgAId.toString());
    assert.strictEqual(createdJob.resourceId.toString(), datasetA._id.toString());
    assert.strictEqual(createdJob.jobType, 'data_profiling');
    assert.strictEqual(createdJob.correlationId, 'req-corr-job-123');

    // Security verify: metadata and payload contain NO passwords or secrets
    const jobDoc = await Job.findById(createdJob._id).lean();
    assert.strictEqual(JSON.stringify(jobDoc).includes('password'), false);
    assert.strictEqual(JSON.stringify(jobDoc).includes('1818'), false);
  });

  await t.test('33.2 Idempotency: Prevents duplicate enqueuing for identical active resource and jobType', async () => {
    // Attempt to enqueue the exact same active job
    const duplicateJob = await enqueueJob({
      jobType: JOB_TYPES.DATA_PROFILING,
      organizationId: orgAId,
      resourceId: datasetA._id,
      resourceType: 'dataset',
      actorId: userAId
    });

    // Should return existing job document, NOT create a second job
    assert.strictEqual(duplicateJob.jobId, createdJob.jobId);
    const count = await Job.countDocuments({
      organizationId: orgAId,
      resourceId: datasetA._id,
      jobType: JOB_TYPES.DATA_PROFILING
    });
    assert.strictEqual(count, 1);
  });

  await t.test('33.3 Worker Execution: Processes job and transitions status to SUCCESS with recorded duration', async () => {
    // Wait for in-memory / BullMQ worker to pick up and process job
    let finishedJob = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      finishedJob = await Job.findOne({ jobId: createdJob.jobId }).lean();
      if (finishedJob && (finishedJob.status === JOB_STATUSES.SUCCESS || finishedJob.status === JOB_STATUSES.FAILED)) {
        break;
      }
    }

    assert.ok(finishedJob);
    assert.strictEqual(finishedJob.status, JOB_STATUSES.SUCCESS);
    assert.ok(finishedJob.startedAt);
    assert.ok(finishedJob.completedAt);
    assert.ok(finishedJob.duration >= 0);
    assert.strictEqual(finishedJob.attempts, 1);
  });

  await t.test('33.4 Multi-Tenant Safety & Authorization: Re-verifies tenant ownership before execution', async () => {
    // Rogue tenant B enqueues a job targeting Org A's dataset
    const rogueJob = await enqueueJob({
      jobType: JOB_TYPES.DATA_PROFILING,
      organizationId: orgBId, // Tenant B
      resourceId: datasetA._id, // Belongs to Tenant A!
      resourceType: 'dataset',
      actorId: userBId
    });

    // Wait for worker execution
    let processedRogueJob = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      processedRogueJob = await Job.findOne({ jobId: rogueJob.jobId }).lean();
      if (processedRogueJob && processedRogueJob.status !== JOB_STATUSES.QUEUED && processedRogueJob.status !== JOB_STATUSES.RUNNING) {
        break;
      }
    }

    assert.ok(processedRogueJob);
    assert.strictEqual(processedRogueJob.status, JOB_STATUSES.FAILED);
    assert.strictEqual(processedRogueJob.errorCode, 'UNAUTHORIZED_DATASET');
  });

  await t.test('33.5 Job Cancellation: Cancels a queued job safely', async () => {
    // Create another dummy dataset for cancellation testing
    const datasetCancel = await Dataset.create({
      organizationId: orgAId,
      dataSourceId: dsA._id,
      name: 'cancel_test',
      status: 'ACTIVE'
    });

    // Manually create a queued job
    const queuedJob = await Job.create({
      jobId: 'job_cancel_' + Date.now(),
      jobType: JOB_TYPES.QUALITY_SCAN,
      organizationId: orgAId,
      resourceId: datasetCancel._id,
      resourceType: 'dataset',
      status: JOB_STATUSES.QUEUED
    });

    const cancelledDoc = await cancelJob(queuedJob.jobId, orgAId);
    assert.strictEqual(cancelledDoc.status, JOB_STATUSES.CANCELLED);

    const reloaded = await Job.findOne({ jobId: queuedJob.jobId });
    assert.strictEqual(reloaded.status, JOB_STATUSES.CANCELLED);
  });

  await t.test('33.6 Scheduling: Registers and lists recurring schedules per tenant without runaway loops', async () => {
    const regResult = ScheduleManager.registerSchedule({
      organizationId: orgAId,
      jobType: JOB_TYPES.CATALOG_SYNC,
      resourceId: dsA._id,
      resourceType: 'data_source',
      cadence: SCHEDULE_CADENCES.DAILY,
      actorId: userAId
    });

    assert.strictEqual(regResult.success, true);
    assert.strictEqual(regResult.cadence, 'daily');

    const schedulesA = ScheduleManager.listSchedules(orgAId);
    assert.strictEqual(schedulesA.length, 1);
    assert.strictEqual(schedulesA[0].jobType, 'catalog_sync');

    // Tenant B cannot see Tenant A schedules
    const schedulesB = ScheduleManager.listSchedules(orgBId);
    assert.strictEqual(schedulesB.length, 0);

    // Cancel schedule
    const cancelled = ScheduleManager.cancelSchedule(orgAId, JOB_TYPES.CATALOG_SYNC, dsA._id);
    assert.strictEqual(cancelled, true);
    assert.strictEqual(ScheduleManager.listSchedules(orgAId).length, 0);
  });

  await t.test('33.7 Job Query API: Multi-tenant filtering, pagination, and status checks', async () => {
    let resData;
    let resStatus;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // Query jobs for Org A
    await jobController.getJobs(
      {
        organizationId: orgAId,
        query: { page: 1, limit: 10 }
      },
      mockRes
    );

    assert.strictEqual(resStatus, 200);
    assert.ok(resData.data.length >= 1);
    assert.ok(resData.data.every(j => j.organizationId.toString() === orgAId.toString()));

    // Query queue metrics
    await jobController.getQueueStatus(
      {
        organizationId: orgAId
      },
      mockRes
    );

    assert.strictEqual(resStatus, 200);
    assert.ok(resData.data.catalog_sync);
    assert.ok(resData.data.data_profiling);
  });

  await t.test('33.8 Graceful Shutdown: Shuts down workers and cleans active queues', async () => {
    await closeQueuesAndWorkers();
    ScheduleManager.clearAll();
    const metrics = await getQueueMetrics();
    assert.ok(metrics);
  });

  // Cleanup
  await Job.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
