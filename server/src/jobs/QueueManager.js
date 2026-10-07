import { Queue, Worker } from 'bullmq';
import crypto from 'crypto';
import { getRedisClient, isRedisAvailable } from '../config/redis.js';
import { Job, JOB_TYPES, JOB_STATUSES } from '../models/Job.js';
import { CatalogSyncService } from '../services/CatalogSyncService.js';
import { ProfilingService } from '../services/ProfilingService.js';
import { QualityEngine } from '../services/QualityEngine.js';
import { Dataset } from '../models/Dataset.js';
import { DataSource } from '../models/DataSource.js';
import { logger } from '../utils/logger.js';

// Active queues and workers registry
const queues = new Map();
const workers = new Map();
let isShuttingDown = false;

// In-memory fallback queue for environments where Redis is not deployed
const inMemoryQueues = new Map();
const inMemoryActiveWorkers = new Set();
const inMemoryIntervals = [];

const DEFAULT_QUEUE_CONFIG = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    timeout: 60000, // 60s max per job
    removeOnComplete: { count: 500, age: 3600 * 24 },
    removeOnFail: { count: 1000, age: 3600 * 24 * 7 }
  }
};

/**
 * Worker processor function that executes the actual business task.
 * Strictly re-verifies tenant ownership and uses existing Phase 4/5 services.
 */
