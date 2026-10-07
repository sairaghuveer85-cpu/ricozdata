import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import '../src/connectors/index.js'; // Ensure connector registry is populated
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import { QualityRule, QUALITY_RULE_TYPES, QUALITY_SEVERITIES } from '../src/models/QualityRule.js';
import { QualityRun } from '../src/models/QualityRun.js';
import { QualityMetricSnapshot } from '../src/models/QualityMetricSnapshot.js';
import { QualityIssue } from '../src/models/QualityIssue.js';
import { DataProfile } from '../src/models/DataProfile.js';
import { LineageEdge } from '../src/models/LineageEdge.js';
import { GlossaryTerm } from '../src/models/GlossaryTerm.js';
import { MaskingPolicy } from '../src/models/MaskingPolicy.js';
import { Activity } from '../src/models/Activity.js';
import { QualityEngine } from '../src/services/QualityEngine.js';
import { ProfilingService } from '../src/services/ProfilingService.js';
import { LineageService } from '../src/services/LineageService.js';
import { MaskingEngine } from '../src/services/MaskingEngine.js';
import { validateSafeRegex, validateCustomSql } from '../src/utils/securityValidators.js';
import * as governanceController from '../src/controllers/governance.controller.js';
import * as auditController from '../src/controllers/audit.controller.js';

