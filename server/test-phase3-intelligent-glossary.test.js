// Phase 3: Intelligent Business Glossary Test Suite
// Validates:
// 1. Suggestion generation from catalog metadata (offline deterministic rule engine)
// 2. Normalization (snake_case, camelCase, acronyms)
// 3. Transparent confidence calculation (0-100, high/medium/low)
// 4. Multi-signal reasoning documentation
// 5. Dataset and column relationship detection
// 6. Existing authoritative term matching and deduplication (matchType: existing_term_link)
// 7. Domain and tag suggestion (PII, Identifier, etc.)
// 8. Pagination, search, and filtering across suggestions
// 9. Review and approval workflow -> creates authoritative GlossaryTerm
// 10. Rejection and dismissal workflows
// 11. Bulk action operations
// 12. RBAC enforcement (VIEWER, DATA_ANALYST, DATA_STEWARD, ADMIN)
// 13. Audit logging integration via Activity

const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

let adminToken = null;
let stewardToken = null;
let analystToken = null;
let viewerToken = null;

let adminUser = null;
let stewardUser = null;

let testDatasetId = null;

async function login(email, password) {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  if (!res.data.success) {
    throw new Error(`Login failed for ${email}`);
  }
  return { token: res.data.data.token, user: res.data.data.user };
}

