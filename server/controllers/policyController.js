const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const Dataset = require('../models/Dataset');
const GlossaryTerm = require('../models/GlossaryTerm');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');
const { ROLES } = require('../config/rbac');

// Allowed sort fields to prevent query injection
const ALLOWED_SORT_FIELDS = ['name', 'createdAt', 'updatedAt', 'priority', 'severity', 'status', 'category'];

/**
 * @desc    Get all policies with search, filters, sorting, and pagination
 * @route   GET /api/policies
 * @access  Private (POLICY_READ)
 */
const getPolicies = asyncHandler(async (req, res) => {
  const {
    search,
    status,
    category,
    severity,
    datasetId,
    sortBy = 'name',
    sortOrder = 'asc',
    page = 1,
    limit = 50,
  } = req.query;

  const query = {};

  // Text / keyword search
  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } },
      { category: { $regex: s, $options: 'i' } },
      { appliesTo: { $regex: s, $options: 'i' } },
    ];
  }

  // Status filter
  if (status && status !== 'all') {
    const normalized = status.toLowerCase().replace(/[\s-]/g, '_');
    query.status = normalized;
  }

  // Category filter
  if (category && category !== 'all') {
    query.category = { $regex: new RegExp(`^${category.trim()}$`, 'i') };
  }

  // Severity filter
  if (severity && severity !== 'all') {
    query.severity = severity;
  }

  // Dataset filter
  if (datasetId) {
    if (mongoose.Types.ObjectId.isValid(datasetId)) {
      query.datasetIds = new mongoose.Types.ObjectId(datasetId);
    }
  }

  // Bounded pagination
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * pageSize;

  // Safe sorting
  const sortField = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'name';
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  const sortOptions = { [sortField]: sortDirection };

  const [policies, total] = await Promise.all([
    Policy.find(query)
      .populate('ownerId', 'name email avatar avatarBg role')
      .populate('datasetIds', 'name tableName schemaName status qualityScore')
      .populate('glossaryTermIds', 'term definition status')
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Policy.countDocuments(query),
  ]);

  // Transform for frontend compatibility (ensuring both `id` and `_id` are available)
  const formatted = policies.map((p) => ({
    ...p,
    id: p._id.toString(),
    owner: p.ownerId ? p.ownerId.name : p.owner || 'Unassigned',
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
 * @desc    Get single policy by ID with all relationships
 * @route   GET /api/policies/:id
 * @access  Private (POLICY_READ)
 */
const getPolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid policy ID format' });
  }

  const policy = await Policy.findById(id)
    .populate('ownerId', 'name email avatar avatarBg role')
    .populate('datasetIds', 'name tableName schemaName classification sensitivity qualityScore')
    .populate('glossaryTermIds', 'term definition status domain')
    .populate('ruleIds', 'name category ruleType severity status lastResult lastRunAt')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('approvedBy', 'name email');

  if (!policy) {
    return res.status(404).json({ success: false, message: 'Policy not found' });
  }

  res.json({
    success: true,
    data: {
      ...policy.toObject(),
      id: policy._id.toString(),
      owner: policy.ownerId ? policy.ownerId.name : policy.owner || 'Unassigned',
    },
  });
});

/**
 * @desc    Create new governance policy
 * @route   POST /api/policies
 * @access  Private (POLICY_CREATE)
 */