test('RicozData Phase 5 — Full Cross-Module Integration, Security & Performance Audit', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  await Organization.create([
    { _id: orgAId, name: 'Phase5 Enterprise Org A', slug: 'p5-org-a-' + Date.now() },
    { _id: orgBId, name: 'Phase5 Rogue Org B', slug: 'p5-org-b-' + Date.now() }
  ]);

  await User.create([
    {
      _id: userAId,
      organizationId: orgAId,
      name: 'Alice Architect',
      email: 'alice.arch@alpha.com',
      role: 'admin',
      passwordHash: 'dummy_hash'
    },
    {
      _id: userBId,
      organizationId: orgBId,
      name: 'Bob Rogue',
      email: 'bob.rogue@beta.com',
      role: 'admin',
      passwordHash: 'dummy_hash'
    }
  ]);

  // Real PostgreSQL DataSource pointing to localhost:5432 / ricoz_test
  const pgSourceA = new DataSource({
    organizationId: orgAId,
    name: 'Production PostgreSQL Test DB',
    type: 'postgresql',
    configuration: {
      host: 'localhost',
      port: 5432,
      database: 'ricoz_test',
      ssl: false,
      schema: 'public'
    },
    status: 'ACTIVE',
    createdBy: userAId
  });
  pgSourceA.setCredentials({
    username: 'postgres',
    password: 'password' in process.env ? process.env.PGPASSWORD : '1818'
  });
  await pgSourceA.save();

  // Create real discovered datasets for customers and products
  const customersDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: pgSourceA._id,
    name: 'customers',
    schemaName: 'public',
    columns: [
      { name: 'customer_id', dataType: 'integer', isNullable: false },
      { name: 'name', dataType: 'character varying', isNullable: false },
      { name: 'email', dataType: 'character varying', isNullable: true },
      { name: 'phone', dataType: 'character varying', isNullable: true },
      { name: 'age', dataType: 'integer', isNullable: true },
      { name: 'created_at', dataType: 'timestamp without time zone', isNullable: true }
    ],
    status: 'ACTIVE'
  });

  const productsDataset = await Dataset.create({
    organizationId: orgAId,
    dataSourceId: pgSourceA._id,
    name: 'products',
    schemaName: 'public',
    columns: [
      { name: 'product_id', dataType: 'integer', isNullable: false },
      { name: 'product_name', dataType: 'character varying', isNullable: false },
      { name: 'price', dataType: 'numeric', isNullable: false },
      { name: 'category', dataType: 'character varying', isNullable: true },
      { name: 'created_at', dataType: 'timestamp without time zone', isNullable: true }
    ],
    status: 'ACTIVE'
  });

  // ============================================================
  // INTEGRATION FLOW
  // ============================================================

  let qualityIssueDoc = null;

  await t.test('Integration 1: Quality Rules & Real PostgreSQL Quality Engine Execution', async () => {
    // 1. Create real rules for customers
    const ruleNull = await QualityRule.create({
      organizationId: orgAId,
      datasetId: customersDataset._id,
      name: 'Customer Email Null Check',
      ruleType: QUALITY_RULE_TYPES.NULL_CHECK,
      targetColumn: 'email',
      configuration: { column: 'email' },
      severity: QUALITY_SEVERITIES.HIGH,
      createdBy: userAId
    });

    const ruleUnique = await QualityRule.create({
      organizationId: orgAId,
      datasetId: customersDataset._id,
      name: 'Customer ID Uniqueness',
      ruleType: QUALITY_RULE_TYPES.UNIQUENESS,
      targetColumn: 'customer_id',
      configuration: { column: 'customer_id', columns: ['customer_id'] },
      severity: QUALITY_SEVERITIES.CRITICAL,
      createdBy: userAId
    });

    const ruleRange = await QualityRule.create({
      organizationId: orgAId,
      datasetId: customersDataset._id,
      name: 'Customer Age Value Range',
      ruleType: QUALITY_RULE_TYPES.VALUE_RANGE,
      targetColumn: 'age',
      configuration: { column: 'age', min: 18, max: 100 },
      severity: QUALITY_SEVERITIES.MEDIUM,
      createdBy: userAId
    });

    // 2. Run Quality Check on customers
    const runResult = await QualityEngine.runQualityCheck(customersDataset._id, orgAId, userAId);

    assert.strictEqual(runResult.status, 'SUCCESS');
    assert.strictEqual(runResult.rulesEvaluated, 3);
    assert.strictEqual(runResult.passedRules, 2);
    assert.strictEqual(runResult.failedRules, 1);
    assert.ok(runResult.score >= 0 && runResult.score <= 100);

    // Verify snapshot created
    const snapshot = await QualityMetricSnapshot.findOne({
      datasetId: customersDataset._id,
      organizationId: orgAId
    }).sort({ timestamp: -1 });

    assert.ok(snapshot);
    assert.strictEqual(snapshot.score, runResult.score);
    assert.ok(snapshot.metrics.completeness !== null);
    assert.ok(snapshot.metrics.uniqueness !== null);

    // Verify Quality Issue created for the failed null check
    qualityIssueDoc = await QualityIssue.findOne({
      datasetId: customersDataset._id,
      ruleId: ruleNull._id,
      organizationId: orgAId
    });

    assert.ok(qualityIssueDoc);
    assert.strictEqual(qualityIssueDoc.status, 'OPEN');
    assert.strictEqual(qualityIssueDoc.affectedColumn, 'email');
    assert.strictEqual(qualityIssueDoc.affectedRowsCount, 1); // Real PostgreSQL customers table has 1 null email
  });

  await t.test('Integration 2: Quality Issue Remediation & Lifecycle', async () => {
    assert.ok(qualityIssueDoc);

    // Transition to IN_REVIEW with assignment and rootCause
    qualityIssueDoc.status = 'IN_REVIEW';
    qualityIssueDoc.assignedTo = userAId;
    qualityIssueDoc.rootCause = 'Customer signup form lacked required validation on legacy app';
    await qualityIssueDoc.save();

    // Transition to RESOLVED with resolution notes
    qualityIssueDoc.status = 'RESOLVED';
    qualityIssueDoc.resolution = {
      notes: 'Frontend registration validated; legacy records backfilled with fallback contact',
      resolvedBy: userAId,
      resolvedAt: new Date()
    };
    qualityIssueDoc.resolvedAt = new Date();
    await qualityIssueDoc.save();

    const resolved = await QualityIssue.findById(qualityIssueDoc._id);
    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.ok(resolved.resolvedAt);
    assert.strictEqual(resolved.resolution.notes, 'Frontend registration validated; legacy records backfilled with fallback contact');
  });

  await t.test('Integration 3: Real PostgreSQL Data Profiling on customers and products', async () => {
    // 1. Profile customers
    const customersProfile = await ProfilingService.profileDataset(customersDataset._id, orgAId);
    assert.strictEqual(customersProfile.rowCount, 4);
    assert.strictEqual(customersProfile.columns.length, 6);

    const emailCol = customersProfile.columns.find(c => c.columnName === 'email');
    assert.ok(emailCol);
    assert.strictEqual(emailCol.nullCount, 1);
    assert.strictEqual(emailCol.nullPercentage, 25);
    assert.strictEqual(emailCol.distinctCount, 3);

    const ageCol = customersProfile.columns.find(c => c.columnName === 'age');
    assert.ok(ageCol);
    assert.strictEqual(ageCol.nullCount, 0);
    assert.strictEqual(ageCol.nullPercentage, 0);
    assert.strictEqual(ageCol.meanValue, 31.5);
    assert.strictEqual(ageCol.medianValue, 30);
    assert.ok(Array.isArray(ageCol.histogram));

    // 2. Profile products
    const productsProfile = await ProfilingService.profileDataset(productsDataset._id, orgAId);
    assert.strictEqual(productsProfile.rowCount, 4);
    const priceCol = productsProfile.columns.find(c => c.columnName === 'price');
    assert.ok(priceCol);
    assert.strictEqual(priceCol.meanValue, 21675);
    assert.strictEqual(priceCol.minValue, '1200.00');
    assert.strictEqual(priceCol.maxValue, '65000.00');
  });

  await t.test('Integration 4: Governance Classification, Masking Policies & Compliance Reporting', async () => {
    let resData;
    let resStatus;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // 1. Classify dataset customers as PII
    await governanceController.updateClassification(
      {
        organizationId: orgAId,
        user: { _id: userAId },
        body: {
          datasetId: customersDataset._id,
          classification: 'PII'
        }
      },
      mockRes
    );
    assert.strictEqual(resStatus, 200);

    // 2. Classify email as PII and age as SENSITIVE
    await governanceController.updateClassification(
      {
        organizationId: orgAId,
        user: { _id: userAId },
        body: {
          datasetId: customersDataset._id,
          column: 'email',
          classification: 'PII'
        }
      },
      mockRes
    );
    assert.strictEqual(resStatus, 200);

    await governanceController.updateClassification(
      {
        organizationId: orgAId,
        user: { _id: userAId },
        body: {
          datasetId: customersDataset._id,
          column: 'age',
          classification: 'SENSITIVE'
        }
      },
      mockRes
    );
    assert.strictEqual(resStatus, 200);

    // 3. Create Masking Policy for email
    await governanceController.createMaskingPolicy(
      {
        organizationId: orgAId,
        user: { _id: userAId, email: 'alice.arch@alpha.com' },
        body: {
          name: 'Customer Email Redaction Policy',
          datasetId: customersDataset._id.toString(),
          column: 'email',
          maskingType: 'REDACT',
          roles: ['viewer', 'analyst']
        }
      },
      mockRes
    );

    assert.strictEqual(resStatus, 201);
    assert.strictEqual(resData.data.maskingType, 'REDACT');

    // 4. Verify MaskingEngine redaction
    const masked = MaskingEngine.maskValue('alice@example.com', 'REDACT');
    assert.strictEqual(masked, '[REDACTED]');

    // 5. Generate Compliance Report
    await governanceController.getComplianceReport(
      {
        organizationId: orgAId
      },
      mockRes
    );

    assert.strictEqual(resStatus, 200);
    assert.strictEqual(resData.data.summary.totalDatasets, 2);
    assert.strictEqual(resData.data.summary.classifiedDatasets, 1);
    assert.strictEqual(resData.data.summary.unclassifiedDatasets, 1);
    assert.strictEqual(resData.data.maskingPoliciesSummary.total, 1);
  });

  await t.test('Integration 5: Data Lineage Graph Construction & Traversal', async () => {
    // customers -> products lineage edge
    const edge = await LineageService.createEdge(
      {
        upstreamDatasetId: customersDataset._id,
        downstreamDatasetId: productsDataset._id,
        upstreamColumn: 'customer_id',
        downstreamColumn: 'product_id',
        relationshipType: 'DERIVED'
      },
      orgAId,
      userAId
    );

    assert.ok(edge._id);

    // Retrieve downstream graph for customers
    const downstreamGraph = await LineageService.getDownstream(customersDataset._id, orgAId, { maxDepth: 3 });
    assert.strictEqual(downstreamGraph.nodes.length, 2);
    assert.strictEqual(downstreamGraph.edges.length, 1);
    assert.strictEqual(downstreamGraph.edges[0].relationshipType, 'DERIVED');

    // Retrieve upstream graph for products
    const upstreamGraph = await LineageService.getUpstream(productsDataset._id, orgAId, { maxDepth: 3 });
    assert.strictEqual(upstreamGraph.nodes.length, 2);
    assert.strictEqual(upstreamGraph.edges.length, 1);
  });

  await t.test('Integration 6: Business Glossary Term Definition & Dataset/Column Linking', async () => {
    const term = await GlossaryTerm.create({
      organizationId: orgAId,
      name: 'Customer Profile Record',
      definition: 'Master record representing registered retail customers',
      domain: 'Sales & Marketing',
      tags: ['master-data', 'retail'],
      owner: userAId,
      status: 'APPROVED',
      createdBy: userAId
    });

    // Link term to customers dataset and email column
    term.linkedDatasets.push({
      datasetId: customersDataset._id,
      column: 'email',
      linkedBy: userAId,
      linkedAt: new Date()
    });
    await term.save();

    const retrieved = await GlossaryTerm.findById(term._id);
    assert.strictEqual(retrieved.linkedDatasets.length, 1);
    assert.strictEqual(retrieved.linkedDatasets[0].datasetId.toString(), customersDataset._id.toString());
    assert.strictEqual(retrieved.linkedDatasets[0].column, 'email');
  });

  await t.test('Integration 7: Comprehensive Immutable Audit Event History', async () => {
    let resData;
    let resStatus;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    // Query audit logs for Org A
    await auditController.getAuditLogs(
      {
        organizationId: orgAId,
        query: { page: 1, limit: 50 }
      },
      mockRes
    );

    assert.strictEqual(resStatus, 200);
    assert.ok(resData.data.length > 0);
    // Strict tenant isolation: every audit event belongs to Org A
    assert.ok(resData.data.every(e => e.organizationId.toString() === orgAId.toString()));
  });

  // ============================================================
  // SECURITY AUDIT (NEGATIVE TESTS)
  // ============================================================

  await t.test('Security 1: Cross-Tenant Isolation Across All Phase 5 Modules', async () => {
    // 1. Quality Engine: Org B cannot execute quality check on Org A dataset
    await assert.rejects(
      async () => {
        await QualityEngine.runQualityCheck(customersDataset._id, orgBId, userBId);
      },
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('authorized'));
        return true;
      }
    );

    // 2. Profiling: Org B cannot profile Org A dataset
    await assert.rejects(
      async () => {
        await ProfilingService.profileDataset(customersDataset._id, orgBId);
      },
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('authorized'));
        return true;
      }
    );

    // 3. Lineage: Org B cannot link Org A dataset to Org B
    await assert.rejects(
      async () => {
        await LineageService.createEdge(
          {
            upstreamDatasetId: customersDataset._id,
            downstreamDatasetId: productsDataset._id
          },
          orgBId,
          userBId
        );
      },
      (err) => {
        assert.ok(err.message.includes('not found') || err.message.includes('inaccessible'));
        return true;
      }
    );

    // 4. Audit: Org B queries audit logs and sees ZERO logs from Org A
    let resData;
    let resStatus;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(payload) { resData = payload; return this; }
    };

    await auditController.getAuditLogs(
      {
        organizationId: orgBId,
        query: {}
      },
      mockRes
    );

    assert.strictEqual(resStatus, 200);
    assert.strictEqual(resData.data.length, 0);
  });

  await t.test('Security 2: Malicious Regex Injection & ReDoS Protection', async () => {
    // Pathological patterns that cause catastrophic backtracking
    const redosPatterns = [
      '(a+)+$',
      '(a|aa)+$',
      'a'.repeat(600) // Exceeds max length
    ];

    for (const pat of redosPatterns) {
      const check = validateSafeRegex(pat);
      assert.strictEqual(check.valid, false, `Expected pattern "${pat}" to be rejected`);
      assert.ok(check.error);
    }

    // Safe pattern should pass
    const safeResult = validateSafeRegex('^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$');
    assert.strictEqual(safeResult.valid, true);
  });

  await t.test('Security 3: Destructive SQL & Injection Protection', async () => {
    const dangerousQueries = [
      'DROP TABLE customers',
      'TRUNCATE TABLE products',
      'DELETE FROM customers WHERE 1=1',
      'UPDATE customers SET email = NULL',
      'INSERT INTO customers VALUES (1, "fake")',
      'ALTER TABLE customers DROP COLUMN email',
      'SELECT * FROM customers; DROP TABLE customers;', // Stacked statements
      'SELECT * FROM pg_authid', // System shadow auth tables
      'GRANT ALL ON customers TO public',
      'REVOKE SELECT ON customers FROM public',
      'COPY customers TO "/tmp/leak.csv"'
    ];

    for (const query of dangerousQueries) {
      const check = validateCustomSql(query);
      assert.strictEqual(check.valid, false, `Expected query "${query}" to be rejected`);
      assert.ok(check.error);
    }

    // Safe SELECT query should pass
    const safeSql = validateCustomSql('SELECT COUNT(*) FROM customers WHERE age > 18');
    assert.strictEqual(safeSql.valid, true);
  });

  await t.test('Security 4: Lineage Graph Depth Limits and Cycle Protection', async () => {
    // Create a circular relationship: Dataset X -> Dataset Y -> Dataset X
    const dsX = await Dataset.create({
      organizationId: orgAId,
      dataSourceId: pgSourceA._id,
      name: 'dataset_x',
      columns: [{ name: 'id', dataType: 'integer' }]
    });

    const dsY = await Dataset.create({
      organizationId: orgAId,
      dataSourceId: pgSourceA._id,
      name: 'dataset_y',
      columns: [{ name: 'id', dataType: 'integer' }]
    });

    await LineageEdge.create([
      {
        organizationId: orgAId,
        upstreamDatasetId: dsX._id,
        downstreamDatasetId: dsY._id,
        relationshipType: 'DERIVED',
        createdBy: userAId
      },
      {
        organizationId: orgAId,
        upstreamDatasetId: dsY._id,
        downstreamDatasetId: dsX._id,
        relationshipType: 'DERIVED',
        createdBy: userAId
      }
    ]);

    // Query downstream graph: Should complete cleanly without hanging or blowing the stack
    const cycleGraph = await LineageService.getDownstream(dsX._id, orgAId, { maxDepth: 5 });
    assert.ok(cycleGraph.nodes.length >= 2);
    assert.ok(cycleGraph.edges.length >= 1);
  });

  await t.test('Security 5: Audit Log Immutability & Modification Denial', async () => {
    const sampleLog = await Activity.findOne({ organizationId: orgAId });
    assert.ok(sampleLog);

    await assert.rejects(
      async () => {
        await Activity.updateOne({ _id: sampleLog._id }, { $set: { action: 'hacked.action' } });
      },
      (err) => {
        assert.ok(err.message.includes('immutable and cannot be updated'));
        return true;
      }
    );
  });

  // Cleanup
  await Activity.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }, { allowAuditRetentionPurge: true });
  await QualityIssue.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await QualityMetricSnapshot.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await QualityRun.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await QualityRule.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataProfile.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await LineageEdge.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await GlossaryTerm.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await MaskingPolicy.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Dataset.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
