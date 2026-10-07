const mongoose = require('mongoose');
const GlossaryTerm = require('../models/GlossaryTerm');
const Dataset = require('../models/Dataset');
const Domain = require('../models/Domain');
const User = require('../models/User');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isValidObjectId = (id) => {
  return Boolean(id) && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

const ALLOWED_STATUSES = ['draft', 'approved', 'deprecated', 'archived', 'active'];
const SORTABLE_FIELDS = ['term', 'definition', 'domain', 'status', 'usageCount', 'createdAt', 'updatedAt'];

// Helper to normalize and sanitize string arrays
const sanitizeStringArray = (arr, maxItems = 50, maxItemLength = 500) => {
  if (!arr) return [];
  const rawList = Array.isArray(arr)
    ? arr
    : typeof arr === 'string'
      ? arr.split(',').map((s) => s.trim())
      : [];

  const sanitized = [];
  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed.length > 0 && trimmed.length <= maxItemLength) {
      if (!sanitized.includes(trimmed)) {
        sanitized.push(trimmed);
      }
    }
    if (sanitized.length >= maxItems) break;
  }
  return sanitized;
};

// @desc    Get all glossary terms with search, filter, sort, and pagination
// @route   GET /api/glossary
// @access  Private (GLOSSARY_READ)
const getGlossary = asyncHandler(async (req, res) => {
  const {
    search,
    domain,
    domainId,
    status,
    tags,
    ownerId,
    page = 1,
    limit = 20,
    sortBy = 'term',
    sortOrder = 'asc',
  } = req.query;

  const filter = {};

  // Case-insensitive search across term, definition, synonyms, tags
  if (search && typeof search === 'string' && search.trim()) {
    const safeRegex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [
      { term: safeRegex },
      { definition: safeRegex },
      { synonyms: safeRegex },
      { tags: safeRegex },
    ];
  }

  // Domain filtering
  if (domain && typeof domain === 'string' && domain.trim() && domain !== 'All Domains') {
    filter.domain = domain.trim();
  }

  if (domainId) {
    if (!isValidObjectId(domainId)) {
      return res.status(400).json({ success: false, message: 'Invalid domainId format' });
    }
    filter.domainId = domainId;
  }

  // Status filtering
  if (status && typeof status === 'string' && status.trim() && status !== 'All Statuses') {
    filter.status = status.trim().toLowerCase();
  }

  // Owner filtering
  if (ownerId) {
    if (!isValidObjectId(ownerId)) {
      return res.status(400).json({ success: false, message: 'Invalid ownerId format' });
    }
    filter.ownerId = ownerId;
  }

  // Tag filtering
  if (tags) {
    const tagList = Array.isArray(tags) ? tags : [tags];
    filter.tags = { $in: tagList };
  }

  // Controlled, whitelisted sorting
  const safeSortField = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'term';
  const sortDirection = String(sortOrder).toLowerCase() === 'desc' ? -1 : 1;
  const sortOptions = { [safeSortField]: sortDirection };
  if (safeSortField !== 'term') {
    sortOptions.term = 1; // Secondary stable sort
  }

  // Safe pagination limits
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [total, items] = await Promise.all([
    GlossaryTerm.countDocuments(filter),
    GlossaryTerm.find(filter)
      .populate('domainId', 'name description')
      .populate('ownerId', 'name email avatar avatarBg')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit),
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  res.json({
    success: true,
    data: {
      items,
      terms: items, // Alias for backward compatibility
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: totalPages,
      },
    },
  });
});

