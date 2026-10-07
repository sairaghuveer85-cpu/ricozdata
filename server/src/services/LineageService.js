import { LineageEdge } from '../models/LineageEdge.js';
import { Dataset } from '../models/Dataset.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../utils/logger.js';

export class LineageService {
  /**
   * Creates a normalized lineage edge between upstream and downstream datasets/columns.
   * Strictly enforces tenant isolation and validates dataset existence.
   */
  static async createEdge(data, organizationId, actorId) {
    const {
      upstreamDatasetId,
      downstreamDatasetId,
      transformationId,
      upstreamColumn,
      downstreamColumn,
      relationshipType,
      confidence,
      metadata
    } = data;

    if (String(upstreamDatasetId) === String(downstreamDatasetId) && !upstreamColumn && !downstreamColumn) {
      const err = new Error('Dataset-level self-referential lineage is not permitted');
      err.statusCode = 400;
      err.code = 'INVALID_LINEAGE';
      throw err;
    }

    // Tenant isolation: verify both upstream and downstream datasets belong to this organization
    const [upstreamDataset, downstreamDataset] = await Promise.all([
      Dataset.findOne({ _id: upstreamDatasetId, organizationId, isDeleted: { $ne: true } }),
      Dataset.findOne({ _id: downstreamDatasetId, organizationId, isDeleted: { $ne: true } })
    ]);

    if (!upstreamDataset) {
      const err = new Error('Upstream dataset not found or inaccessible in this organization');
      err.statusCode = 404;
      err.code = 'UPSTREAM_DATASET_NOT_FOUND';
      throw err;
    }

    if (!downstreamDataset) {
      const err = new Error('Downstream dataset not found or inaccessible in this organization');
      err.statusCode = 404;
      err.code = 'DOWNSTREAM_DATASET_NOT_FOUND';
      throw err;
    }

    // Upsert edge to handle duplicate creations idempotently
    const filter = {
      organizationId,
      upstreamDatasetId,
      downstreamDatasetId,
      upstreamColumn: upstreamColumn || null,
      downstreamColumn: downstreamColumn || null
    };

    const update = {
      transformationId: transformationId || null,
      relationshipType: relationshipType || 'DERIVED',
      confidence: confidence !== undefined ? confidence : 1.0,
      metadata: metadata || {},
      createdBy: actorId
    };

    const edge = await LineageEdge.findOneAndUpdate(filter, { $set: update }, { new: true, upsert: true });

    // Record activity audit
    try {
      await Activity.create({
        organizationId,
        actorId: actorId || organizationId,
        action: 'lineage_edge.created',
        entityType: 'lineage_edge',
        entityId: edge._id,
        metadata: {
          upstreamDatasetName: upstreamDataset.name,
          downstreamDatasetName: downstreamDataset.name,
          upstreamColumn,
          downstreamColumn,
          relationshipType
        }
      });
    } catch (actErr) {
      logger.warn('[LineageService] Failed to record lineage_edge.created audit:', actErr.message);
    }

    return edge;
  }

  /**
   * Traverses graph upstream to discover all parent datasets and column dependencies.
   * Cycle-safe with strict depth limits.
   */
  static async getUpstream(datasetId, organizationId, options = {}) {
    const maxDepth = Math.min(Math.max(parseInt(options.maxDepth, 10) || 5, 1), 10);
    const visited = new Set();
    const collectedEdges = [];
    const collectedNodeIds = new Set([String(datasetId)]);

    let currentQueue = [String(datasetId)];
    let currentDepth = 0;

    while (currentQueue.length > 0 && currentDepth < maxDepth) {
      currentDepth++;
      const nextQueue = [];

      const edges = await LineageEdge.find({
        organizationId,
        downstreamDatasetId: { $in: currentQueue }
      }).populate('upstreamDatasetId', 'name schemaName type assetType classification');

      for (const edge of edges) {
        collectedEdges.push(edge);
        const upId = String(edge.upstreamDatasetId?._id || edge.upstreamDatasetId);
        collectedNodeIds.add(upId);

        const edgeKey = `${upId}->${edge.downstreamDatasetId}`;
        if (!visited.has(edgeKey)) {
          visited.add(edgeKey);
          nextQueue.push(upId);
        }
      }

      currentQueue = nextQueue;
    }

    const nodes = await Dataset.find({
      _id: { $in: Array.from(collectedNodeIds) },
      organizationId,
      isDeleted: { $ne: true }
    }).select('name schemaName type assetType classification qualityScore');

    return {
      rootDatasetId: datasetId,
      direction: 'UPSTREAM',
      maxDepth,
      nodes,
      edges: collectedEdges
    };
  }

