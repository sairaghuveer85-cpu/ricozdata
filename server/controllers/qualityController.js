const Quality = require('../models/Quality');
const QualityIssue = require('../models/QualityIssue');
const Dataset = require('../models/Dataset');
const QualityHistory = require('../models/QualityHistory');
const QualityProfile = require('../models/QualityProfile');
const Rule = require('../models/Rule');
const User = require('../models/User');
const Activity = require('../models/Activity');
const qualityEngine = require('../services/qualityEngine');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all quality records
// @route   GET /api/quality
// @access  Private
const getQualities = asyncHandler(async (req, res) => {
  const qualities = await Quality.find().populate('datasetId', 'name');

  res.json({
    success: true,
    data: qualities,
  });
});

// @desc    Get quality for a specific dataset
// @route   GET /api/quality/:datasetId
// @access  Private
const getQualityForDataset = asyncHandler(async (req, res) => {
  const quality = await Quality.findOne({ datasetId: req.params.datasetId })
    .populate('datasetId', 'name');

  if (!quality) {
    return res.status(404).json({ success: false, message: 'Quality record not found for this dataset' });
  }

  res.json({
    success: true,
    data: quality,
  });
});

// @desc    Get quality overview (for a dataset)
// @route   GET /api/quality/overview/:datasetId
// @access  Private
const getQualityOverview = asyncHandler(async (req, res) => {
  const datasetId = req.params.datasetId;

  const quality = await Quality.findOne({ datasetId });

  if (!quality) {
    const dataset = await Dataset.findById(datasetId);
    if (!dataset) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }
    return res.json({
      success: true,
      data: {
        score: dataset.quality ?? null,
        grade: dataset.quality != null
          ? (dataset.quality >= 95 ? 'Excellent' : dataset.quality >= 90 ? 'Good' : dataset.quality >= 85 ? 'Fair' : 'At Risk')
          : 'NOT ASSESSED',
        trendText: 'No quality evaluations recorded yet',
        trendDirection: 'neutral',
        passedRulesCount: 0,
        totalRulesCount: 0,
        dimensions: [
          { name: 'Completeness', score: null, status: 'NOT_ASSESSED', color: '#64748b' },
          { name: 'Accuracy', score: null, status: 'NOT_ASSESSED', color: '#64748b' },
          { name: 'Consistency', score: null, status: 'NOT_ASSESSED', color: '#64748b' },
          { name: 'Uniqueness', score: null, status: 'NOT_ASSESSED', color: '#64748b' },
          { name: 'Validity', score: null, status: 'NOT_ASSESSED', color: '#64748b' },
          { name: 'Timeliness', score: null, status: 'NOT_ASSESSED', color: '#64748b' }
        ],
        lastScanned: null
      }
    });
  }

  res.json({
    success: true,
    data: quality,
  });
});

// @desc    Create quality record
// @route   POST /api/quality
// @access  Private
const createQuality = asyncHandler(async (req, res) => {
  const { datasetId, score, grade, dimensions } = req.body;

  const existingQuality = await Quality.findOne({ datasetId });
  if (existingQuality) {
    return res.status(400).json({ success: false, message: 'Quality record already exists for this dataset' });
  }

  const quality = await Quality.create({
    datasetId,
    score,
    grade,
    dimensions,
  });

  res.status(201).json({
    success: true,
    data: quality,
  });
});

// @desc    Update quality record
// @route   PUT /api/quality/:id
// @access  Private
const updateQuality = asyncHandler(async (req, res) => {
  const quality = await Quality.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('datasetId', 'name');

  if (!quality) {
    return res.status(404).json({ success: false, message: 'Quality record not found' });
  }

  res.json({
    success: true,
    data: quality,
  });
});

// @desc    Delete quality record
// @route   DELETE /api/quality/:id
// @access  Private
const deleteQuality = asyncHandler(async (req, res) => {
  const quality = await Quality.findByIdAndDelete(req.params.id);

  if (!quality) {
    return res.status(404).json({ success: false, message: 'Quality record not found' });
  }

  res.json({
    success: true,
    message: 'Quality record removed',
  });
});

