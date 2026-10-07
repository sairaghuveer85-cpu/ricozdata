import { EventEmitter } from 'events';
import { Activity } from '../models/Activity.js';
import { logger } from '../utils/logger.js';

class QualityAlertDispatcher extends EventEmitter {
  constructor() {
    super();
    // Prevent unhandled error listener warnings
    this.on('error', (err) => {
      logger.error('[QualityAlertDispatcher] Internal error:', err);
    });
  }

  /**
   * Dispatch an internal quality event.
   * Emits the event to in-process subscribers and records an Activity audit entry.
   * 
   * @param {Object} eventData
   * @param {string} eventData.event - Event type, e.g. "quality.issue.created", "quality.issue.resolved", "quality.score.degraded"
   * @param {string} eventData.organizationId - Tenant organization ID
   * @param {string} [eventData.actorId] - User or system actor
   * @param {string} [eventData.datasetId] - Dataset ID
   * @param {string} [eventData.issueId] - Issue ID if applicable
   * @param {Object} [eventData.metadata] - Event metadata
   */
  async dispatch(eventData) {
    const { event, organizationId, actorId, datasetId, issueId, metadata = {} } = eventData;

    // 1. Emit internal event
    try {
      this.emit(event, eventData);
    } catch (emitErr) {
      logger.warn(`[QualityAlertDispatcher] Error emitting event ${event}: ${emitErr.message}`);
    }

    // 2. Persist audit activity
    try {
      if (organizationId) {
        let entityType = 'dataset';
        let entityId = datasetId;

        if (issueId) {
          entityType = 'quality_issue';
          entityId = issueId;
        }

        if (entityId) {
          await Activity.create({
            organizationId,
            actorId: actorId || organizationId,
            action: event,
            entityType,
            entityId,
            metadata: {
              ...metadata,
              dispatchedAt: new Date().toISOString()
            }
          });
        }
      }
    } catch (actErr) {
      logger.warn(`[QualityAlertDispatcher] Failed to record activity for ${event}: ${actErr.message}`);
    }
  }
}

export const qualityAlertDispatcher = new QualityAlertDispatcher();
export default qualityAlertDispatcher;
