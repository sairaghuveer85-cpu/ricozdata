const mongoose = require('mongoose');
const GlossarySuggestion = require('../models/GlossarySuggestion');
const GlossaryTerm = require('../models/GlossaryTerm');
const Dataset = require('../models/Dataset');
const Activity = require('../models/Activity');
const asyncHandler = require('../middleware/asyncHandler');
const { defaultEngine } = require('../services/glossarySuggestionEngine');

const isValidObjectId = (id) => {
  return Boolean(id) && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const SORTABLE_SUGGESTION_FIELDS = [
  'confidenceScore',
  'semanticConfidence',
  'glossaryRelevanceScore',
  'suggestedTerm',
  'createdAt',
  'status',
  'suggestionPriority',
  'conceptCategory',
];

// @desc    Generate suggestions by scanning catalog metadata
// @route   POST /api/glossary/suggestions/generate
// @access  Private (GLOSSARY_UPDATE)
const generateSuggestions = asyncHandler(async (req, res) => {
  const { datasetId, dataSourceId, scope = 'dataset' } = req.body;

  if (datasetId && !isValidObjectId(datasetId)) {
    return res.status(400).json({ success: false, message: 'Invalid datasetId format' });
  }
  if (dataSourceId && !isValidObjectId(dataSourceId)) {
    return res.status(400).json({ success: false, message: 'Invalid dataSourceId format' });
  }

  const result = await defaultEngine.generateSuggestions({
    datasetId,
    dataSourceId,
    scope,
    user: req.user,
  });

  // Audit activity
  try {
    await Activity.create({
      title: `Generated ${result.generatedCount} glossary suggestions`,
      type: 'glossary',
      actorId: req.user ? req.user._id : null,
      metadata: {
        action: 'SUGGESTION_GENERATED',
        generatedCount: result.generatedCount,
        scope,
        datasetId,
      },
    });
  } catch (err) {
    console.warn('Activity logging notice:', err.message);
  }

  res.status(200).json({
    success: true,
    message: `Generated ${result.generatedCount} semantic candidates for review`,
    data: result,
  });
});

// @desc    Get paginated suggestions with filters and confidence summary
// @route   GET /api/glossary/suggestions
// @access  Private (GLOSSARY_READ)
const getSuggestions = asyncHandler(async (req, res) => {
  const {
    status = 'pending',
    confidence,
    priority,
    category,
    domain,
    datasetId,
    search,
    page = 1,
    limit = 20,
    sortBy = 'confidenceScore',
    sortOrder = 'desc',
  } = req.query;

  const filter = {};

  // Status filter (default to pending unless 'all' or specified)
  if (status && status !== 'all') {
    filter.status = status.toLowerCase();
  }

  // Priority filter
  if (priority && priority !== 'all') {
    const prioUpper = priority.toUpperCase();
    if (['RECOMMENDED', 'REVIEW', 'LOW_PRIORITY', 'TECHNICAL_METADATA', 'DUPLICATE', 'EXISTING_TERM'].includes(prioUpper)) {
      filter.suggestionPriority = prioUpper;
    } else if (prioUpper === 'BUSINESS_CONCEPTS' || prioUpper === 'RECOMMENDED_REVIEW') {
      filter.suggestionPriority = { $in: ['RECOMMENDED', 'REVIEW'] };
    }
  }

  // Category filter
  if (category && category !== 'all') {
    const catUpper = category.toUpperCase();
    if (catUpper === 'BUSINESS_CONCEPTS') {
      filter.conceptCategory = { $ne: 'TECHNICAL_METADATA' };
    } else if (
      [
        'BUSINESS_ENTITY',
        'BUSINESS_ATTRIBUTE',
        'BUSINESS_MEASURE',
        'BUSINESS_METRIC',
        'IDENTIFIER',
        'REFERENCE',
        'STATUS',
        'DATE_ATTRIBUTE',
        'TECHNICAL_METADATA',
        'CLASSIFICATION',
        'OTHER',
      ].includes(catUpper)
    ) {
      filter.conceptCategory = catUpper;
    }
  }

  // Confidence level filter
  if (confidence && ['high', 'medium', 'low'].includes(confidence.toLowerCase())) {
    filter.confidenceLevel = confidence.toLowerCase();
  }

  // Domain filter
  if (domain && domain !== 'All Domains') {
    filter.suggestedDomain = domain;
  }

  // Dataset filter
  if (datasetId) {
    if (!isValidObjectId(datasetId)) {
      return res.status(400).json({ success: false, message: 'Invalid datasetId format' });
    }
    filter.sourceDatasetIds = datasetId;
  }

  // Search filter
  if (search && typeof search === 'string' && search.trim()) {
    const safeRegex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [
      { suggestedTerm: safeRegex },
      { suggestedDefinition: safeRegex },
      { reasoning: safeRegex },
      { suggestedTags: safeRegex },
    ];
  }

  // Safe sorting
  const safeSortField = SORTABLE_SUGGESTION_FIELDS.includes(sortBy) ? sortBy : 'confidenceScore';
  const sortDirection = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
  const sortOptions = { [safeSortField]: sortDirection };
  if (safeSortField !== 'suggestedTerm') {
    sortOptions.suggestedTerm = 1;
  }

  // Safe pagination
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  // Run queries and summary aggregations in parallel
  const [
    total,
    items,
    pendingCount,
    highCount,
    mediumCount,
    lowCount,
    approvedCount,
    rejectedCount,
    recommendedCount,
    reviewCount,
    technicalCount,
    entitiesCount,
    measuresCount,
    metricsCount,
    attributesCount,
    identifiersCount,
    statusesCount,
    existingCount,
  ] = await Promise.all([
    GlossarySuggestion.countDocuments(filter),
    GlossarySuggestion.find(filter)
      .populate('sourceDatasetIds', 'name domain')
      .populate('matchedExistingTermId', 'term definition domain')
      .populate('createdTermId', 'term status')
      .populate('reviewedBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit),
    GlossarySuggestion.countDocuments({ status: 'pending' }),
    GlossarySuggestion.countDocuments({ status: 'pending', confidenceLevel: 'high' }),
    GlossarySuggestion.countDocuments({ status: 'pending', confidenceLevel: 'medium' }),
    GlossarySuggestion.countDocuments({ status: 'pending', confidenceLevel: 'low' }),
    GlossarySuggestion.countDocuments({ status: 'approved' }),
    GlossarySuggestion.countDocuments({ status: 'rejected' }),
    GlossarySuggestion.countDocuments({ status: 'pending', suggestionPriority: 'RECOMMENDED' }),
    GlossarySuggestion.countDocuments({ status: 'pending', suggestionPriority: 'REVIEW' }),
    GlossarySuggestion.countDocuments({ status: 'pending', conceptCategory: 'TECHNICAL_METADATA' }),
    GlossarySuggestion.countDocuments({ status: 'pending', conceptCategory: 'BUSINESS_ENTITY' }),
    GlossarySuggestion.countDocuments({ status: 'pending', conceptCategory: 'BUSINESS_MEASURE' }),
    GlossarySuggestion.countDocuments({ status: 'pending', conceptCategory: 'BUSINESS_METRIC' }),
    GlossarySuggestion.countDocuments({ status: 'pending', conceptCategory: 'BUSINESS_ATTRIBUTE' }),
    GlossarySuggestion.countDocuments({ status: 'pending', conceptCategory: 'IDENTIFIER' }),
    GlossarySuggestion.countDocuments({ status: 'pending', conceptCategory: 'STATUS' }),
    GlossarySuggestion.countDocuments({
      status: 'pending',
      $or: [{ matchType: 'existing_term_link' }, { suggestionPriority: 'EXISTING_TERM' }, { suggestionPriority: 'DUPLICATE' }],
    }),
  ]);

  const totalPages = Math.ceil(total / parsedLimit) || 1;

  res.status(200).json({
    success: true,
    data: {
      items,
      summary: {
        totalPending: pendingCount,
        highConfidence: highCount,
        mediumConfidence: mediumCount,
        lowConfidence: lowCount,
        totalApproved: approvedCount,
        totalRejected: rejectedCount,
        recommendedCount,
        reviewCount,
        technicalCount,
        existingCount: existingCount || 0,
        entitiesCount,
        measuresCount,
        metricsCount,
        attributesCount,
        identifiersCount,
        statusesCount,
      },
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: totalPages,
      },
    },
  });
});

// @desc    Get single suggestion by ID
// @route   GET /api/glossary/suggestions/:id
// @access  Private (GLOSSARY_READ)
const getSuggestionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid suggestion ID format' });
  }

  const suggestion = await GlossarySuggestion.findById(id)
    .populate('sourceDatasetIds', 'name domain qualityScore')
    .populate('matchedExistingTermId', 'term definition domain status')
    .populate('createdTermId', 'term status')
    .populate('reviewedBy', 'name email');

  if (!suggestion) {
    return res.status(404).json({ success: false, message: 'Glossary suggestion not found' });
  }

  res.status(200).json({
    success: true,
    data: suggestion,
  });
});

