/**
 * Comprehensive Multi-Tenant Organization Onboarding & Isolation Test Suite
 *
 * Validates:
 * 1. Organization & Workspace Administrator Registration (POST /api/auth/register)
 * 2. Duplicate email rejection
 * 3. Fresh workspace creation with clean empty-state dashboard metrics (0 datasets, 0 sources)
 * 4. Workspace Administrator full application access & employee provisioning
 * 5. Employee login and full normal operational permissions (no VIEWER or DATA_SOURCE_MANAGE denial)
 * 6. Prevention of employee account administration & role escalation
 * 7. Multi-tenant isolation: Two organizations cannot view, query, or modify each other's resources
 * 8. Cross-workspace access denial (HTTP 403)
 * 9. Protection of Main Admin account against deactivation or deletion
 */

const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

const testRunId = Date.now().toString().slice(-6);

const orgAData = {
  organizationName: `Apex Financial ${testRunId}`,
  name: `Apex Admin ${testRunId}`,
  email: `admin.apex.${testRunId}@apexfin.example.com`,
  password: 'ApexAdminPassword123!',
};

const orgBData = {
  organizationName: `BioHealth Labs ${testRunId}`,
  name: `Bio Admin ${testRunId}`,
  email: `admin.bio.${testRunId}@biohealth.example.com`,
  password: 'BioAdminPassword123!',
};

const employeeAData = {
  name: `Apex Employee ${testRunId}`,
  email: `emp.apex.${testRunId}@apexfin.example.com`,
  password: 'ApexEmployeePassword123!',
  role: 'EMPLOYEE',
  department: 'Data Engineering'
};

let tokenOrgA = null;
let tokenOrgB = null;
let tokenEmpA = null;
let orgAId = null;
let orgBId = null;
let orgADataSourceId = null;
let orgADatasetId = null;

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    totalPassed++;
    console.log(`[PASS] ${message} ${details ? '(' + details + ')' : ''}`);
  } else {
    totalFailed++;
    console.error(`[FAIL] ${message} ${details ? '— ' + details : ''}`);
  }
}

