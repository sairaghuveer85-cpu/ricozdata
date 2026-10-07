import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import { Dataset } from '../src/models/Dataset.js';
import { GlossaryTerm } from '../src/models/GlossaryTerm.js';
import { MaskingPolicy } from '../src/models/MaskingPolicy.js';
import { Activity } from '../src/models/Activity.js';
import tokenService from '../src/services/token.service.js';
import { USER_ROLES } from '../src/constants/user.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const BASE_URL = 'http://localhost:5000';

function apiCall(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = options.headers || {};
    let body = options.body;
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }
    const req = http.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function verifyAllProductPages() {
  console.log('================================================================');
  console.log(' RICOZDATA — FULL E2E PRODUCT FLOW & REAL-DATA VERIFICATION     ');
  console.log('================================================================\n');

  await connectDB();

  // Find or create test organization and admin user
  let org = await Organization.findOne({ slug: 'ricoz-demo' });
  if (!org) {
    org = await Organization.create({
      name: 'Ricoz Demo Corp',
      slug: 'ricoz-demo',
      plan: 'ENTERPRISE',
      status: 'ACTIVE'
    });
  }

  let user = await User.findOne({ email: 'test@example.com' });
  if (!user) {
    const hashedPw = await bcrypt.hash('password', 10);
    user = await User.create({
      organizationId: org._id,
      name: 'Test Administrator',
      email: 'test@example.com',
      passwordHash: hashedPw,
      role: USER_ROLES.ADMIN,
      status: 'ACTIVE'
    });
  }

  const token = tokenService.generateAccessToken({
    _id: user._id,
    organizationId: org._id,
    role: user.role
  });

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const results = {};

  try {
    // -------------------------------------------------------------
    // 1. DATA CATALOG (GET /api/v1/datasets)
    // -------------------------------------------------------------
    console.log('1. Verifying Data Catalog API...');
    const catalogRes = await apiCall('/api/v1/datasets?page=1&limit=20', { headers: authHeaders });
    assert.strictEqual(catalogRes.status, 200, `Expected 200 from /api/v1/datasets, got ${catalogRes.status}`);
    assert.ok(catalogRes.body.success, 'Catalog response success must be true');
    const datasetsList = catalogRes.body.data || [];
    assert.ok(Array.isArray(datasetsList), 'Catalog datasets must be array');
    console.log(`   ✓ Datasets found: ${datasetsList.length} records`);
    results.catalog = {
      status: 'PASS',
      count: datasetsList.length,
      sampleNames: datasetsList.map(d => d.name)
    };

    const firstDataset = datasetsList[0];
    assert.ok(firstDataset, 'Expected at least 1 dataset in test organization');

    // -------------------------------------------------------------
    // 2. DATASET DETAILS (GET /api/v1/datasets/:id)
    // -------------------------------------------------------------
    console.log(`2. Verifying Dataset Details API for ${firstDataset.name} (id: ${firstDataset.id || firstDataset._id})...`);
    const datasetId = firstDataset.id || firstDataset._id;
    const detailRes = await apiCall(`/api/v1/datasets/${datasetId}`, { headers: authHeaders });
    assert.strictEqual(detailRes.status, 200, `Expected 200 from /api/v1/datasets/${datasetId}`);
    assert.ok(detailRes.body.success, 'Dataset detail success must be true');
    assert.strictEqual(detailRes.body.data.name, firstDataset.name);
    console.log(`   ✓ Dataset Details loaded: ${detailRes.body.data.name}, columns: ${detailRes.body.data.columns?.length}`);
    results.datasetDetails = {
      status: 'PASS',
      name: detailRes.body.data.name,
      columnsCount: detailRes.body.data.columns?.length
    };

    // -------------------------------------------------------------
    // 3. DATA QUALITY (GET /api/v1/quality/datasets/:id & rules)
    // -------------------------------------------------------------
    console.log(`3. Verifying Data Quality API for dataset ${datasetId}...`);
    const qualitySummaryRes = await apiCall(`/api/v1/quality/datasets/${datasetId}`, { headers: authHeaders });
    assert.strictEqual(qualitySummaryRes.status, 200, `Expected 200 from /api/v1/quality/datasets/${datasetId}`);
    console.log(`   ✓ Quality Summary returned score: ${qualitySummaryRes.body.data?.overallScore ?? 'unevaluated'}`);

    const qualityRulesRes = await apiCall(`/api/v1/quality/datasets/${datasetId}/rules`, { headers: authHeaders });
    assert.strictEqual(qualityRulesRes.status, 200);
    console.log(`   ✓ Quality Rules returned count: ${qualityRulesRes.body.data?.length ?? 0}`);
    results.quality = {
      status: 'PASS',
      score: qualitySummaryRes.body.data?.overallScore ?? null,
      rulesCount: qualityRulesRes.body.data?.length ?? 0
    };

    // -------------------------------------------------------------
    // 4. DATA LINEAGE (GET /api/v1/lineage/datasets/:id)
    // -------------------------------------------------------------
    console.log(`4. Verifying Data Lineage API for dataset ${datasetId}...`);
    const lineageRes = await apiCall(`/api/v1/lineage/datasets/${datasetId}`, { headers: authHeaders });
    assert.strictEqual(lineageRes.status, 200, `Expected 200 from /api/v1/lineage/datasets/${datasetId}`);
    console.log(`   ✓ Lineage returned: upstream=${lineageRes.body.data?.upstream?.length ?? 0}, downstream=${lineageRes.body.data?.downstream?.length ?? 0}`);
    results.lineage = {
      status: 'PASS',
      upstream: lineageRes.body.data?.upstream?.length ?? 0,
      downstream: lineageRes.body.data?.downstream?.length ?? 0
    };

    // -------------------------------------------------------------
    // 5. BUSINESS GLOSSARY (GET /api/v1/glossary & POST /api/v1/glossary)
    // -------------------------------------------------------------
    console.log('5. Verifying Business Glossary API...');
    const testTermName = `Verified E2E Term ${Date.now()}`;
    const createGlossaryRes = await apiCall('/api/v1/glossary', {
      method: 'POST',
      headers: authHeaders,
      body: {
        term: testTermName,
        definition: 'Automated test business glossary term created during full E2E verification.',
        domain: 'ENGINEERING',
        status: 'APPROVED',
        owner: 'test@example.com'
      }
    });
    assert.strictEqual(createGlossaryRes.status, 201, `Expected 201 from POST /api/v1/glossary, got ${createGlossaryRes.status}`);
    const createdTermId = createGlossaryRes.body.data?.id || createGlossaryRes.body.data?._id;
    console.log(`   ✓ Glossary Term created: ${testTermName} (id: ${createdTermId})`);

    const listGlossaryRes = await apiCall('/api/v1/glossary', { headers: authHeaders });
    assert.strictEqual(listGlossaryRes.status, 200);
    const foundTerm = (listGlossaryRes.body.data?.terms || listGlossaryRes.body.data || []).find(t => t.name === testTermName || t.term === testTermName);
    assert.ok(foundTerm, 'Created glossary term must appear in list');
    console.log(`   ✓ Glossary Term verified in listing: total terms = ${(listGlossaryRes.body.data?.terms || listGlossaryRes.body.data || []).length}`);

    // Cleanup test term
    if (createdTermId) {
      await apiCall(`/api/v1/glossary/${createdTermId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      console.log(`   ✓ Cleaned up test glossary term ${createdTermId}`);
    }
    results.glossary = { status: 'PASS' };

    // -------------------------------------------------------------
    // 6. GOVERNANCE & POLICIES (GET & POST /api/v1/governance/masking-policies)
    // -------------------------------------------------------------
    console.log('6. Verifying Governance & Masking Policies API...');
    const listPoliciesRes = await apiCall('/api/v1/governance/masking-policies', { headers: authHeaders });
    assert.strictEqual(listPoliciesRes.status, 200, `Expected 200 from /api/v1/governance/masking-policies`);
    console.log(`   ✓ Governance Masking Policies returned count: ${listPoliciesRes.body.data?.length ?? 0}`);
    results.governance = {
      status: 'PASS',
      policiesCount: listPoliciesRes.body.data?.length ?? 0
    };

    // -------------------------------------------------------------
    // 7. USERS DIRECTORY (GET /api/v1/users)
    // -------------------------------------------------------------
    console.log('7. Verifying Users Directory API...');
    const usersRes = await apiCall('/api/v1/users', { headers: authHeaders });
    assert.strictEqual(usersRes.status, 200, `Expected 200 from /api/v1/users, got ${usersRes.status}`);
    const userList = usersRes.body.users || usersRes.body.data?.users || usersRes.body.data || [];
    assert.ok(Array.isArray(userList), 'Users must be an array');
    console.log(`   ✓ Users found: ${userList.length} users (Active user: ${user.email})`);
    results.users = {
      status: 'PASS',
      usersCount: userList.length
    };

    // -------------------------------------------------------------
    // 8. GLOBAL SEARCH (GET /api/v1/search?query=...)
    // -------------------------------------------------------------
    const searchTarget = firstDataset.name.split(' ')[0];
    console.log(`8. Verifying Global Search API for "${searchTarget}"...`);
    const searchRes = await apiCall(`/api/v1/search?query=${encodeURIComponent(searchTarget)}`, { headers: authHeaders });
    assert.strictEqual(searchRes.status, 200, `Expected 200 from /api/v1/search`);
    assert.ok(searchRes.body.success, 'Search success must be true');
    const searchItems = searchRes.body.data?.items || [];
    console.log(`   ✓ Search returned results: items=${searchItems.length}`);
    assert.ok(searchItems.length > 0, `Search for "${searchTarget}" should return matching entity`);
    results.search = {
      status: 'PASS',
      itemsFound: searchItems.length
    };

    // -------------------------------------------------------------
    // 9. DASHBOARD SUMMARY & LIVE ACTIVITY
    // -------------------------------------------------------------
    console.log('9. Verifying Dashboard Summary & Activity API...');
    const dashRes = await apiCall('/api/v1/dashboard/summary', { headers: authHeaders });
    assert.strictEqual(dashRes.status, 200, `Expected 200 from /api/v1/dashboard/summary`);
    assert.ok(dashRes.body.success);
    const totalDatasets = dashRes.body.data?.totalDatasets;
    const activeUsers = dashRes.body.data?.users?.active;
    console.log(`   ✓ Dashboard Metrics: totalDatasets=${totalDatasets}, activeUsers=${activeUsers}`);
    assert.ok(typeof totalDatasets === 'number');

    const actRes = await apiCall('/api/v1/dashboard/activity', { headers: authHeaders });
    assert.strictEqual(actRes.status, 200, `Expected 200 from /api/v1/dashboard/activity`);
    console.log(`   ✓ Dashboard Activity items: ${actRes.body.data?.length ?? 0}`);
    results.dashboard = {
      status: 'PASS',
      totalDatasets,
      activeUsers
    };

    // -------------------------------------------------------------
    // 10. EMPTY TENANT CLEAN LEAKAGE CHECK
    // -------------------------------------------------------------
    console.log('10. Verifying Clean Empty Tenant (Zero Data Leakage / Zero Mock Leakage)...');
    const emptyOrgId = new mongoose.Types.ObjectId();
    const emptyOrg = await Organization.create({
      _id: emptyOrgId,
      name: 'Pristine Zero Org',
      slug: 'pristine-zero-' + Date.now(),
      plan: 'ENTERPRISE',
      status: 'ACTIVE'
    });

    const emptyUser = await User.create({
      organizationId: emptyOrgId,
      name: 'Zero User',
      email: `zero.user.${Date.now()}@example.com`,
      passwordHash: await bcrypt.hash('Secure123!', 10),
      role: USER_ROLES.ADMIN,
      status: 'ACTIVE'
    });

    const emptyToken = tokenService.generateAccessToken({
      _id: emptyUser._id,
      organizationId: emptyOrgId,
      role: emptyUser.role
    });

    const emptyHeaders = { Authorization: `Bearer ${emptyToken}` };

    const emptyCatalog = await apiCall('/api/v1/datasets', { headers: emptyHeaders });
    assert.strictEqual(emptyCatalog.status, 200);
    assert.strictEqual((emptyCatalog.body.data || []).length, 0, 'Clean tenant must have 0 datasets');

    const emptyGlossary = await apiCall('/api/v1/glossary', { headers: emptyHeaders });
    assert.strictEqual(emptyGlossary.status, 200);
    const emptyGlossaryTerms = emptyGlossary.body.data?.terms || emptyGlossary.body.data || [];
    assert.strictEqual(emptyGlossaryTerms.length, 0, 'Clean tenant must have 0 glossary terms');

    const emptyPolicies = await apiCall('/api/v1/governance/masking-policies', { headers: emptyHeaders });
    assert.strictEqual(emptyPolicies.status, 200);
    assert.strictEqual((emptyPolicies.body.data || []).length, 0, 'Clean tenant must have 0 masking policies');

    const emptyDash = await apiCall('/api/v1/dashboard/summary', { headers: emptyHeaders });
    assert.strictEqual(emptyDash.status, 200);
    assert.strictEqual(emptyDash.body.data?.totalDatasets, 0, 'Clean tenant dashboard must show 0 datasets');

    console.log('   ✓ Clean Empty Tenant Verified: 0 datasets, 0 terms, 0 policies, 0 fake leakages');
    results.emptyTenantIsolation = { status: 'PASS' };

    console.log('\n================================================================');
    console.log(' ALL 10 E2E PRODUCT FLOW CHECKS PASSED WITH ZERO ERRORS         ');
    console.log('================================================================');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await disconnectDB();
  }
}

verifyAllProductPages().catch(err => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
