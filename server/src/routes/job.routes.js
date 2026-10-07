import { Router } from 'express';
import {
  getJobs,
  getJobById,
  enqueueManualJob,
  cancelJobById,
  getQueueStatus,
  registerSchedule,
  listSchedules,
  cancelSchedule
} from '../controllers/job.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireTenant } from '../middleware/requireTenant.js';
import { requirePermission } from '../middleware/authorizePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.use(requireTenant);

// Job listing and details
router.get(
  '/',
  requirePermission(PERMISSIONS.ACTIVITIES_READ),
  asyncHandler(getJobs)
);

router.get(
  '/queue/metrics',
  requirePermission(PERMISSIONS.DATASETS_READ),
  asyncHandler(getQueueStatus)
);

router.get(
  '/schedules',
  requirePermission(PERMISSIONS.DATASETS_READ),
  asyncHandler(listSchedules)
);

router.post(
  '/schedules',
  requirePermission(PERMISSIONS.DATASETS_UPDATE),
  asyncHandler(registerSchedule)
);

router.delete(
  '/schedules/:resourceId',
  requirePermission(PERMISSIONS.DATASETS_UPDATE),
  asyncHandler(cancelSchedule)
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.ACTIVITIES_READ),
  asyncHandler(getJobById)
);

router.post(
  '/enqueue',
  requirePermission(PERMISSIONS.DATASETS_UPDATE),
  asyncHandler(enqueueManualJob)
);

router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.DATASETS_UPDATE),
  asyncHandler(cancelJobById)
);

export default router;
