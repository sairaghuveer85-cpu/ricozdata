import { z } from 'zod';
import mongoose from 'mongoose';
import { GLOSSARY_TERM_STATUSES } from '../models/GlossaryTerm.js';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid MongoDB ObjectId'
});

export const glossaryIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const createGlossaryTermSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    definition: z.string().min(5).max(2000),
    description: z.string().max(5000).optional().default(''),
    domain: z.string().max(100).optional().default('General'),
    tags: z.array(z.string().max(50)).optional().default([]),
    owner: z.string().max(100).optional().default(''),
    steward: objectIdSchema.nullable().optional(),
    synonyms: z.array(z.string().max(150)).optional().default([]),
    status: z.enum([
      GLOSSARY_TERM_STATUSES.DRAFT,
      GLOSSARY_TERM_STATUSES.APPROVED,
      GLOSSARY_TERM_STATUSES.DEPRECATED
    ]).optional().default(GLOSSARY_TERM_STATUSES.DRAFT)
  })
});

export const updateGlossaryTermSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    definition: z.string().min(5).max(2000).optional(),
    description: z.string().max(5000).optional(),
    domain: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).optional(),
    owner: z.string().max(100).optional(),
    steward: objectIdSchema.nullable().optional(),
    synonyms: z.array(z.string().max(150)).optional(),
    status: z.enum([
      GLOSSARY_TERM_STATUSES.DRAFT,
      GLOSSARY_TERM_STATUSES.APPROVED,
      GLOSSARY_TERM_STATUSES.DEPRECATED
    ]).optional()
  })
});

export const linkGlossaryTermSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    datasetId: objectIdSchema,
    column: z.string().max(200).nullable().optional()
  })
});
