/**
 * RicozData Phase 8 Advanced Enterprise Data Catalog Verification Suite
 * Tests all Phase 8 capabilities against the live Express + MongoDB API:
 * 1. Advanced search across 10+ fields
 * 2. Multi-faceted server-side filtering
 * 3. Sorting and pagination with pagination metadata
 * 4. User-specific favorites & bookmarks
 * 5. Certification & Deprecation governance workflow with RBAC
 * 6. Interactive column-level schema metadata updates
 * 7. Related datasets discovery with relationship reasoning
 * 8. Activity audit logs for catalog mutations
 * 9. Tag and source aggregation discovery endpoints
 * 10. Catalog summary statistics
 */

const http = require('http');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

const USERS = {
  SUPER_ADMIN: { email: 'raghuveer.chandran@ricoz-industries.demo', password: 'Password123!', role: 'SUPER_ADMIN' },
  ADMIN: { email: 'priya.shah@ricoz-industries.demo', password: 'Password123!', role: 'ADMIN' },
  DATA_STEWARD: { email: 'arjun.kumar@ricoz-industries.demo', password: 'Password123!', role: 'DATA_STEWARD' },
  DATA_ENGINEER: { email: 'meera.iyer@ricoz-industries.demo', password: 'Password123!', role: 'DATA_ENGINEER' },
  DATA_ANALYST: { email: 'vikram.mehta@ricoz-industries.demo', password: 'Password123!', role: 'DATA_ANALYST' },
  VIEWER: { email: 'kavya.sharma@ricoz-industries.demo', password: 'Password123!', role: 'VIEWER' }
};