// @desc    Get quality issues
// @route   GET /api/quality/issues
// @access  Private
const getQualityIssues = asyncHandler(async (req, res) => {
  const { datasetId, severity, status } = req.query;

  const filter = {};
  if (datasetId) filter.datasetId = datasetId;
  if (severity) filter.severity = severity;
  if (status) filter.status = status;

  const issues = await QualityIssue.find(filter)
    .populate('datasetId', 'name')
    .populate('assignedToId', 'name')
    .sort({ severity: 1, count: -1 });

  res.json({
    success: true,
    data: issues,
  });
});

// @desc    Get single quality issue
// @route   GET /api/quality/issues/:id
// @access  Private
const getQualityIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.findById(req.params.id)
    .populate('datasetId', 'name')
    .populate('assignedToId', 'name');

  if (!issue) {
    return res.status(404).json({ success: false, message: 'Quality issue not found' });
  }

  res.json({
    success: true,
    data: issue,
  });
});

// @desc    Create quality issue
// @route   POST /api/quality/issues
// @access  Private
const createQualityIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.create(req.body);

  const populated = await QualityIssue.findById(issue._id)
    .populate('datasetId', 'name')
    .populate('assignedToId', 'name');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

// @desc    Update quality issue
// @route   PUT /api/quality/issues/:id
// @access  Private
const updateQualityIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('datasetId', 'name')
    .populate('assignedToId', 'name');

  if (!issue) {
    return res.status(404).json({ success: false, message: 'Quality issue not found' });
  }

  res.json({
    success: true,
    data: issue,
  });
});

// @desc    Delete quality issue
// @route   DELETE /api/quality/issues/:id
// @access  Private
const deleteQualityIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.findByIdAndDelete(req.params.id);

  if (!issue) {
    return res.status(404).json({ success: false, message: 'Quality issue not found' });
  }

  res.json({
    success: true,
    message: 'Quality issue removed',
  });
});

// ══════════════════════════════════════════════════════════════════════
//  RULE CRUD
// ══════════════════════════════════════════════════════════════════════

// @desc    Get all rules for a dataset
// @route   GET /api/quality/rules
// @access  Private
const getRules = asyncHandler(async (req, res) => {
  const { datasetId, enabled, status, ruleType } = req.query;
  const filter = {};
  if (datasetId) filter.datasetId = datasetId;
  if (enabled !== undefined) filter.enabled = enabled === 'true';
  if (status) filter.status = status;
  if (ruleType) filter.ruleType = ruleType;

  const rules = await Rule.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: rules });
});

// @desc    Get single rule
// @route   GET /api/quality/rules/:id
// @access  Private
const getRule = asyncHandler(async (req, res) => {
  const rule = await Rule.findById(req.params.id).populate('createdBy', 'name');
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }
  res.json({ success: true, data: rule });
});

// @desc    Create rule
// @route   POST /api/quality/rules
// @access  Private (QUALITY_MANAGE)
const createRule = asyncHandler(async (req, res) => {
  const rule = await Rule.create(req.body);
  const populated = await Rule.findById(rule._id).populate('createdBy', 'name');

  await Activity.create({
    title: `Quality rule "${rule.name}" created`,
    type: 'rule_create',
    actorId: req.user.id,
    datasetId: rule.datasetId,
    timestamp: new Date(),
  });

  res.status(201).json({ success: true, data: populated });
});

// @desc    Update rule
// @route   PUT /api/quality/rules/:id
// @access  Private (QUALITY_MANAGE)
const updateRule = asyncHandler(async (req, res) => {
  const rule = await Rule.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  }).populate('createdBy', 'name');

  if (!rule) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }

  await Activity.create({
    title: `Quality rule "${rule.name}" updated`,
    type: 'rule_update',
    actorId: req.user.id,
    datasetId: rule.datasetId,
    timestamp: new Date(),
  });

  res.json({ success: true, data: rule });
});

