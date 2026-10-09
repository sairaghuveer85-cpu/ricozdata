const Dataset = require('../models/Dataset');
const Quality = require('../models/Quality');
const Lineage = require('../models/Lineage');
const Activity = require('../models/Activity');
const User = require('../models/User');
const DataSource = require('../models/DataSource');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all datasets with advanced search, filter, sort, pagination
// @route   GET /api/datasets
// @access  Private
const getDatasets = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;

  const search = req.query.search || '';
  const domain = req.query.domain;
  const sourceSystem = req.query.sourceSystem;
  const sourceType = req.query.sourceType;
  const status = req.query.status;
  const sensitivity = req.query.sensitivity;
  const classification = req.query.classification;
  const certificationStatus = req.query.certificationStatus;
  const qualityStatus = req.query.qualityStatus;
  const tags = req.query.tags;
  const owner = req.query.owner;
  const steward = req.query.steward;
  const myFavorites = req.query.myFavorites === 'true' || req.query.myFavorites ? req.user._id : null;
  const sortBy = req.query.sortBy || 'updatedAt';
  const sortOrder = req.query.sortOrder || 'desc';

  const filter = {};
  const andConditions = [];

  // Search across multiple fields
  if (search) {
    andConditions.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { businessDescription: { $regex: search, $options: 'i' } },
        { technicalDescription: { $regex: search, $options: 'i' } },
        { domain: { $regex: search, $options: 'i' } },
        { sourceSystem: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } },
        { owner: { $regex: search, $options: 'i' } },
        { steward: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ]
    });
  }

  if (domain) {
    if (Array.isArray(domain)) {
      filter.domain = { $in: domain };
    } else if (domain.includes(',')) {
      filter.domain = { $in: domain.split(',').map(d => d.trim()) };
    } else {
      filter.domain = domain;
    }
  }

  if (sourceSystem) {
    const sources = Array.isArray(sourceSystem)
      ? sourceSystem
      : sourceSystem.includes(',')
      ? sourceSystem.split(',').map(s => s.trim())
      : [sourceSystem];
    andConditions.push({
      $or: [
        { sourceSystem: { $in: sources } },
        { source: { $in: sources } }
      ]
    });
  }

  if (sourceType) filter.sourceType = sourceType;
  if (status) filter.status = status;

  if (sensitivity) {
    if (Array.isArray(sensitivity)) {
      filter.sensitivity = { $in: sensitivity };
    } else if (sensitivity.includes(',')) {
      filter.sensitivity = { $in: sensitivity.split(',').map(s => s.trim()) };
    } else {
      filter.sensitivity = sensitivity;
    }
  }

  if (classification) filter.classification = classification;

  if (certificationStatus) {
    if (Array.isArray(certificationStatus)) {
      filter.certificationStatus = { $in: certificationStatus };
    } else if (certificationStatus.includes(',')) {
      filter.certificationStatus = { $in: certificationStatus.split(',').map(c => c.trim()) };
    } else {
      filter.certificationStatus = certificationStatus;
    }
  }

  if (qualityStatus) filter.qualityStatus = qualityStatus;

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    filter.tags = { $in: tagArray };
  }

  if (owner) filter.owner = { $regex: owner, $options: 'i' };
  if (steward) filter.steward = { $regex: steward, $options: 'i' };
  if (myFavorites) filter.favoriteIds = myFavorites;

  if (req.user?.organizationId) {
    andConditions.push({ organizationId: req.user.organizationId });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  const sortOptions = {};
  switch (sortBy) {
    case 'name': sortOptions.name = sortOrder === 'desc' ? -1 : 1; break;
    case 'popularity': sortOptions.popularity = sortOrder === 'desc' ? -1 : 1; break;
    case 'views': sortOptions.viewCount = sortOrder === 'desc' ? -1 : 1; break;
    case 'favorites': sortOptions.favoriteCount = sortOrder === 'desc' ? -1 : 1; break;
    case 'quality': sortOptions.qualityScore = sortOrder === 'desc' ? -1 : 1; break;
    case 'rowCount': sortOptions.rowCount = sortOrder === 'desc' ? -1 : 1; break;
    case 'createdAt': sortOptions.createdAt = sortOrder === 'desc' ? -1 : 1; break;
    case 'updatedAt':
    default: sortOptions.updatedAt = sortOrder === 'desc' ? -1 : 1; break;
  }

  const datasets = await Dataset.find(filter)
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('stewardId', 'name email avatar avatarBg')
    .populate('domainId', 'name')
    .populate('dataSourceId', 'name type database schema environment status')
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  const total = await Dataset.countDocuments(filter);

  // Quality enrichment
  const datasetIds = datasets.map(d => d._id);
  const qualityData = await Quality.find({ datasetId: { $in: datasetIds } });
  const qualityMap = {};
  qualityData.forEach(q => { qualityMap[q.datasetId.toString()] = q; });

  const datasetsWithQuality = datasets.map(dataset => {
    const quality = qualityMap[dataset._id.toString()];
    const isFavorited = dataset.favoriteIds && dataset.favoriteIds.some(fid => fid.toString() === req.user._id.toString());
    const obj = dataset.toObject();
    const cols = (obj.schema && obj.schema.length > 0) ? obj.schema : ((obj.columns && obj.columns.length > 0) ? obj.columns : []);
    const columnsCount = cols.length;
    const viewsCount = typeof obj.views === 'number' ? obj.views : (typeof obj.viewCount === 'number' ? obj.viewCount : 0);
    const isQualityAssessed = quality
      ? (quality.grade !== 'Not Assessed' && quality.status !== 'NOT_ASSESSED')
      : Boolean(dataset.lastQualityCheck && dataset.qualityScore !== null && dataset.qualityScore !== undefined);
    const resolvedQuality = isQualityAssessed
      ? (quality ? quality.score : dataset.qualityScore)
      : null;
    const resolvedQualityStatus = isQualityAssessed
      ? (quality?.grade || dataset.qualityStatus || (resolvedQuality >= 80 ? 'Healthy' : resolvedQuality >= 50 ? 'Warning' : 'Critical'))
      : 'Not Assessed';

    return {
      ...obj,
      id: dataset._id,
      schema: cols,
      columns: cols,
      columnsCount,
      views: viewsCount,
      viewCount: viewsCount,
      usage: `${viewsCount} views`,
      quality: resolvedQuality,
      qualityScore: resolvedQuality,
      qualityStatus: resolvedQualityStatus,
      notAssessed: !isQualityAssessed,
      issueCount: quality ? (dataset.issueCount || quality.totalRulesCount - quality.passedRulesCount) : dataset.issueCount || 0,
      owner: dataset.ownerId ? dataset.ownerId.name : dataset.owner,
      steward: dataset.stewardId ? dataset.stewardId.name : dataset.steward,
      domain: dataset.domainId ? dataset.domainId.name : dataset.domain,
      source: dataset.dataSourceId ? dataset.dataSourceId.name : (dataset.source || dataset.sourceSystem),
      sourceType: dataset.dataSourceId ? dataset.dataSourceId.type : dataset.sourceType,
      isFavorited,
    };
  });

  // Quality is stored in a separate Quality collection, so sort by it in JS
  if (sortBy === 'quality') {
    const dir = sortOrder === 'desc' ? -1 : 1;
    datasetsWithQuality.sort((a, b) => dir * ((a.qualityScore || 0) - (b.qualityScore || 0)));
  }

  const pages = Math.ceil(total / limit) || 1;

  res.json({
    success: true,
    total,
    page,
    limit,
    pages,
    data: {
      datasets: datasetsWithQuality,
      total,
      page,
      limit,
      pages,
      hasNextPage: page < pages,
      hasPreviousPage: page > 1,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNextPage: page < pages,
        hasPreviousPage: page > 1,
      },
    },
  });
});