// @desc    Get single glossary term with detailed semantic and catalog connections
// @route   GET /api/glossary/:id
// @access  Private (GLOSSARY_READ)
const getGlossaryTerm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid glossary term ID' });
  }

  const term = await GlossaryTerm.findById(id)
    .populate('domainId', 'name description')
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('approvedBy', 'name email')
    .populate('relatedTermIds', 'term definition domain status');

  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  // Resolve related datasets
  const relatedDatasets = await Dataset.find({
    _id: { $in: term.relatedDatasetIds || [] },
  }).select('name displayName description domain qualityScore quality certificationStatus columns source sourceSystem');

  // Resolve related columns with dataset context
  const resolvedColumns = [];
  if (Array.isArray(term.relatedColumnRefs)) {
    for (const ref of term.relatedColumnRefs) {
      const ds = relatedDatasets.find((d) => d._id.toString() === ref.datasetId.toString()) ||
        await Dataset.findById(ref.datasetId).select('name columns');

      if (ds && Array.isArray(ds.columns)) {
        const col = ds.columns.find((c) => c._id.toString() === ref.columnId.toString());
        if (col) {
          resolvedColumns.push({
            datasetId: ds._id,
            datasetName: ds.name,
            columnId: col._id,
            columnName: col.name,
            type: col.type,
            description: col.description || col.businessMeaning || '',
            sensitivity: col.sensitivity,
            pii: col.pii,
          });
        }
      }
    }
  }

  res.json({
    success: true,
    data: {
      ...term.toObject(),
      relatedDatasets,
      relatedColumns: resolvedColumns,
      relatedTerms: term.relatedTermIds || [],
    },
  });
});

