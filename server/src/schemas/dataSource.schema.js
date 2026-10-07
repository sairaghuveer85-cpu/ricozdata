import { z } from 'zod';
import { zObjectId } from '../middleware/validate.js';
import { validateSafeHost } from '../utils/securityValidators.js';

// Reusable safe identifier regex: hostnames, domains, IP addresses
const SAFE_HOST_REGEX = /^[a-zA-Z0-9.-]+$/;
const SAFE_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

// Supported data source types enum
export const SUPPORTED_SOURCE_TYPES = [
  'postgresql',
  'mysql',
  'snowflake',
  'bigquery',
  'redshift',
  'mongodb',
  's3',
  'kafka',
  'api',
  'oracle',
  'sqlserver',
  'other'
];

export const STATUS_ENUM = [
  'ACTIVE',
  'INACTIVE',
  'ERROR',
  'PENDING',
  'DISCONNECTED',
  'CONNECTED',
  'TESTING',
  'active',
  'inactive',
  'error',
  'pending',
  'disconnected',
  'connected',
  'testing'
];

// Configuration schemas per connector type
export const postgresConfigSchema = z
  .object({
    host: z.string().trim().min(1, 'Host is required').max(255).regex(SAFE_HOST_REGEX, 'Host contains invalid characters'),
    port: z.coerce.number().int().min(1, 'Port must be between 1 and 65535').max(65535, 'Port must be between 1 and 65535').default(5432).optional(),
    database: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Database name contains invalid characters').optional(),
    schema: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Schema contains invalid characters').optional(),
    ssl: z.boolean().optional(),
    connectTimeout: z.coerce.number().int().min(100).max(60000).optional(),
    parameters: z.record(z.any()).optional()
  })
  .strict();

export const mysqlConfigSchema = z
  .object({
    host: z.string().trim().min(1, 'Host is required').max(255).regex(SAFE_HOST_REGEX, 'Host contains invalid characters'),
    port: z.coerce.number().int().min(1, 'Port must be between 1 and 65535').max(65535, 'Port must be between 1 and 65535').default(3306).optional(),
    database: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Database name contains invalid characters').optional(),
    ssl: z.boolean().optional(),
    connectTimeout: z.coerce.number().int().min(100).max(60000).optional(),
    parameters: z.record(z.any()).optional()
  })
  .strict();

export const snowflakeConfigSchema = z
  .object({
    account: z.string().trim().min(1, 'Account identifier is required').max(255).regex(SAFE_NAME_REGEX, 'Account contains invalid characters'),
    username: z.string().trim().max(128).optional(),
    authMethod: z.enum(['password', 'keypair', 'key_pair', 'externalbrowser', 'oauth']).default('password').optional(),
    warehouse: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Warehouse contains invalid characters').optional(),
    database: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Database contains invalid characters').optional(),
    schema: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Schema contains invalid characters').optional(),
    role: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Role contains invalid characters').optional(),
    clientSessionKeepAlive: z.boolean().optional(),
    connectTimeout: z.coerce.number().int().min(100).max(60000).optional(),
    parameters: z.record(z.any()).optional()
  })
  .passthrough();

export const sqlserverConfigSchema = z
  .object({
    host: z.string().trim().min(1, 'Host is required').max(255).regex(SAFE_HOST_REGEX, 'Host contains invalid characters'),
    port: z.coerce.number().int().min(1, 'Port must be between 1 and 65535').max(65535, 'Port must be between 1 and 65535').default(1433).optional(),
    instanceName: z.string().trim().max(128).regex(SAFE_NAME_REGEX, 'Instance name contains invalid characters').optional(),
    database: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Database name contains invalid characters').optional(),
    schema: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Schema contains invalid characters').default('dbo').optional(),
    authType: z.enum(['sql', 'windows', 'azure-active-directory-password']).default('sql').optional(),
    domain: z.string().trim().max(128).optional(),
    trustServerCertificate: z.boolean().default(true).optional(),
    encrypt: z.boolean().default(true).optional(),
    connectTimeout: z.coerce.number().int().min(100).max(60000).default(15000).optional(),
    parameters: z.record(z.any()).optional()
  })
  .passthrough();

export const mongodbConfigSchema = z
  .object({
    host: z.string().trim().max(255).regex(SAFE_HOST_REGEX, 'Host contains invalid characters').optional(),
    port: z.coerce.number().int().min(1, 'Port must be between 1 and 65535').max(65535, 'Port must be between 1 and 65535').default(27017).optional(),
    database: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Database name contains invalid characters').optional(),
    authSource: z.string().trim().min(1).max(128).regex(SAFE_NAME_REGEX, 'Auth source contains invalid characters').optional(),
    authMechanism: z.string().trim().max(64).optional(),
    replicaSet: z.string().trim().max(128).regex(SAFE_NAME_REGEX, 'Replica set name contains invalid characters').optional(),
    ssl: z.boolean().optional(),
    tls: z.boolean().optional(),
    connectionString: z.string().trim().optional(),
    connectionUrl: z.string().trim().optional(),
    uri: z.string().trim().optional(),
    connectTimeout: z.coerce.number().int().min(100).max(60000).optional(),
    parameters: z.record(z.any()).optional()
  })
  .strict();

export const s3ConfigSchema = z
  .object({
    region: z.string().trim().min(1, 'Region is required').max(64).regex(/^[a-zA-Z0-9-]+$/, 'Region contains invalid characters'),
    bucket: z.string().trim().min(3, 'Bucket name must be at least 3 characters').max(63, 'Bucket cannot exceed 63 characters').regex(/^[a-z0-9.-]+$/, 'Bucket name must be valid S3 format'),
    prefix: z
      .string()
      .trim()
      .max(512)
      .refine((p) => !p.includes('..'), {
        message: 'Prefix cannot contain parent directory traversal (..)'
      })
      .optional(),
    parameters: z.record(z.any()).optional()
  })
  .strict();

