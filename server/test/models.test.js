import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  Organization,
  User,
  DataSource,
  Dataset,
  Activity
} from '../src/models/index.js';

describe('Step 05 — Database Architecture & Foundational Models', () => {
  const dummyOrgId = new mongoose.Types.ObjectId();
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyDataSourceId = new mongoose.Types.ObjectId();
  const dummyDatasetId = new mongoose.Types.ObjectId();

  describe('1. Organization Model', () => {
    test('validates valid organization document', () => {
      const org = new Organization({
        name: 'Acme Enterprise Corp',
        slug: 'acme-corp',
        status: 'active',
        settings: {
          tier: 'enterprise',
          maxDataSources: 25,
          maxUsers: 100
        }
      });

      const validationError = org.validateSync();
      assert.strictEqual(validationError, undefined, 'Valid organization must pass validation');
      assert.strictEqual(org.slug, 'acme-corp');
      assert.strictEqual(org.settings.tier, 'enterprise');
    });

    test('fails validation when required fields are missing or slug format is invalid', () => {
      const invalidOrg = new Organization({
        slug: 'Invalid Slug With Spaces!'
      });

      const error = invalidOrg.validateSync();
      assert.ok(error, 'Should fail validation');
      assert.ok(error.errors.name, 'Name is required');
      assert.ok(error.errors.slug, 'Slug format validation should fail');
    });
  });

  describe('2. User Model', () => {
    test('validates valid user and excludes passwordHash in toJSON', () => {
      const user = new User({
        organizationId: dummyOrgId,
        name: 'Sarah Connor',
        email: 'sarah.connor@acme.io',
        passwordHash: '$2b$12$e8xYzFzG9...encrypted_hash',
        role: 'data_steward',
        status: 'active',
        department: 'Governance & Compliance'
      });

      const validationError = user.validateSync();
      assert.strictEqual(validationError, undefined, 'Valid user must pass validation');

      // Test JSON transformation security
      const serialized = user.toJSON();
      assert.strictEqual(serialized.passwordHash, undefined, 'passwordHash must never be exposed in toJSON');
      assert.strictEqual(serialized.__v, undefined, '__v must be stripped in toJSON');
      assert.strictEqual(serialized.email, 'sarah.connor@acme.io');
    });

    test('fails validation on invalid email or missing organizationId', () => {
      const invalidUser = new User({
        name: 'John Doe',
        email: 'not-an-email',
        passwordHash: 'dummyhash'
      });

      const error = invalidUser.validateSync();
      assert.ok(error, 'Should fail validation');
      assert.ok(error.errors.organizationId, 'organizationId is required for multi-tenant isolation');
      assert.ok(error.errors.email, 'Email format regex validation must fail');
    });

    test('validates role enum constraints', () => {
      const invalidUser = new User({
        organizationId: dummyOrgId,
        name: 'Hacker',
        email: 'hacker@acme.io',
        passwordHash: 'dummyhash',
        role: 'super_root_admin' // Not in enum
      });

      const error = invalidUser.validateSync();
      assert.ok(error, 'Should fail validation');
      assert.ok(error.errors.role, 'Role must belong to approved enum');
    });
  });

  describe('3. DataSource Model', () => {
    test('validates valid data source and protects credentials payload', () => {
      const ds = new DataSource({
        organizationId: dummyOrgId,
        name: 'Production Snowflake Warehouse',
        type: 'snowflake',
        status: 'connected',
        connectionConfig: {
          host: 'xy12345.snowflakecomputing.com',
          database: 'PROD_ANALYTICS',
          schema: 'PUBLIC',
          warehouse: 'COMPUTE_WH',
          ssl: true
        },
        credentials: {
          type: 'encrypted_payload',
          encryptedData: 'aes-gcm:iv:ciphertext:tag',
          keyId: 'kms-key-uuid-123'
        },
        tags: ['production', 'analytics', 'snowflake']
      });

      const validationError = ds.validateSync();
      assert.strictEqual(validationError, undefined, 'Valid data source must pass validation');

      // Test credentials encryption protection in JSON serialization
      const json = ds.toJSON();
      assert.strictEqual(
        json.credentials?.encryptedData,
        undefined,
        'Encrypted credentials payload must be stripped from JSON serialization'
      );
    });

    test('fails validation when type is unsupported or organizationId is missing', () => {
      const invalidDs = new DataSource({
        name: 'Test DB',
        type: 'unsupported_db_type'
      });

      const error = invalidDs.validateSync();
      assert.ok(error);
      assert.ok(error.errors.organizationId, 'organizationId is required');
      assert.ok(error.errors.type, 'Unsupported data source type must fail enum validation');
    });
  });

  describe('4. Dataset Model', () => {
    test('validates dataset with schema metadata, tags, and classification', () => {
      const dataset = new Dataset({
        organizationId: dummyOrgId,
        dataSourceId: dummyDataSourceId,
        name: 'dim_customers',
        path: 'analytics.core.dim_customers',
        description: 'Customer master dimension table',
        type: 'table',
        classification: 'confidential',
        schemaMetadata: {
          rowCount: 1250000,
          sizeBytes: 45000000,
          fields: [
            {
              name: 'customer_id',
              dataType: 'VARCHAR(64)',
              isPrimaryKey: true,
              nullable: false,
              description: 'Unique customer identifier'
            },
            {
              name: 'email',
              dataType: 'VARCHAR(255)',
              nullable: false,
              piiClassification: 'pii',
              tags: ['pii', 'gdpr']
            },
            {
              name: 'credit_card_hash',
              dataType: 'VARCHAR(128)',
              nullable: true,
              piiClassification: 'financial'
            }
          ]
        },
        qualityScore: {
          score: 94.5,
          lastEvaluatedAt: new Date()
        },
        tags: ['core', 'customers', 'gdpr']
      });

      const validationError = dataset.validateSync();
      assert.strictEqual(validationError, undefined, 'Valid dataset must pass validation');
      assert.strictEqual(dataset.schemaMetadata.fields.length, 3);
      assert.strictEqual(dataset.classification, 'confidential');
    });

    test('fails validation if qualityScore is out of bounds [0, 100]', () => {
      const invalidDataset = new Dataset({
        organizationId: dummyOrgId,
        dataSourceId: dummyDataSourceId,
        name: 'bad_score_dataset',
        qualityScore: { score: 120 } // Max is 100
      });

      const error = invalidDataset.validateSync();
      assert.ok(error);
      assert.ok(error.errors['qualityScore.score'], 'Quality score over 100 must fail validation');
    });
  });

  describe('5. Activity Model', () => {
    test('validates activity audit record with actor, action, and entity references', () => {
      const activity = new Activity({
        organizationId: dummyOrgId,
        actorId: dummyUserId,
        action: 'dataset.schema_updated',
        entityType: 'dataset',
        entityId: dummyDatasetId,
        metadata: {
          addedFields: ['credit_card_hash'],
          modifiedByIp: '192.168.1.100'
        }
      });

      const validationError = activity.validateSync();
      assert.strictEqual(validationError, undefined, 'Valid activity must pass validation');
      assert.ok(activity.timestamp instanceof Date, 'Timestamp must default to Date');
      assert.strictEqual(activity.action, 'dataset.schema_updated');
    });

    test('fails validation on missing action, entityType or entityId', () => {
      const invalidActivity = new Activity({
        organizationId: dummyOrgId,
        actorId: dummyUserId
      });

      const error = invalidActivity.validateSync();
      assert.ok(error);
      assert.ok(error.errors.action, 'Action is required');
      assert.ok(error.errors.entityType, 'EntityType is required');
      assert.ok(error.errors.entityId, 'EntityId is required');
    });
  });

  describe('6. Multi-Tenant Architecture & Index Definitions', () => {
    test('all tenant-scoped models define organizationId with proper references', () => {
      const tenantModels = [
        { model: User, name: 'User' },
        { model: DataSource, name: 'DataSource' },
        { model: Dataset, name: 'Dataset' },
        { model: Activity, name: 'Activity' }
      ];

      for (const { model, name } of tenantModels) {
        const orgIdField = model.schema.path('organizationId');
        assert.ok(orgIdField, `${name} must include organizationId`);
        assert.strictEqual(orgIdField.instance, 'ObjectId', `${name}.organizationId must be an ObjectId`);
        assert.strictEqual(
          orgIdField.options.ref,
          'Organization',
          `${name}.organizationId must reference Organization model`
        );
        assert.strictEqual(
          orgIdField.options.required[0],
          true,
          `${name}.organizationId must be mandatory for tenant isolation`
        );
      }
    });

    test('compound indexes are properly registered on schemas', () => {
      const userIndexes = User.schema.indexes();
      const hasUserCompoundUnique = userIndexes.some(
        ([fields, options]) => fields.organizationId === 1 && fields.email === 1 && options?.unique === true
      );
      assert.ok(hasUserCompoundUnique, 'User must have compound unique index on { organizationId: 1, email: 1 }');

      const dsIndexes = DataSource.schema.indexes();
      const hasDsCompoundUnique = dsIndexes.some(
        ([fields, options]) => fields.organizationId === 1 && fields.name === 1 && options?.unique === true
      );
      assert.ok(hasDsCompoundUnique, 'DataSource must have compound unique index on { organizationId: 1, name: 1 }');

      const datasetIndexes = Dataset.schema.indexes();
      const hasDatasetCompoundUnique = datasetIndexes.some(
        ([fields, options]) =>
          fields.organizationId === 1 &&
          fields.dataSourceId === 1 &&
          fields.name === 1 &&
          options?.unique === true
      );
      assert.ok(
        hasDatasetCompoundUnique,
        'Dataset must have compound unique index on { organizationId: 1, dataSourceId: 1, name: 1 }'
      );
    });
  });
});
