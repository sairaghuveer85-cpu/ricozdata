import mongoose from 'mongoose';
import { Activity } from '../models/Activity.js';

/**
 * GET /api/v1/audit-logs
 * Retrieves immutable audit event logs with multi-parameter filtering and pagination.
 */
export async function getAuditLogs(req, res) {
  const organizationId = req.organizationId;
  const {
    actorId,
    action,
    resourceType,
    resourceId,
    datasetId,
    status,
    startDate,
    endDate
  } = req.query;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // Strict tenant-scoped query
  const filter = { organizationId };

  if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
    filter.actorId = actorId;
  }

  if (action) {
    filter.action = action;
  }

  if (resourceType) {
    filter.entityType = resourceType.toLowerCase();
  }

  if (resourceId && mongoose.Types.ObjectId.isValid(resourceId)) {
    filter.entityId = resourceId;
  }

  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    filter.$or = [
      { entityType: 'dataset', entityId: datasetId },
      { 'metadata.datasetId': String(datasetId) }
    ];
  }

  if (status) {
    filter.status = status.toUpperCase();
  }

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      filter.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.timestamp.$lte = new Date(endDate);
    }
  }

  const [logs, total] = await Promise.all([
    Activity.find(filter)
      .populate('actorId', 'firstName lastName email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit),
    Activity.countDocuments(filter)
  ]);

  const formattedLogs = logs.map((log) => ({
    id: log._id,
    organizationId: log.organizationId,
    actorId: log.actorId?._id || log.actorId,
    actor: log.actorId
      ? {
          id: log.actorId._id,
          name: `${log.actorId.firstName || ''} ${log.actorId.lastName || ''}`.trim() || log.actorId.email,
          email: log.actorId.email,
          role: log.actorId.role
        }
      : null,
    action: log.action,
    resourceType: log.entityType,
    resourceId: log.entityId,
    before: log.before,
    after: log.after,
    status: log.status,
    correlationId: log.correlationId,
    requestMetadata: log.requestMetadata,
    metadata: log.metadata,
    timestamp: log.timestamp
  }));

  return res.status(200).json({
    success: true,
    data: formattedLogs,
    error: null,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