// @desc    Get single dataset with full metadata
// @route   GET /api/datasets/:id
// @access  Private
const getDataset = asyncHandler(async (req, res) => {
  const shouldTrackView = req.query.trackView !== 'false';

  let dataset = await Dataset.findById(req.params.id)
    .populate('dataSourceId', 'name type database schema environment status')
    .populate('ownerId', 'name email avatar avatarBg')
    .populate('stewardId', 'name email avatar avatarBg')
    .populate('domainId', 'name')
    .populate('policyIds', 'name description')
    .populate('glossaryTermIds', 'term');

  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  // Workspace isolation check
  if (req.user?.organizationId && dataset.organizationId && !dataset.organizationId.equals(req.user.organizationId) && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'You do not have permission to view datasets from another workspace.' });
  }

  // Atomically increment views count when viewed
  if (shouldTrackView) {
    dataset = await Dataset.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { viewCount: 1, views: 1 },
        $set: { lastAccessedAt: new Date() }
      },
      { new: true }
    )
      .populate('dataSourceId', 'name type database schema environment status')
      .populate('ownerId', 'name email avatar avatarBg')
      .populate('stewardId', 'name email avatar avatarBg')
      .populate('domainId', 'name')
      .populate('policyIds', 'name description')
      .populate('glossaryTermIds', 'term');

    // Create activity record for viewing dataset if user is authenticated
    if (req.user) {
      try {
        await Activity.create({
          title: `Viewed dataset ${dataset.name}`,
          type: 'access',
          actorId: req.user._id,
          datasetId: dataset._id,
          timestamp: new Date(),
          metadata: {
            action: 'VIEW_DATASET',
            datasetId: dataset._id,
            datasetName: dataset.name,
            actorName: req.user.name,
            actorEmail: req.user.email,
          }
        });
      } catch (err) {
        console.warn('Failed to record dataset view activity:', err.message);
      }
    }
  }

  const quality = await Quality.findOne({ datasetId: dataset._id });

  // Related datasets: same domain, same source, shared glossary terms, shared tags
  const relatedQuery = {
    _id: { $ne: dataset._id },
    $or: [
      { domain: dataset.domain },
      { sourceSystem: dataset.sourceSystem },
      { source: dataset.source },
      { glossaryTermIds: { $in: dataset.glossaryTermIds || [] } },
      { tags: { $in: dataset.tags || [] } },
    ]
  };
  const relatedDatasets = await Dataset.find(relatedQuery)
    .populate('ownerId', 'name')
    .populate('domainId', 'name')
    .limit(8)
    .select('name description domain owner qualityScore certificationStatus status tags source sourceSystem');

  // Annotate related datasets with relationship reasons
  const relatedWithReason = relatedDatasets.map(r => {
    const reasons = [];
    if (r.domain === dataset.domain) reasons.push('Same domain');
    if ((r.sourceSystem && r.sourceSystem === dataset.sourceSystem) || (r.source && r.source === dataset.source)) reasons.push('Shares source');
    const sharedTerms = (r.glossaryTermIds || []).filter(t => (dataset.glossaryTermIds || []).includes(t));
    if (sharedTerms.length > 0) reasons.push('Shared glossary');
    const sharedTags = (r.tags || []).filter(t => (dataset.tags || []).includes(t));
    if (sharedTags.length > 0 && !reasons.includes('Shared glossary')) reasons.push('Shared tags');
    return { ...r.toObject(), id: r._id, relationshipReasons: reasons };
  });

  // Dataset activity from Activity collection
  const activity = await Activity.find({
    $or: [
      { datasetId: dataset._id },
      { 'metadata.datasetId': dataset._id }
    ]
  })
    .populate('actorId', 'name avatar avatarBg')
    .sort({ createdAt: -1 })
    .limit(20);

  const isFavorited = dataset.favoriteIds && dataset.favoriteIds.some(fid => fid.toString() === req.user._id.toString());
  const obj = dataset.toObject();

  const cols = (obj.schema && obj.schema.length > 0) ? obj.schema : ((obj.columns && obj.columns.length > 0) ? obj.columns : []);
  const columnsCount = cols.length;
  const viewsCount = typeof obj.views === 'number' ? obj.views : (typeof obj.viewCount === 'number' ? obj.viewCount : 0);
  const isQualityAssessed = quality
    ? (quality.grade !== 'Not Assessed' && quality.status !== 'NOT_ASSESSED')
    : Boolean(dataset.lastQualityCheck && dataset.qualityScore !== null && dataset.qualityScore !== undefined);
  const resolvedQuality = isQualityAssessed
    ? (quality ? quality.score : dataset.qualityScore)
    : null;
  const resolvedQualityStatus = isQualityAssessed
    ? (quality?.grade || dataset.qualityStatus || (resolvedQuality >= 80 ? 'Healthy' : resolvedQuality >= 50 ? 'Warning' : 'Critical'))
    : 'Not Assessed';

  res.json({
    success: true,
    data: {
      ...obj,
      id: dataset._id,
      schema: cols,
      columns: cols,
      columnsCount,
      views: viewsCount,
      viewCount: viewsCount,
      usage: `${viewsCount} views`,
      quality: resolvedQuality,
      qualityScore: resolvedQuality,
      qualityStatus: resolvedQualityStatus,
      notAssessed: !isQualityAssessed,
      issueCount: quality ? (dataset.issueCount || quality.totalRulesCount - quality.passedRulesCount) : dataset.issueCount || 0,
      owner: dataset.ownerId ? dataset.ownerId.name : dataset.owner,
      steward: dataset.stewardId ? dataset.stewardId.name : dataset.steward,
      domain: dataset.domainId ? dataset.domainId.name : dataset.domain,
      source: dataset.dataSourceId ? dataset.dataSourceId.name : (dataset.source || dataset.sourceSystem),
      sourceType: dataset.dataSourceId ? dataset.dataSourceId.type : dataset.sourceType,
      isFavorited,
      relatedDatasets: relatedWithReason,
      related: relatedWithReason,
      activity,
      qualityDetails: quality,
    },
    related: relatedWithReason,
    activity,
  });
});

