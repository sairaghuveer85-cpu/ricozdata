const mongoose = require('mongoose');
const ComplianceFramework = require('../models/ComplianceFramework');
const ComplianceControl = require('../models/ComplianceControl');
const ComplianceAssessment = require('../models/ComplianceAssessment');
const ComplianceEvidence = require('../models/ComplianceEvidence');
const Policy = require('../models/Policy');
const GovernanceRule = require('../models/GovernanceRule');
const GovernanceFinding = require('../models/GovernanceFinding');
const Dataset = require('../models/Dataset');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

// ──────────────────────────────────────────────────────────────────────────────
// Frameworks
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Get all compliance frameworks with stats & search
 * @route   GET /api/compliance/frameworks
 * @access  Private (COMPLIANCE_READ)
 */
const getFrameworks = asyncHandler(async (req, res) => {
  const { search, category, status } = req.query;

  const query = {};
  if (category && category !== 'all') query.category = category;
  if (status && status !== 'all') query.status = status.toUpperCase();

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { identifier: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } },
    ];
  }

  const frameworks = await ComplianceFramework.find(query).sort({ identifier: 1 }).lean();

  // Aggregate control counts and compliance rate per framework
  const enriched = await Promise.all(
    frameworks.map(async (fw) => {
      const controls = await ComplianceControl.find({ frameworkId: fw._id }).select('status');
      const total = controls.length;
      const compliant = controls.filter((c) => c.status === 'COMPLIANT').length;
      const partial = controls.filter((c) => c.status === 'PARTIALLY_COMPLIANT').length;
      const nonCompliant = controls.filter((c) => c.status === 'NON_COMPLIANT').length;
      const unassessed = controls.filter((c) => c.status === 'NOT_ASSESSED').length;
      const notApplicable = controls.filter((c) => c.status === 'NOT_APPLICABLE').length;

      const eligible = total - notApplicable;
      const rate = eligible > 0 ? Math.round(((compliant + 0.5 * partial) / eligible) * 100) : 0;

      return {
        ...fw,
        id: fw._id.toString(),
        stats: {
          totalControls: total,
          compliant,
          partial,
          nonCompliant,
          unassessed,
          notApplicable,
          complianceRate: rate,
        },
      };
    })
  );

  res.json({
    success: true,
    data: enriched,
  });
});

/**
 * @desc    Create new compliance framework
 * @route   POST /api/compliance/frameworks
 * @access  Private (COMPLIANCE_MANAGE)
 */