// @desc    Create glossary term
// @route   POST /api/glossary
// @access  Private (GLOSSARY_CREATE)
const createGlossaryTerm = asyncHandler(async (req, res) => {
  const {
    term,
    definition,
    domainId,
    domain,
    ownerId,
    owner,
    status = 'draft',
    synonyms,
    tags,
    examples,
    businessRules,
    relatedDatasetIds,
    relatedTermIds,
    relatedColumnRefs,
  } = req.body;

  // Validation: term
  if (!term || typeof term !== 'string' || term.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Term is required and must be at least 2 characters',
    });
  }
  if (term.trim().length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Term must not exceed 200 characters',
    });
  }

  // Duplicate check (case-insensitive & normalized equivalent)
  const cleanTerm = term.trim();
  const normalizedKey = cleanTerm.toLowerCase().replace(/[\-_]/g, ' ').replace(/\s+/g, ' ');

  let existingTerm = await GlossaryTerm.findOne({
    term: { $regex: `^${escapeRegex(cleanTerm)}$`, $options: 'i' },
  });

  if (!existingTerm) {
    const allTerms = await GlossaryTerm.find({}).select('term synonyms').lean();
    for (const t of allTerms) {
      const existingNorm = (t.term || '').toLowerCase().replace(/[\-_]/g, ' ').replace(/\s+/g, ' ');
      if (existingNorm === normalizedKey) {
        existingTerm = t;
        break;
      }
      if (Array.isArray(t.synonyms)) {
        for (const syn of t.synonyms) {
          const synNorm = String(syn || '').toLowerCase().replace(/[\-_]/g, ' ').replace(/\s+/g, ' ');
          if (synNorm === normalizedKey) {
            existingTerm = t;
            break;
          }
        }
        if (existingTerm) break;
      }
    }
  }

  if (existingTerm) {
    return res.status(409).json({
      success: false,
      message: `A glossary term or synonym representing "${cleanTerm}" already exists ("${existingTerm.term}")`,
      error: { code: 'DUPLICATE_TERM', message: 'Term already exists' }
    });
  }

  // Validation: definition
  if (!definition || typeof definition !== 'string' || definition.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Definition is required and must be at least 10 characters',
    });
  }
  if (definition.trim().length > 5000) {
    return res.status(400).json({
      success: false,
      message: 'Definition must not exceed 5000 characters',
    });
  }

  // Validation: domainId
  let resolvedDomainName = domain ? domain.trim() : 'Customer Data';
  let resolvedDomainId = null;
  if (domainId) {
    if (!isValidObjectId(domainId)) {
      return res.status(400).json({ success: false, message: 'Invalid domainId format' });
    }
    const domainDoc = await Domain.findById(domainId);
    if (!domainDoc) {
      return res.status(400).json({ success: false, message: 'Referenced domain does not exist' });
    }
    resolvedDomainId = domainDoc._id;
    resolvedDomainName = domainDoc.name;
  }

  // Validation: ownerId
  let resolvedOwnerName = owner ? owner.trim() : (req.user ? req.user.name : 'Data Governance Team');
  let resolvedOwnerId = null;
  if (ownerId) {
    if (!isValidObjectId(ownerId)) {
      return res.status(400).json({ success: false, message: 'Invalid ownerId format' });
    }
    const userDoc = await User.findById(ownerId);
    if (!userDoc) {
      return res.status(400).json({ success: false, message: 'Referenced owner does not exist' });
    }
    resolvedOwnerId = userDoc._id;
    resolvedOwnerName = userDoc.name;
  } else if (req.user && req.user._id) {
    resolvedOwnerId = req.user._id;
  }

  // Validation: status
  const normalizedStatus = String(status).toLowerCase();
  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
    });
  }

  // Validation: relatedDatasetIds
  const validatedDatasetIds = [];
  if (Array.isArray(relatedDatasetIds) && relatedDatasetIds.length > 0) {
    for (const dId of relatedDatasetIds) {
      if (!isValidObjectId(dId)) {
        return res.status(400).json({ success: false, message: `Invalid dataset ID: ${dId}` });
      }
      const dsExists = await Dataset.exists({ _id: dId });
      if (!dsExists) {
        return res.status(400).json({ success: false, message: `Referenced dataset does not exist: ${dId}` });
      }
      if (!validatedDatasetIds.some((id) => id.toString() === dId.toString())) {
        validatedDatasetIds.push(dId);
      }
    }
  }

  // Validation: relatedTermIds
  const validatedTermIds = [];
  if (Array.isArray(relatedTermIds) && relatedTermIds.length > 0) {
    for (const tId of relatedTermIds) {
      if (!isValidObjectId(tId)) {
        return res.status(400).json({ success: false, message: `Invalid related term ID: ${tId}` });
      }
      const termExists = await GlossaryTerm.exists({ _id: tId });
      if (!termExists) {
        return res.status(400).json({ success: false, message: `Referenced glossary term does not exist: ${tId}` });
      }
      if (!validatedTermIds.some((id) => id.toString() === tId.toString())) {
        validatedTermIds.push(tId);
      }
    }
  }

  // Validation: relatedColumnRefs
  const validatedColumnRefs = [];
  if (Array.isArray(relatedColumnRefs) && relatedColumnRefs.length > 0) {
    for (const ref of relatedColumnRefs) {
      if (!ref || !isValidObjectId(ref.datasetId) || !isValidObjectId(ref.columnId)) {
        return res.status(400).json({
          success: false,
          message: 'Each column reference must have valid datasetId and columnId',
        });
      }
      const ds = await Dataset.findById(ref.datasetId);
      if (!ds) {
        return res.status(400).json({
          success: false,
          message: `Referenced dataset does not exist: ${ref.datasetId}`,
        });
      }
      const colExists = ds.columns.some((c) => c._id.toString() === ref.columnId.toString());
      if (!colExists) {
        return res.status(400).json({
          success: false,
          message: `Column ${ref.columnId} does not belong to dataset ${ds.name}`,
        });
      }
      const duplicate = validatedColumnRefs.some(
        (c) => c.datasetId.toString() === ref.datasetId.toString() && c.columnId.toString() === ref.columnId.toString()
      );
      if (!duplicate) {
        validatedColumnRefs.push({ datasetId: ref.datasetId, columnId: ref.columnId });
        if (!validatedDatasetIds.some((id) => id.toString() === ref.datasetId.toString())) {
          validatedDatasetIds.push(ref.datasetId);
        }
      }
    }
  }

  const userId = req.user ? req.user._id : null;
  const isApproved = normalizedStatus === 'approved';

  const newTerm = await GlossaryTerm.create({
    term: term.trim(),
    definition: definition.trim(),
    domainId: resolvedDomainId,
    domain: resolvedDomainName,
    ownerId: resolvedOwnerId,
    owner: resolvedOwnerName,
    status: normalizedStatus,
    synonyms: sanitizeStringArray(synonyms),
    tags: sanitizeStringArray(tags),
    examples: sanitizeStringArray(examples, 50, 1000),
    businessRules: sanitizeStringArray(businessRules, 50, 1000),
    relatedDatasetIds: validatedDatasetIds,
    relatedTermIds: validatedTermIds,
    relatedColumnRefs: validatedColumnRefs,
    createdBy: userId,
    updatedBy: userId,
    approvedBy: isApproved ? userId : null,
    approvedAt: isApproved ? new Date() : null,
  });

  // Maintain bidirectional Dataset.glossaryTermIds
  if (validatedDatasetIds.length > 0) {
    await Dataset.updateMany(
      { _id: { $in: validatedDatasetIds } },
      { $addToSet: { glossaryTermIds: newTerm._id } }
    );
  }

  // Audit Activity
  try {
    await Activity.create({
      title: `Glossary term "${newTerm.term}" created`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: newTerm._id,
      metadata: {
        action: 'CREATE',
        term: newTerm.term,
        domain: newTerm.domain,
        status: newTerm.status,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  const populated = await GlossaryTerm.findById(newTerm._id)
    .populate('domainId', 'name description')
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('approvedBy', 'name email');

  res.status(201).json({
    success: true,
    data: populated,
  });
});

// @desc    Update glossary term
// @route   PUT /api/glossary/:id
// @access  Private (GLOSSARY_UPDATE)
const updateGlossaryTerm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid glossary term ID' });
  }

  const termDoc = await GlossaryTerm.findById(id);
  if (!termDoc) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const {
    term,
    definition,
    domainId,
    domain,
    ownerId,
    owner,
    status,
    synonyms,
    tags,
    examples,
    businessRules,
    relatedDatasetIds,
    relatedTermIds,
    relatedColumnRefs,
  } = req.body;

  // Validate term if provided
  if (term !== undefined) {
    if (typeof term !== 'string' || term.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Term must be at least 2 characters',
      });
    }
    if (term.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Term must not exceed 200 characters',
      });
    }
    // Duplicate check if name changed
    if (term.trim().toLowerCase() !== termDoc.term.toLowerCase()) {
      const duplicate = await GlossaryTerm.findOne({
        _id: { $ne: termDoc._id },
        term: { $regex: `^${escapeRegex(term.trim())}$`, $options: 'i' },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: `A glossary term with the name "${term.trim()}" already exists`,
        });
      }
    }
    termDoc.term = term.trim();
  }

  // Validate definition if provided
  if (definition !== undefined) {
    if (typeof definition !== 'string' || definition.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Definition must be at least 10 characters',
      });
    }
    if (definition.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Definition must not exceed 5000 characters',
      });
    }
    termDoc.definition = definition.trim();
  }

  // Domain update
  if (domainId !== undefined) {
    if (domainId === null || domainId === '') {
      termDoc.domainId = null;
    } else {
      if (!isValidObjectId(domainId)) {
        return res.status(400).json({ success: false, message: 'Invalid domainId format' });
      }
      const domainDoc = await Domain.findById(domainId);
      if (!domainDoc) {
        return res.status(400).json({ success: false, message: 'Referenced domain does not exist' });
      }
      termDoc.domainId = domainDoc._id;
      termDoc.domain = domainDoc.name;
    }
  } else if (domain !== undefined) {
    termDoc.domain = domain.trim();
  }

  // Owner update
  if (ownerId !== undefined) {
    if (ownerId === null || ownerId === '') {
      termDoc.ownerId = null;
    } else {
      if (!isValidObjectId(ownerId)) {
        return res.status(400).json({ success: false, message: 'Invalid ownerId format' });
      }
      const userDoc = await User.findById(ownerId);
      if (!userDoc) {
        return res.status(400).json({ success: false, message: 'Referenced owner does not exist' });
      }
      termDoc.ownerId = userDoc._id;
      termDoc.owner = userDoc.name;
    }
  } else if (owner !== undefined) {
    termDoc.owner = owner.trim();
  }

  // Status update
  const userId = req.user ? req.user._id : null;
  if (status !== undefined) {
    const normalizedStatus = String(status).toLowerCase();
    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }
    if (normalizedStatus === 'approved' && termDoc.status !== 'approved') {
      termDoc.approvedBy = userId;
      termDoc.approvedAt = new Date();
    }
    termDoc.status = normalizedStatus;
  }

  if (synonyms !== undefined) termDoc.synonyms = sanitizeStringArray(synonyms);
  if (tags !== undefined) termDoc.tags = sanitizeStringArray(tags);
  if (examples !== undefined) termDoc.examples = sanitizeStringArray(examples, 50, 1000);
  if (businessRules !== undefined) termDoc.businessRules = sanitizeStringArray(businessRules, 50, 1000);

  // Sync related datasets
  if (relatedDatasetIds !== undefined) {
    const validatedDatasetIds = [];
    for (const dId of relatedDatasetIds) {
      if (!isValidObjectId(dId)) {
        return res.status(400).json({ success: false, message: `Invalid dataset ID: ${dId}` });
      }
      const dsExists = await Dataset.exists({ _id: dId });
      if (!dsExists) {
        return res.status(400).json({ success: false, message: `Referenced dataset does not exist: ${dId}` });
      }
      if (!validatedDatasetIds.some((id) => id.toString() === dId.toString())) {
        validatedDatasetIds.push(dId);
      }
    }

    const previousDatasetIds = (termDoc.relatedDatasetIds || []).map((id) => id.toString());
    const nextDatasetIds = validatedDatasetIds.map((id) => id.toString());

    const removedDatasetIds = previousDatasetIds.filter((id) => !nextDatasetIds.includes(id));
    const addedDatasetIds = nextDatasetIds.filter((id) => !previousDatasetIds.includes(id));

    if (removedDatasetIds.length > 0) {
      await Dataset.updateMany(
        { _id: { $in: removedDatasetIds } },
        { $pull: { glossaryTermIds: termDoc._id } }
      );
    }
    if (addedDatasetIds.length > 0) {
      await Dataset.updateMany(
        { _id: { $in: addedDatasetIds } },
        { $addToSet: { glossaryTermIds: termDoc._id } }
      );
    }

    termDoc.relatedDatasetIds = validatedDatasetIds;
  }

  // Related terms update
  if (relatedTermIds !== undefined) {
    const validatedTermIds = [];
    for (const tId of relatedTermIds) {
      if (!isValidObjectId(tId)) {
        return res.status(400).json({ success: false, message: `Invalid related term ID: ${tId}` });
      }
      if (tId.toString() === termDoc._id.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot relate a term to itself' });
      }
      const tExists = await GlossaryTerm.exists({ _id: tId });
      if (!tExists) {
        return res.status(400).json({ success: false, message: `Referenced term does not exist: ${tId}` });
      }
      if (!validatedTermIds.some((id) => id.toString() === tId.toString())) {
        validatedTermIds.push(tId);
      }
    }
    termDoc.relatedTermIds = validatedTermIds;
  }

  // Related column refs update
  if (relatedColumnRefs !== undefined) {
    const validatedColumnRefs = [];
    for (const ref of relatedColumnRefs) {
      if (!ref || !isValidObjectId(ref.datasetId) || !isValidObjectId(ref.columnId)) {
        return res.status(400).json({
          success: false,
          message: 'Each column reference must have valid datasetId and columnId',
        });
      }
      const ds = await Dataset.findById(ref.datasetId);
      if (!ds) {
        return res.status(400).json({ success: false, message: `Dataset not found: ${ref.datasetId}` });
      }
      const colExists = ds.columns.some((c) => c._id.toString() === ref.columnId.toString());
      if (!colExists) {
        return res.status(400).json({
          success: false,
          message: `Column ${ref.columnId} does not exist in dataset ${ds.name}`,
        });
      }
      const duplicate = validatedColumnRefs.some(
        (c) => c.datasetId.toString() === ref.datasetId.toString() && c.columnId.toString() === ref.columnId.toString()
      );
      if (!duplicate) {
        validatedColumnRefs.push({ datasetId: ref.datasetId, columnId: ref.columnId });
      }
    }
    termDoc.relatedColumnRefs = validatedColumnRefs;
  }

  termDoc.updatedBy = userId;
  termDoc.updatedAt = new Date();
  await termDoc.save();

  // Audit Activity
  try {
    await Activity.create({
      title: `Glossary term "${termDoc.term}" updated`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: termDoc._id,
      metadata: { action: 'UPDATE', term: termDoc.term },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  const populated = await GlossaryTerm.findById(termDoc._id)
    .populate('domainId', 'name description')
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('approvedBy', 'name email')
    .populate('relatedTermIds', 'term definition domain status');

  res.json({
    success: true,
    data: populated,
  });
});

// @desc    Update glossary term status
// @route   PATCH /api/glossary/:id/status
// @access  Private (GLOSSARY_UPDATE)
const updateGlossaryTermStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid glossary term ID' });
  }

  if (!status || typeof status !== 'string') {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const normalizedStatus = status.trim().toLowerCase();
  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
    });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const previousStatus = term.status;
  const userId = req.user ? req.user._id : null;

  term.status = normalizedStatus;
  term.updatedBy = userId;
  term.updatedAt = new Date();

  if (normalizedStatus === 'approved') {
    term.approvedBy = userId;
    term.approvedAt = new Date();
  }

  await term.save();

  // Audit Activity
  try {
    await Activity.create({
      title: `Glossary term "${term.term}" status changed to ${normalizedStatus}`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      metadata: {
        action: 'STATUS_CHANGE',
        term: term.term,
        status: normalizedStatus,
        previousStatus,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  const populated = await GlossaryTerm.findById(term._id)
    .populate('domainId', 'name description')
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('approvedBy', 'name email')
    .populate('updatedBy', 'name email');

  res.json({
    success: true,
    data: populated,
  });
});

// @desc    Delete glossary term
// @route   DELETE /api/glossary/:id
// @access  Private (GLOSSARY_DELETE)
const deleteGlossaryTerm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid glossary term ID' });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  // Safely clean up references in datasets
  await Dataset.updateMany(
    { glossaryTermIds: term._id },
    { $pull: { glossaryTermIds: term._id } }
  );

  // Safely clean up references in other glossary terms
  await GlossaryTerm.updateMany(
    { relatedTermIds: term._id },
    { $pull: { relatedTermIds: term._id } }
  );

  // Audit Activity before deletion
  const userId = req.user ? req.user._id : null;
  try {
    await Activity.create({
      title: `Glossary term "${term.term}" deleted`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      metadata: { action: 'DELETE', term: term.term },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  await GlossaryTerm.findByIdAndDelete(term._id);

  res.json({
    success: true,
    message: 'Glossary term removed',
  });
});

// @desc    Link dataset to glossary term
// @route   POST /api/glossary/:id/datasets/:datasetId
// @access  Private (GLOSSARY_UPDATE)
const linkDataset = asyncHandler(async (req, res) => {
  const { id, datasetId } = req.params;

  if (!isValidObjectId(id) || !isValidObjectId(datasetId)) {
    return res.status(400).json({ success: false, message: 'Invalid term or dataset ID format' });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const dataset = await Dataset.findById(datasetId);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const alreadyLinked = (term.relatedDatasetIds || []).some(
    (dId) => dId.toString() === datasetId.toString()
  );
  if (alreadyLinked) {
    return res.status(409).json({ success: false, message: 'Dataset relationship already exists' });
  }

  const userId = req.user ? req.user._id : null;

  // Update both sides
  await Promise.all([
    GlossaryTerm.findByIdAndUpdate(term._id, {
      $addToSet: { relatedDatasetIds: dataset._id },
      $set: { updatedBy: userId, updatedAt: new Date() },
    }),
    Dataset.findByIdAndUpdate(dataset._id, {
      $addToSet: { glossaryTermIds: term._id },
    }),
  ]);

  // Audit Activity
  try {
    await Activity.create({
      title: `Dataset "${dataset.name}" linked to glossary term "${term.term}"`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      datasetId: dataset._id,
      metadata: {
        action: 'DATASET_LINK',
        datasetName: dataset.name,
        term: term.term,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  const updatedTerm = await GlossaryTerm.findById(term._id)
    .populate('relatedDatasetIds', 'name displayName description domain qualityScore');

  res.json({
    success: true,
    message: 'Dataset linked successfully',
    data: updatedTerm,
  });
});

// @desc    Unlink dataset from glossary term
// @route   DELETE /api/glossary/:id/datasets/:datasetId
// @access  Private (GLOSSARY_UPDATE)
const unlinkDataset = asyncHandler(async (req, res) => {
  const { id, datasetId } = req.params;

  if (!isValidObjectId(id) || !isValidObjectId(datasetId)) {
    return res.status(400).json({ success: false, message: 'Invalid term or dataset ID format' });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const userId = req.user ? req.user._id : null;

  // Remove dataset from term and pull any associated columns
  await GlossaryTerm.findByIdAndUpdate(term._id, {
    $pull: {
      relatedDatasetIds: new mongoose.Types.ObjectId(datasetId),
      relatedColumnRefs: { datasetId: new mongoose.Types.ObjectId(datasetId) },
    },
    $set: { updatedBy: userId, updatedAt: new Date() },
  });

  // Remove term from dataset
  await Dataset.findByIdAndUpdate(datasetId, {
    $pull: { glossaryTermIds: term._id },
  });

  // Audit Activity
  try {
    await Activity.create({
      title: `Dataset unlinked from glossary term "${term.term}"`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      datasetId,
      metadata: { action: 'DATASET_UNLINK', term: term.term, datasetId },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  res.json({
    success: true,
    message: 'Dataset unlinked from glossary term',
  });
});

// @desc    Link column to glossary term
// @route   POST /api/glossary/:id/columns
// @access  Private (GLOSSARY_UPDATE)
const linkColumn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { datasetId, columnId } = req.body;

  if (!isValidObjectId(id) || !isValidObjectId(datasetId) || !isValidObjectId(columnId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid term ID, datasetId, and columnId are required',
    });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const dataset = await Dataset.findById(datasetId);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const column = dataset.columns.find((c) => c._id.toString() === columnId.toString());
  if (!column) {
    return res.status(400).json({
      success: false,
      message: `Column does not belong to dataset "${dataset.name}"`,
    });
  }

  const alreadyLinked = (term.relatedColumnRefs || []).some(
    (c) => c.datasetId.toString() === datasetId.toString() && c.columnId.toString() === columnId.toString()
  );
  if (alreadyLinked) {
    return res.status(409).json({ success: false, message: 'Column relationship already exists' });
  }

  const userId = req.user ? req.user._id : null;

  // Add column ref, ensure datasetId is in relatedDatasetIds, and ensure term._id in dataset.glossaryTermIds
  await Promise.all([
    GlossaryTerm.findByIdAndUpdate(term._id, {
      $push: {
        relatedColumnRefs: {
          datasetId: new mongoose.Types.ObjectId(datasetId),
          columnId: new mongoose.Types.ObjectId(columnId),
        },
      },
      $addToSet: { relatedDatasetIds: dataset._id },
      $set: { updatedBy: userId, updatedAt: new Date() },
    }),
    Dataset.findByIdAndUpdate(dataset._id, {
      $addToSet: { glossaryTermIds: term._id },
    }),
  ]);

  // Audit Activity
  try {
    await Activity.create({
      title: `Column "${column.name}" in dataset "${dataset.name}" linked to glossary term "${term.term}"`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      datasetId: dataset._id,
      metadata: {
        action: 'COLUMN_LINK',
        columnName: column.name,
        datasetName: dataset.name,
        term: term.term,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  res.json({
    success: true,
    message: 'Column linked successfully',
    data: {
      datasetId: dataset._id,
      datasetName: dataset.name,
      columnId: column._id,
      columnName: column.name,
    },
  });
});

// @desc    Unlink column from glossary term
// @route   DELETE /api/glossary/:id/columns
// @access  Private (GLOSSARY_UPDATE)
const unlinkColumn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const datasetId = req.body.datasetId || req.query.datasetId;
  const columnId = req.body.columnId || req.query.columnId;

  if (!isValidObjectId(id) || !isValidObjectId(datasetId) || !isValidObjectId(columnId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid term ID, datasetId, and columnId are required',
    });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const userId = req.user ? req.user._id : null;

  await GlossaryTerm.findByIdAndUpdate(term._id, {
    $pull: {
      relatedColumnRefs: {
        datasetId: new mongoose.Types.ObjectId(datasetId),
        columnId: new mongoose.Types.ObjectId(columnId),
      },
    },
    $set: { updatedBy: userId, updatedAt: new Date() },
  });

  // Audit Activity
  try {
    await Activity.create({
      title: `Column unlinked from glossary term "${term.term}"`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      datasetId,
      metadata: { action: 'COLUMN_UNLINK', term: term.term, columnId },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  res.json({
    success: true,
    message: 'Column unlinked from glossary term',
  });
});

// @desc    Link related business term
// @route   POST /api/glossary/:id/related-terms
// @access  Private (GLOSSARY_UPDATE)
const linkRelatedTerm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { relatedTermId } = req.body;

  if (!isValidObjectId(id) || !isValidObjectId(relatedTermId)) {
    return res.status(400).json({ success: false, message: 'Valid term ID and relatedTermId are required' });
  }

  if (id.toString() === relatedTermId.toString()) {
    return res.status(400).json({ success: false, message: 'Cannot link a term to itself' });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const targetTerm = await GlossaryTerm.findById(relatedTermId);
  if (!targetTerm) {
    return res.status(404).json({ success: false, message: 'Related glossary term not found' });
  }

  const alreadyLinked = (term.relatedTermIds || []).some(
    (tId) => tId.toString() === relatedTermId.toString()
  );
  if (alreadyLinked) {
    return res.status(409).json({ success: false, message: 'Term relationship already exists' });
  }

  const userId = req.user ? req.user._id : null;

  // Bidirectional linking
  await Promise.all([
    GlossaryTerm.findByIdAndUpdate(term._id, {
      $addToSet: { relatedTermIds: targetTerm._id },
      $set: { updatedBy: userId, updatedAt: new Date() },
    }),
    GlossaryTerm.findByIdAndUpdate(targetTerm._id, {
      $addToSet: { relatedTermIds: term._id },
      $set: { updatedBy: userId, updatedAt: new Date() },
    }),
  ]);

  // Audit Activity
  try {
    await Activity.create({
      title: `Related term "${targetTerm.term}" linked to "${term.term}"`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      metadata: {
        action: 'TERM_LINK',
        term: term.term,
        relatedTerm: targetTerm.term,
      },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  res.json({
    success: true,
    message: 'Related term linked successfully',
    data: {
      relatedTermId: targetTerm._id,
      relatedTermName: targetTerm.term,
    },
  });
});

// @desc    Unlink related business term
// @route   DELETE /api/glossary/:id/related-terms/:relatedTermId
// @access  Private (GLOSSARY_UPDATE)
const unlinkRelatedTerm = asyncHandler(async (req, res) => {
  const { id, relatedTermId } = req.params;

  if (!isValidObjectId(id) || !isValidObjectId(relatedTermId)) {
    return res.status(400).json({ success: false, message: 'Valid term ID and relatedTermId are required' });
  }

  const term = await GlossaryTerm.findById(id);
  if (!term) {
    return res.status(404).json({ success: false, message: 'Glossary term not found' });
  }

  const userId = req.user ? req.user._id : null;

  // Bidirectional unlinking
  await Promise.all([
    GlossaryTerm.findByIdAndUpdate(term._id, {
      $pull: { relatedTermIds: new mongoose.Types.ObjectId(relatedTermId) },
      $set: { updatedBy: userId, updatedAt: new Date() },
    }),
    GlossaryTerm.findByIdAndUpdate(relatedTermId, {
      $pull: { relatedTermIds: term._id },
      $set: { updatedBy: userId, updatedAt: new Date() },
    }),
  ]);

  // Audit Activity
  try {
    await Activity.create({
      title: `Related term unlinked from glossary term "${term.term}"`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: term._id,
      metadata: { action: 'TERM_UNLINK', term: term.term, relatedTermId },
    });
  } catch (actErr) {
    console.warn('Activity logging notice:', actErr.message);
  }

  res.json({
    success: true,
    message: 'Related term unlinked successfully',
  });
});

// @desc    Get glossary terms for a dataset
// @route   GET /api/glossary/dataset/:datasetId
// @access  Private (GLOSSARY_READ)
const getGlossaryTermsForDataset = asyncHandler(async (req, res) => {
  const { datasetId } = req.params;
  if (!isValidObjectId(datasetId)) {
    return res.status(400).json({ success: false, message: 'Invalid dataset ID' });
  }

  const terms = await GlossaryTerm.find({ relatedDatasetIds: datasetId })
    .populate('domainId', 'name')
    .populate('ownerId', 'name email avatar avatarBg');

  res.json({
    success: true,
    data: terms,
  });
});

module.exports = {
  getGlossary,
  getGlossaryTerm,
  createGlossaryTerm,
  updateGlossaryTerm,
  updateGlossaryTermStatus,
  deleteGlossaryTerm,
  linkDataset,
  unlinkDataset,
  linkColumn,
  unlinkColumn,
  linkRelatedTerm,
  unlinkRelatedTerm,
  getGlossaryTermsForDataset,
};