import { z } from 'zod';
import mongoose from 'mongoose';
import { LINEAGE_RELATIONSHIP_TYPES } from '../models/LineageEdge.js';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid MongoDB ObjectId'
});

export const lineageIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const datasetLineageParamSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  query: z.object({
    maxDepth: z.coerce.number().min(1).max(10).optional().default(5)
  }).optional()
});

export const createLineageEdgeSchema = z.object({
  body: z.object({
    upstreamDatasetId: objectIdSchema,
    downstreamDatasetId: objectIdSchema,
    transformationId: z.string().max(200).optional(),
    upstreamColumn: z.string().max(200).optional(),
    downstreamColumn: z.string().max(200).optional(),
    relationshipType: z.enum([
      LINEAGE_RELATIONSHIP_TYPES.DIRECT_COPY,
      LINEAGE_RELATIONSHIP_TYPES.DERIVED,
      LINEAGE_RELATIONSHIP_TYPES.AGGREGATED,
      LINEAGE_RELATIONSHIP_TYPES.JOINED,
      LINEAGE_RELATIONSHIP_TYPES.FILTERED,
      LINEAGE_RELATIONSHIP_TYPES.TRANSFORMED
    ]).optional().default(LINEAGE_RELATIONSHIP_TYPES.DERIVED),
    confidence: z.number().min(0).max(1).optional().default(1.0),
    metadata: z.record(z.any()).optional().default({})
  })
});
