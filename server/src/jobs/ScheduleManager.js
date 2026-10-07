import { enqueueJob } from './QueueManager.js';
import { logger } from '../utils/logger.js';

// Active schedules registered in-process: key is `orgId:jobType:resourceId`
const activeSchedules = new Map();

export const SCHEDULE_CADENCES = Object.freeze({
  HOURLY: 'hourly',
  EVERY_6_HOURS: 'every_6_hours',
  DAILY: 'daily',
  WEEKLY: 'weekly'
});

const CADENCE_INTERVAL_MS = {
  [SCHEDULE_CADENCES.HOURLY]: 3600 * 1000,
  [SCHEDULE_CADENCES.EVERY_6_HOURS]: 6 * 3600 * 1000,
  [SCHEDULE_CADENCES.DAILY]: 24 * 3600 * 1000,
  [SCHEDULE_CADENCES.WEEKLY]: 7 * 24 * 3600 * 1000
};

export class ScheduleManager {
  /**
   * Registers a recurring schedule for a resource.
   */
  static registerSchedule(params) {
    const { organizationId, jobType, resourceId, resourceType, cadence, actorId } = params;

    const key = `${organizationId}:${jobType}:${resourceId}`;
    if (activeSchedules.has(key)) {
      this.cancelSchedule(organizationId, jobType, resourceId);
    }

    const intervalMs = CADENCE_INTERVAL_MS[cadence] || CADENCE_INTERVAL_MS[SCHEDULE_CADENCES.DAILY];

    const timer = setInterval(async () => {
      try {
        logger.info(`[Scheduler] Firing scheduled job for ${key} (${cadence})`);
        await enqueueJob({
          organizationId,
          jobType,
          resourceId,
          resourceType,
          actorId,
          metadata: { scheduled: true, cadence }
        });
      } catch (err) {
        logger.warn(`[Scheduler] Scheduled job trigger failed for ${key}: ${err.message}`);
      }
    }, intervalMs);

    // Prevent active timer from blocking node process shutdown
    if (timer.unref) {
      timer.unref();
    }

    const scheduleRecord = {
      organizationId,
      jobType,
      resourceId,
      resourceType,
      cadence,
      timer,
      registeredAt: new Date()
    };

    activeSchedules.set(key, scheduleRecord);
    logger.info(`[Scheduler] Registered ${cadence} schedule for ${key}`);
    return {
      success: true,
      scheduleKey: key,
      cadence,
      registeredAt: scheduleRecord.registeredAt
    };
  }

  /**
   * Cancels a recurring schedule.
   */
  static cancelSchedule(organizationId, jobType, resourceId) {
    const key = `${organizationId}:${jobType}:${resourceId}`;
    const schedule = activeSchedules.get(key);
    if (schedule) {
      clearInterval(schedule.timer);
      activeSchedules.delete(key);
      logger.info(`[Scheduler] Cancelled schedule for ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Lists active schedules for an organization.
   */
  static listSchedules(organizationId) {
    const list = [];
    for (const [key, sched] of activeSchedules.entries()) {
      if (sched.organizationId.toString() === organizationId.toString()) {
        list.push({
          scheduleKey: key,
          jobType: sched.jobType,
          resourceId: sched.resourceId,
          resourceType: sched.resourceType,
          cadence: sched.cadence,
          registeredAt: sched.registeredAt
        });
      }
    }
    return list;
  }

  /**
   * Clears all active schedules upon shutdown.
   */
  static clearAll() {
    for (const [key, sched] of activeSchedules.entries()) {
      clearInterval(sched.timer);
    }
    activeSchedules.clear();
  }
}

export default ScheduleManager;
