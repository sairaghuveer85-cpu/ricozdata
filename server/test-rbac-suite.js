/**
 * RicozData Phase 7 Production RBAC Verification Suite
 * Executes real API tests against all 6 roles, verifying permissions,
 * privilege escalation prevention, account status checks, and token handling.
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

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

async function runSuite() {
  console.log('===============================================================');
  console.log('STARTING RICOZDATA PHASE 7 RBAC TEST SUITE');
  console.log('===============================================================\n');

  // 1. Health check
  const health = await request('GET', '/api/health');
  record('System', 'GET /api/health', 200, health.status, health.status === 200);

  // 2. Log in all 6 roles
  const tokens = {};
  const userObjects = {};

  for (const [roleKey, creds] of Object.entries(USERS)) {
    const res = await request('POST', '/api/auth/login', { email: creds.email, password: creds.password });
    const pass = res.status === 200 && res.body?.data?.token;
    if (pass) {
      tokens[roleKey] = res.body.data.token;
      userObjects[roleKey] = res.body.data.user;
    }
    record('Authentication', `Login as ${roleKey} (${creds.email})`, 200, res.status, pass, pass ? `Token received` : JSON.stringify(res.body));
  }

  // Get sample dataset ID
  let sampleDatasetId = null;
  const dsRes = await request('GET', '/api/datasets', null, tokens.SUPER_ADMIN);
  if (dsRes.body?.data?.datasets?.length > 0) {
    sampleDatasetId = dsRes.body.data.datasets[0]._id || dsRes.body.data.datasets[0].id;
  }

  console.log('\n--- TOKEN INTEGRITY & ERROR HANDLING ---');
  // 3. Missing JWT -> 401
  const noTokenRes = await request('GET', '/api/datasets');
  record('Auth Handling', 'Missing JWT to protected endpoint /api/datasets', 401, noTokenRes.status, noTokenRes.status === 401);

  // 4. Invalid JWT -> 401
  const invalidTokenRes = await request('GET', '/api/datasets', null, 'invalid_token_string_here');
  record('Auth Handling', 'Invalid JWT to protected endpoint /api/datasets', 401, invalidTokenRes.status, invalidTokenRes.status === 401);

  // 5. Expired JWT -> 401
  // Crafted expired JWT header.payload.signature
  const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3OTI5ZjBhMGU4Yzc1NWQxMjM0NTY3OCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAwfQ.invalid_sig';
  const expiredRes = await request('GET', '/api/datasets', null, expiredJwt);
  record('Auth Handling', 'Expired/Bad Signature JWT to /api/datasets', 401, expiredRes.status, expiredRes.status === 401);

  console.log('\n--- ROLE-SPECIFIC PERMISSION TESTS ---');

  // VIEWER Permissions (Read only)
  const viewerReadDs = await request('GET', '/api/datasets', null, tokens.VIEWER);
  record('VIEWER', 'GET /api/datasets (DATASET_READ)', 200, viewerReadDs.status, viewerReadDs.status === 200);

  const viewerCreateDs = await request('POST', '/api/datasets', { name: 'Viewer Dataset', source: 'Test' }, tokens.VIEWER);
  record('VIEWER', 'POST /api/datasets (DATASET_CREATE - unauthorized)', 403, viewerCreateDs.status, viewerCreateDs.status === 403);

  const viewerDelDs = await request('DELETE', `/api/datasets/${sampleDatasetId || '123'}`, null, tokens.VIEWER);
  record('VIEWER', 'DELETE /api/datasets/:id (DATASET_DELETE - unauthorized)', 403, viewerDelDs.status, viewerDelDs.status === 403);

  const viewerGetUsers = await request('GET', '/api/users', null, tokens.VIEWER);
  record('VIEWER', 'GET /api/users (USER_READ)', 200, viewerGetUsers.status, viewerGetUsers.status === 200);

  const viewerCreateUser = await request('POST', '/api/users', { name: 'Viewer New User' }, tokens.VIEWER);
  record('VIEWER', 'POST /api/users (USER_CREATE - unauthorized)', 403, viewerCreateUser.status, viewerCreateUser.status === 403);

  // DATA_ANALYST Permissions (Read + Dataset Create, No Update/Delete/User Create)
  const analystReadDs = await request('GET', '/api/datasets', null, tokens.DATA_ANALYST);
  record('DATA_ANALYST', 'GET /api/datasets (DATASET_READ)', 200, analystReadDs.status, analystReadDs.status === 200);

  // Fetch a valid domain id and use the analyst's own id as owner (schema requires ownerId)
  const domainsRes = await request('GET', '/api/domains', null, tokens.SUPER_ADMIN);
  const sampleDomainId = domainsRes.body?.data?.[0]?._id || domainsRes.body?.data?.[0]?.id;
  const analystOwnerId = userObjects.DATA_ANALYST?._id || userObjects.DATA_ANALYST?.id;

  const analystCreateDs = await request('POST', '/api/datasets', {
    name: 'Analyst Test Mart ' + Date.now(),
    description: 'Created by analyst test',
    source: 'PostgreSQL',
    domainId: sampleDomainId,
    ownerId: analystOwnerId,
    domain: 'Sales',
    sensitivity: 'Internal'
  }, tokens.DATA_ANALYST);
  record('DATA_ANALYST', 'POST /api/datasets (DATASET_CREATE - authorized)', 201, analystCreateDs.status, analystCreateDs.status === 201);

  const analystDelDs = await request('DELETE', `/api/datasets/${sampleDatasetId || '123'}`, null, tokens.DATA_ANALYST);
  record('DATA_ANALYST', 'DELETE /api/datasets/:id (DATASET_DELETE - unauthorized)', 403, analystDelDs.status, analystDelDs.status === 403);

  const analystCreateTerm = await request('POST', '/api/glossary', { term: 'Analyst Term' }, tokens.DATA_ANALYST);
  record('DATA_ANALYST', 'POST /api/glossary (GLOSSARY_CREATE - unauthorized)', 403, analystCreateTerm.status, analystCreateTerm.status === 403);

  // DATA_ENGINEER Permissions (Dataset Create/Update, Lineage Manage, No Dataset Delete)
  const engineerReadDs = await request('GET', '/api/datasets', null, tokens.DATA_ENGINEER);
  record('DATA_ENGINEER', 'GET /api/datasets (DATASET_READ)', 200, engineerReadDs.status, engineerReadDs.status === 200);

  const engineerUpdateDs = await request('PUT', `/api/datasets/${sampleDatasetId || '123'}`, { description: 'Updated by Data Engineer' }, tokens.DATA_ENGINEER);
  record('DATA_ENGINEER', 'PUT /api/datasets/:id (DATASET_UPDATE - authorized)', 200, engineerUpdateDs.status, engineerUpdateDs.status === 200);

  const engineerDelDs = await request('DELETE', `/api/datasets/${sampleDatasetId || '123'}`, null, tokens.DATA_ENGINEER);
  record('DATA_ENGINEER', 'DELETE /api/datasets/:id (DATASET_DELETE - unauthorized)', 403, engineerDelDs.status, engineerDelDs.status === 403);

  // DATA_STEWARD Permissions (Glossary CRUD, Quality Manage, No Dataset Delete)
  const stewardCreateTerm = await request('POST', '/api/glossary', {
    term: 'Steward Metric ' + Date.now(),
    definition: 'Defined by Data Steward in test',
    domain: 'Customer'
  }, tokens.DATA_STEWARD);
  record('DATA_STEWARD', 'POST /api/glossary (GLOSSARY_CREATE - authorized)', 201, stewardCreateTerm.status, stewardCreateTerm.status === 201);

  const stewardDelDs = await request('DELETE', `/api/datasets/${sampleDatasetId || '123'}`, null, tokens.DATA_STEWARD);
  record('DATA_STEWARD', 'DELETE /api/datasets/:id (DATASET_DELETE - unauthorized)', 403, stewardDelDs.status, stewardDelDs.status === 403);

  // ADMIN Permissions (Full Dataset/Policy/User CRUD, but cannot manage SUPER_ADMIN)
  const adminGetUsers = await request('GET', '/api/users', null, tokens.ADMIN);
  record('ADMIN', 'GET /api/users (USER_READ)', 200, adminGetUsers.status, adminGetUsers.status === 200);

  const adminCreateUser = await request('POST', '/api/users', {
    name: 'Admin Created Analyst',
    email: 'analyst.test.' + Date.now() + '@ricoz-industries.demo',
    password: 'Password123!',
    role: 'DATA_ANALYST',
    department: 'Operations',
    avatar: 'AC',
    avatarBg: 'bg-teal-600'
  }, tokens.ADMIN);
  record('ADMIN', 'POST /api/users (USER_CREATE with DATA_ANALYST role)', 201, adminCreateUser.status, adminCreateUser.status === 201);

  // SUPER_ADMIN Permissions (Full access)
  const superAdminGetUsers = await request('GET', '/api/users', null, tokens.SUPER_ADMIN);
  record('SUPER_ADMIN', 'GET /api/users (USER_READ)', 200, superAdminGetUsers.status, superAdminGetUsers.status === 200);

  const superAdminGetDashboard = await request('GET', '/api/dashboard/metrics', null, tokens.SUPER_ADMIN);
  record('SUPER_ADMIN', 'GET /api/dashboard/metrics (DASHBOARD_READ)', 200, superAdminGetDashboard.status, superAdminGetDashboard.status === 200);

  console.log('\n--- PRIVILEGE ESCALATION PREVENTION TESTS ---');

  // Escalation Test 1: ADMIN attempts to create a SUPER_ADMIN account
  const adminPromoteSuper = await request('POST', '/api/users', {
    name: 'Illegal Super Admin',
    email: 'illegal.super.' + Date.now() + '@ricoz-industries.demo',
    password: 'Password123!',
    role: 'SUPER_ADMIN',
    department: 'Executive',
    avatar: 'IS'
  }, tokens.ADMIN);
  record('Privilege Escalation', 'ADMIN creates SUPER_ADMIN user', 403, adminPromoteSuper.status, adminPromoteSuper.status === 403, adminPromoteSuper.body?.message);

  // Escalation Test 2: User attempts to modify their own account via admin endpoint
  const adminSelfId = userObjects.ADMIN?.id || userObjects.ADMIN?._id;
  const adminSelfUpdate = await request('PUT', `/api/users/${adminSelfId}`, { role: 'SUPER_ADMIN' }, tokens.ADMIN);
  record('Privilege Escalation', 'ADMIN attempts self-role change to SUPER_ADMIN', 403, adminSelfUpdate.status, adminSelfUpdate.status === 403, adminSelfUpdate.body?.message);

  // Escalation Test 3: Unauthorized user (VIEWER) attempts user role modification
  const targetUserId = userObjects.DATA_ANALYST?.id || userObjects.DATA_ANALYST?._id;
  const viewerModRole = await request('PUT', `/api/users/${targetUserId}`, { role: 'ADMIN' }, tokens.VIEWER);
  record('Privilege Escalation', 'VIEWER attempts user role modification', 403, viewerModRole.status, viewerModRole.status === 403, viewerModRole.body?.message);

  // Escalation Test 4: ADMIN attempts to delete SUPER_ADMIN
  const superAdminId = userObjects.SUPER_ADMIN?.id || userObjects.SUPER_ADMIN?._id;
  const adminDelSuper = await request('DELETE', `/api/users/${superAdminId}`, null, tokens.ADMIN);
  record('Privilege Escalation', 'ADMIN attempts to delete SUPER_ADMIN account', 403, adminDelSuper.status, adminDelSuper.status === 403, adminDelSuper.body?.message);

  // Summary
  const passedCount = results.filter(r => r.pass).length;
  const totalCount = results.length;

  console.log('\n===============================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount}/${totalCount} PASS (${((passedCount/totalCount)*100).toFixed(1)}%)`);
  console.log('===============================================================');

  return { passedCount, totalCount, allPass: passedCount === totalCount };
}

runSuite().catch(err => {
  console.error('Fatal test suite runner error:', err);
  process.exit(1);
});
