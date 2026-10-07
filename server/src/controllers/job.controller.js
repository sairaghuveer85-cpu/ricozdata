import mongoose from 'mongoose';
import { Job, JOB_TYPES, JOB_STATUSES } from '../models/Job.js';
import { enqueueJob, cancelJob, getQueueMetrics } from '../jobs/QueueManager.js';
import { ScheduleManager, SCHEDULE_CADENCES } from '../jobs/ScheduleManager.js';

/**
 * GET /api/v1/jobs
 * Lists tenant background jobs with filtering and pagination.
 */
export async function getJobs(req, res) {
  const organizationId = req.organizationId;
  const { status, jobType, resourceId } = req.query;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { organizationId };

  if (status && Object.values(JOB_STATUSES).includes(status.toUpperCase())) {
    filter.status = status.toUpperCase();
  }

  if (jobType && Object.values(JOB_TYPES).includes(jobType.toLowerCase())) {
    filter.jobType = jobType.toLowerCase();
  }

  if (resourceId && mongoose.Types.ObjectId.isValid(resourceId)) {
    filter.resourceId = resourceId;
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter)
  ]);

  return res.status(200).json({
    success: true,
    data: jobs,
    error: null,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

/**
 * GET /api/v1/jobs/:id
 * Retrieves a single job by its jobId or ObjectId.
 */
export async function getJobById(req, res) {
  const organizationId = req.organizationId;
  const { id } = req.params;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const filter = isObjectId
    ? { organizationId, $or: [{ _id: id }, { jobId: id }] }
    : { organizationId, jobId: id };

  const job = await Job.findOne(filter).lean();
  if (!job) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Job not found' }
    });
  }

  return res.status(200).json({
    success: true,
    data: job,
    error: null
  });
}

/**
 * POST /api/v1/jobs/enqueue
 * Manually enqueues an asynchronous job for catalog sync, profiling, or quality scan.
 */
export async function enqueueManualJob(req, res) {
  const organizationId = req.organizationId;
  const actorId = req.user?._id;
  const correlationId = req.correlationId;
  const { jobType, resourceId, resourceType, metadata } = req.body;

  if (!jobType || !resourceId || !resourceType) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'jobType, resourceId, and resourceType are required' }
    });
  }

  if (!Object.values(JOB_TYPES).includes(jobType)) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'INVALID_JOB_TYPE', message: `Invalid job type: ${jobType}` }
    });
  }

  const jobDoc = await enqueueJob({
    jobType,
    organizationId,
    resourceId,
    resourceType,
    actorId,
    correlationId,
    metadata
  });

  return res.status(202).json({
    success: true,
    data: jobDoc,
    error: null,
    message: 'Job enqueued successfully'
  });
}

/**
 * POST /api/v1/jobs/:id/cancel
 * Cancels a pending queued job.
 */
export async function cancelJobById(req, res) {
  const organizationId = req.organizationId;
  const { id } = req.params;

  const cancelled = await cancelJob(id, organizationId);

  return res.status(200).json({
    success: true,
    data: cancelled,
    error: null,
    message: 'Job cancelled successfully'
  });
}

/**
 * GET /api/v1/jobs/queue/metrics
 * Exposes internal queue metrics (depth, active workers).
 */
export async function getQueueStatus(req, res) {
  const metrics = await getQueueMetrics();
  return res.status(200).json({
    success: true,
    data: metrics,
    error: null
  });
}

/**
 * POST /api/v1/jobs/schedules
 * Registers a recurring schedule.
 */
export async function registerSchedule(req, res) {
  const organizationId = req.organizationId;
  const actorId = req.user?._id;
  const { jobType, resourceId, resourceType, cadence } = req.body;

  if (!jobType || !resourceId || !resourceType || !cadence) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'jobType, resourceId, resourceType, and cadence are required' }
    });
  }

  if (!Object.values(SCHEDULE_CADENCES).includes(cadence)) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'INVALID_CADENCE', message: `Cadence must be one of: ${Object.values(SCHEDULE_CADENCES).join(', ')}` }
    });
  }

  const result = ScheduleManager.registerSchedule({
    organizationId,
    jobType,
    resourceId,
    resourceType,
    cadence,
    actorId
  });

  return res.status(201).json({
    success: true,
    data: result,
    error: null
  });
}

/**
 * GET /api/v1/jobs/schedules
 * Lists active recurring schedules.
 */
export async function listSchedules(req, res) {
  const organizationId = req.organizationId;
  const schedules = ScheduleManager.listSchedules(organizationId);

  return res.status(200).json({
    success: true,
    data: schedules,
    error: null
  });
}

/**
 * DELETE /api/v1/jobs/schedules/:resourceId
 * Cancels recurring schedule for resource.
 */
export async function cancelSchedule(req, res) {
  const organizationId = req.organizationId;
  const { resourceId } = req.params;
  const { jobType } = req.query;

  if (!jobType) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'MISSING_QUERY', message: 'jobType query parameter is required' }
    });
  }

  const cancelled = ScheduleManager.cancelSchedule(organizationId, jobType, resourceId);

  return res.status(200).json({
    success: true,
    data: { cancelled },
    error: null
  });
}
