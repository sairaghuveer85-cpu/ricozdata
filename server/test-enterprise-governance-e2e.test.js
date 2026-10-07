const assert = require('assert');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runE2EGovernanceTests() {
  console.log('===============================================================');
  console.log('STARTING RICOZDATA MASTER ENTERPRISE GOVERNANCE E2E SUITE');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  async function testStep(name, fn) {
    try {
      await fn();
      console.log(`[✅ PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[❌ FAIL] ${name}`);
      console.error(`         Error: ${err.message}`);
      if (err.response?.data) {
        console.error(`         Response:`, JSON.stringify(err.response.data));
      }
      failed++;
    }
  }

  // Auth tokens
  let adminToken = '';
  let stewardToken = '';
  let viewerToken = '';

  // Setup: Authenticate
  await testStep('Setup: Authenticate Admin, Steward, and Viewer users', async () => {
    const adminRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'raghuveer.chandran@ricoz-industries.demo',
      password: 'Password123!',
    });
    assert(adminRes.data.success, 'Admin login failed');
    adminToken = adminRes.data.data.token;

    const stewardRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'arjun.kumar@ricoz-industries.demo',
      password: 'Password123!',
    });
    assert(stewardRes.data.success, 'Steward login failed');
    stewardToken = stewardRes.data.data.token;

    const viewerRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'kavya.sharma@ricoz-industries.demo',
      password: 'Password123!',
    });
    assert(viewerRes.data.success, 'Viewer login failed');
    viewerToken = viewerRes.data.data.token;
  });

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const stewardHeaders = { Authorization: `Bearer ${stewardToken}` };
  const viewerHeaders = { Authorization: `Bearer ${viewerToken}` };

  let testDataset = null;
  let createdPolicy = null;
  let createdRule = null;
  let generatedFinding = null;
  let testFramework = null;
  let createdControl = null;

  // Find a real catalog dataset
  await testStep('Prerequisite: Locate existing catalog dataset in database', async () => {
    const res = await axios.get(`${BASE_URL}/api/datasets?limit=10`, { headers: adminHeaders });
    assert(res.data.success);
    const list = res.data.data.datasets || res.data.data;
    assert(Array.isArray(list) && list.length > 0, 'Catalog must contain at least 1 dataset');
    testDataset = list.find((d) => d.name?.toLowerCase().includes('customer')) || list[0];
    assert(testDataset, 'Test dataset must be available');
  });

  // STEP 1: Create a data protection policy
  await testStep('Step 1: Authorized user creates a data protection policy (Draft)', async () => {
    const res = await axios.post(
      `${BASE_URL}/api/policies`,
      {
        name: `E2E Customer Data Protection Policy ${Date.now()}`,
        description: 'Mandatory governance requirements governing customer PII and operational lifecycle security.',
        category: 'Data Protection',
        status: 'draft',
        priority: 'High',
        severity: 'High',
        appliesTo: 'Customer Master & Transaction Records',
        reviewFrequency: 'Quarterly',
        datasetIds: [testDataset._id || testDataset.id],
      },
      { headers: stewardHeaders }
    );

    assert.strictEqual(res.status, 201);
    assert(res.data.success);
    createdPolicy = res.data.data;
    assert.strictEqual(createdPolicy.status, 'draft');
    assert.strictEqual(createdPolicy.version, 1);
  });

  // STEP 2: Link policy to real catalog dataset & test lifecycle transitions
  await testStep('Step 2: Policy lifecycle transition: draft -> under_review -> active', async () => {
    const policyId = createdPolicy.id || createdPolicy._id;

    // Transition 1: draft -> under_review
    const resReview = await axios.put(
      `${BASE_URL}/api/policies/${policyId}/transition`,
      { targetStatus: 'under_review', reason: 'Submitted for Data Steward governance review' },
      { headers: stewardHeaders }
    );
    assert(resReview.data.success);
    assert.strictEqual(resReview.data.data.status, 'under_review');
    assert.strictEqual(resReview.data.data.version, 2);

    // Transition 2: under_review -> active
    const resActive = await axios.put(
      `${BASE_URL}/api/policies/${policyId}/transition`,
      { targetStatus: 'active', reason: 'Formal governance committee approval' },
      { headers: adminHeaders }
    );
    assert(resActive.data.success);
    assert.strictEqual(resActive.data.data.status, 'active');
    assert.strictEqual(resActive.data.data.version, 3);
    assert(resActive.data.data.approvedBy, 'Approved policy must record approvedBy actor');

    // Test transition safety: Invalid transition (active -> draft directly is forbidden)
    try {
      await axios.put(
        `${BASE_URL}/api/policies/${policyId}/transition`,
        { targetStatus: 'draft', reason: 'Illegal jump' },
        { headers: adminHeaders }
      );
      assert.fail('Illegal status transition should have returned 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
    }
  });

  // STEP 3: Create a governance rule under the policy
  await testStep('Step 3: Create a governance rule under the policy targeting catalog dataset', async () => {
    const policyId = createdPolicy.id || createdPolicy._id;
    const datasetId = testDataset._id || testDataset.id;

    const res = await axios.post(
      `${BASE_URL}/api/governance-rules`,
      {
        name: `E2E Customer PII Classification Rule ${Date.now()}`,
        description: 'Verifies all columns with personal identifiers have PII flags and Restricted/Confidential sensitivity',
        policyId,
        category: 'PII_PROTECTION',
        ruleType: 'PII_CLASSIFICATION',
        severity: 'high',
        targetType: 'DATASET',
        datasetId,
      },
      { headers: stewardHeaders }
    );

    assert.strictEqual(res.status, 201);
    assert(res.data.success);
    createdRule = res.data.data;
    assert.strictEqual(createdRule.ruleType, 'PII_CLASSIFICATION');
    assert.strictEqual(createdRule.lastResult, 'NOT_EVALUATED');
  });

  // STEP 4: Declarative rule evaluation
  await testStep('Step 4: Execute declarative rule evaluation against catalog metadata', async () => {
    const ruleId = createdRule.id || createdRule._id;

    const res = await axios.post(
      `${BASE_URL}/api/governance-rules/${ruleId}/evaluate`,
      {},
      { headers: stewardHeaders }
    );

    assert(res.data.success);
    assert(['PASS', 'FAIL'].includes(res.data.data.result), 'Evaluation must return deterministic PASS or FAIL');
    assert(res.data.data.summary, 'Evaluation must include summary explanation');
  });

  // STEP 5: Verify governance finding generation & deduplication
  await testStep('Step 5: Verify governance findings lifecycle and deduplication protection', async () => {
    const ruleId = createdRule.id || createdRule._id;

    // Fetch findings for this rule
    const resFindings = await axios.get(`${BASE_URL}/api/governance-findings?ruleId=${ruleId}`, {
      headers: adminHeaders,
    });
    assert(resFindings.data.success);

    // If findings generated, verify structure & deduplication
    if (resFindings.data.data.length > 0) {
      generatedFinding = resFindings.data.data[0];
      assert(generatedFinding.title, 'Finding must have title');
      assert(generatedFinding.explanation, 'Finding must have explanation');
      assert.strictEqual(generatedFinding.status, 'OPEN');

      // Re-run evaluation to test deduplication: does not generate extra findings
      const countBefore = resFindings.data.data.length;
      await axios.post(`${BASE_URL}/api/governance-rules/${ruleId}/evaluate`, {}, { headers: stewardHeaders });

      const resAfter = await axios.get(`${BASE_URL}/api/governance-findings?ruleId=${ruleId}`, {
        headers: adminHeaders,
      });
      assert.strictEqual(resAfter.data.data.length, countBefore, 'Re-evaluation must not create duplicate OPEN findings');

      // Test status transition on finding: OPEN -> ACKNOWLEDGED
      const findingId = generatedFinding.id || generatedFinding._id;
      const resAck = await axios.patch(
        `${BASE_URL}/api/governance-findings/${findingId}/status`,
        { status: 'ACKNOWLEDGED', resolutionNotes: 'Steward acknowledged and queued remediation' },
        { headers: stewardHeaders }
      );
      assert.strictEqual(resAck.data.data.status, 'ACKNOWLEDGED');
    }
  });

  // STEP 6: Inspect resource-level access configuration
  await testStep('Step 6: Inspect resource-level access and configure explicit grant', async () => {
    const datasetId = testDataset._id || testDataset.id;

    // Inspect effective access
    const resInspect = await axios.get(
      `${BASE_URL}/api/access-control/inspect?resourceType=DATASET&resourceId=${datasetId}`,
      { headers: adminHeaders }
    );
    assert(resInspect.data.success);
    assert(resInspect.data.data.precedenceModel, 'Must document access precedence model');

    // Create a resource-level grant
    const resGrant = await axios.post(
      `${BASE_URL}/api/access-control/grants`,
      {
        resourceType: 'DATASET',
        resourceId: datasetId,
        grantType: 'GRANT',
        principalType: 'ROLE',
        role: 'DATA_ANALYST',
        permissions: ['DATASET_READ'],
        reason: 'Authorized temporary research access for analytics team',
      },
      { headers: adminHeaders }
    );
    assert.strictEqual(resGrant.status, 201);
    assert(resGrant.data.success);

    // Verify inspect shows the new rule
    const resInspectAfter = await axios.get(
      `${BASE_URL}/api/access-control/inspect?resourceType=DATASET&resourceId=${datasetId}`,
      { headers: adminHeaders }
    );
    assert(resInspectAfter.data.data.rules.length >= 1);
  });

  // STEP 7: Link compliance control to policy and rule
  await testStep('Step 7: Link compliance control to policy and rule under GDPR framework', async () => {
    // Get GDPR framework
    const resFw = await axios.get(`${BASE_URL}/api/compliance/frameworks`, { headers: adminHeaders });
    assert(resFw.data.success);
    testFramework = resFw.data.data.find((f) => f.identifier === 'GDPR') || resFw.data.data[0];
    assert(testFramework, 'GDPR framework must exist');

    const policyId = createdPolicy.id || createdPolicy._id;
    const ruleId = createdRule.id || createdRule._id;
    const datasetId = testDataset._id || testDataset.id;

    const resControl = await axios.post(
      `${BASE_URL}/api/compliance/controls`,
      {
        frameworkId: testFramework.id || testFramework._id,
        controlId: `GDPR-Art-25-E2E-${Date.now()}`,
        name: 'Technical Safeguards for Customer Personal Data',
        description: 'Verify mandatory classification and sensitivity safeguards across catalog assets.',
        policyIds: [policyId],
        ruleIds: [ruleId],
        datasetIds: [datasetId],
      },
      { headers: adminHeaders }
    );

    assert.strictEqual(resControl.status, 201);
    assert(resControl.data.success);
    createdControl = resControl.data.data;
    assert.strictEqual(createdControl.status, 'NOT_ASSESSED');
  });

  // STEP 8: Collect supporting evidence
  await testStep('Step 8: Collect immutable supporting evidence for compliance control', async () => {
    const controlId = createdControl.id || createdControl._id;

    const resEv = await axios.post(
      `${BASE_URL}/api/compliance/controls/${controlId}/evidence`,
      {
        type: 'RULE_EVALUATION',
        title: 'Automated PII Classification Rule Outcome',
        description: 'Snapshot of catalog metadata evaluation for customer columns',
        sourceResource: `GovernanceRule:${createdRule.id || createdRule._id}`,
        dataSnapshot: {
          ruleName: createdRule.name,
          datasetId: testDataset._id || testDataset.id,
          datasetName: testDataset.name,
          lastResult: createdRule.lastResult,
          evaluatedAt: new Date().toISOString(),
        },
      },
      { headers: adminHeaders }
    );

    assert.strictEqual(resEv.status, 201);
    assert(resEv.data.success);
    assert(resEv.data.data.collectedBy, 'Evidence must record collector user');
    assert(resEv.data.data.collectedAt, 'Evidence must record immutable collection timestamp');
  });

  // STEP 9: Authorized user formally assesses the control
  await testStep('Step 9: Authorized user commits formal control assessment', async () => {
    const controlId = createdControl.id || createdControl._id;

    const resAssess = await axios.post(
      `${BASE_URL}/api/compliance/controls/${controlId}/assess`,
      {
        status: 'PARTIALLY_COMPLIANT',
        notes: 'Assessed based on automated rule evidence and linked catalog metadata. Remediation in progress.',
      },
      { headers: adminHeaders }
    );

    assert.strictEqual(resAssess.status, 201);
    assert(resAssess.data.success);
    assert.strictEqual(resAssess.data.data.status, 'PARTIALLY_COMPLIANT');
    assert(resAssess.data.data.assessorId, 'Assessment must record assessor ID');
  });

  // STEP 10: Compliance summary & deterministic calculation
  await testStep('Step 10: Compliance dashboard reflects deterministic assessment calculations', async () => {
    const resSummary = await axios.get(`${BASE_URL}/api/compliance/summary`, { headers: adminHeaders });
    assert(resSummary.data.success);

    const metrics = resSummary.data.data.metrics;
    assert(metrics.totalControls > 0, 'Total controls must be > 0');
    assert(metrics.eligibleControls > 0, 'Eligible controls must be > 0');
    assert(metrics.partiallyCompliantControls >= 1, 'Partially compliant controls must reflect Step 9');
    assert(typeof metrics.overallComplianceRate === 'number', 'Overall compliance rate must be numeric');
    assert(resSummary.data.data.calculationFormula, 'Calculation formula must be transparently exposed');
  });

  // STEP 11: Audit Trail Verification
  await testStep('Step 11: Verify audit records in Activity infrastructure for governance mutations', async () => {
    const resAct = await axios.get(`${BASE_URL}/api/activities?limit=20`, { headers: adminHeaders });
    assert(resAct.data.success);

    const activities = resAct.data.data || [];
    assert(activities.length > 0, 'Activities must be logged');

    const govActivities = activities.filter((a) => a.type === 'policy');
    assert(govActivities.length > 0, 'At least one policy/governance activity must be recorded');
  });

  // STEP 12: RBAC Security & Privilege Escalation Prevention
  await testStep('Step 12: RBAC Enforcement: Unauthorized users are strictly blocked', async () => {
    // 1. VIEWER cannot create policy (403)
    try {
      await axios.post(
        `${BASE_URL}/api/policies`,
        { name: 'Unauthorized Policy', description: 'Should fail', category: 'Security' },
        { headers: viewerHeaders }
      );
      assert.fail('VIEWER should not be able to create policy');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }

    // 2. VIEWER cannot create governance rule (403)
    try {
      await axios.post(
        `${BASE_URL}/api/governance-rules`,
        { name: 'Unauthorized Rule', policyId: createdPolicy.id || createdPolicy._id, ruleType: 'PII_CLASSIFICATION' },
        { headers: viewerHeaders }
      );
      assert.fail('VIEWER should not be able to create governance rule');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }

    // 3. VIEWER cannot assess compliance control (403)
    try {
      await axios.post(
        `${BASE_URL}/api/compliance/controls/${createdControl.id || createdControl._id}/assess`,
        { status: 'COMPLIANT', notes: 'Unauthorized assessment' },
        { headers: viewerHeaders }
      );
      assert.fail('VIEWER should not be able to assess compliance control');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }

    // 4. VIEWER cannot configure resource access grants (403)
    try {
      await axios.post(
        `${BASE_URL}/api/access-control/grants`,
        {
          resourceType: 'DATASET',
          resourceId: testDataset._id || testDataset.id,
          grantType: 'GRANT',
          principalType: 'ROLE',
          role: 'VIEWER',
          permissions: ['DATASET_DELETE'],
        },
        { headers: viewerHeaders }
      );
      assert.fail('VIEWER should not be able to configure resource grants');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  console.log('===============================================================');
  console.log(`MASTER GOVERNANCE E2E RESULTS: ${passed}/${passed + failed} PASS (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2EGovernanceTests();
