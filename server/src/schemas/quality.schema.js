import { z } from 'zod';
import mongoose from 'mongoose';
import { QUALITY_RULE_TYPES, QUALITY_SEVERITIES } from '../models/QualityRule.js';
import { QUALITY_ISSUE_STATUSES } from '../models/QualityIssue.js';
import { validateSafeRegex, validateCustomSql } from '../utils/securityValidators.js';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid MongoDB ObjectId'
});

export const datasetIdParamSchema = z.object({
  params: z.object({
    datasetId: objectIdSchema
  })
});

export const ruleIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const runIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const issueIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const createQualityRuleSchema = z.object({
  params: z.object({
    datasetId: objectIdSchema.optional()
  }).optional(),
  body: z.object({
    datasetId: objectIdSchema.optional(),
    name: z.string().min(2).max(150),
    description: z.string().max(1000).optional().default(''),
    ruleType: z.enum([
      QUALITY_RULE_TYPES.NULL_CHECK,
      QUALITY_RULE_TYPES.UNIQUENESS,
      QUALITY_RULE_TYPES.REGEX_PATTERN,
      QUALITY_RULE_TYPES.VALUE_RANGE,
      QUALITY_RULE_TYPES.REFERENCE_INTEGRITY,
      QUALITY_RULE_TYPES.CUSTOM_SQL
    ]),
    targetColumn: z.string().max(200).optional(),
    targetColumns: z.array(z.string().max(200)).optional(),
    configuration: z.record(z.any()).default({}),
    severity: z.enum([
      QUALITY_SEVERITIES.LOW,
      QUALITY_SEVERITIES.MEDIUM,
      QUALITY_SEVERITIES.HIGH,
      QUALITY_SEVERITIES.CRITICAL
    ]).optional().default(QUALITY_SEVERITIES.MEDIUM),
    enabled: z.boolean().optional().default(true),
    owner: z.string().max(100).optional().default('')
  }).superRefine((data, ctx) => {
    // Validate targetColumn or targetColumns
    if (data.ruleType === QUALITY_RULE_TYPES.NULL_CHECK ||
        data.ruleType === QUALITY_RULE_TYPES.REGEX_PATTERN ||
        data.ruleType === QUALITY_RULE_TYPES.VALUE_RANGE ||
        data.ruleType === QUALITY_RULE_TYPES.REFERENCE_INTEGRITY) {
      if (!data.targetColumn && !data.configuration?.column) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Target column is required for rule type ${data.ruleType}`,
          path: ['targetColumn']
        });
      }
    }

    if (data.ruleType === QUALITY_RULE_TYPES.UNIQUENESS) {
      const cols = data.targetColumns?.length ? data.targetColumns : (data.targetColumn ? [data.targetColumn] : []);
      if (cols.length === 0 && !data.configuration?.column) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one target column is required for UNIQUENESS rule',
          path: ['targetColumns']
        });
      }
    }

    // Validate regex pattern
    if (data.ruleType === QUALITY_RULE_TYPES.REGEX_PATTERN) {
      const pattern = data.configuration?.pattern;
      const regRes = validateSafeRegex(pattern);
      if (!regRes.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: regRes.error || 'Invalid or unsafe regular expression',
          path: ['configuration', 'pattern']
        });
      }
    }

    // Validate value range
    if (data.ruleType === QUALITY_RULE_TYPES.VALUE_RANGE) {
      const min = data.configuration?.min;
      const max = data.configuration?.max;
      if (min === undefined && max === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'VALUE_RANGE rule requires at least min or max value',
          path: ['configuration']
        });
      }
    }

    // Validate reference integrity
    if (data.ruleType === QUALITY_RULE_TYPES.REFERENCE_INTEGRITY) {
      if (!data.configuration?.referenceTable) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'referenceTable is required for REFERENCE_INTEGRITY rule',
          path: ['configuration', 'referenceTable']
        });
      }
      if (!data.configuration?.referenceColumn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'referenceColumn is required for REFERENCE_INTEGRITY rule',
          path: ['configuration', 'referenceColumn']
        });
      }
    }

    // Validate custom SQL
    if (data.ruleType === QUALITY_RULE_TYPES.CUSTOM_SQL) {
      const query = data.configuration?.query;
      const sqlRes = validateCustomSql(query);
      if (!sqlRes.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: sqlRes.error || 'Invalid or unsafe SQL query',
          path: ['configuration', 'query']
        });
      }
    }
  })
});

export const updateQualityRuleSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(1000).optional(),
    targetColumn: z.string().max(200).optional(),
    targetColumns: z.array(z.string().max(200)).optional(),
    configuration: z.record(z.any()).optional(),
    severity: z.enum([
      QUALITY_SEVERITIES.LOW,
      QUALITY_SEVERITIES.MEDIUM,
      QUALITY_SEVERITIES.HIGH,
      QUALITY_SEVERITIES.CRITICAL
    ]).optional(),
    enabled: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    owner: z.string().max(100).optional()
  }).superRefine((data, ctx) => {
    if (data.configuration?.pattern) {
      const regRes = validateSafeRegex(data.configuration.pattern);
      if (!regRes.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: regRes.error || 'Invalid or unsafe regular expression',
          path: ['configuration', 'pattern']
        });
      }
    }
    if (data.configuration?.query) {
      const sqlRes = validateCustomSql(data.configuration.query);
      if (!sqlRes.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: sqlRes.error || 'Invalid or unsafe SQL query',
          path: ['configuration', 'query']
        });
      }
    }
  })
});

export const updateQualityIssueSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    status: z.enum([
      QUALITY_ISSUE_STATUSES.OPEN,
      QUALITY_ISSUE_STATUSES.IN_REVIEW,
      QUALITY_ISSUE_STATUSES.RESOLVED
    ]).optional(),
    severity: z.enum([
      QUALITY_SEVERITIES.LOW,
      QUALITY_SEVERITIES.MEDIUM,
      QUALITY_SEVERITIES.HIGH,
      QUALITY_SEVERITIES.CRITICAL
    ]).optional(),
    assignedTo: objectIdSchema.nullable().optional(),
    rootCause: z.string().max(2000).optional(),
    resolutionNotes: z.string().max(2000).optional()
  })
});
