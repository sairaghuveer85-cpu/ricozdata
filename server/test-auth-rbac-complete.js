/**
 * RicozData Complete Account Creation, Authentication & ADMIN Authorization Verification Suite
 *
 * Runs all required verification tests in an isolated, in-memory MongoDB environment:
 * - Registration validation, password hashing, and privilege escalation prevention
 * - Authentication, token handling, and session verification
 * - ADMIN runtime permissions (including DATASET_READ fix verification)
 * - Granular RBAC enforcement across Data Catalog, Sources, Quality, Lineage, Glossary, Policies, Users
 * - Non-destructive: Uses MongoMemoryServer; NEVER touches production database.
 */

const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

let mongoServer;
let server;
let baseUrl;
const results = [];

function record(category, testName, expectedStatus, actualStatus, pass, details = '') {
  results.push({ category, testName, expectedStatus, actualStatus, pass, details });
  const icon = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${category} :: ${testName} (Status: ${actualStatus}, Expected: ${expectedStatus}) ${details ? '— ' + details : ''}`);
}

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
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

async function startTestSuite() {
  console.log('===============================================================');
  console.log('RICOZDATA COMPLETE AUTH & RBAC VERIFICATION SUITE');
  console.log('===============================================================\n');

  // 1. Initialize isolated in-memory MongoDB
  console.log('Initializing isolated in-memory test database...');
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: 'ricozdata-test' }
  });
  const mongoUri = mongoServer.getUri();
  process.env.MONGO_URI = mongoUri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-verification-suite-2026';

  await mongoose.connect(mongoUri);
  console.log('Connected to isolated in-memory MongoDB.\n');

  // Load models & seed initial users for RBAC testing
  const User = require('./models/User');
  const Dataset = require('./models/Dataset');
  const DataSource = require('./models/DataSource');
  const { ROLES } = require('./config/rbac');

  // Setup express test application
  const app = express();
  app.use(express.json());

  // Mount API routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/datasets', require('./routes/datasets'));
  app.use('/api/data-sources', require('./routes/dataSources'));
  app.use('/api/quality', require('./routes/quality'));
  app.use('/api/lineage', require('./routes/lineage'));
  app.use('/api/glossary', require('./routes/glossary'));
  app.use('/api/policies', require('./routes/policies'));
  app.use('/api/governance-rules', require('./routes/governanceRules'));
  app.use('/api/compliance', require('./routes/compliance'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/activities', require('./routes/activities'));
  app.use('/api/search', require('./routes/search'));
  app.use(require('./middleware/errorHandler'));

  // Start HTTP server on random available port
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server active at: ${baseUrl}\n`);
      resolve();
    });
  });

  // Seed baseline users for role testing
  const seedUsers = {
    ADMIN: await User.create({
      name: 'Priya Shah',
      email: 'priya.admin@ricoz-industries.demo',
      password: 'Password123!',
      role: ROLES.ADMIN,
      department: 'Data Governance',
      avatar: 'PS',
      avatarBg: 'bg-emerald-600',
      status: 'ACTIVE'
    }),
    SUPER_ADMIN: await User.create({
      name: 'Super Admin User',
      email: 'super.admin@ricoz-industries.demo',
      password: 'Password123!',
      role: ROLES.SUPER_ADMIN,
      department: 'Executive',
      avatar: 'SA',
      avatarBg: 'bg-blue-600',
      status: 'ACTIVE'
    }),
    VIEWER: await User.create({
      name: 'Kavya Sharma',
      email: 'kavya.viewer@ricoz-industries.demo',
      password: 'Password123!',
      role: ROLES.VIEWER,
      department: 'Finance',
      avatar: 'KS',
      avatarBg: 'bg-amber-600',
      status: 'ACTIVE'
    }),
    SUSPENDED: await User.create({
      name: 'Suspended Account',
      email: 'suspended@ricoz-industries.demo',
      password: 'Password123!',
      role: ROLES.VIEWER,
      department: 'Finance',
      avatar: 'SA',
      avatarBg: 'bg-slate-600',
      status: 'SUSPENDED'
    })
  };

  // Seed baseline dataset and data source
  const sampleDataSource = await DataSource.create({
    name: 'Primary PostgreSQL Mart',
    type: 'postgresql',
    description: 'Production PostgreSQL analytical database',
    status: 'CONNECTED',
    healthStatus: 'HEALTHY',
    tags: ['operational', 'analytics'],
    createdBy: seedUsers.ADMIN._id,
    ownerId: seedUsers.ADMIN._id
  });

  const sampleDataset = await Dataset.create({
    name: 'Customer Golden Master',
    description: 'Conformed customer profile data',
    owner: seedUsers.ADMIN.name,
    ownerId: seedUsers.ADMIN._id,
    domain: 'Customer',
    source: 'PostgreSQL',
    sourceSystem: 'PostgreSQL',
    sourceType: 'Relational Database',
    environment: 'Production',
    sensitivity: 'Confidential',
    certificationStatus: 'Certified',
    stewardId: seedUsers.ADMIN._id,
    rowCount: '1.2M',
    schema: [
      { name: 'customer_id', type: 'VARCHAR(64)', nullable: false, isPrimaryKey: true },
      { name: 'email', type: 'VARCHAR(255)', nullable: false },
      { name: 'status', type: 'VARCHAR(32)', nullable: false }
    ]
  });

  // Generate tokens for test roles
  const tokens = {
    ADMIN: jwt.sign({ id: seedUsers.ADMIN._id, role: seedUsers.ADMIN.role, email: seedUsers.ADMIN.email }, process.env.JWT_SECRET, { expiresIn: '1d' }),
    SUPER_ADMIN: jwt.sign({ id: seedUsers.SUPER_ADMIN._id, role: seedUsers.SUPER_ADMIN.role, email: seedUsers.SUPER_ADMIN.email }, process.env.JWT_SECRET, { expiresIn: '1d' }),
    VIEWER: jwt.sign({ id: seedUsers.VIEWER._id, role: seedUsers.VIEWER.role, email: seedUsers.VIEWER.email }, process.env.JWT_SECRET, { expiresIn: '1d' }),
    SUSPENDED: jwt.sign({ id: seedUsers.SUSPENDED._id, role: seedUsers.SUSPENDED.role, email: seedUsers.SUSPENDED.email }, process.env.JWT_SECRET, { expiresIn: '1d' })
  };

  console.log('--- 1. REGISTRATION TESTS ---');

  // Test 1.1: Valid registration succeeds
  const regEmail = `test.user.${Date.now()}@enterprise.com`;
  const regRes = await request('POST', '/api/auth/register', {
    name: 'John Citizen',
    email: regEmail,
    password: 'Password123!',
    department: 'Analytics'
  });
  const pass1_1 = regRes.status === 201 && regRes.body?.success && regRes.body?.data?.token && regRes.body?.data?.user?.email === regEmail;
  record('Registration', 'Valid registration succeeds with 201 and token', 201, regRes.status, pass1_1, pass1_1 ? `Role: ${regRes.body?.data?.user?.role}` : regRes.body?.message);

  // Test 1.2: Missing full name is rejected
  const missingNameRes = await request('POST', '/api/auth/register', {
    name: '',
    email: `noname.${Date.now()}@enterprise.com`,
    password: 'Password123!'
  });
  record('Registration', 'Missing full name rejected with 400', 400, missingNameRes.status, missingNameRes.status === 400);

  // Test 1.3: Invalid email format is rejected
  const invalidEmailRes = await request('POST', '/api/auth/register', {
    name: 'Invalid Email User',
    email: 'not-an-email-format',
    password: 'Password123!'
  });
  record('Registration', 'Invalid email format rejected with 400', 400, invalidEmailRes.status, invalidEmailRes.status === 400);

  // Test 1.4: Missing password is rejected
  const missingPassRes = await request('POST', '/api/auth/register', {
    name: 'No Password User',
    email: `nopass.${Date.now()}@enterprise.com`,
    password: ''
  });
  record('Registration', 'Missing password rejected with 400', 400, missingPassRes.status, missingPassRes.status === 400);

  // Test 1.5: Weak passwords rejected according to policy
  const weakPassRes = await request('POST', '/api/auth/register', {
    name: 'Weak Pass User',
    email: `weak.${Date.now()}@enterprise.com`,
    password: 'short'
  });
  record('Registration', 'Weak password (< 8 chars) rejected with 400', 400, weakPassRes.status, weakPassRes.status === 400);

  // Test 1.6: Duplicate email rejected
  const duplicateEmailRes = await request('POST', '/api/auth/register', {
    name: 'Duplicate User',
    email: regEmail,
    password: 'Password123!'
  });
  record('Registration', 'Duplicate email rejected with 400', 400, duplicateEmailRes.status, duplicateEmailRes.status === 400);

  // Test 1.7: Password is hashed before storage
  const createdUserDoc = await User.findOne({ email: regEmail });
  const isHashed = createdUserDoc && createdUserDoc.password !== 'Password123!' && createdUserDoc.password.startsWith('$2');
  record('Registration', 'Password hashed with bcrypt before database storage', 200, isHashed ? 200 : 500, !!isHashed);

  // Test 1.8: Password hash is NEVER returned in API responses
  const hashNotReturned = regRes.body?.data?.user?.password === undefined && regRes.body?.data?.password === undefined;
  record('Registration', 'Password hash omitted from registration response', 200, hashNotReturned ? 200 : 500, hashNotReturned);

  // Test 1.9: Privilege escalation: registering with role: ADMIN does NOT grant ADMIN
  const escalateEmail = `attacker.${Date.now()}@enterprise.com`;
  const escalateAdminRes = await request('POST', '/api/auth/register', {
    name: 'Malicious Visitor',
    email: escalateEmail,
    password: 'Password123!',
    role: 'ADMIN' // Malicious client manipulation
  });
  const assignedRoleAdmin = escalateAdminRes.body?.data?.user?.role;
  const escalationAdminPrevented = escalateAdminRes.status === 201 && assignedRoleAdmin === ROLES.VIEWER;
  record('Registration', 'Registering with role: ADMIN is neutralized to VIEWER', 201, escalateAdminRes.status, escalationAdminPrevented, `Assigned role: ${assignedRoleAdmin}`);

  // Test 1.10: Privilege escalation: registering with role: SUPER_ADMIN does NOT grant SUPER_ADMIN
  const escalateSuperEmail = `attacker.super.${Date.now()}@enterprise.com`;
  const escalateSuperRes = await request('POST', '/api/auth/register', {
    name: 'Malicious Super Visitor',
    email: escalateSuperEmail,
    password: 'Password123!',
    role: 'SUPER_ADMIN' // Malicious client manipulation
  });
  const assignedRoleSuper = escalateSuperRes.body?.data?.user?.role;
  const escalationSuperPrevented = escalateSuperRes.status === 201 && assignedRoleSuper === ROLES.VIEWER;
  record('Registration', 'Registering with role: SUPER_ADMIN is neutralized to VIEWER', 201, escalateSuperRes.status, escalationSuperPrevented, `Assigned role: ${assignedRoleSuper}`);

  // Test 1.11: Consistent response structure on validation errors
  const hasConsistentErrorFormat = missingNameRes.body && missingNameRes.body.success === false && typeof missingNameRes.body.message === 'string';
  record('Registration', 'Error responses use standard API response envelope', 400, missingNameRes.status, hasConsistentErrorFormat);

  console.log('\n--- 2. AUTHENTICATION & SESSION TESTS ---');

  // Test 2.1: Valid login succeeds
  const loginRes = await request('POST', '/api/auth/login', {
    email: seedUsers.ADMIN.email,
    password: 'Password123!'
  });
  const pass2_1 = loginRes.status === 200 && loginRes.body?.data?.token && loginRes.body?.data?.user?.role === 'ADMIN';
  record('Authentication', 'Valid login returns 200 and JWT token', 200, loginRes.status, pass2_1);

  // Test 2.2: Invalid credentials fail safely
  const badLoginRes = await request('POST', '/api/auth/login', {
    email: seedUsers.ADMIN.email,
    password: 'WrongPassword456!'
  });
  record('Authentication', 'Invalid password returns 401 without user enumeration', 401, badLoginRes.status, badLoginRes.status === 401 && badLoginRes.body?.message === 'Invalid credentials');

  // Test 2.3: Non-existent email fails with same generic message
  const badEmailRes = await request('POST', '/api/auth/login', {
    email: 'nonexistent.user.2026@ricozdata.com',
    password: 'Password123!'
  });
  record('Authentication', 'Unknown email returns identical generic 401', 401, badEmailRes.status, badEmailRes.status === 401 && badEmailRes.body?.message === 'Invalid credentials');

  // Test 2.4: Unauthenticated request to protected route returns 401
  const unauthRes = await request('GET', '/api/datasets');
  record('Authentication', 'Unauthenticated request to /api/datasets returns 401', 401, unauthRes.status, unauthRes.status === 401);

  // Test 2.5: Valid token restores session via /api/auth/me
  const meRes = await request('GET', '/api/auth/me', null, tokens.ADMIN);
  const pass2_5 = meRes.status === 200 && meRes.body?.data?.email === seedUsers.ADMIN.email && meRes.body?.data?.role === 'ADMIN';
  record('Authentication', 'GET /api/auth/me restores authenticated profile', 200, meRes.status, pass2_5);

  // Test 2.6: Invalid token string returns 401
  const badTokenRes = await request('GET', '/api/datasets', null, 'malformed.invalid.token');
  record('Authentication', 'Invalid JWT signature returns 401', 401, badTokenRes.status, badTokenRes.status === 401);

  // Test 2.7: Suspended user token is rejected with 403
  const suspendedRes = await request('GET', '/api/datasets', null, tokens.SUSPENDED);
  record('Authentication', 'Suspended account token rejected with 403', 403, suspendedRes.status, suspendedRes.status === 403);

  // Test 2.8: Logout endpoint succeeds
  const logoutRes = await request('POST', '/api/auth/logout', {}, tokens.ADMIN);
  record('Authentication', 'POST /api/auth/logout succeeds with 200', 200, logoutRes.status, logoutRes.status === 200);

  console.log('\n--- 3. ADMIN AUTHORIZATION & DATASET_READ FIX TESTS ---');

  // Test 3.1: ADMIN can access DATASET_READ (GET /api/datasets) -> FIX VERIFICATION
  const adminGetDatasets = await request('GET', '/api/datasets', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/datasets (DATASET_READ) authorized for ADMIN', 200, adminGetDatasets.status, adminGetDatasets.status === 200);

  // Test 3.2: ADMIN can access single dataset by id
  const adminGetSingleDataset = await request('GET', `/api/datasets/${sampleDataset._id}`, null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/datasets/:id (DATASET_READ) authorized for ADMIN', 200, adminGetSingleDataset.status, adminGetSingleDataset.status === 200);

  // Test 3.3: ADMIN can create datasets (DATASET_CREATE)
  const newDatasetName = 'Admin Created Dataset ' + Date.now();
  const adminCreateDataset = await request('POST', '/api/datasets', {
    name: newDatasetName,
    description: 'Created by Admin in test',
    source: 'PostgreSQL',
    domain: 'Customer'
  }, tokens.ADMIN);
  const pass3_3 = adminCreateDataset.status === 201 && adminCreateDataset.body?.success;
  record('ADMIN Access', 'POST /api/datasets (DATASET_CREATE) authorized for ADMIN', 201, adminCreateDataset.status, pass3_3);
  const createdDsId = adminCreateDataset.body?.data?._id || adminCreateDataset.body?.data?.id;

  // Test 3.4: ADMIN can update datasets (DATASET_UPDATE)
  const adminUpdateDataset = await request('PUT', `/api/datasets/${createdDsId || sampleDataset._id}`, {
    description: 'Updated by Admin in test'
  }, tokens.ADMIN);
  record('ADMIN Access', 'PUT /api/datasets/:id (DATASET_UPDATE) authorized for ADMIN', 200, adminUpdateDataset.status, adminUpdateDataset.status === 200);

  // Test 3.5: ADMIN can delete datasets (DATASET_DELETE)
  if (createdDsId) {
    const adminDeleteDataset = await request('DELETE', `/api/datasets/${createdDsId}`, null, tokens.ADMIN);
    record('ADMIN Access', 'DELETE /api/datasets/:id (DATASET_DELETE) authorized for ADMIN', 200, adminDeleteDataset.status, adminDeleteDataset.status === 200);
  }

  // Test 3.6: ADMIN can access Data Sources read
  const adminGetDataSources = await request('GET', '/api/data-sources', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/data-sources (DATA_SOURCE_READ) authorized for ADMIN', 200, adminGetDataSources.status, adminGetDataSources.status === 200);

  // Test 3.7: ADMIN can test Data Source connection
  const adminTestConn = await request('POST', '/api/data-sources/test', {
    type: 'mongodb',
    configuration: {
      host: '127.0.0.1',
      port: 27017,
      database: 'test'
    }
  }, tokens.ADMIN);
  record('ADMIN Access', 'POST /api/data-sources/test (DATA_SOURCE_TEST) authorized for ADMIN', 200, adminTestConn.status, adminTestConn.status === 200);

  // Test 3.8: ADMIN can access Data Quality rules
  const adminGetQuality = await request('GET', '/api/quality/rules', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/quality/rules (QUALITY_READ) authorized for ADMIN', 200, adminGetQuality.status, adminGetQuality.status === 200);

  // Test 3.9: ADMIN can access Data Lineage
  const adminGetLineage = await request('GET', '/api/lineage', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/lineage (LINEAGE_READ) authorized for ADMIN', 200, adminGetLineage.status, adminGetLineage.status === 200);

  // Test 3.10: ADMIN can access Business Glossary
  const adminGetGlossary = await request('GET', '/api/glossary', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/glossary (GLOSSARY_READ) authorized for ADMIN', 200, adminGetGlossary.status, adminGetGlossary.status === 200);

  // Test 3.11: ADMIN can access Governance Policies
  const adminGetPolicies = await request('GET', '/api/policies', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/policies (POLICY_READ) authorized for ADMIN', 200, adminGetPolicies.status, adminGetPolicies.status === 200);

  // Test 3.12: ADMIN can access Compliance summaries
  const adminGetCompliance = await request('GET', '/api/compliance/summary', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/compliance/summary (COMPLIANCE_READ) authorized for ADMIN', 200, adminGetCompliance.status, adminGetCompliance.status === 200);

  // Test 3.13: ADMIN can access User Management
  const adminGetUsers = await request('GET', '/api/users', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/users (USER_READ) authorized for ADMIN', 200, adminGetUsers.status, adminGetUsers.status === 200);

  // Test 3.14: ADMIN can create users (non-SUPER_ADMIN)
  const adminCreateUser = await request('POST', '/api/users', {
    name: 'New Analyst',
    email: `analyst.${Date.now()}@enterprise.com`,
    password: 'Password123!',
    role: 'DATA_ANALYST',
    department: 'Operations',
    avatar: 'NA',
    avatarBg: 'bg-teal-600'
  }, tokens.ADMIN);
  record('ADMIN Access', 'POST /api/users (USER_CREATE) authorized for ADMIN', 201, adminCreateUser.status, adminCreateUser.status === 201);

  // Test 3.15: ADMIN can access Dashboard
  const adminGetDashboard = await request('GET', '/api/dashboard/metrics', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/dashboard/metrics (DASHBOARD_READ) authorized for ADMIN', 200, adminGetDashboard.status, adminGetDashboard.status === 200);

  // Test 3.16: ADMIN can perform Global Search
  const adminSearch = await request('GET', '/api/search?q=customer', null, tokens.ADMIN);
  record('ADMIN Access', 'GET /api/search (SEARCH_READ) authorized for ADMIN', 200, adminSearch.status, adminSearch.status === 200);

  console.log('\n--- 4. PRIVILEGE RESTRICTION & ESCALATION TESTS ---');

  // Test 4.1: VIEWER can read datasets
  const viewerGetDatasets = await request('GET', '/api/datasets', null, tokens.VIEWER);
  record('RBAC Enforcement', 'VIEWER can read datasets (DATASET_READ)', 200, viewerGetDatasets.status, viewerGetDatasets.status === 200);

  // Test 4.2: VIEWER CANNOT create datasets -> 403 Forbidden
  const viewerCreateDs = await request('POST', '/api/datasets', { name: 'Illegal Viewer Dataset' }, tokens.VIEWER);
  record('RBAC Enforcement', 'VIEWER blocked from POST /api/datasets (DATASET_CREATE) with 403', 403, viewerCreateDs.status, viewerCreateDs.status === 403);

  // Test 4.3: VIEWER CANNOT delete datasets -> 403 Forbidden
  const viewerDeleteDs = await request('DELETE', `/api/datasets/${sampleDataset._id}`, null, tokens.VIEWER);
  record('RBAC Enforcement', 'VIEWER blocked from DELETE /api/datasets with 403', 403, viewerDeleteDs.status, viewerDeleteDs.status === 403);

  // Test 4.4: VIEWER CANNOT create users -> 403 Forbidden
  const viewerCreateUser = await request('POST', '/api/users', { name: 'Illegal User' }, tokens.VIEWER);
  record('RBAC Enforcement', 'VIEWER blocked from POST /api/users with 403', 403, viewerCreateUser.status, viewerCreateUser.status === 403);

  // Test 4.5: VIEWER CANNOT modify roles
  const viewerModRole = await request('PUT', `/api/users/${seedUsers.VIEWER._id}`, { role: 'ADMIN' }, tokens.VIEWER);
  record('RBAC Enforcement', 'VIEWER blocked from modifying roles via PUT /api/users with 403', 403, viewerModRole.status, viewerModRole.status === 403);

  // Test 4.6: ADMIN CANNOT create a SUPER_ADMIN account
  const adminCreateSuper = await request('POST', '/api/users', {
    name: 'Illegal Super Admin',
    email: `illegalsuper.${Date.now()}@enterprise.com`,
    password: 'Password123!',
    role: 'SUPER_ADMIN',
    department: 'Executive'
  }, tokens.ADMIN);
  record('Privilege Escalation', 'ADMIN blocked from creating SUPER_ADMIN with 403', 403, adminCreateSuper.status, adminCreateSuper.status === 403);

  // Test 4.7: ADMIN CANNOT delete SUPER_ADMIN account
  const adminDeleteSuper = await request('DELETE', `/api/users/${seedUsers.SUPER_ADMIN._id}`, null, tokens.ADMIN);
  record('Privilege Escalation', 'ADMIN blocked from deleting SUPER_ADMIN with 403', 403, adminDeleteSuper.status, adminDeleteSuper.status === 403);

  // Test 4.8: User cannot modify their own account via admin endpoint
  const adminSelfUpdate = await request('PUT', `/api/users/${seedUsers.ADMIN._id}`, { role: 'SUPER_ADMIN' }, tokens.ADMIN);
  record('Privilege Escalation', 'User blocked from self-modifying account via admin endpoint with 403', 403, adminSelfUpdate.status, adminSelfUpdate.status === 403);

  // Final Test Summary
  const passedCount = results.filter((r) => r.pass).length;
  const totalCount = results.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log('\n===============================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount}/${totalCount} PASS (${passRate}%)`);
  console.log('===============================================================');

  // Cleanup
  if (server) server.close();
  if (mongoose.connection) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();

  if (passedCount !== totalCount) {
    console.error(`\n❌ Test suite failed with ${totalCount - passedCount} failing tests.`);
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

startTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