// @desc    Create dataset
// @route   POST /api/datasets
// @access  Private
const createDataset = asyncHandler(async (req, res) => {
  const {
    name, description, displayName, businessDescription, technicalDescription,
    owner, ownerId, steward, stewardId, technicalOwner,
    domain, domainId, sourceSystem, sourceType, environment, connection,
    sensitivity, classification, tags, status, source, sourceDetails,
    rowCount, size, refreshFrequency, documentation, schema, columns
  } = req.body;

  const dataset = await Dataset.create({
    name,
    displayName: displayName || name,
    description,
    businessDescription,
    technicalDescription,
    owner: owner || req.user.name,
    ownerId: ownerId || req.user._id,
    steward,
    stewardId,
    technicalOwner,
    domain: domain || 'Customer',
    domainId,
    sourceSystem: sourceSystem || source || 'PostgreSQL',
    sourceType: sourceType || 'Warehouse',
    environment: environment || 'Production',
    connection,
    sensitivity: sensitivity || 'Internal',
    classification: classification || 'Operational',
    tags: tags || [],
    status: status || 'active',
    source: source || sourceSystem || 'PostgreSQL',
    sourceDetails,
    rowCount: rowCount || '0',
    size: size || '0 GB',
    refreshFrequency: refreshFrequency || 'Daily',
    documentation,
    columns: schema || columns || [],
    certificationStatus: 'Not Certified',
    qualityScore: 85,
    organizationId: req.user?.organizationId,
  });

  await Activity.create({
    title: `Dataset "${dataset.name}" registered in catalog`,
    type: 'dataset_created',
    actorId: req.user._id,
    organizationId: req.user?.organizationId,
    datasetId: dataset._id,
    metadata: { domain: dataset.domain, source: dataset.source },
  });

  res.status(201).json({ success: true, data: dataset });
});

