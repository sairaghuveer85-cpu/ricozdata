const mongoose = require('mongoose');
const GovernanceRule = require('../models/GovernanceRule');
const GovernanceFinding = require('../models/GovernanceFinding');
const Policy = require('../models/Policy');
const Dataset = require('../models/Dataset');
const GlossaryTerm = require('../models/GlossaryTerm');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');
const { evaluateRule: runRuleEvaluation } = require('../services/governanceRuleEngine');

/**
 * @desc    Get all governance rules with filters & pagination
 * @route   GET /api/governance-rules
 * @access  Private (RULE_READ)
 */
const getRules = asyncHandler(async (req, res) => {
  const {
    policyId,
    category,
    ruleType,
    status,
    severity,
    datasetId,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};

  if (policyId && mongoose.Types.ObjectId.isValid(policyId)) {
    query.policyId = new mongoose.Types.ObjectId(policyId);
  }

  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    query.datasetId = new mongoose.Types.ObjectId(datasetId);
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  if (ruleType && ruleType !== 'all') {
    query.ruleType = ruleType;
  }

  if (status && status !== 'all') {
    query.status = status.toLowerCase();
  }

  if (severity && severity !== 'all') {
    query.severity = severity.toLowerCase();
  }

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } },
      { columnName: { $regex: s, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * pageSize;

  const allowedSorts = ['name', 'createdAt', 'updatedAt', 'severity', 'status', 'lastRunAt', 'lastResult'];
  const sortField = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const [rules, total] = await Promise.all([
    GovernanceRule.find(query)
      .populate('policyId', 'name category status')
      .populate('datasetId', 'name tableName schemaName')
      .populate('glossaryTermId', 'term definition')
      .populate('ownerId', 'name email avatar')
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    GovernanceRule.countDocuments(query),
  ]);

  const formatted = rules.map((r) => ({
    ...r,
    id: r._id.toString(),
  }));

  res.json({
    success: true,
    data: formatted,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize) || 1,
    },
  });
});

/**
 * @desc    Get single governance rule
 * @route   GET /api/governance-rules/:id
 * @access  Private (RULE_READ)
 */
const getRule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid rule ID format' });
  }

  const rule = await GovernanceRule.findById(id)
    .populate('policyId', 'name description category status datasetIds')
    .populate('datasetId', 'name tableName schemaName columns')
    .populate('glossaryTermId', 'term definition')
    .populate('ownerId', 'name email avatar');

  if (!rule) {
    return res.status(404).json({ success: false, message: 'Governance rule not found' });
  }

  const findings = await GovernanceFinding.find({ ruleId: rule._id })
    .sort({ detectedAt: -1 })
    .limit(20);

  res.json({
    success: true,
    data: {
      ...rule.toObject(),
      id: rule._id.toString(),
      findings,
    },
  });
});

/**
 * @desc    Create new governance rule
 * @route   POST /api/governance-rules
 * @access  Private (RULE_CREATE)
 */
