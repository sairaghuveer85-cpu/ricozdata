import { z } from 'zod';
import { zObjectId } from '../middleware/validate.js';

export const datasetIdParamSchema = {
  params: z.object({
    id: zObjectId
  }).strict()
};

export const columnSchema = z.object({
  name: z.string().trim().min(1, 'Column name cannot be empty').max(200),
  dataType: z.string().trim().min(1, 'Data type is required').max(100),
  nullable: z.boolean().default(true),
  ordinalPosition: z.number().int().min(1).default(1),
  defaultValue: z.string().nullable().optional(),
  isPrimaryKey: z.boolean().default(false),
  isForeignKey: z.boolean().default(false),
  description: z.string().max(1000).optional().default(''),
  tags: z.array(z.string().trim().max(50)).max(50).optional().default([]),
  classification: z.enum(['none', 'public', 'internal', 'confidential', 'restricted', 'pii', 'financial']).optional().default('none')
});

export const createDatasetSchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Dataset name is required').max(200),
    dataSourceId: zObjectId,
    externalId: z.string().trim().max(300).optional(),
    schemaName: z.string().trim().max(100).optional().default('public'),
    path: z.string().trim().max(500).optional(),
    description: z.string().trim().max(2000).optional().default(''),
    type: z.enum(['table', 'view', 'stream', 'file', 'collection', 'model']).optional().default('table'),
    origin: z.enum(['DISCOVERED', 'MANUAL']).optional().default('MANUAL'),
    columns: z.array(columnSchema).max(1000).optional().default([]),
    tags: z.array(z.string().trim().max(50)).max(50).optional().default([]),
    classification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional().default('internal'),
    metadata: z.record(z.any()).optional().default({})
  }).strict()
};

export const updateDatasetSchema = {
  params: z.object({
    id: zObjectId
  }).strict(),
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    path: z.string().trim().max(500).optional(),
    type: z.enum(['table', 'view', 'stream', 'file', 'collection', 'model']).optional(),
    columns: z.array(columnSchema).max(1000).optional(),
    tags: z.array(z.string().trim().max(50)).max(50).optional(),
    classification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional(),
    metadata: z.record(z.any()).optional(),
    // Strictly disallow mutating immutable tenant and source identity fields
    organizationId: z.never().optional(),
    dataSourceId: z.never().optional(),
    externalId: z.never().optional(),
    _id: z.never().optional(),
    createdBy: z.never().optional()
  }).strict()
};

export const queryDatasetSchema = {
  params: z.object({
    id: zObjectId
  }).strict(),
  body: z.object({
    query: z.string().trim().min(1, 'SQL query is required').max(2000, 'SQL query exceeds maximum allowed length of 2000 characters'),
    limit: z.number().int().min(1).max(500).optional().default(50)
  }).strict()
};