function validateSourceConfiguration(type, config, ctx) {
  if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
    return;
  }

  // Reject MongoDB injection operators
  const jsonStr = JSON.stringify(config);
  if (jsonStr.includes('"$where"') || jsonStr.includes('"$gt"') || jsonStr.includes('"$regex"')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Configuration must not contain MongoDB query operators'
    });
    return;
  }

  // SSRF Protection: Validate host address
  if (config.host) {
    const hostCheck = validateSafeHost(config.host, {
      allowLocal: process.env.NODE_ENV !== 'production'
    });
    if (!hostCheck.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['configuration', 'host'],
        message: hostCheck.error
      });
      return;
    }
  }

  const normalizedType = String(type).toLowerCase().trim();
  let result;

  switch (normalizedType) {
    case 'postgresql':
      result = postgresConfigSchema.safeParse(config);
      break;
    case 'mysql':
      result = mysqlConfigSchema.safeParse(config);
      break;
    case 'snowflake':
      result = snowflakeConfigSchema.safeParse(config);
      break;
    case 'sqlserver':
      result = sqlserverConfigSchema.safeParse(config);
      break;
    case 'mongodb':
      result = mongodbConfigSchema.safeParse(config);
      break;
    case 's3':
      result = s3ConfigSchema.safeParse(config);
      break;
    default:
      result = { success: true };
      break;
  }

  if (result && !result.success) {
    result.error.issues.forEach((issue) => {
      ctx.addIssue({
        ...issue,
        path: ['configuration', ...(issue.path || [])]
      });
    });
  }
}

export const dataSourceIdParamSchema = {
  params: z.object({
    id: zObjectId
  })
};

export const createDataSourceSchema = {
  body: z
    .object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
      type: z
        .string()
        .trim()
        .transform((v) => v.toLowerCase())
        .pipe(
          z.enum(SUPPORTED_SOURCE_TYPES, {
            message: 'Unsupported data source type'
          })
        ),
      description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional(),
      configuration: z.record(z.any()).optional(),
      connectionConfig: z.record(z.any()).optional(),
      credentials: z.any().optional(),
      tags: z.array(z.string().trim().max(50)).max(20).optional(),
      metadata: z.record(z.any()).optional(),

      // Mass-assignment protection: reject prohibited system fields
      organizationId: z.never({ message: 'organizationId cannot be provided in request body' }).optional(),
      _id: z.never({ message: '_id cannot be provided in request body' }).optional(),
      id: z.never({ message: 'id cannot be provided in request body' }).optional(),
      createdBy: z.never({ message: 'createdBy is managed automatically' }).optional(),
      updatedBy: z.never({ message: 'updatedBy is managed automatically' }).optional(),
      healthStatus: z.never({ message: 'healthStatus is managed automatically' }).optional(),
      lastTestedAt: z.never({ message: 'lastTestedAt is managed automatically' }).optional(),
      lastTestLatencyMs: z.never({ message: 'lastTestLatencyMs is managed automatically' }).optional(),
      lastTestError: z.never({ message: 'lastTestError is managed automatically' }).optional(),
      connectionState: z.never({ message: 'connectionState is managed automatically' }).optional(),
      isDeleted: z.never({ message: 'isDeleted cannot be modified directly' }).optional(),
      deletedAt: z.never({ message: 'deletedAt cannot be modified directly' }).optional()
    })
    .superRefine((data, ctx) => {
      const config = data.configuration || data.connectionConfig;
      if (config) {
        validateSourceConfiguration(data.type, config, ctx);
      }
    })
};

export const updateDataSourceSchema = {
  params: z.object({
    id: zObjectId
  }),
  body: z
    .object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
      description: z.string().trim().max(1000).optional(),
      type: z
        .string()
        .trim()
        .transform((v) => v.toLowerCase())
        .pipe(z.enum(SUPPORTED_SOURCE_TYPES))
        .optional(),
      status: z.enum(STATUS_ENUM, { message: 'Invalid data source status' }).optional(),
      configuration: z.record(z.any()).optional(),
      connectionConfig: z.record(z.any()).optional(),
      credentials: z.any().optional(),
      tags: z.array(z.string().trim().max(50)).max(20).optional(),
      metadata: z.record(z.any()).optional(),

      // Mass-assignment protection: reject prohibited system fields
      organizationId: z.never({ message: 'organizationId cannot be modified in payload' }).optional(),
      _id: z.never({ message: '_id cannot be modified in payload' }).optional(),
      id: z.never({ message: 'id cannot be modified in payload' }).optional(),
      createdBy: z.never({ message: 'createdBy cannot be modified in payload' }).optional(),
      updatedBy: z.never({ message: 'updatedBy is managed automatically' }).optional(),
      healthStatus: z.never({ message: 'healthStatus cannot be modified in payload' }).optional(),
      lastTestedAt: z.never({ message: 'lastTestedAt cannot be modified in payload' }).optional(),
      lastTestLatencyMs: z.never({ message: 'lastTestLatencyMs cannot be modified in payload' }).optional(),
      lastTestError: z.never({ message: 'lastTestError cannot be modified in payload' }).optional(),
      connectionState: z.never({ message: 'connectionState cannot be modified in payload' }).optional(),
      isDeleted: z.never({ message: 'isDeleted cannot be modified directly' }).optional(),
      deletedAt: z.never({ message: 'deletedAt cannot be modified directly' }).optional()
    })
    .superRefine((data, ctx) => {
      const config = data.configuration || data.connectionConfig;
      if (config && data.type) {
        validateSourceConfiguration(data.type, config, ctx);
      }
    })
};
