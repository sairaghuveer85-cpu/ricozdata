import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Dataset } from '../src/models/Dataset.js';
import { DataSource } from '../src/models/DataSource.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { Activity } from '../src/models/Activity.js';
import * as datasetController from '../src/controllers/dataset.controller.js';

test('Step 20 — Dataset Management Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userAId = new mongoose.Types.ObjectId();

  await Organization.create({ _id: orgAId, name: 'Org A Datasets', slug: 'org-a-ds-' + Date.now() });
  await Organization.create({ _id: orgBId, name: 'Org B Datasets', slug: 'org-b-ds-' + Date.now() });

  await User.create({
    _id: userAId,
    organizationId: orgAId,
    name: 'Dataset Admin',
    email: 'ds.admin@example.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const dsA = await DataSource.create({
    organizationId: orgAId,
    name: 'Postgres Source A',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'analytics' },
    status: 'ACTIVE',
    createdBy: userAId
  });

  const dsB = await DataSource.create({
    organizationId: orgBId,
    name: 'Postgres Source B',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'finance' },
    status: 'ACTIVE',
    createdBy: userAId
  });

  let createdDatasetId = null;

  await t.test('1. Dataset Creation: creates discovered dataset with columns, tags, and audit event', async () => {
    const req = {
      organizationId: orgAId,
      user: { _id: userAId },
      body: {
        name: 'dim_customers',
        dataSourceId: dsA._id,
        schemaName: 'analytics',
        origin: 'DISCOVERED',
        description: 'Customer dimension table',
        columns: [
          { name: 'id', dataType: 'uuid', isPrimaryKey: true, nullable: false, ordinalPosition: 1 },
          { name: 'email', dataType: 'varchar(255)', nullable: false, ordinalPosition: 2, tags: ['pii'], classification: 'confidential' },
          { name: 'country', dataType: 'varchar(50)', nullable: true, ordinalPosition: 3 }
        ],
        tags: ['Core', 'Customer', 'core'], // duplicates with varying case
        classification: 'confidential'
      }
    };

    let sentData = null;
    let sentStatus = null;
    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentData = data;
        return res;
      }
    };

    await datasetController.createDataset(req, res);

    assert.strictEqual(sentStatus, 201);
    assert.strictEqual(sentData.success, true);
    assert.strictEqual(sentData.data.name, 'dim_customers');
    assert.strictEqual(sentData.data.externalId, 'analytics.dim_customers');
    assert.strictEqual(sentData.data.origin, 'DISCOVERED');
    assert.strictEqual(sentData.data.columns.length, 3);
    assert.strictEqual(sentData.data.columns[0].isPrimaryKey, true);

    // Verify tag normalization and deduplication
    assert.deepStrictEqual(sentData.data.tags.sort(), ['core', 'customer'].sort());

    createdDatasetId = sentData.data._id;

    // Verify Activity audit event
    const activity = await Activity.findOne({
      organizationId: orgAId,
      action: 'dataset.discovered',
      entityId: createdDatasetId
    });
    assert.notStrictEqual(activity, null);
    assert.strictEqual(activity.metadata.name, 'dim_customers');
  });

  await t.test('2. Manual Dataset: creates manual dataset asset and prevents duplicate name', async () => {
    const req = {
      organizationId: orgAId,
      user: { _id: userAId },
      body: {
        name: 'manual_kpi_metrics',
        dataSourceId: dsA._id,
        origin: 'MANUAL',
        description: 'Manual KPI aggregation model',
        columns: [{ name: 'metric_name', dataType: 'varchar(100)' }]
      }
    };

    let sentData = null;
    let sentStatus = null;
    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentData = data;
        return res;
      }
    };

    await datasetController.createDataset(req, res);
    assert.strictEqual(sentStatus, 201);
    assert.strictEqual(sentData.data.origin, 'MANUAL');

    // Attempting duplicate in same data source fails with 409
    await datasetController.createDataset(req, res);
    assert.strictEqual(sentStatus, 409);
    assert.strictEqual(sentData.error.code, 'DUPLICATE_DATASET');
  });

  await t.test('3. Dataset Read & Query Service: search, filter, and pagination', async () => {
    const req = {
      organizationId: orgAId,
      query: {
        search: 'customer',
        'filter[origin]': 'DISCOVERED',
        page: '1',
        limit: '10'
      }
    };

    let sentData = null;
    let sentStatus = null;
    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentData = data;
        return res;
      }
    };

    await datasetController.getDatasets(req, res);
    assert.strictEqual(sentStatus, 200);
    assert.strictEqual(sentData.success, true);
    assert.strictEqual(Array.isArray(sentData.data), true);
    assert.strictEqual(sentData.data.length, 1);
    assert.strictEqual(sentData.data[0].name, 'dim_customers');
  });

  await t.test('4. Immutable Source Identity: cannot modify organizationId or dataSourceId', async () => {
    const req = {
      organizationId: orgAId,
      user: { _id: userAId },
      params: { id: createdDatasetId },
      body: {
        organizationId: orgBId, // attempting tenant tampering
        description: 'Tampered'
      }
    };

    let sentData = null;
    let sentStatus = null;
    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentData = data;
        return res;
      }
    };

    await datasetController.updateDataset(req, res);
    assert.strictEqual(sentStatus, 400);
    assert.strictEqual(sentData.error.code, 'IMMUTABLE_FIELD');
  });

  await t.test('5. Metadata Updates: updating columns logs dataset.metadata_changed audit', async () => {
    const req = {
      organizationId: orgAId,
      user: { _id: userAId },
      params: { id: createdDatasetId },
      body: {
        columns: [
          { name: 'id', dataType: 'uuid', isPrimaryKey: true, nullable: false, ordinalPosition: 1 },
          { name: 'email', dataType: 'varchar(255)', nullable: false, ordinalPosition: 2 },
          { name: 'country', dataType: 'varchar(50)', nullable: true, ordinalPosition: 3 },
          { name: 'created_at', dataType: 'timestamp', nullable: false, ordinalPosition: 4 } // added column
        ]
      }
    };

    let sentData = null;
    let sentStatus = null;
    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentData = data;
        return res;
      }
    };

    await datasetController.updateDataset(req, res);
    assert.strictEqual(sentStatus, 200);
    assert.strictEqual(sentData.data.columns.length, 4);

    const audit = await Activity.findOne({
      organizationId: orgAId,
      action: 'dataset.metadata_changed',
      entityId: createdDatasetId
    });
    assert.notStrictEqual(audit, null);
  });

  await t.test('6. Tenant Isolation: Org B cannot access Org A dataset', async () => {
    const req = {
      organizationId: orgBId, // Cross-tenant context
      params: { id: createdDatasetId }
    };

    let sentData = null;
    let sentStatus = null;
    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentData = data;
        return res;
      }
    };

    await datasetController.getDatasetById(req, res);
    assert.strictEqual(sentStatus, 404);
    assert.strictEqual(sentData.error.code, 'DATASET_NOT_FOUND');
  });

  await t.test('7. Safe Deletion: soft-deletes and marks syncStatus DEPRECATED', async () => {
    const req = {
      organizationId: orgAId,
      user: { _id: userAId },
      params: { id: createdDatasetId }
    };

    let sentData = null;
    let sentStatus = null;
    const res = {
      status: (code) => {
        sentStatus = code;
        return res;
      },
      json: (data) => {
        sentData = data;
        return res;
      }
    };

    await datasetController.deleteDataset(req, res);
    assert.strictEqual(sentStatus, 200);

    const deleted = await Dataset.findById(createdDatasetId);
    assert.strictEqual(deleted.isDeleted, true);
    assert.strictEqual(deleted.syncStatus, 'DEPRECATED');
    assert.notStrictEqual(deleted.deletedAt, null);

    const deleteAudit = await Activity.findOne({
      organizationId: orgAId,
      action: 'dataset.deleted',
      entityId: createdDatasetId
    });
    assert.notStrictEqual(deleteAudit, null);
  });

  // Cleanup
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
  await Activity.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