// @desc    Approve suggestion and promote to authoritative GlossaryTerm
// @route   POST /api/glossary/suggestions/:id/approve
// @access  Private (GLOSSARY_CREATE)
const approveSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid suggestion ID format' });
  }

  const suggestion = await GlossarySuggestion.findById(id);
  if (!suggestion) {
    return res.status(404).json({ success: false, message: 'Glossary suggestion not found' });
  }

  const userId = req.user ? req.user._id : null;
  const {
    term,
    definition,
    domain,
    domainId,
    owner,
    ownerId,
    tags,
    synonyms,
    examples,
    businessRules,
    relatedTermIds,
    status = 'approved',
  } = req.body;

  const finalTerm = (term || suggestion.suggestedTerm).trim();
  const finalDefinition = (definition || suggestion.suggestedDefinition).trim();
  const finalDomain = (domain || suggestion.suggestedDomain || 'Customer Data').trim();
  const finalDomainId = domainId || suggestion.suggestedDomainId || null;
  const finalOwnerName = owner || (req.user ? req.user.name : 'Data Governance Team');
  const finalOwnerId = ownerId && isValidObjectId(ownerId) ? ownerId : userId;
  const finalTags = tags || suggestion.suggestedTags || [];
  const finalSynonyms = synonyms || suggestion.suggestedSynonyms || [];
  const finalExamples = examples || suggestion.suggestedExamples || [];
  const finalBusinessRules = businessRules || suggestion.suggestedBusinessRules || [];

  let validatedRelatedTermIds = [];
  if (Array.isArray(relatedTermIds) && relatedTermIds.length > 0) {
    for (const tId of relatedTermIds) {
      if (isValidObjectId(tId)) {
        const tExists = await GlossaryTerm.exists({ _id: tId });
        if (tExists) validatedRelatedTermIds.push(tId);
      }
    }
  }

  if (finalTerm.length < 2) {
    return res.status(400).json({ success: false, message: 'Term name must be at least 2 characters' });
  }
  if (finalDefinition.length < 10) {
    return res.status(400).json({ success: false, message: 'Definition must be at least 10 characters' });
  }

  // CASE 1: If suggestion matches an existing authoritative term, link sources instead of duplicating
  if (suggestion.matchType === 'existing_term_link' && suggestion.matchedExistingTermId) {
    const existingTerm = await GlossaryTerm.findById(suggestion.matchedExistingTermId);

    if (existingTerm) {
      const updateFields = {
        updatedBy: userId,
        updatedAt: new Date(),
        status,
        ...(status === 'approved' ? { approvedBy: userId, approvedAt: new Date() } : {}),
      };
      if (req.body.definition) updateFields.definition = finalDefinition;
      if (req.body.domain) updateFields.domain = finalDomain;
      if (req.body.domainId) updateFields.domainId = finalDomainId;
      if (req.body.tags) updateFields.tags = finalTags;
      if (req.body.synonyms) updateFields.synonyms = finalSynonyms;
      if (req.body.owner) updateFields.owner = finalOwnerName;
      if (req.body.ownerId && isValidObjectId(req.body.ownerId)) updateFields.ownerId = req.body.ownerId;

      const addToSet = { relatedDatasetIds: { $each: suggestion.sourceDatasetIds } };
      if (validatedRelatedTermIds.length > 0) {
        addToSet.relatedTermIds = { $each: validatedRelatedTermIds };
      }

      // Add source datasets and apply edits
      const updatedTerm = await GlossaryTerm.findByIdAndUpdate(
        existingTerm._id,
        {
          $addToSet: addToSet,
          $set: updateFields,
        },
        { new: true }
      );

      // Add source columns
      for (const colRef of suggestion.sourceColumnRefs) {
        const alreadyLinked = (existingTerm.relatedColumnRefs || []).some(
          (c) => c.datasetId.toString() === colRef.datasetId.toString() && c.columnId.toString() === colRef.columnId.toString()
        );
        if (!alreadyLinked) {
          await GlossaryTerm.findByIdAndUpdate(existingTerm._id, {
            $push: {
              relatedColumnRefs: {
                datasetId: colRef.datasetId,
                columnId: colRef.columnId,
              },
            },
          });
        }
      }

      // Link term to datasets
      if (suggestion.sourceDatasetIds.length > 0) {
        await Dataset.updateMany(
          { _id: { $in: suggestion.sourceDatasetIds } },
          { $addToSet: { glossaryTermIds: existingTerm._id } }
        );
      }

      suggestion.status = 'approved';
      suggestion.reviewedBy = userId;
      suggestion.reviewedAt = new Date();
      suggestion.createdTermId = existingTerm._id;
      await suggestion.save();

      try {
        await Activity.create({
          title: `Linked discovered columns to existing glossary term "${existingTerm.term}"`,
          type: 'glossary',
          actorId: userId,
          glossaryTermId: existingTerm._id,
          metadata: {
            action: 'SUGGESTION_APPROVED',
            suggestionId: suggestion._id,
            term: existingTerm.term,
            matchedExisting: true,
          },
        });
      } catch (e) {}

      return res.status(200).json({
        success: true,
        message: `Discovered sources linked to existing authoritative term "${existingTerm.term}"`,
        data: {
          term: updatedTerm,
          suggestion,
          matchedExisting: true,
        },
      });
    }
  }

  // CASE 2: Create new authoritative GlossaryTerm
  // Check if term already exists by name
  let existingByName = await GlossaryTerm.findOne({
    term: { $regex: `^${escapeRegex(finalTerm)}$`, $options: 'i' },
  });

  let createdTerm = null;

  if (existingByName) {
    const addToSet = { relatedDatasetIds: { $each: suggestion.sourceDatasetIds } };
    if (validatedRelatedTermIds.length > 0) {
      addToSet.relatedTermIds = { $each: validatedRelatedTermIds };
    }

    // Merge into existing term rather than duplicating
    await GlossaryTerm.findByIdAndUpdate(existingByName._id, {
      $addToSet: addToSet,
      $set: {
        updatedBy: userId,
        updatedAt: new Date(),
        status,
        ...(status === 'approved' ? { approvedBy: userId, approvedAt: new Date() } : {}),
      },
    });

    createdTerm = await GlossaryTerm.findById(existingByName._id);
  } else {
    // Prepare column refs
    const colRefs = (suggestion.sourceColumnRefs || []).map((c) => ({
      datasetId: c.datasetId,
      columnId: c.columnId,
    }));

    createdTerm = await GlossaryTerm.create({
      term: finalTerm,
      definition: finalDefinition,
      domainId: finalDomainId,
      domain: finalDomain,
      ownerId: finalOwnerId,
      owner: finalOwnerName,
      status,
      tags: finalTags,
      synonyms: finalSynonyms,
      examples: finalExamples,
      businessRules: finalBusinessRules,
      relatedDatasetIds: suggestion.sourceDatasetIds,
      relatedColumnRefs: colRefs,
      relatedTermIds: validatedRelatedTermIds,
      createdBy: userId,
      updatedBy: userId,
      approvedBy: status === 'approved' ? userId : null,
      approvedAt: status === 'approved' ? new Date() : null,
    });

    if (suggestion.sourceDatasetIds.length > 0) {
      await Dataset.updateMany(
        { _id: { $in: suggestion.sourceDatasetIds } },
        { $addToSet: { glossaryTermIds: createdTerm._id } }
      );
    }
  }

  // Update suggestion state
  suggestion.status = 'approved';
  suggestion.reviewedBy = userId;
  suggestion.reviewedAt = new Date();
  suggestion.createdTermId = createdTerm._id;
  await suggestion.save();

  // Audit activity
  try {
    await Activity.create({
      title: `Glossary term "${createdTerm.term}" created from suggestion`,
      type: 'glossary',
      actorId: userId,
      glossaryTermId: createdTerm._id,
      metadata: {
        action: 'TERM_CREATED_FROM_SUGGESTION',
        suggestionId: suggestion._id,
        term: createdTerm.term,
      },
    });
  } catch (err) {
    console.warn('Activity logging notice:', err.message);
  }

  const populated = await GlossaryTerm.findById(createdTerm._id)
    .populate('domainId', 'name description')
    .populate('ownerId', 'name email');

  res.status(201).json({
    success: true,
    message: `Glossary term "${createdTerm.term}" created successfully from suggestion`,
    data: {
      term: populated,
      suggestion,
    },
  });
});