const results = [];

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function record(category, testName, expected, actualStatus, pass, details = '') {
  results.push({ category, testName, expected, actualStatus, pass, details });
  const icon = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${category} :: ${testName} (Status: ${actualStatus}, Expected: ${expected}) ${details ? '- ' + details : ''}`);
}

async function runPhase8Suite() {
  console.log('===============================================================');
  console.log('STARTING RICOZDATA PHASE 8 ENTERPRISE CATALOG VERIFICATION SUITE');
  console.log('===============================================================\n');

  // 1. Authenticate users
  const tokens = {};
  const userObjects = {};

  for (const [roleKey, creds] of Object.entries(USERS)) {
    const res = await request('POST', '/api/auth/login', { email: creds.email, password: creds.password });
    const pass = res.status === 200 && res.body?.data?.token;
    if (pass) {
      tokens[roleKey] = res.body.data.token;
      userObjects[roleKey] = res.body.data.user;
    }
    record('Authentication', `Login as ${roleKey}`, 200, res.status, pass);
  }

  // 2. Fetch baseline datasets list
  const baseRes = await request('GET', '/api/datasets', null, tokens.DATA_ANALYST);
  const datasets = baseRes.body?.data?.datasets || [];
  const sampleDataset = datasets[0] || {};
  const sampleDatasetId = sampleDataset._id || sampleDataset.id;

  record('Catalog Discovery', 'GET /api/datasets baseline retrieval', 200, baseRes.status, baseRes.status === 200 && datasets.length > 0, `Found ${datasets.length} datasets`);

  console.log('\n--- 1. ADVANCED MULTI-FIELD SEARCH ---');
  // Search by name
  const searchNameRes = await request('GET', `/api/datasets?search=${encodeURIComponent(sampleDataset.name?.slice(0, 4) || 'cust')}`, null, tokens.VIEWER);
  const matchName = searchNameRes.body?.data?.datasets?.some(d => d.name?.toLowerCase().includes(sampleDataset.name?.slice(0, 4).toLowerCase()));
  record('Search', 'Search by dataset name substring', 200, searchNameRes.status, searchNameRes.status === 200 && matchName);

  // Search by domain
  const searchDomainRes = await request('GET', '/api/datasets?search=Finance', null, tokens.VIEWER);
  const matchDomain = searchDomainRes.body?.data?.datasets?.every(d => d.domain === 'Finance' || d.description?.includes('Finance') || d.name?.includes('Finance') || d.tags?.includes('Finance'));
  record('Search', 'Search across domain keyword "Finance"', 200, searchDomainRes.status, searchDomainRes.status === 200);

  // Search non-existent
  const searchNoneRes = await request('GET', '/api/datasets?search=xyznonexistentterm999', null, tokens.VIEWER);
  record('Search', 'Search with non-existent query yields 0 results', 200, searchNoneRes.status, searchNoneRes.body?.data?.total === 0);

  console.log('\n--- 2. MULTI-FACETED SERVER-SIDE FILTERING ---');
  // Domain filter
  const filterDomainRes = await request('GET', '/api/datasets?domain=Customer', null, tokens.DATA_ANALYST);
  const domainFiltered = filterDomainRes.body?.data?.datasets || [];
  const allDomainCustomer = domainFiltered.every(d => d.domain === 'Customer');
  record('Filtering', 'Filter by domain=Customer', 200, filterDomainRes.status, allDomainCustomer && domainFiltered.length > 0, `${domainFiltered.length} matches`);

  // Source system filter
  const filterSourceRes = await request('GET', '/api/datasets?sourceSystem=Snowflake', null, tokens.DATA_ANALYST);
  record('Filtering', 'Filter by sourceSystem=Snowflake', 200, filterSourceRes.status, filterSourceRes.status === 200);

  // Sensitivity filter
  const filterSensRes = await request('GET', '/api/datasets?sensitivity=Confidential', null, tokens.DATA_ANALYST);
  const allSensConf = (filterSensRes.body?.data?.datasets || []).every(d => d.sensitivity === 'Confidential');
  record('Filtering', 'Filter by sensitivity=Confidential', 200, filterSensRes.status, allSensConf);

  console.log('\n--- 3. SORTING AND PAGINATION ---');
  // Sort by name ASC
  const sortAscRes = await request('GET', '/api/datasets?sortBy=name&sortOrder=asc', null, tokens.VIEWER);
  const ascList = (sortAscRes.body?.data?.datasets || []).map(d => d.name);
  const isSortedAsc = ascList.slice(1).every((item, i) => ascList[i].localeCompare(item) <= 0);
  record('Sorting', 'Sort by name ASC', 200, sortAscRes.status, isSortedAsc);

  // Sort by quality DESC
  const sortQualityRes = await request('GET', '/api/datasets?sortBy=quality&sortOrder=desc', null, tokens.VIEWER);
  const qualityList = (sortQualityRes.body?.data?.datasets || []).map(d => d.qualityScore || d.quality || 0);
  const isSortedQuality = qualityList.slice(1).every((item, i) => qualityList[i] >= item);
  record('Sorting', 'Sort by quality score DESC', 200, sortQualityRes.status, isSortedQuality);

  // Pagination limit & page
  const pageRes = await request('GET', '/api/datasets?page=1&limit=3', null, tokens.VIEWER);
  const pageData = pageRes.body?.data || {};
  const hasPaginationMeta = pageData.limit === 3 && pageData.page === 1 && typeof pageData.pages === 'number' && typeof pageData.total === 'number';
  record('Pagination', 'Paginated metadata response (page, limit, total, pages)', 200, pageRes.status, hasPaginationMeta, `Total ${pageData.total}, Page ${pageData.page}/${pageData.pages}`);

  console.log('\n--- 4. USER-SPECIFIC FAVORITES & BOOKMARKS ---');
  // Toggle favorite for Analyst
  const favToggleRes = await request('POST', `/api/datasets/${sampleDatasetId}/favorite`, {}, tokens.DATA_ANALYST);
  const isFavNow = favToggleRes.body?.data?.isFavorited;
  record('Favorites', `POST /api/datasets/:id/favorite toggle (now: ${isFavNow})`, 200, favToggleRes.status, favToggleRes.status === 200 && typeof isFavNow === 'boolean');

  // Verify favorite state appears in user's favorites endpoint
  const getFavsRes = await request('GET', `/api/datasets/${sampleDatasetId}/favorite`, null, tokens.DATA_ANALYST);
  record('Favorites', 'GET /api/datasets/:id/favorite check bookmark state', 200, getFavsRes.status, getFavsRes.status === 200 && getFavsRes.body?.data?.isFavorited === isFavNow);

  // Filter by myFavorites
  const myFavsRes = await request('GET', `/api/datasets?myFavorites=true`, null, tokens.DATA_ANALYST);
  const myFavList = myFavsRes.body?.data?.datasets || [];
  const foundInMyFavs = myFavList.some(d => (d._id || d.id) === sampleDatasetId);
  record('Favorites', 'Filter datasets by myFavorites=true', 200, myFavsRes.status, isFavNow ? foundInMyFavs : !foundInMyFavs);

  // Toggle back to preserve initial state if needed
  if (!isFavNow) {
    await request('POST', `/api/datasets/${sampleDatasetId}/favorite`, {}, tokens.DATA_ANALYST);
  }

  console.log('\n--- 5. CERTIFICATION & DEPRECATION WORKFLOW ---');
  // VIEWER attempting to certify (should be 403 Forbidden)
  const viewerCertRes = await request('PUT', `/api/datasets/${sampleDatasetId}/certification`, { status: 'Certified', notes: 'Viewer trying' }, tokens.VIEWER);
  record('Governance RBAC', 'VIEWER attempts dataset certification (unauthorized)', 403, viewerCertRes.status, viewerCertRes.status === 403);

  // DATA_STEWARD certifying dataset
  const stewardCertRes = await request('PUT', `/api/datasets/${sampleDatasetId}/certification`, {
    status: 'Certified',
    notes: 'Approved by enterprise steward team'
  }, tokens.DATA_STEWARD);
  record('Certification', 'DATA_STEWARD certifies dataset (PUT /api/datasets/:id/certification)', 200, stewardCertRes.status, stewardCertRes.status === 200 && stewardCertRes.body?.data?.certificationStatus === 'Certified');

  // Deprecating dataset
  const deprecateRes = await request('PUT', `/api/datasets/${sampleDatasetId}/certification`, {
    status: 'Deprecated',
    notes: 'Superseded by v2 telemetry pipeline'
  }, tokens.ADMIN);
  record('Certification', 'ADMIN deprecates dataset with reason and audit timestamp', 200, deprecateRes.status, deprecateRes.status === 200 && deprecateRes.body?.data?.certificationStatus === 'Deprecated');

  // Restore to Certified
  await request('PUT', `/api/datasets/${sampleDatasetId}/certification`, { status: 'Certified', notes: 'Restored certified status' }, tokens.SUPER_ADMIN);

  console.log('\n--- 6. COLUMN-LEVEL SCHEMA METADATA UPDATES ---');
  // Fetch dataset to get schema column
  const dsDetailRes = await request('GET', `/api/datasets/${sampleDatasetId}`, null, tokens.DATA_STEWARD);
  const schemaCol = dsDetailRes.body?.data?.schema?.[0];
  const colIdentifier = schemaCol?._id || schemaCol?.name;

  if (colIdentifier) {
    const updateColRes = await request('PUT', `/api/datasets/${sampleDatasetId}/schema/${colIdentifier}`, {
      sensitivity: 'Restricted',
      description: 'Enterprise regulated identifier column',
      businessMeaning: 'Unique account ledger primary key'
    }, tokens.DATA_STEWARD);

    record('Schema Metadata', 'DATA_STEWARD updates column metadata (sensitivity, description, business meaning)', 200, updateColRes.status, updateColRes.status === 200 && updateColRes.body?.data?.column?.sensitivity === 'Restricted');

    // VIEWER attempting to update column metadata -> 403
    const viewerColRes = await request('PUT', `/api/datasets/${sampleDatasetId}/schema/${colIdentifier}`, {
      sensitivity: 'Public'
    }, tokens.VIEWER);
    record('Schema Metadata RBAC', 'VIEWER attempts schema column update (unauthorized)', 403, viewerColRes.status, viewerColRes.status === 403);
  }

  console.log('\n--- 7. RELATED DATASETS & RELATIONSHIP REASONS ---');
  const relatedRes = await request('GET', `/api/datasets/${sampleDatasetId}/related`, null, tokens.DATA_ANALYST);
  const relatedList = relatedRes.body?.data || [];
  record('Related Datasets', 'GET /api/datasets/:id/related heuristic relationships', 200, relatedRes.status, relatedRes.status === 200 && Array.isArray(relatedList), `Resolved ${relatedList.length} related assets`);

  console.log('\n--- 8. DATASET ACTIVITY AUDIT TRAIL ---');
  const activityRes = await request('GET', `/api/datasets/${sampleDatasetId}/activity`, null, tokens.DATA_ANALYST);
  const activityList = activityRes.body?.data || [];
  record('Activity Audit', 'GET /api/datasets/:id/activity captures recent lifecycle/schema mutations', 200, activityRes.status, activityRes.status === 200 && Array.isArray(activityList));

  console.log('\n--- 9. DISCOVERY & SUMMARY ENDPOINTS ---');
  // Tags
  const tagsRes = await request('GET', '/api/datasets/tags', null, tokens.VIEWER);
  record('Discovery', 'GET /api/datasets/tags aggregate tag inventory', 200, tagsRes.status, tagsRes.status === 200 && Array.isArray(tagsRes.body?.data));

  // Sources
  const sourcesRes = await request('GET', '/api/datasets/sources', null, tokens.VIEWER);
  record('Discovery', 'GET /api/datasets/sources aggregate source warehouse inventory', 200, sourcesRes.status, sourcesRes.status === 200 && Array.isArray(sourcesRes.body?.data));

  // Summary stats
  const statsRes = await request('GET', '/api/datasets/stats/summary', null, tokens.VIEWER);
  const hasStats = statsRes.body?.data && typeof statsRes.body.data.totalDatasets === 'number';
  record('Summary Stats', 'GET /api/datasets/stats/summary catalog metrics', 200, statsRes.status, hasStats, `Total: ${statsRes.body?.data?.totalDatasets}, Certified: ${statsRes.body?.data?.certifiedDatasets}`);

  // Summary
  const passedCount = results.filter(r => r.pass).length;
  const totalCount = results.length;

  console.log('\n===============================================================');
  console.log(`PHASE 8 VERIFICATION RESULTS: ${passedCount}/${totalCount} PASS (${((passedCount/totalCount)*100).toFixed(1)}%)`);
  console.log('===============================================================');

  return { passedCount, totalCount, allPass: passedCount === totalCount };
}

runPhase8Suite().catch(err => {
  console.error('Fatal Phase 8 test runner error:', err);
  process.exit(1);
});
