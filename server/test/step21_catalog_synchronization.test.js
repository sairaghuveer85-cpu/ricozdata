import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import { CatalogSyncRun } from '../src/models/CatalogSyncRun.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Activity } from '../src/models/Activity.js';
import { CatalogSyncService } from '../src/services/CatalogSyncService.js';
import { PostgreSQLConnector } from '../src/connectors/index.js';

test('Step 21 — Catalog Synchronization & Schema Drift Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userAId = new mongoose.Types.ObjectId();

  await Organization.create({ _id: orgAId, name: 'Org A Sync', slug: 'org-a-sync-' + Date.now() });
  await Organization.create({ _id: orgBId, name: 'Org B Sync', slug: 'org-b-sync-' + Date.now() });

  await User.create({
    _id: userAId,
    organizationId: orgAId,
    name: 'Sync Admin',
    email: 'sync.admin@example.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const dsA = await DataSource.create({
    organizationId: orgAId,
    name: 'PostgreSQL Sync Warehouse',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'sync_test_db', schema: 'public' },
    status: 'ACTIVE',
    createdBy: userAId
  });

  const dsB = await DataSource.create({
    organizationId: orgBId,
    name: 'PostgreSQL Org B Source',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'sync_b_db' },
    status: 'ACTIVE',
    createdBy: userAId
  });

  // Mock metadata snapshot 1: Initial state (2 tables)
  let currentMetadata = {
    sourceType: 'postgresql',
    database: 'sync_test_db',
    schema: 'public',
    schemas: ['public'],
    tables: [
      {
        externalId: 'public.customers',
        name: 'customers',
        schema: 'public',
        type: 'table',
        columns: [
          { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, isPrimaryKey: true },
          { name: 'email', dataType: 'varchar(255)', nullable: false, ordinalPosition: 2 },
          { name: 'phone', dataType: 'varchar(50)', nullable: true, ordinalPosition: 3 }
        ]
      },
      {
        externalId: 'public.orders',
        name: 'orders',
        schema: 'public',
        type: 'table',
        columns: [
          { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, isPrimaryKey: true },
          { name: 'amount', dataType: 'numeric', nullable: false, ordinalPosition: 2 }
        ]
      }
    ]
  };

  const originalFetch = PostgreSQLConnector.prototype.fetchMetadata;
  PostgreSQLConnector.prototype.fetchMetadata = async function () {
    return currentMetadata;
  };

  await t.test('1. Initial Sync: discovers and creates datasets with TABLE_ADDED drift events and audit log', async () => {
    const report = await CatalogSyncService.synchronize(dsA._id, orgAId, { actor: { _id: userAId } });

    assert.strictEqual(report.status, 'SUCCESS');
    assert.strictEqual(report.discoveredCount, 2);
    assert.strictEqual(report.createdCount, 2);
    assert.strictEqual(report.updatedCount, 0);
    assert.strictEqual(report.removedCount, 0);
    assert.strictEqual(report.driftCount, 2);

    // Verify datasets created in DB
    const datasets = await Dataset.find({ organizationId: orgAId, dataSourceId: dsA._id });
    assert.strictEqual(datasets.length, 2);

    const cust = datasets.find((d) => d.name === 'customers');
    assert.strictEqual(cust.columns.length, 3);
    assert.strictEqual(cust.origin, 'DISCOVERED');
    assert.strictEqual(cust.syncStatus, 'ACTIVE');

    // Verify SyncRun record persisted
    const syncRun = await CatalogSyncRun.findById(report.syncRunId);
    assert.strictEqual(syncRun.status, 'SUCCESS');
    assert.strictEqual(syncRun.createdCount, 2);

    // Verify Activity audit event logged
    const activity = await Activity.findOne({
      organizationId: orgAId,
      action: 'catalog.synchronized',
      entityId: dsA._id
    });
    assert.notStrictEqual(activity, null);
    assert.strictEqual(activity.metadata.createdCount, 2);
  });

  await t.test('2. Sync Idempotency: second run with unchanged metadata yields 0 changes and 0 duplicates', async () => {
    const report2 = await CatalogSyncService.synchronize(dsA._id, orgAId, { actor: { _id: userAId } });

    assert.strictEqual(report2.status, 'SUCCESS');
    assert.strictEqual(report2.discoveredCount, 2);
    assert.strictEqual(report2.createdCount, 0);
    assert.strictEqual(report2.updatedCount, 0);
    assert.strictEqual(report2.removedCount, 0);
    assert.strictEqual(report2.driftCount, 0);

    // Verify dataset count remains exactly 2 (zero duplicates!)
    const count = await Dataset.countDocuments({ organizationId: orgAId, dataSourceId: dsA._id });
    assert.strictEqual(count, 2);
  });

  await t.test('3. Schema Drift: detects COLUMN_ADDED, COLUMN_REMOVED, COLUMN_TYPE_CHANGED, and COLUMN_NULLABILITY_CHANGED', async () => {
    // Evolve metadata:
    // in 'customers':
    // - remove 'phone' (COLUMN_REMOVED)
    // - change 'email' from varchar(255) to text (COLUMN_TYPE_CHANGED) and nullable: true (COLUMN_NULLABILITY_CHANGED)
    // - add 'tier' (COLUMN_ADDED)
    currentMetadata = {
      sourceType: 'postgresql',
      database: 'sync_test_db',
      schema: 'public',
      schemas: ['public'],
      tables: [
        {
          externalId: 'public.customers',
          name: 'customers',
          schema: 'public',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, isPrimaryKey: true },
            { name: 'email', dataType: 'text', nullable: true, ordinalPosition: 2 }, // changed type & nullability
            { name: 'tier', dataType: 'varchar(20)', nullable: false, ordinalPosition: 3 } // added column
          ]
        },
        {
          externalId: 'public.orders',
          name: 'orders',
          schema: 'public',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, isPrimaryKey: true },
            { name: 'amount', dataType: 'numeric', nullable: false, ordinalPosition: 2 }
          ]
        }
      ]
    };

    const report3 = await CatalogSyncService.synchronize(dsA._id, orgAId, { actor: { _id: userAId } });

    assert.strictEqual(report3.status, 'SUCCESS');
    assert.strictEqual(report3.createdCount, 0);
    assert.strictEqual(report3.updatedCount, 1);
    assert.strictEqual(report3.driftCount, 4); // 1 removed, 1 type changed, 1 nullability changed, 1 added

    const driftTypes = report3.driftDetails.map((d) => d.type);
    assert.strictEqual(driftTypes.includes('COLUMN_ADDED'), true);
    assert.strictEqual(driftTypes.includes('COLUMN_REMOVED'), true);
    assert.strictEqual(driftTypes.includes('COLUMN_TYPE_CHANGED'), true);
    assert.strictEqual(driftTypes.includes('COLUMN_NULLABILITY_CHANGED'), true);

    // Verify dataset in database was updated
    const updatedCust = await Dataset.findOne({ organizationId: orgAId, dataSourceId: dsA._id, name: 'customers' });
    assert.strictEqual(updatedCust.columns.length, 3);
    const emailCol = updatedCust.columns.find((c) => c.name === 'email');
    assert.strictEqual(emailCol.dataType, 'text');
    assert.strictEqual(emailCol.nullable, true);
    const tierCol = updatedCust.columns.find((c) => c.name === 'tier');
    assert.notStrictEqual(tierCol, undefined);
  });

  await t.test('4. Table Removal: marks dropped table as MISSING_FROM_SOURCE without hard deletion', async () => {
    // Drop 'orders' table from source metadata
    currentMetadata = {
      sourceType: 'postgresql',
      database: 'sync_test_db',
      schema: 'public',
      schemas: ['public'],
      tables: [
        {
          externalId: 'public.customers',
          name: 'customers',
          schema: 'public',
          type: 'table',
          columns: [
            { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, isPrimaryKey: true },
            { name: 'email', dataType: 'text', nullable: true, ordinalPosition: 2 },
            { name: 'tier', dataType: 'varchar(20)', nullable: false, ordinalPosition: 3 }
          ]
        }
      ]
    };

    const report4 = await CatalogSyncService.synchronize(dsA._id, orgAId, { actor: { _id: userAId } });

    assert.strictEqual(report4.removedCount, 1);
    const removedDrift = report4.driftDetails.find((d) => d.type === 'TABLE_REMOVED');
    assert.notStrictEqual(removedDrift, undefined);
    assert.strictEqual(removedDrift.assetName, 'orders');

    // Confirm 'orders' dataset still exists in database with status MISSING_FROM_SOURCE (not hard-deleted)
    const ordersDs = await Dataset.findOne({ organizationId: orgAId, dataSourceId: dsA._id, name: 'orders' });
    assert.notStrictEqual(ordersDs, null);
    assert.strictEqual(ordersDs.syncStatus, 'MISSING_FROM_SOURCE');
    assert.strictEqual(ordersDs.isDeleted, false);
  });

  await t.test('5. Tenant Isolation: Org A cannot sync Org B data source', async () => {
    await assert.rejects(
      () => CatalogSyncService.synchronize(dsB._id, orgAId),
      (err) => {
        assert.strictEqual(err.statusCode || err.status, 404);
        return true;
      }
    );
  });

  // Restore connector prototype
  PostgreSQLConnector.prototype.fetchMetadata = originalFetch;

  // Cleanup
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await CatalogSyncRun.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
  await Activity.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
