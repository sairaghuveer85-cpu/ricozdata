import { Dataset } from '../models/Dataset.js';
import { MaskingPolicy } from '../models/MaskingPolicy.js';
import { Activity } from '../models/Activity.js';

/**
 * POST /api/v1/governance/classification
 * Updates data classification at dataset or column level.
 */
export async function updateClassification(req, res) {
  const organizationId = req.organizationId;
  const { datasetId, column, classification } = req.body;

  const dataset = await Dataset.findOne({
    _id: datasetId,
    organizationId,
    isDeleted: { $ne: true }
  });

  if (!dataset) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Dataset not found' }
    });
  }

  const normalizedClass = String(classification).toUpperCase();

  if (column) {
    // Column-level classification
    const colIndex = (dataset.columns || []).findIndex(
      (c) => c.name.toLowerCase() === column.toLowerCase()
    );

    if (colIndex === -1) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'COLUMN_NOT_FOUND', message: `Column "${column}" not found in dataset` }
      });
    }

    const previousClass = dataset.columns[colIndex].classification;
    // Map to supported classification values
    dataset.columns[colIndex].classification = normalizedClass.toLowerCase() === 'public' ? 'public' : 'restricted';
    dataset.columns[colIndex].piiClassification = ['PII', 'PHI', 'SENSITIVE'].includes(normalizedClass)
      ? normalizedClass.toLowerCase()
      : 'none';
    dataset.markModified('columns');
    await dataset.save();

    await Activity.create({
      organizationId,
      actorId: req.user?._id || organizationId,
      action: 'column.classification_updated',
      entityType: 'dataset',
      entityId: dataset._id,
      metadata: {
        datasetName: dataset.name,
        column,
        previousClassification: previousClass,
        newClassification: normalizedClass
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        datasetId: dataset._id,
        column,
        classification: normalizedClass,
        updatedAt: new Date().toISOString()
      },
      error: null
    });
  } else {
    // Dataset-level classification
    const previousClass = dataset.classification;
    dataset.classification = normalizedClass.toLowerCase() === 'public' ? 'public' : 'confidential';
    await dataset.save();

    await Activity.create({
      organizationId,
      actorId: req.user?._id || organizationId,
      action: 'dataset.classification_updated',
      entityType: 'dataset',
      entityId: dataset._id,
      metadata: {
        datasetName: dataset.name,
        previousClassification: previousClass,
        newClassification: normalizedClass
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        datasetId: dataset._id,
        classification: normalizedClass,
        updatedAt: new Date().toISOString()
      },
      error: null
    });
  }
}

/**
 * GET /api/v1/governance/classification/:datasetId
 * Fetches classification details for a dataset and its columns.
 */
export async function getDatasetClassification(req, res) {
  const { datasetId } = req.params;
  const organizationId = req.organizationId;

  const dataset = await Dataset.findOne({
    _id: datasetId,
    organizationId,
    isDeleted: { $ne: true }
  }).select('name schemaName classification columns');

  if (!dataset) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Dataset not found' }
    });
  }

  const columnsClassification = (dataset.columns || []).map((col) => ({
    name: col.name,
    dataType: col.dataType,
    classification: col.piiClassification !== 'none'
      ? col.piiClassification.toUpperCase()
      : col.classification.toUpperCase(),
    isSensitive: ['pii', 'sensitive_pii', 'financial', 'confidential', 'restricted'].includes(
      String(col.piiClassification || col.classification).toLowerCase()
    )
  }));

  return res.status(200).json({
    success: true,
    data: {
      datasetId: dataset._id,
      name: dataset.name,
      schema: dataset.schemaName,
      datasetClassification: dataset.classification.toUpperCase(),
      columns: columnsClassification
    },
    error: null
  });
}

/**
 * GET /api/v1/governance/masking-policies
 * Lists masking policies for the tenant.
 */
export async function getMaskingPolicies(req, res) {
  const organizationId = req.organizationId;
  const { datasetId } = req.query;

  const filter = { organizationId };
  if (datasetId) filter.datasetId = datasetId;

  const policies = await MaskingPolicy.find(filter)
    .populate('datasetId', 'name schemaName')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: policies,
    error: null,
    meta: { total: policies.length }
  });
}

/**
 * POST /api/v1/governance/masking-policies
 * Creates a new masking policy.
 */
export async function createMaskingPolicy(req, res) {
  const organizationId = req.organizationId;
  const { name, description, datasetId, column, maskingType, roles, enabled } = req.body;

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

  // Check duplicate policy for same column in dataset
  const existing = await MaskingPolicy.findOne({
    organizationId,
    datasetId,
    column: column.trim()
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      data: null,
      error: {
        code: 'DUPLICATE_POLICY',
        message: `A masking policy already exists for column "${column}" on this dataset`
      }
    });
  }

  const policy = await MaskingPolicy.create({
    organizationId,
    name,
    description: description || '',
    datasetId,
    column: column.trim(),
    maskingType,
    roles: roles || ['viewer', 'analyst'],
    enabled: enabled !== undefined ? enabled : true,
    createdBy: req.user?._id
  });

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'masking_policy.created',
    entityType: 'policy',
    entityId: policy._id,
    metadata: {
      policyName: policy.name,
      datasetName: dataset.name,
      column,
      maskingType
    }
  });

  return res.status(201).json({
    success: true,
    data: policy,
    error: null
  });
}

/**
 * PATCH /api/v1/governance/masking-policies/:id
 * Updates an existing masking policy.
 */
