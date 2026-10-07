import { QualityRule } from '../models/QualityRule.js';
import { QualityRun } from '../models/QualityRun.js';
import { QualityMetricSnapshot } from '../models/QualityMetricSnapshot.js';
import { QualityIssue, QUALITY_ISSUE_STATUSES } from '../models/QualityIssue.js';
import { Dataset } from '../models/Dataset.js';
import { QualityEngine } from '../services/QualityEngine.js';
import { qualityAlertDispatcher } from '../services/QualityAlertDispatcher.js';
import { Activity } from '../models/Activity.js';

/**
 * GET /api/v1/quality/datasets/:datasetId
 * Fetches latest quality summary for a dataset.
 */
export async function getDatasetQuality(req, res) {
  const { datasetId } = req.params;
  const organizationId = req.organizationId;

  const dataset = await Dataset.findOne({
    _id: datasetId,
    organizationId,
    isDeleted: { $ne: true }
  }).select('name schemaName qualityScore tags classification');

  if (!dataset) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Dataset not found' }
    });
  }

  const [latestRun, latestSnapshot, activeRulesCount, openIssuesCount] = await Promise.all([
    QualityRun.findOne({ datasetId, organizationId }).sort({ createdAt: -1 }),
    QualityMetricSnapshot.findOne({ datasetId, organizationId }).sort({ timestamp: -1 }),
    QualityRule.countDocuments({ datasetId, organizationId, status: 'ACTIVE', enabled: true }),
    QualityIssue.countDocuments({ datasetId, organizationId, status: { $in: ['OPEN', 'IN_REVIEW'] } })
  ]);

  return res.status(200).json({
    success: true,
    data: {
      dataset: {
        id: dataset._id,
        name: dataset.name,
        schema: dataset.schemaName,
        score: dataset.qualityScore?.score ?? null,
        lastEvaluatedAt: dataset.qualityScore?.lastEvaluatedAt ?? null
      },
      latestRun,
      latestSnapshot,
      stats: {
        activeRulesCount,
        openIssuesCount
      }
    },
    error: null
  });
}

/**
 * GET /api/v1/quality/datasets/:datasetId/history
 * Fetches historical quality snapshots and runs.
 */
export async function getDatasetQualityHistory(req, res) {
  const { datasetId } = req.params;
  const organizationId = req.organizationId;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [snapshots, total] = await Promise.all([
    QualityMetricSnapshot.find({ datasetId, organizationId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit),
    QualityMetricSnapshot.countDocuments({ datasetId, organizationId })
  ]);

  return res.status(200).json({
    success: true,
    data: snapshots,
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
 * POST /api/v1/quality/datasets/:datasetId/run
 * Triggers a quality check run for a dataset.
 */
export async function runDatasetQualityCheck(req, res) {
  const { datasetId } = req.params;
  const organizationId = req.organizationId;

  const qualityRun = await QualityEngine.runQualityCheck(datasetId, organizationId, {
    actor: req.user
  });

  return res.status(200).json({
    success: true,
    data: qualityRun,
    error: null
  });
}

/**
 * GET /api/v1/quality/runs/:id
 * Fetches full details for a quality run.
 */
export async function getQualityRunById(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const run = await QualityRun.findOne({ _id: id, organizationId });
  if (!run) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Quality run not found' }
    });
  }

  return res.status(200).json({
    success: true,
    data: run,
    error: null
  });
}

/**
 * GET /api/v1/quality/datasets/:datasetId/rules
 * Lists all quality rules configured for a dataset.
 */
export async function getDatasetRules(req, res) {
  const { datasetId } = req.params;
  const organizationId = req.organizationId;

  const rules = await QualityRule.find({ datasetId, organizationId }).sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: rules,
    error: null,
    meta: { total: rules.length }
  });
}

/**
 * POST /api/v1/quality/datasets/:datasetId/rules
 * Creates a new quality rule for a dataset.
 */
export async function createQualityRule(req, res) {
  const datasetId = req.params.datasetId || req.body.datasetId;
  const organizationId = req.organizationId;

  // Validate dataset ownership
  const dataset = await Dataset.findOne({
    _id: datasetId,
    organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataset) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Target dataset not found' }
    });
  }

  const rule = await QualityRule.create({
    ...req.body,
    datasetId,
    organizationId,
    createdBy: req.user?._id
  });

  // Log activity
  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'quality_rule.created',
    entityType: 'quality_rule',
    entityId: rule._id,
    metadata: {
      ruleName: rule.name,
      ruleType: rule.ruleType,
      datasetId: String(datasetId)
    }
  });

  return res.status(201).json({
    success: true,
    data: rule,
    error: null
  });
}

