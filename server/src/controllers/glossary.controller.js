import { GlossaryTerm } from '../models/GlossaryTerm.js';
import { Dataset } from '../models/Dataset.js';
import { Activity } from '../models/Activity.js';

export async function getGlossaryTerms(req, res) {
  const organizationId = req.organizationId;
  const { domain, status, tag, search } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { organizationId };
  if (domain) filter.domain = domain;
  if (status) filter.status = status;
  if (tag) filter.tags = tag;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { definition: { $regex: escaped, $options: 'i' } },
      { synonyms: { $regex: escaped, $options: 'i' } }
    ];
  }

  const [terms, total] = await Promise.all([
    GlossaryTerm.find(filter)
      .populate('steward', 'firstName lastName email')
      .populate('linkedDatasets.datasetId', 'name schemaName')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    GlossaryTerm.countDocuments(filter)
  ]);

  return res.status(200).json({
    success: true,
    data: terms,
    error: null,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

export async function createGlossaryTerm(req, res) {
  const organizationId = req.organizationId;
  const { name, term: altTerm, definition, description, domain, tags, owner, steward, synonyms, status } = req.body;
  const termName = (name || altTerm || '').trim();

  if (!termName) {
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Glossary term name is required' }
    });
  }

  // Check duplicate within tenant
  const existing = await GlossaryTerm.findOne({
    organizationId,
    name: { $regex: new RegExp(`^${termName}$`, 'i') }
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      data: null,
      error: { code: 'DUPLICATE_TERM', message: `Glossary term "${termName}" already exists` }
    });
  }

  const term = await GlossaryTerm.create({
    organizationId,
    name: termName,
    definition,
    description: description || '',
    domain: domain || 'General',
    tags: tags || [],
    owner: owner || '',
    steward: steward || null,
    synonyms: synonyms || [],
    status: status || 'DRAFT',
    createdBy: req.user?._id
  });

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'glossary_term.created',
    entityType: 'glossary_term',
    entityId: term._id,
    metadata: { termName: term.name, domain: term.domain }
  });

  return res.status(201).json({
    success: true,
    data: term,
    error: null
  });
}

export async function getGlossaryTermById(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const term = await GlossaryTerm.findOne({ _id: id, organizationId })
    .populate('steward', 'firstName lastName email')
    .populate('linkedDatasets.datasetId', 'name schemaName type assetType classification');

  if (!term) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Glossary term not found' }
    });
  }

  return res.status(200).json({
    success: true,
    data: term,
    error: null
  });
}

export async function updateGlossaryTerm(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  delete req.body.organizationId;
  delete req.body.linkedDatasets;

  const term = await GlossaryTerm.findOne({ _id: id, organizationId });
  if (!term) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Glossary term not found' }
    });
  }

  Object.assign(term, req.body);
  term.updatedBy = req.user?._id;
  await term.save();

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'glossary_term.updated',
    entityType: 'glossary_term',
    entityId: term._id,
    metadata: { termName: term.name }
  });

  return res.status(200).json({
    success: true,
    data: term,
    error: null
  });
}

export async function deleteGlossaryTerm(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const term = await GlossaryTerm.findOneAndDelete({ _id: id, organizationId });
  if (!term) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Glossary term not found' }
    });
  }

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'glossary_term.deleted',
    entityType: 'glossary_term',
    entityId: term._id,
    metadata: { termName: term.name }
  });

  return res.status(200).json({
    success: true,
    data: { id: term._id, deleted: true },
    error: null
  });
}

/**
 * POST /api/v1/glossary/:id/link
 * Links glossary term to a dataset or dataset column.
 */
export async function linkDataset(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;
  const { datasetId, column } = req.body;

  // Validate dataset ownership within tenant
  const dataset = await Dataset.findOne({
    _id: datasetId,
    organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataset) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'DATASET_NOT_FOUND', message: 'Target dataset not found or inaccessible in this organization' }
    });
  }

  const term = await GlossaryTerm.findOne({ _id: id, organizationId });
  if (!term) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Glossary term not found' }
    });
  }

  // Prevent duplicate links
  const targetCol = column || null;
  const alreadyLinked = term.linkedDatasets.some(
    (l) => String(l.datasetId) === String(datasetId) && l.column === targetCol
  );

  if (!alreadyLinked) {
    term.linkedDatasets.push({
      datasetId,
      column: targetCol,
      linkedAt: new Date(),
      linkedBy: req.user?._id
    });
    await term.save();

    await Activity.create({
      organizationId,
      actorId: req.user?._id || organizationId,
      action: 'glossary_term.dataset_linked',
      entityType: 'glossary_term',
      entityId: term._id,
      metadata: {
        termName: term.name,
        datasetName: dataset.name,
        column: targetCol
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: term,
    error: null
  });
}

/**
 * DELETE /api/v1/glossary/:id/link
 * Unlinks glossary term from a dataset or column.
 */
export async function unlinkDataset(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;
  const { datasetId, column } = req.body;

  const term = await GlossaryTerm.findOne({ _id: id, organizationId });
  if (!term) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Glossary term not found' }
    });
  }

  const targetCol = column || null;
  term.linkedDatasets = term.linkedDatasets.filter(
    (l) => !(String(l.datasetId) === String(datasetId) && l.column === targetCol)
  );
  await term.save();

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'glossary_term.dataset_unlinked',
    entityType: 'glossary_term',
    entityId: term._id,
    metadata: { termName: term.name, datasetId, column: targetCol }
  });

  return res.status(200).json({
    success: true,
    data: term,
    error: null
  });
}