async function runSuite() {
  console.log('========================================================================');
  console.log('RicozData Multi-Tenant Organization Onboarding & Isolation Test Suite');
  console.log('========================================================================\n');

  // --- Step 1: Organization A Registration ---
  console.log('--- Section 1: Organization Workspace & Admin Registration ---');
  try {
    const regRes = await axios.post(`${BASE_URL}/auth/register`, orgAData);
    assert(regRes.status === 201, 'Organization A registration returns HTTP 201', `Status: ${regRes.status}`);
    assert(regRes.data?.data?.token, 'Registration returns JWT token');
    assert(regRes.data?.data?.organization?.name === orgAData.organizationName, 'Returns created organization identity');
    assert(regRes.data?.data?.user?.isMainAdmin === true, 'Creator is designated as Workspace Administrator (isMainAdmin: true)');
    assert(regRes.data?.data?.user?.role === 'MAIN_ADMIN', 'Creator role is MAIN_ADMIN');

    tokenOrgA = regRes.data.data.token;
    orgAId = regRes.data.data.organization.id;
  } catch (err) {
    assert(false, 'Organization A registration failed', err.response?.data?.message || err.message);
  }

  // --- Step 2: Duplicate Email Rejection ---
  console.log('\n--- Section 2: Duplicate Email Rejection ---');
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      organizationName: `Apex Copy ${testRunId}`,
      name: 'Duplicate Admin',
      email: orgAData.email,
      password: 'Password123!'
    });
    assert(false, 'Duplicate email registration should fail');
  } catch (err) {
    assert(err.response?.status === 400, 'Duplicate email registration rejected with HTTP 400', `Status: ${err.response?.status}`);
  }

  // --- Step 3: Fresh Workspace Empty-State Verification ---
  console.log('\n--- Section 3: Fresh Workspace Empty-State Dashboard & Catalog ---');
  try {
    const dashRes = await axios.get(`${BASE_URL}/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` }
    });
    assert(dashRes.status === 200, 'Dashboard metrics returns HTTP 200');
    const summary = dashRes.data?.data?.summary;
    assert(summary?.totalDatasets === 0, 'Fresh workspace has 0 catalog datasets', `Count: ${summary?.totalDatasets}`);
    assert(summary?.activeUsers === 1, 'Fresh workspace has 1 active user (administrator)', `Count: ${summary?.activeUsers}`);
    assert(summary?.openIssues === 0, 'Fresh workspace has 0 open policy issues', `Count: ${summary?.openIssues}`);

    const catRes = await axios.get(`${BASE_URL}/datasets`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` }
    });
    const dsList = catRes.data?.data?.datasets || [];
    assert(dsList.length === 0, 'Fresh workspace catalog contains 0 datasets (No cross-tenant leakage)', `Count: ${dsList.length}`);

    const srcRes = await axios.get(`${BASE_URL}/data-sources`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` }
    });
    const srcList = srcRes.data?.data?.dataSources || [];
    assert(srcList.length === 0, 'Fresh workspace contains 0 data sources', `Count: ${srcList.length}`);
  } catch (err) {
    assert(false, 'Fresh workspace verification failed', err.response?.data?.message || err.message);
  }

  // --- Step 4: Workspace Admin Resource Creation ---
  console.log('\n--- Section 4: Workspace Admin Operational Capabilities ---');
  try {
    const newDsRes = await axios.post(
      `${BASE_URL}/data-sources`,
      {
        name: `Apex PostgreSQL ${testRunId}`,
        type: 'postgresql',
        description: 'Production transactional database',
        connectionConfig: { host: 'pg.apex.internal', port: 5432, database: 'apex_prod' }
      },
      { headers: { Authorization: `Bearer ${tokenOrgA}` } }
    );
    assert(newDsRes.status === 201, 'Workspace Admin can create data sources', `Status: ${newDsRes.status}`);
    orgADataSourceId = newDsRes.data?.data?._id;

    const newDatasetRes = await axios.post(
      `${BASE_URL}/datasets`,
      {
        name: `Apex Transactions ${testRunId}`,
        description: 'Financial ledger transactions',
        domain: 'Finance',
        sourceSystem: 'PostgreSQL',
        dataSourceId: orgADataSourceId
      },
      { headers: { Authorization: `Bearer ${tokenOrgA}` } }
    );
    assert(newDatasetRes.status === 201, 'Workspace Admin can register catalog datasets', `Status: ${newDatasetRes.status}`);
    orgADatasetId = newDatasetRes.data?.data?._id;

    // Verify metrics incremented for Org A
    const dashUpdated = await axios.get(`${BASE_URL}/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` }
    });
    assert(dashUpdated.data?.data?.summary?.totalDatasets === 1, 'Org A dashboard reflects newly created dataset', `Count: ${dashUpdated.data?.data?.summary?.totalDatasets}`);
  } catch (err) {
    assert(false, 'Workspace Admin resource creation failed', err.response?.data?.message || err.message);
  }

  // --- Step 5: Employee Account Creation ---
  console.log('\n--- Section 5: Employee Account Provisioning by Workspace Admin ---');
  try {
    const empCreateRes = await axios.post(
      `${BASE_URL}/users`,
      employeeAData,
      { headers: { Authorization: `Bearer ${tokenOrgA}` } }
    );
    assert(empCreateRes.status === 201, 'Workspace Admin can create employee accounts', `Status: ${empCreateRes.status}`);
    assert(empCreateRes.data?.data?.role === 'EMPLOYEE', 'Employee assigned EMPLOYEE role');
    assert(empCreateRes.data?.data?.isMainAdmin === false, 'Employee is not Main Admin');
    assert(empCreateRes.data?.data?.organizationId === orgAId, 'Employee associated with Org A workspace');

    // Duplicate employee email rejection
    try {
      await axios.post(`${BASE_URL}/users`, employeeAData, { headers: { Authorization: `Bearer ${tokenOrgA}` } });
      assert(false, 'Duplicate employee email should fail');
    } catch (dupErr) {
      assert(dupErr.response?.status === 400, 'Duplicate employee email rejected with HTTP 400');
    }
  } catch (err) {
    assert(false, 'Employee creation failed', err.response?.data?.message || err.message);
  }

  // --- Step 6: Employee Login and Full Application Access ---
  console.log('\n--- Section 6: Employee Login and Operational Permissions ---');
  try {
    const empLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: employeeAData.email,
      password: employeeAData.password
    });
    assert(empLoginRes.status === 200, 'Employee login succeeds', `Status: ${empLoginRes.status}`);
    tokenEmpA = empLoginRes.data?.data?.token;

    // Access Data Sources without DATA_SOURCE_MANAGE denial
    const empSrcRes = await axios.get(`${BASE_URL}/data-sources`, {
      headers: { Authorization: `Bearer ${tokenEmpA}` }
    });
    assert(empSrcRes.status === 200, 'Employee can view Data Sources without DATA_SOURCE_MANAGE denial');
    assert(empSrcRes.data?.data?.dataSources?.length === 1, 'Employee sees Org A data source', `Count: ${empSrcRes.data?.data?.dataSources?.length}`);

    // Access Catalog
    const empCatRes = await axios.get(`${BASE_URL}/datasets`, {
      headers: { Authorization: `Bearer ${tokenEmpA}` }
    });
    assert(empCatRes.status === 200, 'Employee can view Data Catalog');
    assert(empCatRes.data?.data?.datasets?.length === 1, 'Employee sees Org A dataset', `Count: ${empCatRes.data?.data?.datasets?.length}`);

    // Employee cannot access User Management
    try {
      await axios.get(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${tokenEmpA}` }
      });
      assert(false, 'Employee should not be allowed to list users');
    } catch (empUserErr) {
      assert(empUserErr.response?.status === 403, 'Employee access to user management rejected (HTTP 403)');
    }

    // Employee cannot create other accounts
    try {
      await axios.post(
        `${BASE_URL}/users`,
        { name: 'Unauthorized', email: 'unauth@apex.com', password: 'Password123!' },
        { headers: { Authorization: `Bearer ${tokenEmpA}` } }
      );
      assert(false, 'Employee should not be allowed to create accounts');
    } catch (empCreateErr) {
      assert(empCreateErr.response?.status === 403, 'Employee attempt to create accounts rejected (HTTP 403)');
    }
  } catch (err) {
    assert(false, 'Employee permissions validation failed', err.response?.data?.message || err.message);
  }

  // --- Step 7: Organization B Registration & Cross-Workspace Isolation ---
  console.log('\n--- Section 7: Organization B Registration & Workspace Isolation ---');
  try {
    const regBRes = await axios.post(`${BASE_URL}/auth/register`, orgBData);
    assert(regBRes.status === 201, 'Organization B registration returns HTTP 201');
    tokenOrgB = regBRes.data.data.token;
    orgBId = regBRes.data.data.organization.id;
    assert(orgBId !== orgAId, 'Organization B has distinct unique workspace identity');

    // Org B dashboard must be completely fresh
    const dashBRes = await axios.get(`${BASE_URL}/dashboard/metrics`, {
      headers: { Authorization: `Bearer ${tokenOrgB}` }
    });
    assert(dashBRes.data?.data?.summary?.totalDatasets === 0, 'Org B dashboard has 0 datasets (Fresh workspace)');
    assert(dashBRes.data?.data?.summary?.activeUsers === 1, 'Org B dashboard has 1 active user');

    // Org B catalog must NOT see Org A datasets
    const catBRes = await axios.get(`${BASE_URL}/datasets`, {
      headers: { Authorization: `Bearer ${tokenOrgB}` }
    });
    assert(catBRes.data?.data?.datasets?.length === 0, 'Org B catalog sees 0 datasets (No Org A data leaked)');

    // Org B data sources must NOT see Org A sources
    const srcBRes = await axios.get(`${BASE_URL}/data-sources`, {
      headers: { Authorization: `Bearer ${tokenOrgB}` }
    });
    assert(srcBRes.data?.data?.dataSources?.length === 0, 'Org B sees 0 data sources (No Org A source leaked)');

    // Cross-workspace direct access denial: Org B tries to access Org A data source by ID
    try {
      await axios.get(`${BASE_URL}/data-sources/${orgADataSourceId}`, {
        headers: { Authorization: `Bearer ${tokenOrgB}` }
      });
      assert(false, 'Org B should not be allowed to access Org A data source');
    } catch (crossDsErr) {
      assert(crossDsErr.response?.status === 403, 'Cross-workspace data source access denied with HTTP 403');
    }

    // Cross-workspace direct deletion denial: Org B tries to delete Org A dataset
    try {
      await axios.delete(`${BASE_URL}/datasets/${orgADatasetId}`, {
        headers: { Authorization: `Bearer ${tokenOrgB}` }
      });
      assert(false, 'Org B should not be allowed to delete Org A dataset');
    } catch (crossDelErr) {
      assert(crossDelErr.response?.status === 403, 'Cross-workspace dataset deletion denied with HTTP 403');
    }
  } catch (err) {
    assert(false, 'Cross-workspace isolation validation failed', err.response?.data?.message || err.message);
  }

  // --- Step 8: Main Admin Protection Invariants ---
  console.log('\n--- Section 8: Main Admin Account Protection Invariants ---');
  try {
    const orgAUsersRes = await axios.get(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` }
    });
    const mainAdminA = orgAUsersRes.data?.data?.find(u => u.isMainAdmin);
    assert(mainAdminA !== undefined, 'Main Admin user found in Org A user list');

    // Main Admin cannot be deleted
    try {
      await axios.delete(`${BASE_URL}/users/${mainAdminA._id}`, {
        headers: { Authorization: `Bearer ${tokenOrgA}` }
      });
      assert(false, 'Main Admin account should not be deletable');
    } catch (delAdminErr) {
      assert(delAdminErr.response?.status === 403, 'Main Admin account deletion rejected with HTTP 403');
    }

    // Main Admin cannot be deactivated
    try {
      await axios.put(
        `${BASE_URL}/users/${mainAdminA._id}`,
        { status: 'INACTIVE' },
        { headers: { Authorization: `Bearer ${tokenOrgA}` } }
      );
      assert(false, 'Main Admin account should not be deactivatable');
    } catch (deactAdminErr) {
      assert(deactAdminErr.response?.status === 403, 'Main Admin account deactivation rejected with HTTP 403');
    }
  } catch (err) {
    assert(false, 'Main Admin protection validation failed', err.response?.data?.message || err.message);
  }

  console.log('\n========================================================================');
  console.log('Test Execution Summary');
  console.log('========================================================================');
  console.log(`Total Assertions: ${totalPassed + totalFailed}`);
  console.log(`Passed:           ${totalPassed}`);
  console.log(`Failed:           ${totalFailed}`);
  console.log(`Success Rate:     ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
  console.log('========================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