// @desc    Update dataset
// @route   PUT /api/datasets/:id
// @access  Private
const updateDataset = asyncHandler(async (req, res) => {
  let dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  // Workspace isolation check
  if (req.user?.organizationId && dataset.organizationId && !dataset.organizationId.equals(req.user.organizationId) && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'You do not have permission to modify datasets from another workspace.' });
  }

  const fieldsToUpdate = { ...req.body, lastUpdatedAt: Date.now() };
  if (req.body.schema) {
    fieldsToUpdate.columns = req.body.schema;
  }

  dataset = await Dataset.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  await Activity.create({
    title: `Dataset "${dataset.name}" metadata updated`,
    type: 'dataset_updated',
    actorId: req.user._id,
    organizationId: req.user?.organizationId,
    datasetId: dataset._id,
    metadata: { updatedFields: Object.keys(req.body) },
  });

  res.json({ success: true, data: dataset });
});

// @desc    Delete dataset
// @route   DELETE /api/datasets/:id
// @access  Private
const deleteDataset = asyncHandler(async (req, res) => {
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  // Workspace isolation check
  if (req.user?.organizationId && dataset.organizationId && !dataset.organizationId.equals(req.user.organizationId) && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'You do not have permission to delete datasets from another workspace.' });
  }

  await Dataset.findByIdAndDelete(req.params.id);

  await Activity.create({
    title: `Dataset "${dataset.name}" deleted from catalog`,
    type: 'dataset_deleted',
    actorId: req.user._id,
    organizationId: req.user?.organizationId,
    datasetId: dataset._id,
  });

  res.json({ success: true, message: 'Dataset removed' });
});