/**
 * GET /api/v1/quality/rules/:id
 * Fetches a single quality rule by ID.
 */
export async function getQualityRuleById(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const rule = await QualityRule.findOne({ _id: id, organizationId });
  if (!rule) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Quality rule not found' }
    });
  }

  return res.status(200).json({
    success: true,
    data: rule,
    error: null
  });
}

/**
 * PATCH /api/v1/quality/rules/:id
 * Updates an existing quality rule.
 */
export async function updateQualityRule(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  // Prevent moving rule across tenants or datasets
  delete req.body.organizationId;
  delete req.body.datasetId;

  const rule = await QualityRule.findOne({ _id: id, organizationId });
  if (!rule) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Quality rule not found' }
    });
  }

  Object.assign(rule, req.body);
  rule.updatedBy = req.user?._id;
  await rule.save();

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'quality_rule.updated',
    entityType: 'quality_rule',
    entityId: rule._id,
    metadata: { ruleName: rule.name }
  });

  return res.status(200).json({
    success: true,
    data: rule,
    error: null
  });
}

/**
 * DELETE /api/v1/quality/rules/:id
 * Deletes a quality rule.
 */
export async function deleteQualityRule(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const rule = await QualityRule.findOneAndDelete({ _id: id, organizationId });
  if (!rule) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Quality rule not found' }
    });
  }

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'quality_rule.deleted',
    entityType: 'quality_rule',
    entityId: rule._id,
    metadata: { ruleName: rule.name }
  });

  return res.status(200).json({
    success: true,
    data: { id: rule._id, deleted: true },
    error: null
  });
}

/**
 * GET /api/v1/quality/issues
 * Lists quality issues with filtering and pagination.
 */
export async function getQualityIssues(req, res) {
  const organizationId = req.organizationId;
  const { datasetId, status, severity } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { organizationId };
  if (datasetId) filter.datasetId = datasetId;
  if (status) filter.status = status;
  if (severity) filter.severity = severity;

  const [issues, total] = await Promise.all([
    QualityIssue.find(filter)
      .populate('datasetId', 'name schemaName')
      .populate('ruleId', 'name ruleType')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    QualityIssue.countDocuments(filter)
  ]);

  return res.status(200).json({
    success: true,
    data: issues,
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
 * GET /api/v1/quality/issues/:id
 * Fetches a single quality issue by ID.
 */
export async function getQualityIssueById(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const issue = await QualityIssue.findOne({ _id: id, organizationId })
    .populate('datasetId', 'name schemaName')
    .populate('ruleId', 'name ruleType configuration')
    .populate('assignedTo', 'firstName lastName email');

  if (!issue) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Quality issue not found' }
    });
  }

  return res.status(200).json({
    success: true,
    data: issue,
    error: null
  });
}

/**
 * PATCH /api/v1/quality/issues/:id
 * Updates issue remediation state (status, assignment, resolution notes).
 */
export async function updateQualityIssue(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;
  const { status, severity, assignedTo, rootCause, resolutionNotes } = req.body;

  const issue = await QualityIssue.findOne({ _id: id, organizationId });
  if (!issue) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Quality issue not found' }
    });
  }

  if (severity) issue.severity = severity;
  if (rootCause !== undefined) issue.rootCause = rootCause;
  if (assignedTo !== undefined) issue.assignedTo = assignedTo;

  if (status) {
    const previousStatus = issue.status;
    issue.status = status;

    if (status === QUALITY_ISSUE_STATUSES.RESOLVED) {
      issue.resolvedAt = new Date();
      issue.resolution = {
        notes: resolutionNotes || '',
        resolvedBy: req.user?._id,
        resolvedAt: new Date()
      };

      await qualityAlertDispatcher.dispatch({
        event: 'quality.issue.resolved',
        organizationId,
        actorId: req.user?._id,
        datasetId: issue.datasetId,
        issueId: issue._id,
        metadata: {
          title: issue.title,
          resolvedBy: req.user?.email
        }
      });
    } else if (previousStatus === QUALITY_ISSUE_STATUSES.RESOLVED && status !== QUALITY_ISSUE_STATUSES.RESOLVED) {
      issue.resolvedAt = null;
    }
  }

  await issue.save();

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'quality_issue.updated',
    entityType: 'quality_issue',
    entityId: issue._id,
    metadata: {
      status: issue.status,
      severity: issue.severity,
      assignedTo: issue.assignedTo
    }
  });

  return res.status(200).json({
    success: true,
    data: issue,
    error: null
  });
}