export async function updateMaskingPolicy(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  delete req.body.organizationId;
  delete req.body.datasetId;
  delete req.body.column;

  const policy = await MaskingPolicy.findOne({ _id: id, organizationId });
  if (!policy) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Masking policy not found' }
    });
  }

  Object.assign(policy, req.body);
  policy.updatedBy = req.user?._id;
  await policy.save();

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'masking_policy.updated',
    entityType: 'policy',
    entityId: policy._id,
    metadata: { policyName: policy.name }
  });

  return res.status(200).json({
    success: true,
    data: policy,
    error: null
  });
}

/**
 * DELETE /api/v1/governance/masking-policies/:id
 * Deletes a masking policy.
 */
export async function deleteMaskingPolicy(req, res) {
  const { id } = req.params;
  const organizationId = req.organizationId;

  const policy = await MaskingPolicy.findOneAndDelete({ _id: id, organizationId });
  if (!policy) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Masking policy not found' }
    });
  }

  await Activity.create({
    organizationId,
    actorId: req.user?._id || organizationId,
    action: 'masking_policy.deleted',
    entityType: 'policy',
    entityId: policy._id,
    metadata: { policyName: policy.name }
  });

  return res.status(200).json({
    success: true,
    data: { id: policy._id, deleted: true },
    error: null
  });
}

/**
 * GET /api/v1/governance/compliance-report
 * Generates audit compliance report summarizing actual stored governance state.
 */
export async function getComplianceReport(req, res) {
  const organizationId = req.organizationId;

  const [datasets, policies, recentAuditEvents] = await Promise.all([
    Dataset.find({ organizationId, isDeleted: { $ne: true } }).select(
      'name schemaName classification columns qualityScore'
    ),
    MaskingPolicy.find({ organizationId }),
    Activity.find({
      organizationId,
      action: {
        $in: [
          'dataset.classification_updated',
          'column.classification_updated',
          'masking_policy.created',
          'masking_policy.updated',
          'masking_policy.deleted'
        ]
      }
    })
      .sort({ timestamp: -1 })
      .limit(10)
  ]);

  const totalDatasets = datasets.length;
  let classifiedDatasets = 0;
  let unclassifiedDatasets = 0;

  const classificationBreakdown = {
    PII: 0,
    PHI: 0,
    SENSITIVE: 0,
    PUBLIC: 0
  };

  const sensitiveColumns = [];

  for (const ds of datasets) {
    let hasClassification = false;
    if (ds.classification && ds.classification !== 'internal') {
      hasClassification = true;
    }

    for (const col of ds.columns || []) {
      const piiClass = String(col.piiClassification || '').toUpperCase();
      const colClass = String(col.classification || '').toUpperCase();

      if (piiClass === 'PII' || colClass === 'PII') {
        hasClassification = true;
        classificationBreakdown.PII++;
        sensitiveColumns.push({
          datasetId: ds._id,
          datasetName: ds.name,
          column: col.name,
          classification: 'PII'
        });
      } else if (piiClass === 'PHI' || colClass === 'PHI') {
        hasClassification = true;
        classificationBreakdown.PHI++;
        sensitiveColumns.push({
          datasetId: ds._id,
          datasetName: ds.name,
          column: col.name,
          classification: 'PHI'
        });
      } else if (['SENSITIVE_PII', 'FINANCIAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(piiClass) ||
                 ['CONFIDENTIAL', 'RESTRICTED', 'FINANCIAL'].includes(colClass)) {
        hasClassification = true;
        classificationBreakdown.SENSITIVE++;
        sensitiveColumns.push({
          datasetId: ds._id,
          datasetName: ds.name,
          column: col.name,
          classification: 'SENSITIVE'
        });
      } else if (colClass === 'PUBLIC') {
        classificationBreakdown.PUBLIC++;
      }
    }

    if (hasClassification) {
      classifiedDatasets++;
    } else {
      unclassifiedDatasets++;
    }
  }

  // Active masking policies lookup
  const activePolicyKeys = new Set(
    policies.filter((p) => p.enabled).map((p) => `${p.datasetId}:${p.column.toLowerCase()}`)
  );

  const unprotectedSensitiveColumns = sensitiveColumns.filter(
    (sc) => !activePolicyKeys.has(`${sc.datasetId}:${sc.column.toLowerCase()}`)
  );

  const totalSensitive = sensitiveColumns.length;
  const protectedSensitive = totalSensitive - unprotectedSensitiveColumns.length;
  const complianceRate = totalSensitive > 0
    ? Math.round((protectedSensitive / totalSensitive) * 10000) / 100
    : 100;

  return res.status(200).json({
    success: true,
    data: {
      summary: {
        totalDatasets,
        classifiedDatasets,
        unclassifiedDatasets,
        classificationCoveragePercentage: totalDatasets > 0
          ? Math.round((classifiedDatasets / totalDatasets) * 10000) / 100
          : 100,
        totalSensitiveColumns: totalSensitive,
        protectedSensitiveColumns: protectedSensitive,
        unprotectedSensitiveColumnsCount: unprotectedSensitiveColumns.length,
        complianceRatePercentage: complianceRate
      },
      classificationBreakdown,
      maskingPoliciesSummary: {
        total: policies.length,
        active: policies.filter((p) => p.enabled).length,
        disabled: policies.filter((p) => !p.enabled).length
      },
      unprotectedSensitiveColumns,
      recentAuditEvents
    },
    error: null,
    generatedAt: new Date().toISOString()
  });
}