  /**
   * Traverses graph downstream to discover all child datasets and column dependencies.
   * Cycle-safe with strict depth limits.
   */
  static async getDownstream(datasetId, organizationId, options = {}) {
    const maxDepth = Math.min(Math.max(parseInt(options.maxDepth, 10) || 5, 1), 10);
    const visited = new Set();
    const collectedEdges = [];
    const collectedNodeIds = new Set([String(datasetId)]);

    let currentQueue = [String(datasetId)];
    let currentDepth = 0;

    while (currentQueue.length > 0 && currentDepth < maxDepth) {
      currentDepth++;
      const nextQueue = [];

      const edges = await LineageEdge.find({
        organizationId,
        upstreamDatasetId: { $in: currentQueue }
      }).populate('downstreamDatasetId', 'name schemaName type assetType classification');

      for (const edge of edges) {
        collectedEdges.push(edge);
        const downId = String(edge.downstreamDatasetId?._id || edge.downstreamDatasetId);
        collectedNodeIds.add(downId);

        const edgeKey = `${edge.upstreamDatasetId}->${downId}`;
        if (!visited.has(edgeKey)) {
          visited.add(edgeKey);
          nextQueue.push(downId);
        }
      }

      currentQueue = nextQueue;
    }

    const nodes = await Dataset.find({
      _id: { $in: Array.from(collectedNodeIds) },
      organizationId,
      isDeleted: { $ne: true }
    }).select('name schemaName type assetType classification qualityScore');

    return {
      rootDatasetId: datasetId,
      direction: 'DOWNSTREAM',
      maxDepth,
      nodes,
      edges: collectedEdges
    };
  }

  /**
   * Returns complete bidirectional lineage graph (both upstream and downstream) for a dataset.
   */
  static async getDatasetLineage(datasetId, organizationId, options = {}) {
    const [upstream, downstream] = await Promise.all([
      this.getUpstream(datasetId, organizationId, options),
      this.getDownstream(datasetId, organizationId, options)
    ]);

    // Merge nodes deduplicated by ID
    const nodesMap = new Map();
    [...upstream.nodes, ...downstream.nodes].forEach((n) => {
      nodesMap.set(String(n._id), n);
    });

    // Merge edges deduplicated by ID
    const edgesMap = new Map();
    [...upstream.edges, ...downstream.edges].forEach((e) => {
      edgesMap.set(String(e._id), e);
    });

    return {
      rootDatasetId: datasetId,
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values())
    };
  }

  /**
   * Deletes a lineage edge.
   */
  static async deleteEdge(edgeId, organizationId, actorId) {
    const edge = await LineageEdge.findOneAndDelete({ _id: edgeId, organizationId });
    if (!edge) {
      const err = new Error('Lineage relationship not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    try {
      await Activity.create({
        organizationId,
        actorId: actorId || organizationId,
        action: 'lineage_edge.deleted',
        entityType: 'lineage_edge',
        entityId: edge._id,
        metadata: {
          upstreamDatasetId: String(edge.upstreamDatasetId),
          downstreamDatasetId: String(edge.downstreamDatasetId)
        }
      });
    } catch (actErr) {
      logger.warn('[LineageService] Failed to record lineage_edge.deleted audit:', actErr.message);
    }

    return { id: edgeId, deleted: true };
  }
}

export default LineageService;