// @desc    Get dataset statistics
// @route   GET /api/datasets/stats/summary
// @access  Private
const getDatasetStats = asyncHandler(async (req, res) => {
  const total = await Dataset.countDocuments();
  const active = await Dataset.countDocuments({ status: 'active' });
  const certified = await Dataset.countDocuments({ certificationStatus: 'Certified' });
  const inReview = await Dataset.countDocuments({ certificationStatus: { $in: ['In Review', 'Under Review', 'in_review'] } });
  const deprecated = await Dataset.countDocuments({ certificationStatus: 'Deprecated' });
  const domains = await Dataset.distinct('domain');

  const qualityData = await Quality.find();
  const avgQuality = qualityData.length > 0
    ? Math.round(qualityData.reduce((sum, q) => sum + q.score, 0) / qualityData.length)
    : 85;

  const domainStats = await Dataset.aggregate([
    { $group: { _id: '$domain', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const qualityDistribution = await Dataset.aggregate([
    { $group: { _id: '$qualityStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const certificationDistribution = await Dataset.aggregate([
    { $group: { _id: '$certificationStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      total,
      totalDatasets: total,
      active,
      certified,
      certifiedDatasets: certified,
      inReview,
      inReviewDatasets: inReview,
      deprecated,
      avgQuality,
      domainCount: domains.length,
      domainStats,
      qualityDistribution,
      certificationDistribution,
    },
  });
});

// @desc    Favorite a dataset
// @route   POST /api/datasets/:id/favorite
// @access  Private
const favoriteDataset = asyncHandler(async (req, res) => {
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const userId = req.user._id;
  const existingFavorite = dataset.favoriteIds && dataset.favoriteIds.some(fid => fid.toString() === userId.toString());

  if (existingFavorite) {
    // Already favorited - unfavorite
    const updated = await Dataset.findByIdAndUpdate(req.params.id, {
      $pull: { favoriteIds: userId },
      $inc: { favoriteCount: -1 }
    }, { new: true });
    return res.json({
      success: true,
      data: {
        isFavorited: false,
        favorited: false,
        favoriteCount: Math.max(0, updated.favoriteCount || 0)
      },
      isFavorited: false,
      favorited: false,
      favoriteCount: Math.max(0, updated.favoriteCount || 0),
      message: 'Removed from favorites'
    });
  } else {
    // Add favorite
    const updated = await Dataset.findByIdAndUpdate(req.params.id, {
      $addToSet: { favoriteIds: userId },
      $inc: { favoriteCount: 1 }
    }, { new: true });
    await Activity.create({
      title: `Dataset "${dataset.name}" bookmarked as favorite`,
      type: 'favorited',
      actorId: userId,
      datasetId: dataset._id,
      metadata: { action: 'favorite' },
    });
    return res.json({
      success: true,
      data: {
        isFavorited: true,
        favorited: true,
        favoriteCount: updated.favoriteCount || 1
      },
      isFavorited: true,
      favorited: true,
      favoriteCount: updated.favoriteCount || 1,
      message: 'Added to favorites'
    });
  }
});

// @desc    Get dataset favorites
// @route   GET /api/datasets/:id/favorite
// @access  Private
const getDatasetFavorites = asyncHandler(async (req, res) => {
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const isFavorited = dataset.favoriteIds && dataset.favoriteIds.some(fid => fid.toString() === req.user._id.toString());
  res.json({
    success: true,
    data: {
      isFavorited,
      favorited: isFavorited,
      favoriteCount: dataset.favoriteCount || 0,
      favoriteIds: dataset.favoriteIds || []
    }
  });
});

// @desc    Certification workflow
// @route   PUT /api/datasets/:id/certification
// @access  Private
const certifyDataset = asyncHandler(async (req, res) => {
  const { action, status, reason, notes } = req.body;
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  // Only DATA_STEWARD, ADMIN, and SUPER_ADMIN can certify
  const userRole = req.user.role;
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'DATA_STEWARD'];
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to certify datasets.' });
  }

  let targetStatus = 'Draft';
  if (status) {
    const s = status.toLowerCase();
    if (s.includes('certif')) targetStatus = 'Certified';
    else if (s.includes('deprecat')) targetStatus = 'Deprecated';
    else if (s.includes('review')) targetStatus = 'Under Review';
    else targetStatus = 'Draft';
  } else if (action) {
    if (action === 'certify') targetStatus = 'Certified';
    else if (action === 'deprecate') targetStatus = 'Deprecated';
    else if (action === 'under_review') targetStatus = 'Under Review';
    else targetStatus = 'Draft';
  }

  if (targetStatus === 'Certified') {
    dataset.certificationStatus = 'Certified';
    dataset.certificationDate = new Date();
  } else if (targetStatus === 'Deprecated') {
    dataset.certificationStatus = 'Deprecated';
    dataset.deprecatedAt = new Date();
    dataset.deprecateReason = reason || notes || 'Superseded';
  } else if (targetStatus === 'Under Review') {
    dataset.certificationStatus = 'In Review';
  } else {
    dataset.certificationStatus = 'Not Certified';
    dataset.deprecatedAt = null;
    dataset.deprecateReason = null;
  }

  dataset.certifications.push({
    status: targetStatus,
    certifiedBy: req.user.name,
    certifiedAt: new Date(),
    certificationNotes: notes || reason || `Status changed to ${targetStatus}`
  });

  await dataset.save();

  await Activity.create({
    title: `Dataset "${dataset.name}" certification updated to ${targetStatus}`,
    type: 'certification_changed',
    actorId: req.user._id,
    datasetId: dataset._id,
    metadata: { targetStatus, reason, notes },
  });

  res.json({
    success: true,
    data: {
      certificationStatus: dataset.certificationStatus,
      certifications: dataset.certifications,
      certificationDate: dataset.certificationDate,
      deprecatedAt: dataset.deprecatedAt,
      deprecateReason: dataset.deprecateReason,
    },
    message: `Dataset certification updated to ${targetStatus}`
  });
});

// @desc    Update column metadata
// @route   PUT /api/datasets/:id/schema/:columnId
// @access  Private
const updateColumnMetadata = asyncHandler(async (req, res) => {
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const { columnId } = req.params;
  const { name, type, description, sensitivity, nullable, primaryKey, businessMeaning } = req.body;

  // Find column by name or subdocument id in dataset.columns
  let schemaField = (dataset.columns || []).find(col => col.name === columnId || (col._id && col._id.toString() === columnId));
  if (!schemaField) {
    return res.status(404).json({ success: false, message: 'Column not found in dataset schema' });
  }

  const oldValues = { ...schemaField.toObject() };

  if (name) schemaField.name = name;
  if (type) schemaField.type = type;
  if (description !== undefined) schemaField.description = description;
  if (sensitivity) schemaField.sensitivity = sensitivity;
  if (nullable !== undefined) schemaField.nullable = nullable;
  if (primaryKey !== undefined) schemaField.primaryKey = primaryKey;
  if (businessMeaning !== undefined) schemaField.businessMeaning = businessMeaning;

  await dataset.save();

  await Activity.create({
    title: `Column "${schemaField.name}" metadata updated in "${dataset.name}"`,
    type: 'schema_updated',
    actorId: req.user._id,
    datasetId: dataset._id,
    metadata: { columnName: schemaField.name, oldValues, newValues: schemaField.toObject() },
  });

  res.json({ success: true, data: { column: schemaField, dataset: dataset._id } });
});

// @desc    Get dataset activity
// @route   GET /api/datasets/:id/activity
// @access  Private
const getDatasetActivity = asyncHandler(async (req, res) => {
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const activity = await Activity.find({
    $or: [
      { datasetId: dataset._id },
      { 'metadata.datasetId': dataset._id }
    ]
  })
    .populate('actorId', 'name avatar avatarBg')
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ success: true, data: activity });
});

// @desc    Get related datasets
// @route   GET /api/datasets/:id/related
// @access  Private
const getRelatedDatasets = asyncHandler(async (req, res) => {
  const dataset = await Dataset.findById(req.params.id);
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const relatedQuery = {
    _id: { $ne: dataset._id },
    $or: [
      { domain: dataset.domain },
      { sourceSystem: dataset.sourceSystem },
      { source: dataset.source },
      { glossaryTermIds: { $in: dataset.glossaryTermIds || [] } },
      { tags: { $in: dataset.tags || [] } },
    ]
  };

  const related = await Dataset.find(relatedQuery)
    .populate('ownerId', 'name')
    .populate('domainId', 'name')
    .limit(10)
    .select('name description domain owner qualityScore certificationStatus status tags source sourceSystem');

  const relatedWithReason = related.map(r => {
    const reasons = [];
    if (r.domain === dataset.domain) reasons.push('Same domain');
    if ((r.sourceSystem && r.sourceSystem === dataset.sourceSystem) || (r.source && r.source === dataset.source)) reasons.push('Shares source');
    const sharedTerms = (r.glossaryTermIds || []).filter(t => (dataset.glossaryTermIds || []).includes(t));
    if (sharedTerms.length > 0) reasons.push('Shared glossary');
    const sharedTags = (r.tags || []).filter(t => (dataset.tags || []).includes(t));
    if (sharedTags.length > 0 && !reasons.includes('Shared glossary')) reasons.push('Shared tags');
    return { ...r.toObject(), id: r._id, relationshipReasons: reasons };
  });

  res.json({ success: true, data: relatedWithReason });
});

// @desc    Get all tags
// @route   GET /api/datasets/tags
// @access  Private
const getTags = asyncHandler(async (req, res) => {
  const tags = (await Dataset.distinct('tags')) || [];
  const validTags = tags.filter(Boolean).sort();
  res.json({ success: true, data: validTags });
});

// @desc    Get all source systems
// @route   GET /api/datasets/sources
// @access  Private
const getSources = asyncHandler(async (req, res) => {
  const sourceSystems = (await Dataset.distinct('sourceSystem')) || [];
  const sources = (await Dataset.distinct('source')) || [];
  const combined = Array.from(new Set([...sourceSystems, ...sources].filter(Boolean))).sort();
  const sourceStats = [];
  for (const s of combined) {
    const count = await Dataset.countDocuments({ $or: [{ sourceSystem: s }, { source: s }] });
    sourceStats.push({ label: s, name: s, count });
  }
  res.json({ success: true, data: sourceStats });
});

// @desc    Execute safe read-only SQL or document query against real connected data source
// @route   POST /api/datasets/:id/query
// @access  Private (DATASET_READ permission)
const executeDatasetQuery = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { query, limit = 50 } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_QUERY',
        message: 'A non-empty query string is required.',
        details: { hint: 'Please provide a valid SELECT or document query.' }
      },
      message: 'A non-empty query string is required.'
    });
  }

  // 1. Fetch Dataset from authoritative MongoDB catalog
  const dataset = await Dataset.findById(id);
  if (!dataset) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'DATASET_NOT_FOUND',
        message: `Dataset not found with ID ${id}`,
        details: { hint: 'Verify the dataset ID exists in the Enterprise Catalog.' }
      },
      message: `Dataset not found with ID ${id}`
    });
  }

  // 2. Verify DataSource connection linkage
  if (!dataset.dataSourceId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DATASET_NOT_CONNECTED',
        message: `Dataset "${dataset.name}" is not connected to an external data source.`,
        details: { hint: 'Configure a valid data source connection for this dataset.' }
      },
      message: `Dataset "${dataset.name}" is not connected to an external data source.`
    });
  }

  // 3. Fetch DataSource with envelope-encrypted credentials
  const dataSource = await DataSource.findById(dataset.dataSourceId).select('+credentials.encryptedData +credentials.keyId +credentials');
  if (!dataSource) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'DATA_SOURCE_NOT_FOUND',
        message: 'Associated data source not found.',
        details: { hint: 'The data source may have been removed or de-provisioned.' }
      },
      message: 'Associated data source not found.'
    });
  }

  // 4. Server-side result limit: strictly bounded between 1 and 50 rows
  const maxRows = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 50);

  // 5. Dynamic imports of enterprise connector architecture and security validator
  const { ConnectorFactory } = await import('../src/connectors/index.js');
  const { validateCustomSql } = await import('../src/utils/securityValidators.js');

  const sourceType = String(dataSource.type || dataset.sourceType || '').toLowerCase().trim();
  const isMongo = sourceType === 'mongodb';
  const isS3 = sourceType === 's3';

  // 6. Security validation for SQL-based sources (PostgreSQL, MySQL, SQL Server, Snowflake)
  if (!isMongo && !isS3) {
    const validation = validateCustomSql(query);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISALLOWED_SQL_OPERATION',
          message: validation.error,
          details: {
            hint: 'Only read-only SELECT or WITH queries are permitted. Destructive operations (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, etc.) and comments are strictly forbidden.'
          }
        },
        message: validation.error
      });
    }
  }

  // 7. Instantiate concrete enterprise connector
  let connector;
  try {
    connector = ConnectorFactory.createFromDataSource(dataSource, {
      timeouts: { connect: 10000, query: 15000 }
    });
  } catch (factoryErr) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONNECTOR_INITIALIZATION_ERROR',
        message: factoryErr.message || 'Failed to initialize database connector.',
        details: { hint: 'Verify connector configuration and driver support.' }
      },
      message: factoryErr.message || 'Failed to initialize database connector.'
    });
  }

  // 8. Execute read-only query under connector lifecycle
  const startHr = process.hrtime.bigint();
  try {
    const queryOptions = {
      maxRows,
      tableName: dataset.tableName || dataset.name,
      schema: dataset.schemaName || 'public',
      collection: dataset.tableName || dataset.name,
      timeoutMs: 15000
    };

    const result = await connector.executeWithLifecycle(async (conn) => {
      return await conn.executeQueryReadOnly(query.trim(), [], queryOptions);
    });

    const endHr = process.hrtime.bigint();
    const executionTimeMs = Math.round(Number(endHr - startHr) / 1_000_000);

    const rows = result.rows || [];
    const fields = result.fields || (rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0]) ? Object.keys(rows[0]) : []);
    const columns = result.columns || fields;

    // Record activity for audit trail
    if (req.user) {
      Activity.create({
        title: `Executed SQL query on ${dataset.name}`,
        type: 'query',
        actorId: req.user._id,
        datasetId: dataset._id,
        timestamp: new Date(),
        metadata: {
          rowCount: rows.length,
          executionTimeMs,
          dataSourceId: dataSource._id
        }
      }).catch(() => {});
    }

    return res.json({
      success: true,
      data: {
        rows,
        columns,
        fields,
        rowCount: result.rowCount != null ? result.rowCount : rows.length,
        executionTimeMs,
        truncated: rows.length < (result.rowCount || 0) || rows.length >= maxRows
      },
      message: 'Query executed successfully'
    });
  } catch (err) {
    const endHr = process.hrtime.bigint();
    const executionTimeMs = Math.round(Number(endHr - startHr) / 1_000_000);

    const msg = err.message || '';
    const pgCode = err.details?.pgCode || err.code;

    // A. Source Table Does Not Exist (PostgreSQL 42P01, MySQL ER_NO_SUCH_TABLE, SQL Server 208)
    if (
      pgCode === '42P01' ||
      err.details?.sqlServerNumber === 208 ||
      err.details?.mysqlCode === 'ER_NO_SUCH_TABLE' ||
      /relation ["']?.*["']? does not exist/i.test(msg) ||
      /table ["']?.*["']? does not exist/i.test(msg) ||
      /Invalid object name/i.test(msg)
    ) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SOURCE_TABLE_NOT_FOUND',
          message: msg,
          details: {
            detail: msg,
            hint: 'The specified table or relation does not exist in the external database schema.'
          }
        },
        message: msg
      });
    }

    // B. Syntax error in SQL query (PostgreSQL 42601, etc.)
    if (
      pgCode === '42601' ||
      /syntax error/i.test(msg) ||
      err.name === 'ConnectorConfigurationError' ||
      err.code === 'INVALID_SQL_SYNTAX'
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SQL_SYNTAX',
          message: msg,
          details: {
            detail: msg,
            hint: 'Please verify SQL syntax, quoted identifiers, and keyword placement.'
          }
        },
        message: msg
      });
    }

    // C. Write/DDL violation trapped by database engine (read-only transaction rejection 25006)
    if (
      pgCode === '25006' ||
      /read-only transaction/i.test(msg) ||
      /cannot execute .* in a read-only transaction/i.test(msg)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISALLOWED_SQL_OPERATION',
          message: 'Write and DDL operations are strictly prohibited in the Interactive SQL Studio.',
          details: {
            detail: msg,
            hint: 'Only SELECT or WITH read-only queries can be executed.'
          }
        },
        message: 'Write and DDL operations are strictly prohibited.'
      });
    }

    // D. Connection failure / timeout / unreachable external database
    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ENOTFOUND' ||
      err.name === 'ConnectorUnavailableError' ||
      err.name === 'ConnectorTimeoutError' ||
      /timeout/i.test(msg) ||
      /connection.*refused/i.test(msg) ||
      /host.*unreachable/i.test(msg)
    ) {
      const isTimeout = err.code === 'ETIMEDOUT' || /timeout/i.test(msg);
      return res.status(isTimeout ? 504 : 502).json({
        success: false,
        error: {
          code: isTimeout ? 'QUERY_TIMEOUT' : 'DATA_SOURCE_UNAVAILABLE',
          message: isTimeout ? 'Query execution exceeded the 15-second timeout limit.' : 'Failed to establish connection to the external database.',
          details: {
            detail: msg,
            hint: isTimeout
              ? 'Optimize query filters or increase indexing to return results within 15 seconds.'
              : 'Verify the external database engine is online and network connectivity/credentials are valid.'
          }
        },
        message: isTimeout ? 'Query execution timed out.' : 'External data source is unavailable.'
      });
    }

    // E. General query execution error
    return res.status(500).json({
      success: false,
      error: {
        code: 'QUERY_EXECUTION_ERROR',
        message: msg || 'An error occurred while executing the query on the external data source.',
        details: {
          detail: msg,
          hint: 'Review your query and data source configuration.'
        }
      },
      message: msg || 'Query execution failed.'
    });
  }
});

