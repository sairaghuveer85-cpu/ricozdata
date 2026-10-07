import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { DataSource } from '../src/models/DataSource.js';
import { Activity } from '../src/models/Activity.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import {
  ConnectorService,
  PostgreSQLConnector,
  connectorRegistry
} from '../src/connectors/index.js';

test('Step 18 — Connection Testing & Health Monitoring Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const adminUserId = new mongoose.Types.ObjectId();

  await Organization.create({
    _id: orgAId,
    name: 'Org A Test',
    slug: 'org-a-test-' + Date.now()
  });

  await Organization.create({
    _id: orgBId,
    name: 'Org B Test',
    slug: 'org-b-test-' + Date.now()
  });

  await User.deleteMany({ email: 'admin.step18@example.com' });
  await User.create({
    _id: adminUserId,
    organizationId: orgAId,
    name: 'Admin Tester',
    email: 'admin.step18@example.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  // Create a PostgreSQL data source for Org A
  const dsA = new DataSource({
    organizationId: orgAId,
    name: 'Primary Postgres Org A',
    type: 'postgresql',
    configuration: {
      host: 'pg.internal.example',
      port: 5432,
      database: 'analytics_db',
      schema: 'public'
    },
    status: 'ACTIVE',
    healthStatus: 'UNTESTED',
    connectionState: 'DISCONNECTED',
    createdBy: adminUserId
  });
  dsA.setCredentials({ username: 'db_admin', password: 'ultraSecureSecretPassword999' });
  await dsA.save();

  // Create a PostgreSQL data source for Org B
  const dsB = new DataSource({
    organizationId: orgBId,
    name: 'Primary Postgres Org B',
    type: 'postgresql',
    configuration: {
      host: 'pg.orgb.example',
      port: 5432,
      database: 'finance_db'
    },
    status: 'ACTIVE',
    createdBy: adminUserId
  });
  await dsB.save();

  await t.test('1. Successful connection test: updates DataSource health state, latency, and logs audit', async () => {
    // Mock PostgreSQL pool connection on PostgreSQLConnector prototype for healthy execution
    const originalConnect = PostgreSQLConnector.prototype.connect;
    const originalTest = PostgreSQLConnector.prototype.test;

    PostgreSQLConnector.prototype.test = async function () {
      return {
        success: true,
        connectorType: 'postgresql',
        status: 'HEALTHY',
        latencyMs: 12.5,
        checkedAt: new Date().toISOString(),
        details: {
          database: 'analytics_db',
          serverVersion: 'PostgreSQL 16.2',
          schema: 'public'
        }
      };
    };

    try {
      const result = await ConnectorService.testConnection(dsA._id, orgAId, {
        actor: { _id: adminUserId }
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'HEALTHY');
      assert.strictEqual(result.connectorType, 'postgresql');
      assert.strictEqual(typeof result.latencyMs, 'number');

      // Verify DataSource model state was updated in MongoDB
      const updatedDs = await DataSource.findById(dsA._id);
      assert.strictEqual(updatedDs.healthStatus, 'HEALTHY');
      assert.strictEqual(updatedDs.connectionState, 'CONNECTED');
      assert.notStrictEqual(updatedDs.lastTestedAt, null);
      assert.strictEqual(typeof updatedDs.lastTestLatencyMs, 'number');
      assert.strictEqual(updatedDs.lastTestError, null);

      // Verify Activity audit event was logged
      const activity = await Activity.findOne({
        organizationId: orgAId,
        action: 'connection_test.succeeded',
        entityId: dsA._id
      }).sort({ createdAt: -1 });

      assert.notStrictEqual(activity, null);
      assert.strictEqual(activity.metadata.dataSourceName, 'Primary Postgres Org A');
      assert.strictEqual(activity.metadata.status, 'HEALTHY');
      // Ensure zero credentials in audit metadata
      assert.strictEqual(JSON.stringify(activity.metadata).includes('ultraSecureSecretPassword999'), false);
    } finally {
      PostgreSQLConnector.prototype.connect = originalConnect;
      PostgreSQLConnector.prototype.test = originalTest;
    }
  });

  await t.test('2. Failed connection test: updates healthStatus to UNHEALTHY/ERROR, captures error message, logs audit', async () => {
    const originalTest = PostgreSQLConnector.prototype.test;

    PostgreSQLConnector.prototype.test = async function () {
      const err = new Error('getaddrinfo ENOTFOUND pg.internal.example');
      err.code = 'ENOTFOUND';
      throw err;
    };

    try {
      const result = await ConnectorService.testConnection(dsA._id, orgAId, {
        actor: { _id: adminUserId }
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'UNHEALTHY');
      assert.match(result.error, /Host lookup failed/);

      // Verify DataSource model state in MongoDB
      const updatedDs = await DataSource.findById(dsA._id);
      assert.strictEqual(updatedDs.healthStatus, 'UNHEALTHY');
      assert.strictEqual(updatedDs.connectionState, 'ERROR');
      assert.match(updatedDs.lastTestError, /Host lookup failed/);

      // Verify failure audit event was logged
      const activity = await Activity.findOne({
        organizationId: orgAId,
        action: 'connection_test.failed',
        entityId: dsA._id
      }).sort({ createdAt: -1 });

      assert.notStrictEqual(activity, null);
      assert.match(activity.metadata.error, /Host lookup failed/);
    } finally {
      PostgreSQLConnector.prototype.test = originalTest;
    }
  });

  await t.test('3. Tenant isolation: Org A cannot test Org B data source (fails closed with 404)', async () => {
    await assert.rejects(
      () => ConnectorService.testConnection(dsB._id, orgAId, { actor: { _id: adminUserId } }),
      (err) => {
        assert.strictEqual(err.statusCode || err.status, 404);
        assert.match(err.message, /not found/i);
        return true;
      }
    );
  });

  await t.test('4. Unsupported connector type: fails gracefully with ConnectorUnsupportedError', async () => {
    const unsupportedDs = new DataSource({
      organizationId: orgAId,
      name: 'Unsupported DB Engine',
      type: 'snowflake',
      configuration: { host: 'snowflake.account' },
      status: 'ACTIVE',
      createdBy: adminUserId
    });
    await unsupportedDs.save();

    const snowflakeClass = connectorRegistry._registry.get('snowflake');
    connectorRegistry._registry.delete('snowflake');

    try {
      const result = await ConnectorService.testConnection(unsupportedDs._id, orgAId, {
        actor: { _id: adminUserId }
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'ERROR');
      assert.match(result.error, /unsupported/i);
    } finally {
      if (snowflakeClass) {
        connectorRegistry.register('snowflake', snowflakeClass);
      }
      await DataSource.findByIdAndDelete(unsupportedDs._id);
    }
  });

  // Cleanup
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
  await Activity.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