// @desc    Reject suggestion
// @route   POST /api/glossary/suggestions/:id/reject
// @access  Private (GLOSSARY_UPDATE)
const rejectSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectionReason } = req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid suggestion ID format' });
  }

  const suggestion = await GlossarySuggestion.findById(id);
  if (!suggestion) {
    return res.status(404).json({ success: false, message: 'Glossary suggestion not found' });
  }

  const userId = req.user ? req.user._id : null;

  suggestion.status = 'rejected';
  suggestion.rejectionReason = rejectionReason || 'Rejected during steward review';
  suggestion.reviewedBy = userId;
  suggestion.reviewedAt = new Date();
  await suggestion.save();

  try {
    await Activity.create({
      title: `Glossary suggestion "${suggestion.suggestedTerm}" rejected`,
      type: 'glossary',
      actorId: userId,
      metadata: {
        action: 'SUGGESTION_REJECTED',
        suggestionId: suggestion._id,
        term: suggestion.suggestedTerm,
        reason: suggestion.rejectionReason,
      },
    });
  } catch (err) {
    console.warn('Activity logging notice:', err.message);
  }

  res.status(200).json({
    success: true,
    message: 'Suggestion rejected',
    data: suggestion,
  });
});

// @desc    Dismiss suggestion
// @route   POST /api/glossary/suggestions/:id/dismiss
// @access  Private (GLOSSARY_UPDATE)
const dismissSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid suggestion ID format' });
  }

  const suggestion = await GlossarySuggestion.findById(id);
  if (!suggestion) {
    return res.status(404).json({ success: false, message: 'Glossary suggestion not found' });
  }

  const userId = req.user ? req.user._id : null;

  suggestion.status = 'dismissed';
  suggestion.reviewedBy = userId;
  suggestion.reviewedAt = new Date();
  await suggestion.save();

  try {
    await Activity.create({
      title: `Glossary suggestion "${suggestion.suggestedTerm}" dismissed`,
      type: 'glossary',
      actorId: userId,
      metadata: {
        action: 'SUGGESTION_DISMISSED',
        suggestionId: suggestion._id,
        term: suggestion.suggestedTerm,
      },
    });
  } catch (err) {
    console.warn('Activity logging notice:', err.message);
  }

  res.status(200).json({
    success: true,
    message: 'Suggestion dismissed',
    data: suggestion,
  });
});