// @desc    Get bounded preview rows for a dataset
// @route   GET /api/datasets/:id/preview
// @access  Private (DATASET_READ permission)
const getDatasetPreview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 50);

  const dataset = await Dataset.findById(id);
  if (!dataset) {
    return res.status(404).json({
      success: false,
      message: 'Dataset not found'
    });
  }

  if (!dataset.dataSourceId) {
    return res.status(400).json({
      success: false,
      message: 'Dataset is not connected to a data source.'
    });
  }

  const dataSource = await DataSource.findById(dataset.dataSourceId).select('+credentials.encryptedData +credentials.keyId +credentials');
  if (!dataSource) {
    return res.status(404).json({
      success: false,
      message: 'Data source not found.'
    });
  }

  const { ConnectorFactory } = await import('../src/connectors/index.js');
  const sourceType = String(dataSource.type || dataset.sourceType || '').toLowerCase().trim();
  const schema = dataset.schemaName || 'public';
  const tableName = dataset.tableName || dataset.name;

  let query;
  if (sourceType === 'mongodb') {
    query = '{}';
  } else if (sourceType === 'mysql') {
    query = `SELECT * FROM \`${schema}\`.\`${tableName}\` LIMIT ${limit};`;
  } else if (sourceType === 'sqlserver' || sourceType === 'mssql') {
    query = `SELECT TOP ${limit} * FROM [${schema}].[${tableName}];`;
  } else {
    query = `SELECT * FROM "${schema}"."${tableName}" LIMIT ${limit};`;
  }

  const connector = ConnectorFactory.createFromDataSource(dataSource, {
    timeouts: { connect: 10000, query: 15000 }
  });

  const result = await connector.executeWithLifecycle(async (conn) => {
    return await conn.executeQueryReadOnly(query, [], {
      maxRows: limit,
      tableName,
      schema,
      collection: tableName
    });
  });

  return res.json({
    success: true,
    data: {
      rows: result.rows || [],
      columns: result.fields || (result.rows && result.rows[0] ? Object.keys(result.rows[0]) : []),
      rowCount: result.rows ? result.rows.length : 0
    }
  });
});

