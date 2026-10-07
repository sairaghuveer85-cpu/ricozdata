import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api/v1';

async function testReportsApiAndRouteIntegrity() {
  console.log('============================================================');
  console.log('REPORTS & ROUTE INTEGRITY VERIFICATION');
  console.log('============================================================\n');

  // 1. Authenticate with primary organization
  console.log('[1/4] Authenticating as Lead Steward...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'ricoz-demo'
    },
    body: JSON.stringify({
      email: 'lead.steward@ricoz.io',
      password: 'EnterprisePassword2026!'
    })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  assert.ok(loginData.data?.accessToken, 'Access token must be returned');
  const token = loginData.data.accessToken;
  console.log('✓ Successfully authenticated\n');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-Slug': 'ricoz-demo',
    'Content-Type': 'application/json'
  };

  // 2. Test Activity API used by Reports
  console.log('[2/4] Testing GET /api/v1/dashboard/activity endpoint...');
  const actRes = await fetch(`${BASE_URL}/dashboard/activity?limit=10`, { headers });
  assert.strictEqual(actRes.status, 200, 'Activity endpoint must return HTTP 200');
  const actData = await actRes.json();
  assert.strictEqual(actData.success, true, 'Response success must be true');
  assert.ok(Array.isArray(actData.data?.activities), 'activities must be an array');
  console.log(`✓ Activity endpoint returned ${actData.data.activities.length} activities`);
  if (actData.data.activities.length > 0) {
    const firstAct = actData.data.activities[0];
    console.log('  Top Activity:', {
      id: firstAct.id,
      action: firstAct.action,
      entityType: firstAct.entityType,
      actor: firstAct.actor?.name,
      timestamp: firstAct.timestamp
    });
    assert.ok(firstAct.action, 'Activity must have action field');
    assert.ok(firstAct.timestamp, 'Activity must have timestamp field');
  }

  // 3. Test Frontend Dev Server HTML route serving for /reports and all key routes
  console.log('\n[3/4] Testing Frontend Dev Server route accessibility...');
  const routesToTest = [
    '/',
    '/login',
    '/dashboard',
    '/catalog',
    '/catalog/6ab8f3ea501d04f8ba6e70e7',
    '/quality',
    '/quality/6ab8f3ea501d04f8ba6e70e7',
    '/lineage',
    '/lineage/6ab8f3ea501d04f8ba6e70e7',
    '/glossary',
    '/governance',
    '/users',
    '/settings',
    '/reports'
  ];

  for (const r of routesToTest) {
    const res = await fetch(`http://localhost:5173${r}`);
    assert.strictEqual(res.status, 200, `Route ${r} must respond with 200 OK`);
    const text = await res.text();
    assert.ok(text.includes('id="root"'), `Route ${r} must render the root app container`);
    console.log(`✓ Route http://localhost:5173${r} returned HTTP 200`);
  }

  // 4. Verify all major API endpoints supporting the application pages
  console.log('\n[4/4] Verifying Core APIs for All Pages...');
  const apiChecks = [
    { name: 'Dashboard Summary', url: `${BASE_URL}/dashboard/summary` },
    { name: 'Data Catalog Datasets', url: `${BASE_URL}/datasets?limit=20` },
    { name: 'Dataset Details', url: `${BASE_URL}/datasets/6ab8f3ea501d04f8ba6e70e7` },
    { name: 'Dashboard Quality Overview', url: `${BASE_URL}/dashboard/quality-overview` },
    { name: 'Dataset Quality', url: `${BASE_URL}/quality/datasets/6ab8f3ea501d04f8ba6e70e7` },
    { name: 'Dataset Lineage', url: `${BASE_URL}/lineage/datasets/6ab8f3ea501d04f8ba6e70e7` },
    { name: 'Dataset Lineage Upstream', url: `${BASE_URL}/lineage/upstream/6ab8f3ea501d04f8ba6e70e7` },
    { name: 'Business Glossary', url: `${BASE_URL}/glossary` },
    { name: 'Governance Masking Policies', url: `${BASE_URL}/governance/masking-policies` },
    { name: 'Users List', url: `${BASE_URL}/users` },
    { name: 'Reports Audit Activity', url: `${BASE_URL}/dashboard/activity?limit=10` }
  ];

  for (const check of apiChecks) {
    const res = await fetch(check.url, { headers });
    assert.ok(res.status === 200 || res.status === 201, `API ${check.name} failed with status ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true, `API ${check.name} response must indicate success`);
    console.log(`✓ API [${check.name}]: HTTP ${res.status} OK`);
  }

  console.log('\n============================================================');
  console.log('ALL REPORTS & CORE ROUTE INTEGRITY TESTS PASSED SUCCESSFULLY');
  console.log('============================================================');
}

testReportsApiAndRouteIntegrity().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