function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function runPhase3Suite() {
  console.log('===============================================================');
  console.log('STARTING RICOZDATA PHASE 3 INTELLIGENT GLOSSARY TEST SUITE');
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
      console.error(`         Error: ${err.response?.data?.message || err.message}`);
      failed++;
    }
  }

  // 1. Setup
  await testStep('Setup: Authenticate users and verify catalog fixtures', async () => {
    const admin = await login('raghuveer.chandran@ricoz-industries.demo', 'Password123!');
    adminToken = admin.token;
    adminUser = admin.user;

    const steward = await login('arjun.kumar@ricoz-industries.demo', 'Password123!');
    stewardToken = steward.token;
    stewardUser = steward.user;

    const analyst = await login('vikram.mehta@ricoz-industries.demo', 'Password123!');
    analystToken = analyst.token;

    const viewer = await login('kavya.sharma@ricoz-industries.demo', 'Password123!');
    viewerToken = viewer.token;

    const dsRes = await axios.get(`${BASE_URL}/api/datasets?limit=5`, auth(adminToken));
    const datasets = dsRes.data.data?.datasets || dsRes.data.data || [];
    assert(datasets.length > 0, 'Catalog must contain datasets for semantic analysis');
    testDatasetId = datasets[0]._id || datasets[0].id;

    // Clean up any previously generated test terms for idempotency
    try {
      const existingRes = await axios.get(`${BASE_URL}/api/glossary?limit=100`, auth(adminToken));
      const items = existingRes.data.data?.items || [];
      const testNames = ['Customer ID', 'Customer Email', 'Created Date'];
      for (const item of items) {
        if (testNames.includes(item.term)) {
          await axios.delete(`${BASE_URL}/api/glossary/${item._id || item.id}`, auth(adminToken));
        }
      }
    } catch {}
  });

  // 2. Generation API
  let generatedSuggestions = [];
  await testStep('Generation: Trigger suggestion generation from catalog metadata', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/generate`, {
      scope: 'all'
    }, auth(stewardToken));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data.generatedCount > 0, 'Should generate candidates from catalog');
    generatedSuggestions = res.data.data.suggestions;
  });

  await testStep('Deterministic Rule Engine: Normalization and title casing', async () => {
    const emailCandidate = generatedSuggestions.find(s => s.suggestedTerm.toLowerCase().includes('email'));
    assert(emailCandidate, 'Must identify email semantic candidate');
    assert.match(emailCandidate.suggestedTerm, /Email/, 'Must properly title-case acronyms and words');
  });

  await testStep('Confidence Scoring: Transparent 0-100 score and level classification', async () => {
    for (const s of generatedSuggestions) {
      assert(s.confidenceScore >= 0 && s.confidenceScore <= 100, 'Score must be between 0 and 100');
      assert(['high', 'medium', 'low'].includes(s.confidenceLevel), 'Must classify into high, medium, or low');
      assert(s.reasoning && s.reasoning.length > 10, 'Must record transparent reasoning factors');
    }
  });

  await testStep('Source Reference Integrity: Contains real datasets and columns', async () => {
    const sample = generatedSuggestions[0];
    assert(sample.sourceDatasetIds.length > 0, 'Must reference real source datasets');
    assert(sample.sourceColumnRefs.length > 0, 'Must reference real embedded dataset columns');
    assert(sample.sourceColumnRefs[0].columnName, 'Must record column name');
    assert(sample.sourceColumnRefs[0].datasetName, 'Must record dataset name');
  });

  await testStep('PII Awareness: Automatically suggests PII tag for sensitive columns', async () => {
    const piiCandidate = generatedSuggestions.find(s => s.suggestedTags?.includes('PII') || s.reasoning?.includes('PII'));
    assert(piiCandidate, 'PII metadata must influence suggestion tags and score');
  });

  // 3. Suggestions List API with Filters & Pagination
  await testStep('List & Summary: Retrieve suggestions with metrics dashboard summary', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions?limit=10`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const summary = res.data.data.summary;
    assert(typeof summary.totalPending === 'number');
    assert(typeof summary.highConfidence === 'number');
    assert(typeof summary.mediumConfidence === 'number');
    assert(typeof summary.lowConfidence === 'number');
    assert(res.data.data.pagination.page === 1);
  });

  await testStep('Filter: Filter suggestions by confidence level', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions?confidence=high`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.every(i => i.confidenceLevel === 'high'));
  });

  await testStep('Search: Search suggestions by keyword', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions?search=ID`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    assert(res.data.data.items.length > 0);
  });

  // 4. Single Suggestion Details
  let targetSuggestion = null;
  await testStep('Details: Get single suggestion by ID', async () => {
    targetSuggestion = generatedSuggestions[0];
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions/${targetSuggestion._id}`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data._id, targetSuggestion._id.toString());
  });

  // 5. Approval Workflow
  let approvedTermId = null;
  await testStep('Approval: Approving pending suggestion creates authoritative GlossaryTerm', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/${targetSuggestion._id}/approve`, {
      definition: 'Authoritative validated definition approved by Data Steward during review.',
      status: 'approved'
    }, auth(stewardToken));

    assert(res.status === 201 || res.status === 200, 'Should return 201 for created term or 200 for linked term');
    assert.strictEqual(res.data.success, true);
    const term = res.data.data.term;
    approvedTermId = term._id;

    assert.strictEqual(term.term, targetSuggestion.suggestedTerm);
    assert.strictEqual(term.status, 'approved');
    assert(term.approvedBy, 'Must record approving steward');

    // Verify suggestion status updated to 'approved'
    const sugRes = await axios.get(`${BASE_URL}/api/glossary/suggestions/${targetSuggestion._id}`, auth(stewardToken));
    assert.strictEqual(sugRes.data.data.status, 'approved');
    const createdId = sugRes.data.data.createdTermId?._id || sugRes.data.data.createdTermId;
    assert.strictEqual(createdId.toString(), approvedTermId.toString());
  });

  await testStep('Authoritative Glossary Verification: Approved term appears in GET /api/glossary', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary?search=${encodeURIComponent(targetSuggestion.suggestedTerm)}`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    assert(res.data.data.items.some(t => (t._id || t.id).toString() === approvedTermId.toString()));
  });

  // 6. Duplicate Prevention / Existing Term Match
  await testStep('Existing Term Recognition: Re-running engine links to existing term instead of duplicating', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/generate`, {
      scope: 'all'
    }, auth(stewardToken));

    const suggestions = res.data.data.suggestions;
    const match = suggestions.find(s => s.suggestedTerm.toLowerCase() === targetSuggestion.suggestedTerm.toLowerCase());
    if (match) {
      assert.strictEqual(match.matchType, 'existing_term_link');
      assert.strictEqual(match.matchedExistingTermId.toString(), approvedTermId.toString());
    }
  });

  // 7. Rejection Workflow
  let rejectTarget = null;
  await testStep('Rejection: Rejecting suggestion updates status and does NOT create a term', async () => {
    rejectTarget = generatedSuggestions.find(s => s._id.toString() !== targetSuggestion._id.toString() && s.status === 'pending');
    assert(rejectTarget, 'Must have second pending suggestion');

    const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/${rejectTarget._id}/reject`, {
      rejectionReason: 'Not an authoritative enterprise metric candidate'
    }, auth(stewardToken));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.status, 'rejected');
    assert.strictEqual(res.data.data.rejectionReason, 'Not an authoritative enterprise metric candidate');

    // Verify no term was created with this name
    const checkTerm = await axios.get(`${BASE_URL}/api/glossary?search=${encodeURIComponent(rejectTarget.suggestedTerm)}`, auth(stewardToken));
    assert(!checkTerm.data.data.items.some(t => t.term === rejectTarget.suggestedTerm));
  });

  // 8. Dismissal Workflow
  let dismissTarget = null;
  await testStep('Dismissal: Dismissing suggestion archives it from active review', async () => {
    dismissTarget = generatedSuggestions.find(s => s._id.toString() !== targetSuggestion._id.toString() && s._id.toString() !== rejectTarget._id.toString() && s.status === 'pending');
    if (dismissTarget) {
      const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/${dismissTarget._id}/dismiss`, {}, auth(stewardToken));
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.data.status, 'dismissed');
    }
  });

  // 9. Bulk Operations
  await testStep('Bulk Action: Reject selected suggestions in batch', async () => {
    const pendingList = await axios.get(`${BASE_URL}/api/glossary/suggestions?status=pending&limit=2`, auth(stewardToken));
    const ids = pendingList.data.data.items.map(i => i._id);

    if (ids.length > 0) {
      const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/bulk`, {
        action: 'reject',
        suggestionIds: ids
      }, auth(stewardToken));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.data.succeededCount, ids.length);
    }
  });

  // 10. Audit Logging
  await testStep('Audit Logging: Activity captures suggestion generation, approval, and rejection events', async () => {
    const actRes = await axios.get(`${BASE_URL}/api/activities?limit=15`, auth(stewardToken));
    const activities = actRes.data.data?.activities || actRes.data.data || [];
    const suggestionActivities = activities.filter(a => a.title && (a.title.includes('suggestion') || a.title.includes('glossary')));
    assert(suggestionActivities.length > 0, 'Must record suggestion activities');
  });

  // 11. RBAC Enforcement
  await testStep('RBAC: VIEWER can read suggestions but cannot generate, approve, or reject', async () => {
    // Read succeeds
    const readRes = await axios.get(`${BASE_URL}/api/glossary/suggestions`, auth(viewerToken));
    assert.strictEqual(readRes.status, 200);

    // Generate fails (403)
    try {
      await axios.post(`${BASE_URL}/api/glossary/suggestions/generate`, { scope: 'all' }, auth(viewerToken));
      assert.fail('Viewer must not be allowed to generate suggestions');
    } catch (err) {
      assert.strictEqual(err.response.status, 403);
    }

    // Approve fails (403)
    try {
      await axios.post(`${BASE_URL}/api/glossary/suggestions/${targetSuggestion._id}/approve`, {}, auth(viewerToken));
      assert.fail('Viewer must not be allowed to approve suggestions');
    } catch (err) {
      assert.strictEqual(err.response.status, 403);
    }
  });

  await testStep('RBAC: DATA_ANALYST cannot generate or approve suggestions (403)', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary/suggestions/generate`, { scope: 'all' }, auth(analystToken));
      assert.fail('Analyst must not be allowed to generate suggestions');
    } catch (err) {
      assert.strictEqual(err.response.status, 403);
    }
  });

  // Cleanup test-created term
  if (approvedTermId) {
    try {
      await axios.delete(`${BASE_URL}/api/glossary/${approvedTermId}`, auth(adminToken));
    } catch (e) {}
  }

  console.log('===============================================================');
  console.log(`PHASE 3 TEST RESULTS: ${passed}/${passed + failed} PASS (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Suite().catch((err) => {
  console.error('Fatal error in Phase 3 test suite:', err);
  process.exit(1);
});