// @desc    Export schema definition as normalized JSON
// @route   GET /api/datasets/:id/export-schema
// @access  Private
const exportDatasetSchema = asyncHandler(async (req, res) => {
  const dataset = await Dataset.findById(req.params.id).lean();
  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  const rawColumns = dataset.columns || [];
  if (rawColumns.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Schema metadata is unavailable. Synchronize the dataset before exporting its schema definition.'
    });
  }

  const formatDb = (st) => {
    if (!st) return 'Unknown';
    const s = String(st).toLowerCase().trim();
    if (s.includes('postgres')) return 'PostgreSQL';
    if (s.includes('mysql')) return 'MySQL';
    if (s.includes('sqlserver') || s.includes('mssql')) return 'SQL Server';
    if (s.includes('mongo')) return 'MongoDB';
    if (s.includes('snowflake')) return 'Snowflake';
    return st;
  };

  const isMongo = String(dataset.sourceType || dataset.source || '').toLowerCase().includes('mongo');
  const databaseType = formatDb(dataset.sourceType || dataset.source);

  const schemaDefinition = {
    dataset: dataset.displayName || dataset.name || 'Unnamed Dataset',
    source: dataset.source || dataset.sourceSystem || 'Unknown Source',
    databaseType: databaseType
  };

  if (dataset.schemaName) {
    schemaDefinition.schema = dataset.schemaName;
  }

  if (isMongo) {
    schemaDefinition.collection = dataset.tableName || dataset.name;
  } else {
    schemaDefinition.table = dataset.tableName || dataset.name;
  }

  if (dataset.domain) schemaDefinition.domain = dataset.domain;
  if (dataset.environment) schemaDefinition.environment = dataset.environment;
  if (dataset.sensitivity) schemaDefinition.sensitivity = dataset.sensitivity;
  if (dataset.classification) schemaDefinition.classification = dataset.classification;

  schemaDefinition.columns = rawColumns.map(col => {
    const colDef = {
      name: col.name,
      dataType: col.dataType || col.type || 'unknown'
    };
    if (typeof col.nullable === 'boolean' && !isMongo) colDef.nullable = col.nullable;
    if (col.primaryKey) colDef.primaryKey = true;
    if (col.foreignKey) colDef.foreignKey = col.foreignKey;
    if (col.defaultValue !== undefined && col.defaultValue !== null) colDef.defaultValue = col.defaultValue;
    if (typeof col.ordinalPosition === 'number') colDef.ordinalPosition = col.ordinalPosition;
    if (col.description && col.description.trim()) colDef.description = col.description.trim();
    if (col.businessMeaning && col.businessMeaning.trim()) colDef.businessMeaning = col.businessMeaning.trim();
    if (col.sensitivity) colDef.sensitivity = col.sensitivity;
    if (col.pii) colDef.pii = true;
    return colDef;
  });

  const sanitizedName = (dataset.name || 'dataset').trim().replace(/[^a-zA-Z0-9_-]+/g, '_');
  const filename = `${sanitizedName}_schema.json`;

  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(schemaDefinition, null, 2));
  }

  return res.json({
    success: true,
    data: schemaDefinition,
    filename
  });
});

module.exports = {
  getDatasets,
  getDataset,
  createDataset,
  updateDataset,
  deleteDataset,
  getDatasetStats,
  favoriteDataset,
  getDatasetFavorites,
  certifyDataset,
  updateColumnMetadata,
  getDatasetActivity,
  getRelatedDatasets,
  getTags,
  getSources,
  executeDatasetQuery,
  getDatasetPreview,
  exportDatasetSchema,
};
