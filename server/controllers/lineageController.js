const Lineage = require('../models/Lineage');
const Dataset = require('../models/Dataset');
const asyncHandler = require('../middleware/asyncHandler');

const mongoose = require('mongoose');

// @desc    Get lineage graph for a dataset
// @route   GET /api/lineage/:datasetId
// @access  Private
const getLineageForDataset = asyncHandler(async (req, res) => {
  const param = req.params.datasetId;
  const isObjectId = mongoose.Types.ObjectId.isValid(param);

  let dataset = null;
  if (isObjectId) {
    dataset = await Dataset.findById(param);
  }
  if (!dataset) {
    dataset = await Dataset.findOne({
      $or: [{ id: param }, { name: param }, { slug: param }]
    });
  }

  if (!dataset) {
    return res.status(404).json({ success: false, message: 'Dataset not found' });
  }

  // Look for persisted Lineage record by dataset._id
  let lineage = await Lineage.findOne({ datasetId: dataset._id }).populate('datasetId', 'name source sourceType schema rowCount quality');

  // If lineage document does not exist, or has only the basic 2 nodes, enrich with discovered relationships
  if (!lineage || (Array.isArray(lineage.nodes) && lineage.nodes.length <= 2)) {
    lineage = await enrichLineageForDataset(dataset, lineage);
  }

  res.json({
    success: true,
    data: lineage,
  });
});

