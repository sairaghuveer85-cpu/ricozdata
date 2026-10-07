import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Dataset } from '../src/models/Dataset.js';
import { DataSource } from '../src/models/DataSource.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { MaskingPolicy } from '../src/models/MaskingPolicy.js';
import { Activity } from '../src/models/Activity.js';
import { MaskingEngine } from '../src/services/MaskingEngine.js';
import * as governanceController from '../src/controllers/governance.controller.js';

test('Step 29 — Governance & Compliance Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();

  await Organization.create({ _id: orgAId, name: 'Gov Org A', slug: 'gov-org-a-' + Date.now() });
  await Organization.create({ _id: orgBId, name: 'Gov Org B', slug: 'gov-org-b-' + Date.now() });

  await User.create({
    _id: adminAId,
    organizationId: orgAId,
    name: 'Gov Admin',
    email: 'admin.gov@alpha.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const dsA = await DataSource.create({
    organizationId: orgAId,
    name: 'Gov Source A',
    type: 'postgresql',
    configuration: { host: 'localhost', database: 'analytics' },
    status: 'ACTIVE',
    createdBy: adminAId
  });

  const datasetA = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: dsA._id,
    name: 'customers',
    schemaName: 'public',
    columns: [
      { name: 'customer_id', dataType: 'integer' },
      { name: 'name', dataType: 'character varying' },
      { name: 'email', dataType: 'character varying' },
      { name: 'phone', dataType: 'character varying' },
      { name: 'age', dataType: 'integer' }
    ],
    status: 'ACTIVE'
  });

  let policyId = null;

  await t.test('29.1 Data Classification: Classifies dataset and individual columns as PII/SENSITIVE', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // 1. Column-level PII classification on email
    await governanceController.updateClassification({
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        datasetId: datasetA._id,
        column: 'email',
        classification: 'PII'
      }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(resData.data.classification, 'PII');

    // 2. Column-level PII classification on phone
    await governanceController.updateClassification({
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        datasetId: datasetA._id,
        column: 'phone',
        classification: 'PII'
      }
    }, res);
    assert.equal(res.statusCode, 200);

    // 3. Dataset-level classification
    await governanceController.updateClassification({
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        datasetId: datasetA._id,
        classification: 'SENSITIVE'
      }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(resData.data.classification, 'SENSITIVE');

    // Verify GET classification
    await governanceController.getDatasetClassification({
      params: { datasetId: datasetA._id },
      organizationId: orgAId
    }, res);
    assert.equal(res.statusCode, 200);
    const emailCol = resData.data.columns.find(c => c.name === 'email');
    assert.ok(emailCol);
    assert.equal(emailCol.classification, 'PII');
    assert.equal(emailCol.isSensitive, true);
  });

  await t.test('29.2 Masking Policies CRUD: Creates, retrieves, updates, and deletes masking policies', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // Create policy for email: PARTIAL masking
    await governanceController.createMaskingPolicy({
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        name: 'Mask Email for Viewers',
        datasetId: datasetA._id,
        column: 'email',
        maskingType: 'PARTIAL',
        roles: ['viewer', 'analyst']
      }
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(resData.data.maskingType, 'PARTIAL');
    policyId = resData.data._id;

    // Create policy for phone: REDACT masking
    await governanceController.createMaskingPolicy({
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        name: 'Redact Phone for Viewers',
        datasetId: datasetA._id,
        column: 'phone',
        maskingType: 'REDACT',
        roles: ['viewer']
      }
    }, res);
    assert.equal(res.statusCode, 201);

    // Duplicate policy on same column rejected with 409
    await governanceController.createMaskingPolicy({
      organizationId: orgAId,
      user: { _id: adminAId },
      body: {
        name: 'Duplicate Policy',
        datasetId: datasetA._id,
        column: 'email',
        maskingType: 'REDACT'
      }
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(resData.error.code, 'DUPLICATE_POLICY');

    // List policies
    await governanceController.getMaskingPolicies({
      organizationId: orgAId,
      query: { datasetId: datasetA._id }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(resData.data.length, 2);
  });

  await t.test('29.3 Masking Engine Strategies: Verifies REDACT, PARTIAL, HASH, and TOKENIZED masking', () => {
    // REDACT
    assert.equal(MaskingEngine.applyMasking('secret123', 'REDACT'), '[REDACTED]');

    // PARTIAL email
    assert.equal(MaskingEngine.applyMasking('ravi@example.com', 'PARTIAL'), 'r***i@example.com');

    // PARTIAL phone
    assert.equal(MaskingEngine.applyMasking('9876543210', 'PARTIAL'), '******3210');

    // HASH
    const hashRes = MaskingEngine.applyMasking('sensitive_value', 'HASH');
    assert.match(hashRes, /^\[HASH:[a-f0-9]{16}\]$/);

    // TOKENIZED
    const tokRes = MaskingEngine.applyMasking('sensitive_value', 'TOKENIZED');
    assert.match(tokRes, /^\[TOKEN:TK-[A-F0-9]{8}\]$/);

    // Record list masking based on user role
    const testRecords = [
      { id: 1, email: 'ravi@example.com', phone: '9876543210', age: 28 },
      { id: 2, email: 'anita@example.com', phone: '9876543211', age: 32 }
    ];

    const policies = [
      { column: 'email', maskingType: 'PARTIAL', roles: ['viewer'], enabled: true },
      { column: 'phone', maskingType: 'REDACT', roles: ['viewer'], enabled: true }
    ];

    // As viewer: email is partial, phone is redacted
    const masked = MaskingEngine.maskRecords(testRecords, policies, 'viewer');
    assert.equal(masked[0].email, 'r***i@example.com');
    assert.equal(masked[0].phone, '[REDACTED]');
    assert.equal(masked[0].age, 28); // unmasked

    // As admin: records remain unmodified
    const unmasked = MaskingEngine.maskRecords(testRecords, policies, 'admin');
    assert.equal(unmasked[0].email, 'ravi@example.com');
    assert.equal(unmasked[0].phone, '9876543210');
  });

  await t.test('29.4 Compliance Report: Accurately reflects stored state, sensitive columns, and masking coverage', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    await governanceController.getComplianceReport({
      organizationId: orgAId
    }, res);

    assert.equal(res.statusCode, 200);
    assert.ok(resData.data.summary);
    assert.equal(resData.data.summary.totalDatasets, 1);
    assert.equal(resData.data.summary.classifiedDatasets, 1);
    assert.equal(resData.data.summary.totalSensitiveColumns, 2, 'email and phone are sensitive');
    assert.equal(resData.data.summary.protectedSensitiveColumns, 2, 'both have active masking policies');
    assert.equal(resData.data.summary.unprotectedSensitiveColumnsCount, 0);
    assert.equal(resData.data.summary.complianceRatePercentage, 100);
    assert.equal(resData.data.classificationBreakdown.PII, 2);
    assert.ok(resData.data.recentAuditEvents.length > 0);
  });

  await t.test('29.5 Tenant Isolation: Org B cannot access Org A governance data or policies', async () => {
    let resData;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // Org B tries to get Org A classification
    await governanceController.getDatasetClassification({
      params: { datasetId: datasetA._id },
      organizationId: orgBId
    }, res);
    assert.equal(res.statusCode, 404);

    // Org B compliance report shows 0
    await governanceController.getComplianceReport({
      organizationId: orgBId
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(resData.data.summary.totalDatasets, 0);
  });

  // Cleanup
  await MaskingPolicy.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