const createFramework = asyncHandler(async (req, res) => {
  const { identifier, name, description, version = '1.0', category = 'Privacy & Security', status = 'ACTIVE' } = req.body;

  if (!identifier || identifier.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Framework identifier is required (e.g. GDPR, SOC2)' });
  }

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Framework name is required' });
  }

  const existing = await ComplianceFramework.findOne({ identifier: identifier.trim().toUpperCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: `Framework "${identifier}" already exists` });
  }

  const framework = await ComplianceFramework.create({
    identifier: identifier.trim().toUpperCase(),
    name: name.trim(),
    description: description ? description.trim() : '',
    version,
    category,
    status: status.toUpperCase(),
    ownerId: req.user ? req.user._id : undefined,
  });

  res.status(201).json({
    success: true,
    data: {
      ...framework.toObject(),
      id: framework._id.toString(),
    },
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Controls
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Get controls with filtering by framework, status, search
 * @route   GET /api/compliance/controls
 * @access  Private (COMPLIANCE_READ)
 */
const getControls = asyncHandler(async (req, res) => {
  const { frameworkId, status, policyId, search, page = 1, limit = 50 } = req.query;

  const query = {};

  if (frameworkId && mongoose.Types.ObjectId.isValid(frameworkId)) {
    query.frameworkId = new mongoose.Types.ObjectId(frameworkId);
  }

  if (status && status !== 'all') {
    query.status = status.toUpperCase();
  }

  if (policyId && mongoose.Types.ObjectId.isValid(policyId)) {
    query.policyIds = new mongoose.Types.ObjectId(policyId);
  }

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { controlId: { $regex: s, $options: 'i' } },
      { name: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * pageSize;

  const [controls, total] = await Promise.all([
    ComplianceControl.find(query)
      .populate('frameworkId', 'identifier name version')
      .populate('policyIds', 'name status category')
      .populate('ruleIds', 'name ruleType severity lastResult')
      .populate('datasetIds', 'name tableName')
      .populate('lastAssessedBy', 'name email')
      .sort({ controlId: 1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    ComplianceControl.countDocuments(query),
  ]);

  const formatted = controls.map((c) => ({
    ...c,
    id: c._id.toString(),
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
 * @desc    Create new compliance control
 * @route   POST /api/compliance/controls
 * @access  Private (COMPLIANCE_MANAGE)
 */
const createControl = asyncHandler(async (req, res) => {
  const {
    frameworkId,
    controlId,
    name,
    description,
    category,
    policyIds = [],
    ruleIds = [],
    datasetIds = [],
  } = req.body;

  if (!frameworkId || !mongoose.Types.ObjectId.isValid(frameworkId)) {
    return res.status(400).json({ success: false, message: 'Valid frameworkId is required' });
  }

  const framework = await ComplianceFramework.findById(frameworkId);
  if (!framework) {
    return res.status(404).json({ success: false, message: 'Framework not found' });
  }

  if (!controlId || controlId.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Control identifier is required' });
  }

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Control name is required' });
  }

  const existing = await ComplianceControl.findOne({ frameworkId, controlId: controlId.trim() });
  if (existing) {
    return res.status(409).json({ success: false, message: `Control "${controlId}" already exists in this framework` });
  }

  const control = await ComplianceControl.create({
    frameworkId,
    controlId: controlId.trim(),
    name: name.trim(),
    description: description ? description.trim() : name.trim(),
    category: category || 'Technical Safeguards',
    policyIds,
    ruleIds,
    datasetIds,
    status: 'NOT_ASSESSED',
    ownerId: req.user ? req.user._id : undefined,
  });

  // Increment framework control count
  await ComplianceFramework.findByIdAndUpdate(frameworkId, { $inc: { controlsCount: 1 } });

  res.status(201).json({
    success: true,
    data: {
      ...control.toObject(),
      id: control._id.toString(),
    },
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Assessments & Evidence
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Perform formal assessment on a control with evidence
 * @route   POST /api/compliance/controls/:id/assess
 * @access  Private (COMPLIANCE_MANAGE)
 */
const assessControl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes, evidenceIds = [], findingIds = [] } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid control ID format' });
  }

  const validStatuses = ['COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_ASSESSED', 'NOT_APPLICABLE'];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: `Invalid assessment status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  if (!notes || notes.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Assessment notes/justification are required (min 5 chars)' });
  }

  const control = await ComplianceControl.findById(id);
  if (!control) {
    return res.status(404).json({ success: false, message: 'Compliance control not found' });
  }

  const assessmentStatus = status.toUpperCase();
  const assessmentDate = new Date();

  const assessment = await ComplianceAssessment.create({
    controlId: control._id,
    frameworkId: control.frameworkId,
    status: assessmentStatus,
    assessorId: req.user._id,
    notes: notes.trim(),
    evidenceIds,
    findingIds,
    assessedAt: assessmentDate,
  });

  // Update control state
  control.status = assessmentStatus;
  control.lastAssessedAt = assessmentDate;
  control.lastAssessedBy = req.user._id;
  await control.save();

  // Log audit activity
  try {
    await Activity.create({
      title: `Assessed compliance control: "${control.controlId}" (${assessmentStatus})`,
      type: 'policy',
      actorId: req.user._id,
      metadata: {
        action: 'CONTROL_ASSESSED',
        controlId: control.controlId,
        frameworkId: control.frameworkId,
        status: assessmentStatus,
        notes: notes.trim(),
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  const populated = await ComplianceAssessment.findById(assessment._id)
    .populate('controlId', 'controlId name status')
    .populate('assessorId', 'name email avatar')
    .populate('evidenceIds', 'title type sourceResource');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

/**
 * @desc    Collect supporting evidence for a control
 * @route   POST /api/compliance/controls/:id/evidence
 * @access  Private (COMPLIANCE_MANAGE)
 */
const collectEvidence = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, title, description, sourceResource, dataSnapshot = {} } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid control ID format' });
  }

  const control = await ComplianceControl.findById(id);
  if (!control) {
    return res.status(404).json({ success: false, message: 'Compliance control not found' });
  }

  if (!type || !title || !sourceResource) {
    return res.status(400).json({
      success: false,
      message: 'type, title, and sourceResource are required for evidence collection',
    });
  }

  const evidence = await ComplianceEvidence.create({
    controlId: control._id,
    type,
    title: title.trim(),
    description: description ? description.trim() : '',
    sourceResource: sourceResource.trim(),
    dataSnapshot,
    collectedBy: req.user._id,
    collectedAt: new Date(),
  });

  res.status(201).json({
    success: true,
    data: evidence,
  });
});

/**
 * @desc    Get complete compliance summary & deterministic calculations
 * @route   GET /api/compliance/summary
 * @access  Private (COMPLIANCE_READ)
 */
const getComplianceSummary = asyncHandler(async (req, res) => {
  const [frameworks, controls, openFindings] = await Promise.all([
    ComplianceFramework.find({ status: 'ACTIVE' }).lean(),
    ComplianceControl.find().populate('frameworkId', 'identifier name').lean(),
    GovernanceFinding.find({ status: { $in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } }).lean(),
  ]);

  const totalControls = controls.length;
  const compliantControls = controls.filter((c) => c.status === 'COMPLIANT').length;
  const partiallyCompliantControls = controls.filter((c) => c.status === 'PARTIALLY_COMPLIANT').length;
  const nonCompliantControls = controls.filter((c) => c.status === 'NON_COMPLIANT').length;
  const unassessedControls = controls.filter((c) => c.status === 'NOT_ASSESSED').length;
  const notApplicableControls = controls.filter((c) => c.status === 'NOT_APPLICABLE').length;

  const eligibleControls = totalControls - notApplicableControls;
  const assessedControls = compliantControls + partiallyCompliantControls + nonCompliantControls;

  // Formula: ((Compliant + 0.5 * Partial) / Eligible) * 100
  const overallComplianceRate = eligibleControls > 0
    ? Math.round(((compliantControls + 0.5 * partiallyCompliantControls) / eligibleControls) * 100)
    : 100;

  // Breakdown per framework
  const frameworkBreakdowns = frameworks.map((fw) => {
    const fwControls = controls.filter(
      (c) => c.frameworkId?._id?.toString() === fw._id.toString() || c.frameworkId === fw._id.toString()
    );
    const total = fwControls.length;
    const compliant = fwControls.filter((c) => c.status === 'COMPLIANT').length;
    const partial = fwControls.filter((c) => c.status === 'PARTIALLY_COMPLIANT').length;
    const nonCompliant = fwControls.filter((c) => c.status === 'NON_COMPLIANT').length;
    const unassessed = fwControls.filter((c) => c.status === 'NOT_ASSESSED').length;
    const na = fwControls.filter((c) => c.status === 'NOT_APPLICABLE').length;
    const eligible = total - na;
    const rate = eligible > 0 ? Math.round(((compliant + 0.5 * partial) / eligible) * 100) : 0;

    return {
      frameworkId: fw._id,
      identifier: fw.identifier,
      name: fw.name,
      totalControls: total,
      compliant,
      partial,
      nonCompliant,
      unassessed,
      notApplicable: na,
      complianceRate: rate,
    };
  });

  res.json({
    success: true,
    data: {
      metrics: {
        totalControls,
        eligibleControls,
        assessedControls,
        compliantControls,
        partiallyCompliantControls,
        nonCompliantControls,
        unassessedControls,
        notApplicableControls,
        overallComplianceRate,
        openFindingsCount: openFindings.length,
      },
      calculationFormula: '((CompliantControls + (0.5 * PartiallyCompliantControls)) / (TotalControls - NotApplicableControls)) * 100',
      frameworkBreakdowns,
      auditNotice: 'Compliance assessments reflect internal organizational data governance review against documented policies, catalog evidence, and rule evaluations.',
    },
  });
});

module.exports = {
  getFrameworks,
  createFramework,
  getControls,
  createControl,
  assessControl,
  collectEvidence,
  getComplianceSummary,
};
