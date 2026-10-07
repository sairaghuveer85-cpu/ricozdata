import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Activity } from '../src/models/Activity.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { Dataset } from '../src/models/Dataset.js';
import * as auditController from '../src/controllers/audit.controller.js';

test('Step 30 — Audit Logs & Tracking Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const actorAId = new mongoose.Types.ObjectId();
  const actorBId = new mongoose.Types.ObjectId();
  const datasetAId = new mongoose.Types.ObjectId();

  await Organization.create([
    { _id: orgAId, name: 'Audit Org A', slug: 'audit-org-a-' + Date.now() },
    { _id: orgBId, name: 'Audit Org B', slug: 'audit-org-b-' + Date.now() }
  ]);

  await User.create([
    {
      _id: actorAId,
      organizationId: orgAId,
      name: 'Alice Auditor',
      email: 'alice.auditor@alpha.com',
      role: 'admin',
      passwordHash: 'dummy_hash'
    },
    {
      _id: actorBId,
      organizationId: orgBId,
      name: 'Bob Competitor',
      email: 'bob@beta.com',
      role: 'admin',
      passwordHash: 'dummy_hash'
    }
  ]);

  let testAuditDoc = null;

  await t.test('30.1 Audit Creation: Creates comprehensive audit event with actor, tenant, and metadata', async () => {
    testAuditDoc = await Activity.create({
      organizationId: orgAId,
      actorId: actorAId,
      action: 'dataset.profile',
      entityType: 'dataset',
      entityId: datasetAId,
      before: { status: 'PENDING' },
      after: { status: 'PROFILED', rowCount: 1500 },
      correlationId: 'req-corr-12345',
      status: 'SUCCESS',
      requestMetadata: {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 TestSuite',
        method: 'POST',
        path: `/api/v1/datasets/${datasetAId}/profile`
      },
      metadata: {
        datasetId: String(datasetAId),
        executionTimeMs: 42
      }
    });

    assert.ok(testAuditDoc._id);
    assert.strictEqual(testAuditDoc.organizationId.toString(), orgAId.toString());
    assert.strictEqual(testAuditDoc.actorId.toString(), actorAId.toString());
    assert.strictEqual(testAuditDoc.action, 'dataset.profile');
    assert.strictEqual(testAuditDoc.resourceType, 'dataset');
    assert.strictEqual(testAuditDoc.resourceId.toString(), datasetAId.toString());
    assert.strictEqual(testAuditDoc.status, 'SUCCESS');
    assert.strictEqual(testAuditDoc.correlationId, 'req-corr-12345');
  });

  await t.test('30.2 Credential Redaction: Strips secrets, passwords, tokens from audit payloads', async () => {
    const sensitiveLog = await Activity.create({
      organizationId: orgAId,
      actorId: actorAId,
      action: 'data_source.create',
      entityType: 'data_source',
      entityId: new mongoose.Types.ObjectId(),
      metadata: {
        password: 'SuperSecretPassword123!',
        userToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
        clientSecret: 'shhh_super_secret',
        normalField: 'public_config'
      },
      before: {
        rawPassword: 'PlainOldPassword'
      },
      after: {
        encryptedCredentials: 'enc_blob_123',
        safeName: 'Primary Postgres'
      }
    });

    assert.strictEqual(sensitiveLog.metadata.password, '[REDACTED_CREDENTIAL]');
    assert.strictEqual(sensitiveLog.metadata.userToken, '[REDACTED_CREDENTIAL]');
    assert.strictEqual(sensitiveLog.metadata.clientSecret, '[REDACTED_CREDENTIAL]');
    assert.strictEqual(sensitiveLog.metadata.normalField, 'public_config');
    assert.strictEqual(sensitiveLog.before.rawPassword, '[REDACTED_CREDENTIAL]');
    assert.strictEqual(sensitiveLog.after.encryptedCredentials, '[REDACTED_CREDENTIAL]');
    assert.strictEqual(sensitiveLog.after.safeName, 'Primary Postgres');
  });

  await t.test('30.3 Immutability: Rejects attempts to modify existing audit records', async () => {
    await assert.rejects(
      async () => {
        await Activity.updateOne(
          { _id: testAuditDoc._id },
          { $set: { action: 'tampered.action' } }
        );
      },
      (err) => {
        assert.ok(err.message.includes('immutable and cannot be updated'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await Activity.findByIdAndUpdate(
          testAuditDoc._id,
          { $set: { status: 'FAILURE' } }
        );
      },
      (err) => {
        assert.ok(err.message.includes('immutable and cannot be updated'));
        return true;
      }
    );
  });

  await t.test('30.4 Append-only Behavior: Blocks deletion in non-test without explicit retention purge options', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // Unauthorized deletion attempt
      await assert.rejects(
        async () => {
          await Activity.deleteOne({ _id: testAuditDoc._id });
        },
        (err) => {
          assert.ok(err.message.includes('append-only and cannot be deleted'));
          return true;
        }
      );

      // Authorized privileged retention purge
      const purgeResult = await Activity.deleteOne(
        { _id: testAuditDoc._id },
        { allowAuditRetentionPurge: true }
      );
      assert.strictEqual(purgeResult.deletedCount, 1);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  await t.test('30.5 Audit Logs Query API: Multi-parameter filtering, pagination, and tenant isolation', async () => {
    // Clean any prior activities for Org A and Org B with privileged purge
    await Activity.deleteMany(
      { organizationId: { $in: [orgAId, orgBId] } },
      { allowAuditRetentionPurge: true }
    );

    // Re-seed some distinct events for Org A and Org B
    const timeBase = Date.now();
    await Activity.create([
      {
        organizationId: orgAId,
        actorId: actorAId,
        action: 'quality.rule.create',
        entityType: 'quality_rule',
        entityId: new mongoose.Types.ObjectId(),
        status: 'SUCCESS',
        timestamp: new Date(timeBase - 10000)
      },
      {
        organizationId: orgAId,
        actorId: actorAId,
        action: 'dataset.profile',
        entityType: 'dataset',
        entityId: datasetAId,
        metadata: { datasetId: String(datasetAId) },
        status: 'SUCCESS',
        timestamp: new Date(timeBase - 5000)
      },
      {
        organizationId: orgAId,
        actorId: actorAId,
        action: 'quality.run.execute',
        entityType: 'dataset',
        entityId: datasetAId,
        metadata: { datasetId: String(datasetAId) },
        status: 'FAILURE',
        timestamp: new Date(timeBase)
      },
      // Event belonging to Org B
      {
        organizationId: orgBId,
        actorId: actorBId,
        action: 'dataset.profile',
        entityType: 'dataset',
        entityId: new mongoose.Types.ObjectId(),
        status: 'SUCCESS',
        timestamp: new Date(timeBase)
      }
    ]);

    // Test 1: Query all logs for Org A
    let resData;
    let resStatus;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    await auditController.getAuditLogs(
      {
        organizationId: orgAId,
        query: { page: 1, limit: 10 }
      },
      mockRes
    );

    assert.strictEqual(resStatus, 200);
    assert.strictEqual(resData.success, true);
    assert.strictEqual(resData.data.length, 3);
    assert.strictEqual(resData.meta.total, 3);
    // Ensure all returned events belong to Org A only (Strict tenant isolation)
    assert.ok(resData.data.every(log => log.organizationId.toString() === orgAId.toString()));

    // Test 2: Filter by action = 'dataset.profile'
    await auditController.getAuditLogs(
      {
        organizationId: orgAId,
        query: { action: 'dataset.profile' }
      },
      mockRes
    );
    assert.strictEqual(resData.data.length, 1);
    assert.strictEqual(resData.data[0].action, 'dataset.profile');

    // Test 3: Filter by datasetId
    await auditController.getAuditLogs(
      {
        organizationId: orgAId,
        query: { datasetId: String(datasetAId) }
      },
      mockRes
    );
    assert.strictEqual(resData.data.length, 2);

    // Test 4: Filter by status = 'FAILURE'
    await auditController.getAuditLogs(
      {
        organizationId: orgAId,
        query: { status: 'FAILURE' }
      },
      mockRes
    );
    assert.strictEqual(resData.data.length, 1);
    assert.strictEqual(resData.data[0].status, 'FAILURE');

    // Test 5: Tenant B cannot see Tenant A's events
    await auditController.getAuditLogs(
      {
        organizationId: orgBId,
        query: {}
      },
      mockRes
    );
    assert.strictEqual(resData.data.length, 1);
    assert.strictEqual(resData.data[0].organizationId.toString(), orgBId.toString());
  });

  // Cleanup
  await Activity.deleteMany(
    { organizationId: { $in: [orgAId, orgBId] } },
    { allowAuditRetentionPurge: true }
  );
  await User.deleteMany({ _id: { $in: [actorAId, actorBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