const createRule = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    policyId,
    category,
    ruleType,
    severity = 'medium',
    status = 'active',
    targetType = 'DATASET',
    datasetId,
    columnName,
    glossaryTermId,
    parameters = {},
    ownerId,
  } = req.body;

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Rule name is required (min 3 characters)' });
  }

  if (!policyId || !mongoose.Types.ObjectId.isValid(policyId)) {
    return res.status(400).json({ success: false, message: 'A valid policyId is required' });
  }

  const policy = await Policy.findById(policyId);
  if (!policy) {
    return res.status(404).json({ success: false, message: 'Associated policy not found' });
  }

  if (!ruleType) {
    return res.status(400).json({ success: false, message: 'ruleType is required' });
  }

  // Validate optional target references
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) {
    const dsExists = await Dataset.exists({ _id: datasetId });
    if (!dsExists) {
      return res.status(400).json({ success: false, message: 'Referenced dataset does not exist' });
    }
  }

  if (glossaryTermId && mongoose.Types.ObjectId.isValid(glossaryTermId)) {
    const termExists = await GlossaryTerm.exists({ _id: glossaryTermId });
    if (!termExists) {
      return res.status(400).json({ success: false, message: 'Referenced glossary term does not exist' });
    }
  }

  const assignedOwnerId = ownerId && mongoose.Types.ObjectId.isValid(ownerId) ? ownerId : (req.user ? req.user._id : policy.ownerId);

  const rule = await GovernanceRule.create({
    name: name.trim(),
    description: description ? description.trim() : '',
    policyId: policy._id,
    category: category || 'PII_PROTECTION',
    ruleType,
    severity,
    status,
    targetType,
    datasetId: datasetId && mongoose.Types.ObjectId.isValid(datasetId) ? datasetId : undefined,
    columnName: columnName ? columnName.trim() : undefined,
    glossaryTermId: glossaryTermId && mongoose.Types.ObjectId.isValid(glossaryTermId) ? glossaryTermId : undefined,
    parameters,
    ownerId: assignedOwnerId,
    createdBy: req.user ? req.user._id : assignedOwnerId,
    updatedBy: req.user ? req.user._id : assignedOwnerId,
  });

  // Link rule to policy
  await Policy.findByIdAndUpdate(policy._id, { $addToSet: { ruleIds: rule._id } });

  // Log activity
  try {
    await Activity.create({
      title: `Created governance rule: "${rule.name}" under policy "${policy.name}"`,
      type: 'policy',
      actorId: req.user ? req.user._id : assignedOwnerId,
      policyId: policy._id,
      metadata: {
        action: 'RULE_CREATED',
        ruleName: rule.name,
        ruleType: rule.ruleType,
        severity: rule.severity,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  const populated = await GovernanceRule.findById(rule._id)
    .populate('policyId', 'name category status')
    .populate('datasetId', 'name tableName');

  res.status(201).json({
    success: true,
    data: {
      ...populated.toObject(),
      id: populated._id.toString(),
    },
  });
});

/**
 * @desc    Update existing governance rule
 * @route   PUT /api/governance-rules/:id
 * @access  Private (RULE_UPDATE)
 */
const updateRule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid rule ID format' });
  }

  const rule = await GovernanceRule.findById(id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Governance rule not found' });
  }

  const {
    name,
    description,
    category,
    severity,
    status,
    targetType,
    datasetId,
    columnName,
    glossaryTermId,
    parameters,
    ownerId,
  } = req.body;

  if (name && name.trim().length >= 3) rule.name = name.trim();
  if (description !== undefined) rule.description = description.trim();
  if (category) rule.category = category;
  if (severity) rule.severity = severity.toLowerCase();
  if (status) rule.status = status.toLowerCase();
  if (targetType) rule.targetType = targetType;
  if (parameters) rule.parameters = parameters;
  if (columnName !== undefined) rule.columnName = columnName.trim();
  if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) rule.ownerId = ownerId;
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) rule.datasetId = datasetId;
  if (glossaryTermId && mongoose.Types.ObjectId.isValid(glossaryTermId)) rule.glossaryTermId = glossaryTermId;

  rule.updatedBy = req.user ? req.user._id : rule.ownerId;
  await rule.save();

  res.json({
    success: true,
    data: {
      ...rule.toObject(),
      id: rule._id.toString(),
    },
  });
});

/**
 * @desc    Delete governance rule
 * @route   DELETE /api/governance-rules/:id
 * @access  Private (RULE_DELETE)
 */
const deleteRule = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid rule ID format' });
  }

  const rule = await GovernanceRule.findById(id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Governance rule not found' });
  }

  // Unlink from parent policy
  await Policy.findByIdAndUpdate(rule.policyId, { $pull: { ruleIds: rule._id } });

  // Delete associated findings
  await GovernanceFinding.deleteMany({ ruleId: rule._id });

  await GovernanceRule.findByIdAndDelete(id);

  res.json({
    success: true,
    message: `Governance rule "${rule.name}" removed successfully`,
  });
});

/**
 * @desc    Execute evaluation of a single governance rule
 * @route   POST /api/governance-rules/:id/evaluate
 * @access  Private (RULE_EVALUATE)
 */
const evaluateRuleHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid rule ID format' });
  }

  const outcome = await runRuleEvaluation(id, req.user);

  res.json({
    success: true,
    data: outcome,
  });
});