const createPolicy = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    ownerId,
    owner,
    status = 'draft',
    priority = 'Medium',
    severity = 'Medium',
    scope,
    appliesTo,
    datasetIds = [],
    columnReferences = [],
    glossaryTermIds = [],
    complianceFrameworks = ['GDPR'],
    reviewFrequency = 'Quarterly',
    effectiveDate,
    nextReview,
  } = req.body;

  if (!name || name.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Policy name is required and must be at least 3 characters',
    });
  }

  if (!description || description.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Policy description is required and must be at least 10 characters',
    });
  }

  // Resolve valid owner ID
  let assignedOwnerId = ownerId;
  if (!assignedOwnerId || !mongoose.Types.ObjectId.isValid(assignedOwnerId)) {
    assignedOwnerId = req.user ? req.user._id : null;
  }

  if (!assignedOwnerId) {
    return res.status(400).json({
      success: false,
      message: 'A valid owner is required for policy creation',
    });
  }

  // Validate referenced dataset IDs
  const validDatasetIds = [];
  if (Array.isArray(datasetIds)) {
    for (const dsId of datasetIds) {
      if (mongoose.Types.ObjectId.isValid(dsId)) {
        const exists = await Dataset.exists({ _id: dsId });
        if (exists) validDatasetIds.push(dsId);
      }
    }
  }

  // Validate referenced glossary terms
  const validGlossaryIds = [];
  if (Array.isArray(glossaryTermIds)) {
    for (const gId of glossaryTermIds) {
      if (mongoose.Types.ObjectId.isValid(gId)) {
        const exists = await GlossaryTerm.exists({ _id: gId });
        if (exists) validGlossaryIds.push(gId);
      }
    }
  }

  // Filter valid column references
  const validColumnRefs = [];
  if (Array.isArray(columnReferences)) {
    for (const ref of columnReferences) {
      if (ref && ref.datasetId && mongoose.Types.ObjectId.isValid(ref.datasetId) && ref.columnName) {
        validColumnRefs.push({
          datasetId: ref.datasetId,
          columnName: ref.columnName.trim(),
        });
      }
    }
  }

  // Normalized initial status
  const initialStatus = Policy.VALID_STATUSES.includes(status?.toLowerCase()) ? status.toLowerCase() : 'draft';

  const policy = await Policy.create({
    name: name.trim(),
    description: description.trim(),
    category: category ? category.trim() : 'Data Protection',
    ownerId: assignedOwnerId,
    owner: owner || (req.user ? req.user.name : 'Data Steward'),
    status: initialStatus,
    priority,
    severity,
    scope: scope || 'Application-level governance policy; applies to RicozData metadata and catalog resources.',
    appliesTo: appliesTo || (validDatasetIds.length > 0 ? `${validDatasetIds.length} Linked Datasets` : 'All Datasets'),
    datasetIds: validDatasetIds,
    columnReferences: validColumnRefs,
    glossaryTermIds: validGlossaryIds,
    complianceFrameworks: Array.isArray(complianceFrameworks) ? complianceFrameworks : ['GDPR'],
    reviewFrequency,
    effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
    nextReview: nextReview ? new Date(nextReview) : undefined,
    version: 1,
    versionHistory: [
      {
        version: 1,
        changedBy: req.user ? req.user._id : assignedOwnerId,
        changedAt: new Date(),
        changeNotes: 'Initial policy creation',
      },
    ],
    createdBy: req.user ? req.user._id : assignedOwnerId,
    updatedBy: req.user ? req.user._id : assignedOwnerId,
  });

  // Maintain bidirectional link on Datasets
  if (validDatasetIds.length > 0) {
    await Dataset.updateMany(
      { _id: { $in: validDatasetIds } },
      { $addToSet: { policyIds: policy._id } }
    );
  }

  // Log Activity for audit trail
  try {
    await Activity.create({
      title: `Created governance policy: "${policy.name}"`,
      type: 'policy',
      actorId: req.user ? req.user._id : assignedOwnerId,
      policyId: policy._id,
      metadata: {
        action: 'POLICY_CREATED',
        policyName: policy.name,
        category: policy.category,
        status: policy.status,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  const populated = await Policy.findById(policy._id)
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('datasetIds', 'name tableName')
    .populate('glossaryTermIds', 'term definition');

  res.status(201).json({
    success: true,
    data: {
      ...populated.toObject(),
      id: populated._id.toString(),
      owner: populated.ownerId ? populated.ownerId.name : populated.owner,
    },
  });
});

/**
 * @desc    Update existing governance policy (with versioning & transition safety)
 * @route   PUT /api/policies/:id
 * @access  Private (POLICY_UPDATE)
 */
const updatePolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid policy ID format' });
  }

  const policy = await Policy.findById(id);
  if (!policy) {
    return res.status(404).json({ success: false, message: 'Policy not found' });
  }

  const {
    name,
    description,
    category,
    ownerId,
    owner,
    status,
    priority,
    severity,
    scope,
    appliesTo,
    datasetIds,
    columnReferences,
    glossaryTermIds,
    complianceFrameworks,
    reviewFrequency,
    effectiveDate,
    nextReview,
    changeNotes,
  } = req.body;

  // Snapshot before modifications for version history
  const previousSnapshot = {
    name: policy.name,
    description: policy.description,
    category: policy.category,
    status: policy.status,
    version: policy.version,
    updatedAt: policy.updatedAt,
  };

  // Validate status transition if requested
  if (status && status !== policy.status) {
    const nextStatus = status.toLowerCase().replace(/[\s-]/g, '_');
    if (!policy.canTransitionTo(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from "${policy.status}" to "${nextStatus}". Allowed transitions: ${
          (Policy.VALID_TRANSITIONS[policy.status] || []).join(', ') || 'None'
        }`,
      });
    }

    // Role check for activating a policy (only STEWARD, ADMIN, SUPER_ADMIN)
    if (nextStatus === 'active') {
      const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DATA_STEWARD];
      if (req.user && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only Data Stewards and Administrators are authorized to activate policies',
        });
      }
      policy.approvedBy = req.user._id;
      policy.approvedAt = new Date();
    }

    policy.status = nextStatus;
  }

  // Apply whitelisted updates
  if (name && name.trim().length >= 3) policy.name = name.trim();
  if (description && description.trim().length >= 10) policy.description = description.trim();
  if (category) policy.category = category.trim();
  if (priority) policy.priority = priority;
  if (severity) policy.severity = severity;
  if (scope) policy.scope = scope;
  if (appliesTo) policy.appliesTo = appliesTo;
  if (reviewFrequency) policy.reviewFrequency = reviewFrequency;
  if (effectiveDate) policy.effectiveDate = new Date(effectiveDate);
  if (nextReview) policy.nextReview = new Date(nextReview);
  if (owner) policy.owner = owner;

  if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
    policy.ownerId = ownerId;
  }

  if (Array.isArray(complianceFrameworks)) {
    policy.complianceFrameworks = complianceFrameworks;
    policy.compliance = complianceFrameworks.join(', ');
  }

  // Handle datasetIds relationships
  if (Array.isArray(datasetIds)) {
    const previousDatasetIds = policy.datasetIds.map((d) => d.toString());
    const validDatasetIds = [];
    for (const dsId of datasetIds) {
      if (mongoose.Types.ObjectId.isValid(dsId)) {
        const exists = await Dataset.exists({ _id: dsId });
        if (exists) validDatasetIds.push(dsId);
      }
    }
    policy.datasetIds = validDatasetIds;

    // Remove policyId from datasets no longer associated
    const removedIds = previousDatasetIds.filter((pId) => !validDatasetIds.includes(pId));
    if (removedIds.length > 0) {
      await Dataset.updateMany(
        { _id: { $in: removedIds } },
        { $pull: { policyIds: policy._id } }
      );
    }
    // Add policyId to newly associated datasets
    if (validDatasetIds.length > 0) {
      await Dataset.updateMany(
        { _id: { $in: validDatasetIds } },
        { $addToSet: { policyIds: policy._id } }
      );
    }
  }

  // Handle columnReferences
  if (Array.isArray(columnReferences)) {
    policy.columnReferences = columnReferences.filter(
      (c) => c && c.datasetId && mongoose.Types.ObjectId.isValid(c.datasetId) && c.columnName
    );
  }

  // Handle glossaryTermIds
  if (Array.isArray(glossaryTermIds)) {
    const validGlossaryIds = [];
    for (const gId of glossaryTermIds) {
      if (mongoose.Types.ObjectId.isValid(gId)) {
        const exists = await GlossaryTerm.exists({ _id: gId });
        if (exists) validGlossaryIds.push(gId);
      }
    }
    policy.glossaryTermIds = validGlossaryIds;
  }

  // Advance version and record history
  policy.version = (policy.version || 1) + 1;
  policy.updatedBy = req.user ? req.user._id : policy.ownerId;
  policy.lastReviewed = new Date();

  policy.versionHistory.push({
    version: policy.version,
    changedBy: req.user ? req.user._id : policy.ownerId,
    changedAt: new Date(),
    changeNotes: changeNotes || 'Policy updated via governance console',
    snapshot: previousSnapshot,
  });

  await policy.save();

  // Audit activity log
  try {
    await Activity.create({
      title: `Updated policy: "${policy.name}" (v${policy.version})`,
      type: 'policy',
      actorId: req.user ? req.user._id : policy.ownerId,
      policyId: policy._id,
      metadata: {
        action: 'POLICY_UPDATED',
        version: policy.version,
        status: policy.status,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  const updated = await Policy.findById(policy._id)
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('datasetIds', 'name tableName schemaName')
    .populate('glossaryTermIds', 'term definition')
    .populate('ruleIds', 'name category ruleType severity status');

  res.json({
    success: true,
    data: {
      ...updated.toObject(),
      id: updated._id.toString(),
      owner: updated.ownerId ? updated.ownerId.name : updated.owner,
    },
  });
});

/**
 * @desc    Explicit lifecycle transition for a policy
 * @route   PUT /api/policies/:id/transition
 * @access  Private (POLICY_UPDATE)
 */
const transitionPolicyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { targetStatus, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid policy ID format' });
  }

  if (!targetStatus) {
    return res.status(400).json({ success: false, message: 'Target status is required' });
  }

  const nextStatus = targetStatus.toLowerCase().replace(/[\s-]/g, '_');
  const policy = await Policy.findById(id);

  if (!policy) {
    return res.status(404).json({ success: false, message: 'Policy not found' });
  }

  if (!policy.canTransitionTo(nextStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid transition from "${policy.status}" to "${nextStatus}". Permitted transitions: ${
        (Policy.VALID_TRANSITIONS[policy.status] || []).join(', ') || 'None'
      }`,
    });
  }

  // Authorization gate for activation
  if (nextStatus === 'active') {
    const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DATA_STEWARD];
    if (req.user && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only Data Stewards and Administrators are authorized to activate policies',
      });
    }
    policy.approvedBy = req.user._id;
    policy.approvedAt = new Date();
  }

  const previousStatus = policy.status;
  policy.status = nextStatus;
  policy.version = (policy.version || 1) + 1;
  policy.updatedBy = req.user ? req.user._id : policy.ownerId;

  policy.versionHistory.push({
    version: policy.version,
    changedBy: req.user ? req.user._id : policy.ownerId,
    changedAt: new Date(),
    changeNotes: `Lifecycle transition: ${previousStatus} -> ${nextStatus}. Reason: ${reason || 'N/A'}`,
  });

  await policy.save();

  // Audit Activity
  try {
    await Activity.create({
      title: `Policy status transitioned: "${policy.name}" is now ${nextStatus.toUpperCase()}`,
      type: 'policy',
      actorId: req.user ? req.user._id : policy.ownerId,
      policyId: policy._id,
      metadata: {
        action: 'POLICY_STATUS_TRANSITION',
        previousStatus,
        nextStatus,
        reason,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  res.json({
    success: true,
    data: {
      ...policy.toObject(),
      id: policy._id.toString(),
    },
  });
});

/**
 * @desc    Toggle policy status (legacy compatibility helper)
 * @route   PUT /api/policies/:id/toggle
 * @access  Private (POLICY_UPDATE)
 */
const togglePolicyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid policy ID format' });
  }

  const policy = await Policy.findById(id);
  if (!policy) {
    return res.status(404).json({ success: false, message: 'Policy not found' });
  }

  // Toggle between active and deprecated/draft safely
  const nextStatus = policy.status === 'active' ? 'deprecated' : 'active';

  if (nextStatus === 'active') {
    policy.approvedBy = req.user ? req.user._id : policy.ownerId;
    policy.approvedAt = new Date();
  }

  policy.status = nextStatus;
  policy.updatedBy = req.user ? req.user._id : policy.ownerId;
  await policy.save();

  res.json({
    success: true,
    data: {
      ...policy.toObject(),
      id: policy._id.toString(),
    },
  });
});

/**
 * @desc    Delete policy (with relationship cleanup & audit logging)
 * @route   DELETE /api/policies/:id
 * @access  Private (POLICY_DELETE)
 */
const deletePolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid policy ID format' });
  }

  const policy = await Policy.findById(id);
  if (!policy) {
    return res.status(404).json({ success: false, message: 'Policy not found' });
  }

  // Remove policy ID reference from all datasets
  await Dataset.updateMany(
    { policyIds: policy._id },
    { $pull: { policyIds: policy._id } }
  );

  await Policy.findByIdAndDelete(id);

  // Audit activity log
  try {
    await Activity.create({
      title: `Deleted governance policy: "${policy.name}"`,
      type: 'policy',
      actorId: req.user ? req.user._id : null,
      metadata: {
        action: 'POLICY_DELETED',
        deletedPolicyName: policy.name,
        category: policy.category,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging error:', actErr.message);
  }

  res.json({
    success: true,
    message: `Policy "${policy.name}" was permanently removed`,
  });
});

module.exports = {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  transitionPolicyStatus,
  deletePolicy,
  togglePolicyStatus,
};