// @desc    Delete rule
// @route   DELETE /api/quality/rules/:id
// @access  Private (QUALITY_MANAGE)
const deleteRule = asyncHandler(async (req, res) => {
  const rule = await Rule.findByIdAndDelete(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }

  await Activity.create({
    title: `Quality rule "${rule.name}" deleted`,
    type: 'rule_delete',
    actorId: req.user.id,
    datasetId: rule.datasetId,
    timestamp: new Date(),
  });

  res.json({ success: true, message: 'Rule removed' });
});

// ══════════════════════════════════════════════════════════════════════
//  RULE EXECUTION
// ══════════════════════════════════════════════════════════════════════

// @desc    Run single rule
// @route   POST /api/quality/rules/:id/run
// @access  Private (QUALITY_UPDATE)
const runRule = asyncHandler(async (req, res) => {
  const rule = await Rule.findById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Rule not found' });
  }

  const dataset = await Dataset.findById(rule.datasetId);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const result = await qualityEngine.evaluateRuleOnDataset(rule, dataset, []);
  const outcome = result.passed ? 'pass' : (result.compliance >= 80 ? 'warning' : 'fail');

  rule.lastRunAt = new Date();
  rule.lastResult = outcome;
  await rule.save();

  res.json({
    success: true,
    data: {
      ...result,
      ruleId: rule._id,
      lastRunAt: rule.lastRunAt,
      lastResult: outcome,
      rule
    }
  });
});

// @desc    Evaluate entire dataset
// @route   POST /api/quality/evaluate/:datasetId
// @access  Private (QUALITY_UPDATE)
const evaluateDataset = asyncHandler(async (req, res) => {
  try {
    const result = await qualityEngine.evaluateDataset(req.params.datasetId, {
      userId: req.user ? req.user.id : null,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    if (
      err.code === 'SOURCE_UNAVAILABLE' ||
      err.code === 'CONNECTOR_UNSUPPORTED' ||
      err.code?.startsWith('CONNECTOR_') ||
      err.statusCode ||
      err.status
    ) {
      return res.status(err.statusCode || err.status || 503).json({
        success: false,
        status: err.code || 'EVALUATION_FAILED',
        message: err.message
      });
    }
    throw err;
  }
});

// ══════════════════════════════════════════════════════════════════════
//  ISSUE LIFECYCLE
// ══════════════════════════════════════════════════════════════════════

// @desc    Resolve issue
// @route   POST /api/quality/issues/:id/resolve
// @access  Private (QUALITY_UPDATE)
const resolveIssue = asyncHandler(async (req, res) => {
  const { resolutionNote } = req.body;
  const issue = await QualityIssue.findById(req.params.id);

  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  issue.status = 'resolved';
  issue.resolutionNote = resolutionNote || issue.resolutionNote;
  issue.resolvedById = req.user.id;
  await issue.save();

  await Activity.create({
    title: `Quality issue resolved: ${issue.issue}`,
    type: 'issue_resolve',
    actorId: req.user.id,
    datasetId: issue.datasetId,
    issueId: issue._id,
    timestamp: new Date(),
    details: { resolutionNote },
  });

  res.json({ success: true, data: issue });
});

// @desc    Acknowledge issue
// @route   POST /api/quality/issues/:id/acknowledge
// @access  Private (QUALITY_UPDATE)
const acknowledgeIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.findById(req.params.id);
  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  issue.status = 'acknowledged';
  await issue.save();

  await Activity.create({
    title: `Quality issue acknowledged: ${issue.issue}`,
    type: 'issue_acknowledge',
    actorId: req.user.id,
    datasetId: issue.datasetId,
    issueId: issue._id,
    timestamp: new Date(),
  });

  res.json({ success: true, data: issue });
});

// @desc    Start working on issue
// @route   POST /api/quality/issues/:id/in-progress
// @access  Private (QUALITY_UPDATE)
const inProgressIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.findById(req.params.id);
  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  issue.status = 'in_progress';
  await issue.save();

  await Activity.create({
    title: `Quality issue in progress: ${issue.issue}`,
    type: 'issue_in_progress',
    actorId: req.user.id,
    datasetId: issue.datasetId,
    issueId: issue._id,
    timestamp: new Date(),
  });

  res.json({ success: true, data: issue });
});