// Helper: Dynamically assemble and persist evidence-backed lineage with inter-table foreign keys
async function enrichLineageForDataset(dataset, existingLineage = null) {
  const sourceLabel = dataset.source || 'Enterprise Data Source';
  const sourceType = dataset.sourceType || 'Data Source';

  // Find sibling datasets in the same data source
  const siblings = dataset.dataSourceId
    ? await Dataset.find({ dataSourceId: dataset.dataSourceId, isDeleted: { $ne: true } })
    : [];

  const siblingMap = new Map();
  for (const s of siblings) {
    if (s.tableName) siblingMap.set(s.tableName.toLowerCase(), s);
    if (s.name) siblingMap.set(s.name.toLowerCase(), s);
  }

  const currTableKey = (dataset.tableName || dataset.name || '').toLowerCase();
  const cols = dataset.columns || dataset.schema || [];

  // 1. Upstream datasets: foreign keys on this dataset pointing to a sibling table
  const upstreamDatasetsMap = new Map();
  const upstreamEdges = [];

  for (const col of cols) {
    let refTable = null;
    let refCol = null;
    let constraintName = null;

    if (typeof col.foreignKey === 'string' && col.foreignKey.includes('.')) {
      const parts = col.foreignKey.split('.');
      refTable = parts[0];
      refCol = parts[1] || 'id';
    } else if (col.foreignKey && typeof col.foreignKey === 'object') {
      refTable = col.foreignKey.referencedTable;
      refCol = col.foreignKey.referencedColumn;
      constraintName = col.foreignKey.constraintName;
    }

    if (refTable) {
      const parentDs = siblingMap.get(refTable.toLowerCase());
      if (parentDs && String(parentDs._id) !== String(dataset._id)) {
        upstreamDatasetsMap.set(String(parentDs._id), parentDs);
        const edgeId = `edge-${parentDs._id}-${dataset._id}-${constraintName || col.name || 'fk'}`;
        upstreamEdges.push({
          id: edgeId,
          source: `dataset-${parentDs._id}`,
          target: `dataset-${dataset._id}`,
          animated: true,
          style: { stroke: '#2563eb', strokeWidth: 2 },
          data: {
            relationshipType: 'references',
            foreignKey: constraintName || 'foreign_key',
            sourceColumn: refCol,
            targetColumn: col.name,
            evidence: `Foreign key constraint: ${constraintName || 'FK'} (${dataset.tableName || dataset.name}.${col.name} → ${parentDs.tableName || parentDs.name}.${refCol})`,
            status: 'healthy'
          }
        });
      }
    }
  }

  // 2. Downstream datasets: sibling tables that have foreign keys pointing to this table
  const downstreamDatasetsMap = new Map();
  const downstreamEdges = [];

  for (const sib of siblings) {
    if (String(sib._id) === String(dataset._id)) continue;
    const sibCols = sib.columns || sib.schema || [];
    for (const sc of sibCols) {
      let refTable = null;
      let refCol = null;
      let constraintName = null;

      if (typeof sc.foreignKey === 'string' && sc.foreignKey.includes('.')) {
        const parts = sc.foreignKey.split('.');
        refTable = parts[0];
        refCol = parts[1] || 'id';
      } else if (sc.foreignKey && typeof sc.foreignKey === 'object') {
        refTable = sc.foreignKey.referencedTable;
        refCol = sc.foreignKey.referencedColumn;
        constraintName = sc.foreignKey.constraintName;
      }

      if (refTable && refTable.toLowerCase() === currTableKey) {
        downstreamDatasetsMap.set(String(sib._id), sib);
        const edgeId = `edge-${dataset._id}-${sib._id}-${constraintName || sc.name || 'fk'}`;
        downstreamEdges.push({
          id: edgeId,
          source: `dataset-${dataset._id}`,
          target: `dataset-${sib._id}`,
          animated: true,
          style: { stroke: '#06b6d4', strokeWidth: 2 },
          data: {
            relationshipType: 'referenced_by',
            foreignKey: constraintName || 'foreign_key',
            sourceColumn: refCol,
            targetColumn: sc.name,
            evidence: `Referenced by foreign key: ${constraintName || 'FK'} (${sib.tableName || sib.name}.${sc.name} → ${dataset.tableName || dataset.name}.${refCol})`,
            status: 'healthy'
          }
        });
      }
    }
  }

  const upstreamList = Array.from(upstreamDatasetsMap.values());
  const downstreamList = Array.from(downstreamDatasetsMap.values());

  // If no inter-table foreign keys found and existingLineage already exists, return existingLineage
  if (upstreamList.length === 0 && downstreamList.length === 0 && existingLineage) {
    return existingLineage;
  }

  const currentX = upstreamList.length > 0 ? 720 : 400;
  const downstreamX = upstreamList.length > 0 ? 1060 : 750;

  const datasetNodes = [
    // Source Node
    {
      id: `source-${dataset._id}`,
      type: 'customLineageNode',
      position: { x: 50, y: 170 },
      data: {
        category: 'Source',
        categoryType: 'source',
        label: sourceLabel,
        typeLabel: sourceType,
        system: sourceLabel,
        source: `${sourceLabel} verified ingestion`,
        status: 'active'
      }
    },
    // Upstream Nodes
    ...upstreamList.map((parentDs, idx) => ({
      id: `dataset-${parentDs._id}`,
      type: 'customLineageNode',
      position: { x: 380, y: 70 + idx * 130 },
      data: {
        category: 'Upstream Dataset',
        categoryType: 'dataset',
        label: parentDs.name,
        typeLabel: parentDs.sourceType || sourceType,
        system: sourceLabel,
        datasetId: parentDs._id,
        source: sourceLabel,
        rows: parentDs.rowCount || 'N/A',
        quality: parentDs.quality ? `${parentDs.quality}%` : 'Unrated',
        isPrimary: false,
        status: 'active'
      }
    })),
    // Current Dataset Node
    {
      id: `dataset-${dataset._id}`,
      type: 'customLineageNode',
      position: { x: currentX, y: 170 },
      data: {
        category: 'Dataset',
        categoryType: 'dataset',
        label: dataset.name,
        typeLabel: sourceType,
        system: sourceLabel,
        datasetId: dataset._id,
        source: sourceLabel,
        rows: dataset.rowCount || 'N/A',
        quality: dataset.quality ? `${dataset.quality}%` : 'Unrated',
        domainId: dataset.domain || dataset.domainId,
        columnsCount: dataset.schema ? dataset.schema.length : (dataset.columns ? dataset.columns.length : 0),
        status: 'active',
        isPrimary: true
      }
    },
    // Downstream Nodes
    ...downstreamList.map((childDs, idx) => ({
      id: `dataset-${childDs._id}`,
      type: 'customLineageNode',
      position: { x: downstreamX, y: 70 + idx * 130 },
      data: {
        category: 'Destination',
        categoryType: 'destination',
        label: childDs.name,
        typeLabel: childDs.sourceType || sourceType,
        system: sourceLabel,
        datasetId: childDs._id,
        source: sourceLabel,
        rows: childDs.rowCount || 'N/A',
        quality: childDs.quality ? `${childDs.quality}%` : 'Unrated',
        isPrimary: false,
        status: 'active'
      }
    }))
  ];

  const baseSourceEdge = {
    id: `edge-${dataset._id}-source`,
    source: `source-${dataset._id}`,
    target: `dataset-${dataset._id}`,
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2.5 },
    data: {
      relationshipType: 'ingests',
      evidence: 'Verified catalog metadata ingestion',
      status: 'healthy'
    }
  };

  const edgeMap = new Map();
  edgeMap.set(baseSourceEdge.id, baseSourceEdge);
  for (const e of upstreamEdges) edgeMap.set(e.id, e);
  for (const e of downstreamEdges) edgeMap.set(e.id, e);
  const datasetEdges = Array.from(edgeMap.values());

  const sourceDatasets = [sourceLabel, ...upstreamList.map(u => u.name)];
  const destinationDatasets = downstreamList.map(d => d.name);
  let transformationInfo = `Direct governed ingestion from ${sourceLabel}`;
  if (upstreamList.length > 0) {
    transformationInfo = `Foreign key dependency from ${upstreamList.map(u => u.name).join(', ')} into ${dataset.name}`;
  }

  try {
    const updated = await Lineage.findOneAndUpdate(
      { datasetId: dataset._id },
      {
        $set: {
          datasetId: dataset._id,
          nodes: datasetNodes,
          edges: datasetEdges,
          sourceDatasets,
          destinationDatasets,
          transformationInfo,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    return updated;
  } catch (e) {
    return {
      datasetId: dataset._id,
      nodes: datasetNodes,
      edges: datasetEdges,
      sourceDatasets,
      destinationDatasets,
      transformationInfo
    };
  }
}

// @desc    Get all lineage graphs
// @route   GET /api/lineage
// @access  Private
const getAllLineage = asyncHandler(async (req, res) => {
  const lineage = await Lineage.find().populate('datasetId', 'name');

  res.json({
    success: true,
    data: lineage,
  });
});

// @desc    Create or update lineage graph for a dataset
// @route   POST /api/lineage
// @access  Private
const createLineage = asyncHandler(async (req, res) => {
  const { datasetId, nodes, edges, sourceDatasets, destinationDatasets, transformationInfo } = req.body;

  const existingLineage = await Lineage.findOne({ datasetId });

  if (existingLineage) {
    existingLineage.nodes = nodes || existingLineage.nodes;
    existingLineage.edges = edges || existingLineage.edges;
    existingLineage.sourceDatasets = sourceDatasets || existingLineage.sourceDatasets;
    existingLineage.destinationDatasets = destinationDatasets || existingLineage.destinationDatasets;
    existingLineage.transformationInfo = transformationInfo || existingLineage.transformationInfo;

    const updated = await existingLineage.save();
    return res.json({
      success: true,
      data: updated,
    });
  }

  const lineage = await Lineage.create({
    datasetId,
    nodes,
    edges,
    sourceDatasets,
    destinationDatasets,
    transformationInfo,
  });

  res.status(201).json({
    success: true,
    data: lineage,
  });
});

// @desc    Update lineage graph
// @route   PUT /api/lineage/:id
// @access  Private
const updateLineage = asyncHandler(async (req, res) => {
  const lineage = await Lineage.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('datasetId', 'name');

  if (!lineage) {
    return res.status(404).json({ success: false, message: 'Lineage graph not found' });
  }

  res.json({
    success: true,
    data: lineage,
  });
});

// @desc    Delete lineage graph
// @route   DELETE /api/lineage/:id
// @access  Private
const deleteLineage = asyncHandler(async (req, res) => {
  const lineage = await Lineage.findByIdAndDelete(req.params.id);

  if (!lineage) {
    return res.status(404).json({ success: false, message: 'Lineage graph not found' });
  }

  res.json({
    success: true,
    message: 'Lineage graph removed',
  });
});

module.exports = {
  getLineageForDataset,
  getAllLineage,
  createLineage,
  updateLineage,
  deleteLineage,
};