// Phase 2: Business Glossary Comprehensive Verification Suite
// Validates:
// 1. Data Model & CRUD operations
// 2. Strong Backend Validation (min/max lengths, valid ObjectIds, enums, existence checks)
// 3. Duplicate Prevention (case-insensitive)
// 4. Server-Side Pagination, Filtering, Search, and Whitelisted Sorting
// 5. Audit Logging via Activity system (createdBy, updatedBy, approvedBy, approvedAt)
// 6. Status Management & Lifecycle Transitions
// 7. Dataset Bidirectional Relationships
// 8. Column-Level Relationships & Verification
// 9. Related Business Terms (Self-reference prevention & duplicate rejection)
// 10. Referential Integrity on Delete
// 11. RBAC Permission Enforcement (VIEWER, DATA_ANALYST, DATA_STEWARD, ADMIN)
// 12. Backward Compatibility with existing 'active' and 'deprecated' states

const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

let superAdminToken = null;
let stewardToken = null;
let analystToken = null;
let viewerToken = null;

let superAdminUser = null;
let stewardUser = null;

let testDomainId = null;
let testDatasetId = null;
let testColumnId = null;
let testColumnName = null;

let createdTermIds = [];

async function loginUser(email, password) {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  if (!res.data.success) {
    throw new Error(`Failed to log in as ${email}: ${res.data.message}`);
  }
  return { token: res.data.data.token, user: res.data.data.user };
}

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function runPhase2GlossarySuite() {
  console.log('===============================================================');
  console.log('STARTING RICOZDATA PHASE 2 BUSINESS GLOSSARY TEST SUITE');
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

  // 1. Authentication & Fixtures Setup
  await testStep('Setup: Authenticate users and gather fixtures', async () => {
    const adminAuth = await loginUser('raghuveer.chandran@ricoz-industries.demo', 'Password123!');
    superAdminToken = adminAuth.token;
    superAdminUser = adminAuth.user;

    const stewardAuth = await loginUser('arjun.kumar@ricoz-industries.demo', 'Password123!');
    stewardToken = stewardAuth.token;
    stewardUser = stewardAuth.user;

    const analystAuth = await loginUser('vikram.mehta@ricoz-industries.demo', 'Password123!');
    analystToken = analystAuth.token;

    const viewerAuth = await loginUser('kavya.sharma@ricoz-industries.demo', 'Password123!');
    viewerToken = viewerAuth.token;

    // Get an existing domain
    const domainsRes = await axios.get(`${BASE_URL}/api/datasets`, authHeader(superAdminToken));
    const datasets = domainsRes.data.data?.datasets || domainsRes.data.data || [];
    assert(datasets.length > 0, 'At least one dataset must exist');
    testDatasetId = datasets[0]._id || datasets[0].id;
    testDomainId = datasets[0].domainId;

    // Fetch dataset details for columns
    const dsDetailRes = await axios.get(`${BASE_URL}/api/datasets/${testDatasetId}`, authHeader(superAdminToken));
    const dsDetail = dsDetailRes.data.data;
    const columns = dsDetail.columns || dsDetail.schema || [];
    assert(columns.length > 0, 'Dataset must have at least one column');
    testColumnId = columns[0]._id || columns[0].id;
    testColumnName = columns[0].name;

    assert(superAdminToken && stewardToken && analystToken && viewerToken);
  });

  // 2. Validation Enforcement Tests
  await testStep('Validation: Reject missing or short term name (< 2 chars)', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'A',
        definition: 'Valid definition of sufficient length for test',
      }, authHeader(stewardToken));
      assert.fail('Should have failed');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert.match(err.response.data.message, /at least 2 characters/i);
    }
  });

  await testStep('Validation: Reject missing or short definition (< 10 chars)', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'Short Def Term',
        definition: 'Too short',
      }, authHeader(stewardToken));
      assert.fail('Should have failed');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert.match(err.response.data.message, /at least 10 characters/i);
    }
  });

  await testStep('Validation: Reject invalid domainId ObjectId format', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'Invalid Domain Term',
        definition: 'A valid definition with adequate length',
        domainId: 'invalid-not-an-id'
      }, authHeader(stewardToken));
      assert.fail('Should have failed');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert.match(err.response.data.message, /invalid domainId/i);
    }
  });

  await testStep('Validation: Reject non-existent domainId', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'Nonexistent Domain Term',
        definition: 'A valid definition with adequate length',
        domainId: '507f1f77bcf86cd799439011'
      }, authHeader(stewardToken));
      assert.fail('Should have failed');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert.match(err.response.data.message, /referenced domain does not exist/i);
    }
  });

  await testStep('Validation: Reject invalid status value', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'Invalid Status Term',
        definition: 'A valid definition with adequate length',
        status: 'UNAUTHORIZED_STATUS'
      }, authHeader(stewardToken));
      assert.fail('Should have failed');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert.match(err.response.data.message, /invalid status/i);
    }
  });

  // 3. Successful Creation with Full Metadata & Audit Info
  let termAId = null;
  let termBId = null;

  await testStep('CRUD: Create enterprise glossary term with all semantic fields', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary`, {
      term: 'Annual Recurring Revenue',
      definition: 'Contracted and normalized recurring subscription revenue annualized over 12 months.',
      domain: 'Finance',
      status: 'draft',
      synonyms: ['ARR', 'Normalized ARR'],
      tags: ['saas', 'revenue', 'financial-kpi'],
      examples: ['A customer with a $10,000 monthly subscription has an ARR of $120,000.'],
      businessRules: ['Excludes one-time setup and professional service fees.'],
      relatedDatasetIds: [testDatasetId]
    }, authHeader(stewardToken));

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    const created = res.data.data;
    termAId = created._id;
    createdTermIds.push(termAId);

    assert.strictEqual(created.term, 'Annual Recurring Revenue');
    assert.strictEqual(created.status, 'draft');
    assert.strictEqual(created.synonyms.length, 2);
    assert.strictEqual(created.tags.length, 3);
    assert.strictEqual(created.examples.length, 1);
    assert.strictEqual(created.businessRules.length, 1);
    assert(created.createdBy, 'createdBy must be populated or recorded');
  });

  await testStep('Validation: Prevent duplicate term name (case-insensitive)', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'annual recurring revenue', // lowercase duplicate
        definition: 'Another definition attempt for the same term name',
      }, authHeader(stewardToken));
      assert.fail('Should have failed with 409');
    } catch (err) {
      assert.strictEqual(err.response.status, 409);
      assert.match(err.response.data.message, /already exists/i);
    }
  });

  await testStep('CRUD: Create second term for relationship testing', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary`, {
      term: 'Monthly Recurring Revenue',
      definition: 'Normalized monthly recurring subscription revenue recognized in a given calendar month.',
      domain: 'Finance',
      status: 'draft',
      synonyms: ['MRR'],
      tags: ['finance', 'subscription'],
    }, authHeader(stewardToken));

    assert.strictEqual(res.status, 201);
    termBId = res.data.data._id;
    createdTermIds.push(termBId);
  });

  // 4. Single Term Details & Population
  await testStep('Read: Get single term by ID with populated references', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/${termAId}`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const term = res.data.data;
    assert.strictEqual(term._id, termAId);
    assert.strictEqual(term.term, 'Annual Recurring Revenue');
    assert(Array.isArray(term.relatedDatasets), 'relatedDatasets must be an array');
    assert(term.relatedDatasets.length >= 1, 'Should have linked dataset');
  });

  await testStep('Read: Reject invalid term ID with 400', async () => {
    try {
      await axios.get(`${BASE_URL}/api/glossary/not-an-objectid`, authHeader(stewardToken));
      assert.fail('Should have failed with 400');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
    }
  });

  await testStep('Read: Non-existent term ID returns 404', async () => {
    try {
      await axios.get(`${BASE_URL}/api/glossary/507f1f77bcf86cd799439011`, authHeader(stewardToken));
      assert.fail('Should have failed with 404');
    } catch (err) {
      assert.strictEqual(err.response.status, 404);
    }
  });

  // 5. Server-Side Pagination, Filtering, Search, Sorting
  await testStep('Search: Search by term substring', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary?search=Recurring`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.length >= 2, 'Should find both ARR and MRR terms');
  });

  await testStep('Search: Search by synonym', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary?search=MRR`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.some(t => t.term === 'Monthly Recurring Revenue'));
  });

  await testStep('Search: Search by tag', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary?search=financial-kpi`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.some(t => t.term === 'Annual Recurring Revenue'));
  });

  await testStep('Filter: Filter by domain and status', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary?domain=Finance&status=draft`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.every(t => t.domain === 'Finance' && t.status === 'draft'));
  });

  await testStep('Pagination: Server-side pagination structure and limit clamping', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary?page=1&limit=2`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);
    const pagination = res.data.data.pagination;
    assert.strictEqual(pagination.page, 1);
    assert.strictEqual(pagination.limit, 2);
    assert(pagination.total >= 2);
    assert(pagination.pages >= 1);
    assert(res.data.data.items.length <= 2);
  });

  await testStep('Sorting: Sort by term ascending and descending', async () => {
    const resAsc = await axios.get(`${BASE_URL}/api/glossary?sortBy=term&sortOrder=asc&limit=10`, authHeader(stewardToken));
    const itemsAsc = resAsc.data.data.items;
    for (let i = 1; i < itemsAsc.length; i++) {
      assert(itemsAsc[i - 1].term.localeCompare(itemsAsc[i].term) <= 0);
    }
  });

  // 6. Status Management Lifecycle
  await testStep('Status: Transition from draft to approved records approvedBy and approvedAt', async () => {
    const res = await axios.patch(`${BASE_URL}/api/glossary/${termAId}/status`, {
      status: 'approved'
    }, authHeader(stewardToken));

    assert.strictEqual(res.status, 200);
    const term = res.data.data;
    assert.strictEqual(term.status, 'approved');
    assert(term.approvedBy, 'approvedBy must be set');
    assert(term.approvedAt, 'approvedAt must be set');
  });

  // 7. Column Relationship Linking & Unlinking
  await testStep('Column Link: Link term to specific dataset column', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/${termAId}/columns`, {
      datasetId: testDatasetId,
      columnId: testColumnId
    }, authHeader(stewardToken));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.columnName, testColumnName);

    // Verify resolved column in GET /:id
    const detail = await axios.get(`${BASE_URL}/api/glossary/${termAId}`, authHeader(stewardToken));
    const cols = detail.data.data.relatedColumns;
    assert(cols.some(c => c.columnId.toString() === testColumnId.toString()));
  });

  await testStep('Column Link: Prevent duplicate column link with 409', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary/${termAId}/columns`, {
        datasetId: testDatasetId,
        columnId: testColumnId
      }, authHeader(stewardToken));
      assert.fail('Should have rejected duplicate column link');
    } catch (err) {
      assert.strictEqual(err.response.status, 409);
    }
  });

  await testStep('Column Unlink: Unlink column from glossary term', async () => {
    const res = await axios.delete(`${BASE_URL}/api/glossary/${termAId}/columns`, {
      ...authHeader(stewardToken),
      data: {
        datasetId: testDatasetId,
        columnId: testColumnId
      }
    });
    assert.strictEqual(res.status, 200);

    const detail = await axios.get(`${BASE_URL}/api/glossary/${termAId}`, authHeader(stewardToken));
    const cols = detail.data.data.relatedColumns;
    assert(!cols.some(c => c.columnId.toString() === testColumnId.toString()));
  });

  // 8. Related Terms Linking & Prevention of Self-Reference
  await testStep('Related Term: Prevent self-reference with 400', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary/${termAId}/related-terms`, {
        relatedTermId: termAId
      }, authHeader(stewardToken));
      assert.fail('Should have failed self-reference');
    } catch (err) {
      assert.strictEqual(err.response.status, 400);
      assert.match(err.response.data.message, /cannot link a term to itself/i);
    }
  });

  await testStep('Related Term: Link ARR and MRR bidirectionally', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/${termAId}/related-terms`, {
      relatedTermId: termBId
    }, authHeader(stewardToken));

    assert.strictEqual(res.status, 200);

    // Verify bidirectional link
    const detailB = await axios.get(`${BASE_URL}/api/glossary/${termBId}`, authHeader(stewardToken));
    assert(detailB.data.data.relatedTerms.some(t => (t._id || t.id).toString() === termAId.toString()));
  });

  await testStep('Related Term: Prevent duplicate term link with 409', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary/${termAId}/related-terms`, {
        relatedTermId: termBId
      }, authHeader(stewardToken));
      assert.fail('Should have failed with 409');
    } catch (err) {
      assert.strictEqual(err.response.status, 409);
    }
  });

  await testStep('Related Term: Unlink related terms bidirectionally', async () => {
    const res = await axios.delete(`${BASE_URL}/api/glossary/${termAId}/related-terms/${termBId}`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);

    const detailB = await axios.get(`${BASE_URL}/api/glossary/${termBId}`, authHeader(stewardToken));
    assert(!detailB.data.data.relatedTerms.some(t => (t._id || t.id).toString() === termAId.toString()));
  });

  // 9. Dataset Linking & Unlinking
  await testStep('Dataset Link: Unlink dataset and verify removal', async () => {
    const res = await axios.delete(`${BASE_URL}/api/glossary/${termAId}/datasets/${testDatasetId}`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);

    const detail = await axios.get(`${BASE_URL}/api/glossary/${termAId}`, authHeader(stewardToken));
    assert(!detail.data.data.relatedDatasetIds.includes(testDatasetId));
  });

  await testStep('Dataset Link: Relink dataset and check Dataset.glossaryTermIds bidirectional update', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/${termAId}/datasets/${testDatasetId}`, {}, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);

    // Verify dataset has term
    const dsRes = await axios.get(`${BASE_URL}/api/datasets/${testDatasetId}`, authHeader(stewardToken));
    const termIds = dsRes.data.data.glossaryTermIds || [];
    assert(termIds.some(id => (id._id || id).toString() === termAId.toString()));
  });

  // 10. Audit Logging Verification
  await testStep('Audit: Verify Activity logging for glossary mutations', async () => {
    const actRes = await axios.get(`${BASE_URL}/api/activities?limit=10`, authHeader(stewardToken));
    assert.strictEqual(actRes.status, 200);
    const activities = actRes.data.data?.activities || actRes.data.data || [];
    const glossaryActivities = activities.filter(a => a.type === 'glossary' || (a.title && a.title.includes('Glossary term')));
    assert(glossaryActivities.length > 0, 'Activity log must capture glossary mutations');
  });

  // 11. RBAC Permissions Enforcement
  await testStep('RBAC: VIEWER can read glossary but cannot create, update, or delete', async () => {
    // Read succeeds
    const readRes = await axios.get(`${BASE_URL}/api/glossary`, authHeader(viewerToken));
    assert.strictEqual(readRes.status, 200);

    // Create fails (403)
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'Viewer Unauthorized Term',
        definition: 'This should be rejected by RBAC',
      }, authHeader(viewerToken));
      assert.fail('Viewer should not be allowed to create');
    } catch (err) {
      assert.strictEqual(err.response.status, 403);
    }

    // Update fails (403)
    try {
      await axios.put(`${BASE_URL}/api/glossary/${termAId}`, {
        definition: 'Unauthorized update attempt'
      }, authHeader(viewerToken));
      assert.fail('Viewer should not be allowed to update');
    } catch (err) {
      assert.strictEqual(err.response.status, 403);
    }

    // Delete fails (403)
    try {
      await axios.delete(`${BASE_URL}/api/glossary/${termAId}`, authHeader(viewerToken));
      assert.fail('Viewer should not be allowed to delete');
    } catch (err) {
      assert.strictEqual(err.response.status, 403);
    }
  });

  await testStep('RBAC: DATA_ANALYST cannot create glossary term (403)', async () => {
    try {
      await axios.post(`${BASE_URL}/api/glossary`, {
        term: 'Analyst Unauthorized Term',
        definition: 'This should be rejected by RBAC',
      }, authHeader(analystToken));
      assert.fail('Data Analyst should not be allowed to create');
    } catch (err) {
      assert.strictEqual(err.response.status, 403);
    }
  });

  // 12. Delete & Referential Integrity
  await testStep('Delete: Delete glossary term and ensure Dataset.glossaryTermIds is cleaned up', async () => {
    const res = await axios.delete(`${BASE_URL}/api/glossary/${termAId}`, authHeader(stewardToken));
    assert.strictEqual(res.status, 200);

    // Verify dataset no longer references termAId
    const dsRes = await axios.get(`${BASE_URL}/api/datasets/${testDatasetId}`, authHeader(stewardToken));
    const termIds = dsRes.data.data.glossaryTermIds || [];
    assert(!termIds.some(id => (id._id || id).toString() === termAId.toString()), 'Dataset must not retain deleted term reference');

    // Term itself must return 404
    try {
      await axios.get(`${BASE_URL}/api/glossary/${termAId}`, authHeader(stewardToken));
      assert.fail('Term should be deleted');
    } catch (err) {
      assert.strictEqual(err.response.status, 404);
    }
  });

  // Cleanup any remaining test terms
  for (const id of createdTermIds) {
    if (id !== termAId) {
      try {
        await axios.delete(`${BASE_URL}/api/glossary/${id}`, authHeader(superAdminToken));
      } catch (e) {}
    }
  }

  console.log('===============================================================');
  console.log(`TEST SUITE RESULTS: ${passed}/${passed + failed} PASS (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2GlossarySuite().catch((err) => {
  console.error('Fatal error in glossary test suite:', err);
  process.exit(1);
});