async function processJobPayload(jobData) {
  const { jobId, jobType, organizationId, resourceId, actorId, correlationId } = jobData;

  const jobDoc = await Job.findOne({ jobId });
  if (!jobDoc) {
    throw new Error(`Job document ${jobId} not found in database`);
  }

  if (jobDoc.status === JOB_STATUSES.CANCELLED) {
    logger.info(`[Queue] Skipping cancelled job ${jobId}`);
    return { cancelled: true };
  }

  // Update status to RUNNING
  jobDoc.status = JOB_STATUSES.RUNNING;
  jobDoc.startedAt = new Date();
  jobDoc.attempts += 1;
  await jobDoc.save();

  const startHr = process.hrtime.bigint();

  try {
    let result = null;

    switch (jobType) {
      case JOB_TYPES.CATALOG_SYNC: {
        // Multi-tenant check: ensure dataSource belongs to organization
        const dataSource = await DataSource.findOne({
          _id: resourceId,
          organizationId,
          isDeleted: { $ne: true }
        });
        if (!dataSource) {
          const err = new Error('Data source not found or unauthorized for this tenant');
          err.code = 'UNAUTHORIZED_DATA_SOURCE';
          throw err;
        }
        result = await CatalogSyncService.synchronize(resourceId, organizationId, {
          actor: actorId ? { _id: actorId } : null
        });
        break;
      }

      case JOB_TYPES.DATA_PROFILING: {
        // Multi-tenant check: ensure dataset belongs to organization
        const dataset = await Dataset.findOne({
          _id: resourceId,
          organizationId,
          isDeleted: { $ne: true }
        });
        if (!dataset) {
          const err = new Error('Dataset not found or unauthorized for this tenant');
          err.code = 'UNAUTHORIZED_DATASET';
          throw err;
        }
        result = await ProfilingService.profileDataset(resourceId, organizationId, {
          actor: actorId ? { _id: actorId } : null
        });
        break;
      }

      case JOB_TYPES.QUALITY_SCAN: {
        // Multi-tenant check: ensure dataset belongs to organization
        const dataset = await Dataset.findOne({
          _id: resourceId,
          organizationId,
          isDeleted: { $ne: true }
        });
        if (!dataset) {
          const err = new Error('Dataset not found or unauthorized for this tenant');
          err.code = 'UNAUTHORIZED_DATASET';
          throw err;
        }
        result = await QualityEngine.runQualityCheck(resourceId, organizationId, actorId);
        break;
      }

      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const endHr = process.hrtime.bigint();
    const durationMs = Math.round(Number(endHr - startHr) / 1_000_000);

    jobDoc.status = JOB_STATUSES.SUCCESS;
    jobDoc.completedAt = new Date();
    jobDoc.duration = durationMs;
    jobDoc.safeErrorMessage = null;
    jobDoc.errorCode = null;
    await jobDoc.save();

    logger.info(`[Queue] Job ${jobId} (${jobType}) completed successfully in ${durationMs}ms`);
    return result;
  } catch (err) {
    const endHr = process.hrtime.bigint();
    const durationMs = Math.round(Number(endHr - startHr) / 1_000_000);

    jobDoc.status = JOB_STATUSES.FAILED;
    jobDoc.completedAt = new Date();
    jobDoc.duration = durationMs;
    jobDoc.errorCode = err.code || 'EXECUTION_FAILED';
    // Clean safe error message without secrets
    jobDoc.safeErrorMessage = String(err.message || 'Job execution failed').slice(0, 500);
    await jobDoc.save();

    logger.error(`[Queue] Job ${jobId} (${jobType}) failed: ${jobDoc.safeErrorMessage}`);
    throw err;
  }
}

/**
 * Initializes BullMQ Queues and Workers, or starts the in-memory fallback processor.
 */
export function initQueues() {
  if (isShuttingDown) return;

  const redis = getRedisClient();
  const redisReady = isRedisAvailable();

  for (const jobType of Object.values(JOB_TYPES)) {
    const queueName = `ricoz-${jobType}`;

    if (redisReady && redis) {
      if (!queues.has(queueName)) {
        try {
          const queue = new Queue(queueName, {
            connection: redis,
            ...DEFAULT_QUEUE_CONFIG
          });
          queues.set(queueName, queue);

          const worker = new Worker(
            queueName,
            async (job) => {
              return await processJobPayload(job.data);
            },
            {
              connection: redis,
              concurrency: 3,
              lockDuration: 30000
            }
          );

          worker.on('failed', (job, err) => {
            logger.warn(`[BullMQ] Worker job failed [${queueName}:${job?.id}]: ${err.message}`);
          });

          workers.set(queueName, worker);
          logger.info(`[BullMQ] Initialized queue and worker for: ${queueName}`);
        } catch (err) {
          logger.warn(`[BullMQ] Failed to bind queue ${queueName} to Redis: ${err.message}. Using fallback.`);
        }
      }
    } else {
      // In-memory queue fallback setup
      if (!inMemoryQueues.has(queueName)) {
        inMemoryQueues.set(queueName, []);
      }
    }
  }

  // If Redis is not connected, run bounded in-memory queue consumer loop
  if (!redisReady && inMemoryIntervals.length === 0) {
    const interval = setInterval(async () => {
      if (isShuttingDown) return;
      for (const [queueName, queueItems] of inMemoryQueues.entries()) {
        if (queueItems.length > 0 && inMemoryActiveWorkers.size < 3) {
          const nextJob = queueItems.shift();
          if (nextJob) {
            inMemoryActiveWorkers.add(nextJob.jobId);
            processJobPayload(nextJob)
              .catch((err) => {
                logger.warn(`[Queue:Fallback] Job ${nextJob.jobId} failed: ${err.message}`);
              })
              .finally(() => {
                inMemoryActiveWorkers.delete(nextJob.jobId);
              });
          }
        }
      }
    }, 100);

    inMemoryIntervals.push(interval);
  }
}

/**
 * Enqueues a job with multi-tenant validation and deduplication (Idempotency).
 */
export async function enqueueJob(params) {
  const { jobType, organizationId, resourceId, resourceType, actorId, correlationId, metadata } = params;

  if (!Object.values(JOB_TYPES).includes(jobType)) {
    const err = new Error(`Invalid job type: ${jobType}`);
    err.statusCode = 400;
    throw err;
  }

  if (!organizationId || !resourceId) {
    const err = new Error('organizationId and resourceId are mandatory for job dispatch');
    err.statusCode = 400;
    throw err;
  }

  // Idempotency check: Don't enqueue if an identical job is already QUEUED or RUNNING for this resource
  const existingJob = await Job.findOne({
    organizationId,
    jobType,
    resourceId,
    status: { $in: [JOB_STATUSES.QUEUED, JOB_STATUSES.RUNNING] }
  });

  if (existingJob) {
    logger.info(`[Queue] Deduplicating job: Active job ${existingJob.jobId} already exists for resource ${resourceId}`);
    return existingJob;
  }

  const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const queueName = `ricoz-${jobType}`;

  // Persist Job metadata to MongoDB
  const jobDoc = await Job.create({
    jobId,
    jobType,
    organizationId,
    resourceId,
    resourceType,
    status: JOB_STATUSES.QUEUED,
    correlationId: correlationId || `corr_${Date.now()}`,
    metadata: metadata || {},
    triggeredBy: actorId || null
  });

  const jobPayload = {
    jobId,
    jobType,
    organizationId,
    resourceId,
    actorId,
    correlationId: jobDoc.correlationId
  };

  // Dispatch to BullMQ if Redis is available, otherwise to in-memory queue
  if (isRedisAvailable() && queues.has(queueName)) {
    const bullQueue = queues.get(queueName);
    await bullQueue.add(jobType, jobPayload, { jobId });
  } else {
    initQueues(); // ensure fallback worker loop is active
    if (!inMemoryQueues.has(queueName)) {
      inMemoryQueues.set(queueName, []);
    }
    inMemoryQueues.get(queueName).push(jobPayload);
  }

  return jobDoc;
}

/**
 * Cancels a pending queued job.
 */
export async function cancelJob(jobId, organizationId) {
  const jobDoc = await Job.findOne({ jobId, organizationId });
  if (!jobDoc) {
    const err = new Error('Job not found or inaccessible');
    err.statusCode = 404;
    throw err;
  }

  if (jobDoc.status !== JOB_STATUSES.QUEUED) {
    const err = new Error(`Cannot cancel job in ${jobDoc.status} state`);
    err.statusCode = 400;
    throw err;
  }

  jobDoc.status = JOB_STATUSES.CANCELLED;
  jobDoc.completedAt = new Date();
  await jobDoc.save();

  // Remove from BullMQ if present
  const queueName = `ricoz-${jobDoc.jobType}`;
  if (queues.has(queueName)) {
    try {
      const bullQueue = queues.get(queueName);
      const bJob = await bullQueue.getJob(jobId);
      if (bJob) {
        await bJob.remove();
      }
    } catch (removeErr) {
      logger.warn(`[Queue] Failed to remove BullMQ job ${jobId}: ${removeErr.message}`);
    }
  }

  // Remove from in-memory fallback queue if present
  if (inMemoryQueues.has(queueName)) {
    const qList = inMemoryQueues.get(queueName);
    const idx = qList.findIndex((item) => item.jobId === jobId);
    if (idx !== -1) {
      qList.splice(idx, 1);
    }
  }

  return jobDoc;
}

/**
 * Returns current depth and counts of active queues.
 */
export async function getQueueMetrics() {
  const metrics = {};

  for (const jobType of Object.values(JOB_TYPES)) {
    const queueName = `ricoz-${jobType}`;
    if (isRedisAvailable() && queues.has(queueName)) {
      const q = queues.get(queueName);
      const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      metrics[jobType] = counts;
    } else {
      const inMemoryCount = inMemoryQueues.get(queueName)?.length || 0;
      metrics[jobType] = {
        waiting: inMemoryCount,
        active: inMemoryActiveWorkers.size,
        completed: 0,
        failed: 0,
        delayed: 0
      };
    }
  }

  return metrics;
}

/**
 * Graceful termination of all workers and queues.
 */
export async function closeQueuesAndWorkers() {
  isShuttingDown = true;
  logger.info('[Queue] Closing background workers and queues gracefully...');

  // Clear in-memory timers
  for (const int of inMemoryIntervals) {
    clearInterval(int);
  }
  inMemoryIntervals.length = 0;

  // Close BullMQ workers
  for (const [name, worker] of workers.entries()) {
    try {
      await worker.close();
      logger.info(`[BullMQ] Closed worker: ${name}`);
    } catch (err) {
      logger.warn(`[BullMQ] Error closing worker ${name}: ${err.message}`);
    }
  }
  workers.clear();

  // Close BullMQ queues
  for (const [name, queue] of queues.entries()) {
    try {
      await queue.close();
      logger.info(`[BullMQ] Closed queue: ${name}`);
    } catch (err) {
      logger.warn(`[BullMQ] Error closing queue ${name}: ${err.message}`);
    }
  }
  queues.clear();
}

export default {
  initQueues,
  enqueueJob,
  cancelJob,
  getQueueMetrics,
  closeQueuesAndWorkers,
  processJobPayload
};