/**
 * @desc    Execute evaluation of all rules under a policy
 * @route   POST /api/policies/:id/evaluate-rules
 * @access  Private (RULE_EVALUATE)
 */
const evaluatePolicyRules = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid policy ID format' });
  }

  const rules = await GovernanceRule.find({ policyId: id, status: 'active' });

  const outcomes = [];
  for (const r of rules) {
    const outcome = await runRuleEvaluation(r._id, req.user);
    outcomes.push(outcome);
  }

  res.json({
    success: true,
    totalRulesEvaluated: rules.length,
    results: outcomes,
  });
});

/**
 * @desc    Get governance findings with filtering & pagination
 * @route   GET /api/governance-findings
 * @access  Private (RULE_READ)
 */
const getFindings = asyncHandler(async (req, res) => {
  const {
    policyId,
    ruleId,
    datasetId,
    status,
    severity,
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};

  if (policyId && mongoose.Types.ObjectId.isValid(policyId)) query.policyId = new mongoose.Types.ObjectId(policyId);
  if (ruleId && mongoose.Types.ObjectId.isValid(ruleId)) query.ruleId = new mongoose.Types.ObjectId(ruleId);
  if (datasetId && mongoose.Types.ObjectId.isValid(datasetId)) query.datasetId = new mongoose.Types.ObjectId(datasetId);

  if (status && status !== 'all') {
    query.status = status.toUpperCase();
  }

  if (severity && severity !== 'all') {
    query.severity = severity.toLowerCase();
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * pageSize;

  const [findings, total] = await Promise.all([
    GovernanceFinding.find(query)
      .populate('policyId', 'name category status')
      .populate('ruleId', 'name ruleType severity')
      .populate('datasetId', 'name tableName schemaName')
      .populate('assignedToId', 'name email avatar')
      .populate('resolvedById', 'name email')
      .sort({ detectedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    GovernanceFinding.countDocuments(query),
  ]);

  const formatted = findings.map((f) => ({
    ...f,
    id: f._id.toString(),
  }));

  res.json({
    success: true,
    data: formatted,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize) || 1,
    },
  });
});

/**
 * @desc    Get single finding
 * @route   GET /api/governance-findings/:id
 * @access  Private (RULE_READ)
 */
const getFinding = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid finding ID format' });
  }

  const finding = await GovernanceFinding.findById(id)
    .populate('policyId', 'name category status')
    .populate('ruleId', 'name ruleType severity')
    .populate('datasetId', 'name tableName schemaName columns')
    .populate('assignedToId', 'name email avatar')
    .populate('resolvedById', 'name email');

  if (!finding) {
    return res.status(404).json({ success: false, message: 'Finding not found' });
  }

  res.json({
    success: true,
    data: {
      ...finding.toObject(),
      id: finding._id.toString(),
    },
  });
});

/**
 * @desc    Update finding resolution status & assignee
 * @route   PATCH /api/governance-findings/:id/status
 * @access  Private (RULE_UPDATE)
 */
const updateFindingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resolutionNotes, assignedToId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid finding ID format' });
  }

  const finding = await GovernanceFinding.findById(id);
  if (!finding) {
    return res.status(404).json({ success: false, message: 'Finding not found' });
  }

  const validStatuses = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'];
  if (status && !validStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  if (status) {
    const nextStatus = status.toUpperCase();
    finding.status = nextStatus;
    if (nextStatus === 'RESOLVED') {
      finding.resolvedAt = new Date();
      finding.resolvedById = req.user ? req.user._id : undefined;
    }
  }

  if (resolutionNotes !== undefined) {
    finding.resolutionNotes = resolutionNotes;
  }

  if (assignedToId && mongoose.Types.ObjectId.isValid(assignedToId)) {
    finding.assignedToId = assignedToId;
  }

  await finding.save();

  res.json({
    success: true,
    data: {
      ...finding.toObject(),
      id: finding._id.toString(),
    },
  });
});

module.exports = {
  getRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  evaluateRuleHandler,
  evaluatePolicyRules,
  getFindings,
  getFinding,
  updateFindingStatus,
};
