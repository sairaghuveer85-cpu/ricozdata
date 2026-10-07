import { z } from 'zod';
import mongoose from 'mongoose';
import { MASKING_STRATEGIES } from '../models/MaskingPolicy.js';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid MongoDB ObjectId'
});

export const maskingPolicyIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const updateClassificationSchema = z.object({
  body: z.object({
    datasetId: objectIdSchema,
    column: z.string().max(200).optional(),
    classification: z.enum(['PII', 'PHI', 'SENSITIVE', 'PUBLIC'])
  })
});

export const createMaskingPolicySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    description: z.string().max(1000).optional().default(''),
    datasetId: objectIdSchema,
    column: z.string().min(1).max(200),
    maskingType: z.enum([
      MASKING_STRATEGIES.REDACT,
      MASKING_STRATEGIES.PARTIAL,
      MASKING_STRATEGIES.HASH,
      MASKING_STRATEGIES.TOKENIZED
    ]),
    roles: z.array(z.string().max(50)).optional().default(['viewer', 'analyst']),
    enabled: z.boolean().optional().default(true)
  })
});

export const updateMaskingPolicySchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(1000).optional(),
    maskingType: z.enum([
      MASKING_STRATEGIES.REDACT,
      MASKING_STRATEGIES.PARTIAL,
      MASKING_STRATEGIES.HASH,
      MASKING_STRATEGIES.TOKENIZED
    ]).optional(),
    roles: z.array(z.string().max(50)).optional(),
    enabled: z.boolean().optional()
  })
});