// @desc    Ignore issue
// @route   POST /api/quality/issues/:id/ignore
// @access  Private (QUALITY_MANAGE)
const ignoreIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.findById(req.params.id);
  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  issue.status = 'ignored';
  await issue.save();

  await Activity.create({
    title: `Quality issue ignored: ${issue.issue}`,
    type: 'issue_ignore',
    actorId: req.user.id,
    datasetId: issue.datasetId,
    issueId: issue._id,
    timestamp: new Date(),
  });

  res.json({ success: true, data: issue });
});

// @desc    Reopen issue
// @route   POST /api/quality/issues/:id/reopen
// @access  Private (QUALITY_UPDATE)
const reopenIssue = asyncHandler(async (req, res) => {
  const issue = await QualityIssue.findById(req.params.id);
  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  issue.status = 'open';
  issue.resolvedAt = null;
  issue.resolvedById = null;
  issue.resolutionNote = null;
  await issue.save();

  await Activity.create({
    title: `Quality issue reopened: ${issue.issue}`,
    type: 'issue_reopen',
    actorId: req.user.id,
    datasetId: issue.datasetId,
    issueId: issue._id,
    timestamp: new Date(),
  });

  res.json({ success: true, data: issue });
});

// @desc    Assign issue to user
// @route   POST /api/quality/issues/:id/assign
// @access  Private (QUALITY_UPDATE)
const assignIssue = asyncHandler(async (req, res) => {
  const { assignedToId } = req.body;
  const issue = await QualityIssue.findById(req.params.id);
  if (!issue) {
    return res.status(404).json({ success: false, message: 'Issue not found' });
  }

  issue.assignedToId = assignedToId;
  await issue.save();

  const assignee = await User.findById(assignedToId);

  await Activity.create({
    title: `Quality issue assigned to ${assignee?.name || 'someone'}`,
    type: 'issue_assign',
    actorId: req.user.id,
    datasetId: issue.datasetId,
    issueId: issue._id,
    timestamp: new Date(),
  });

  res.json({ success: true, data: issue });
});

// ═══════════════════════════════════════════════════════════════════════
//  TRENDS & PROFILING
// ═══════════════════════════════════════════════════════════════════════

// @desc    Get quality trends for a dataset
// @route   GET /api/quality/trends/:datasetId
// @access  Private (QUALITY_READ)
const getQualityTrends = asyncHandler(async (req, res) => {
  const { range = '30d' } = req.query;
  const trends = await qualityEngine.getQualityTrends(req.params.datasetId, range);
  res.json({ success: true, data: trends });
});

// @desc    Get quality profile for a dataset
// @route   GET /api/quality/profile/:datasetId
// @access  Private (QUALITY_READ)
const getQualityProfile = asyncHandler(async (req, res) => {
  const profile = await qualityEngine.getQualityProfile(req.params.datasetId);
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Quality profile not found' });
  }
  res.json({ success: true, data: profile });
});

// @desc    Search quality issues
// @route   GET /api/quality/issues/search
// @access  Private (QUALITY_READ)
const searchIssues = asyncHandler(async (req, res) => {
  const { q, datasetId, severity, status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (datasetId) filter.datasetId = datasetId;
  if (severity) filter.severity = severity;
  if (status) filter.status = status;

  if (q) {
    filter.$or = [
      { issue: { $regex: q, $options: 'i' } },
      { field: { $regex: q, $options: 'i' } },
      { ruleType: { $regex: q, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const issues = await QualityIssue.find(filter)
    .populate('datasetId', 'name')
    .populate('assignedToId', 'name')
    .sort({ severity: 1, detectedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await QualityIssue.countDocuments(filter);

  res.json({
    success: true,
    data: issues,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

module.exports = {
  getQualities,
  getQualityForDataset,
  getQualityOverview,
  createQuality,
  updateQuality,
  deleteQuality,
  getQualityIssues,
  getQualityIssue,
  createQualityIssue,
  updateQualityIssue,
  deleteQualityIssue,
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  runRule,
  evaluateDataset,
  resolveIssue,
  acknowledgeIssue,
  inProgressIssue,
  ignoreIssue,
  reopenIssue,
  assignIssue,
  getQualityTrends,
  getQualityProfile,
  searchIssues,
};