// @desc    Bulk action on suggestions (approve, reject, dismiss)
// @route   POST /api/glossary/suggestions/bulk
// @access  Private (GLOSSARY_CREATE)
const bulkActionSuggestions = asyncHandler(async (req, res) => {
  const { action, suggestionIds } = req.body;

  if (!['approve', 'reject', 'dismiss'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action. Allowed: approve, reject, dismiss' });
  }

  if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
    return res.status(400).json({ success: false, message: 'suggestionIds must be a non-empty array' });
  }

  const validIds = suggestionIds.filter(isValidObjectId);
  if (validIds.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid suggestion IDs provided' });
  }

  const userId = req.user ? req.user._id : null;
  let succeededCount = 0;
  let failedCount = 0;

  for (const id of validIds) {
    try {
      const suggestion = await GlossarySuggestion.findById(id);
      if (!suggestion || suggestion.status !== 'pending') {
        failedCount++;
        continue;
      }

      if (action === 'approve') {
        // Create term
        const createdTerm = await GlossaryTerm.create({
          term: suggestion.suggestedTerm,
          definition: suggestion.suggestedDefinition,
          domainId: suggestion.suggestedDomainId,
          domain: suggestion.suggestedDomain || 'Customer Data',
          ownerId: userId,
          owner: req.user ? req.user.name : 'Data Governance Team',
          status: 'draft',
          tags: suggestion.suggestedTags,
          synonyms: suggestion.suggestedSynonyms,
          examples: suggestion.suggestedExamples,
          businessRules: suggestion.suggestedBusinessRules,
          relatedDatasetIds: suggestion.sourceDatasetIds,
          relatedColumnRefs: (suggestion.sourceColumnRefs || []).map((c) => ({
            datasetId: c.datasetId,
            columnId: c.columnId,
          })),
          createdBy: userId,
          updatedBy: userId,
        });

        if (suggestion.sourceDatasetIds.length > 0) {
          await Dataset.updateMany(
            { _id: { $in: suggestion.sourceDatasetIds } },
            { $addToSet: { glossaryTermIds: createdTerm._id } }
          );
        }

        suggestion.status = 'approved';
        suggestion.reviewedBy = userId;
        suggestion.reviewedAt = new Date();
        suggestion.createdTermId = createdTerm._id;
        await suggestion.save();
      } else if (action === 'reject') {
        suggestion.status = 'rejected';
        suggestion.rejectionReason = 'Bulk rejected by data steward';
        suggestion.reviewedBy = userId;
        suggestion.reviewedAt = new Date();
        await suggestion.save();
      } else if (action === 'dismiss') {
        suggestion.status = 'dismissed';
        suggestion.reviewedBy = userId;
        suggestion.reviewedAt = new Date();
        await suggestion.save();
      }

      succeededCount++;
    } catch (itemErr) {
      failedCount++;
    }
  }

  // Audit activity
  try {
    await Activity.create({
      title: `Bulk ${action} executed for ${succeededCount} suggestions`,
      type: 'glossary',
      actorId: userId,
      metadata: {
        action: `SUGGESTION_BULK_${action.toUpperCase()}`,
        succeededCount,
        failedCount,
      },
    });
  } catch (err) {}

  res.status(200).json({
    success: true,
    message: `Bulk ${action} completed: ${succeededCount} succeeded, ${failedCount} skipped/failed`,
    data: {
      action,
      processedCount: validIds.length,
      succeededCount,
      failedCount,
    },
  });
});

module.exports = {
  generateSuggestions,
  getSuggestions,
  getSuggestionById,
  approveSuggestion,
  rejectSuggestion,
  dismissSuggestion,
  bulkActionSuggestions,
};
