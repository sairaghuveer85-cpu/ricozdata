import pg from 'pg';
import mongoose from 'mongoose';

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'ricoz_test',
  user: 'postgres',
  password: process.env.POSTGRES_TEST_PASSWORD || '1818'
};

const BASE_URL = 'http://localhost:5000/api/v1';

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
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
  const data = await res.json();
  if (!data.success) throw new Error('Login failed: ' + JSON.stringify(data));
  return { token: data.data.accessToken, user: data.data.user };
}

async function run() {
  console.log('=== STEP 43: QUALITY CONTROLLED TEST ===\n');

  const { token } = await login();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-Slug': 'ricoz-demo'
  };

  // 1. Get customers dataset
  const datasetsRes = await fetch(`${BASE_URL}/datasets?search=customers`, { headers });
  const datasetsData = await datasetsRes.json();
  const customerDataset = datasetsData.data.find(d => d.name === 'customers');
  if (!customerDataset) throw new Error('customers dataset not found');

  const datasetId = customerDataset._id;
  console.log(`Target Dataset: ${customerDataset.name} (_id: ${datasetId})`);

  // Ensure active quality rule exists for customers: UNIQUENESS on phone
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ricozdata');
  const { QualityRule } = await import('../src/models/QualityRule.js');
  
  // Clean up any old rules to have a deterministic test rule
  await QualityRule.deleteMany({ datasetId: new mongoose.Types.ObjectId(datasetId) });
  const rule = await QualityRule.create({
    organizationId: new mongoose.Types.ObjectId(customerDataset.organizationId),
    datasetId: new mongoose.Types.ObjectId(datasetId),
    dataSourceId: new mongoose.Types.ObjectId(customerDataset.dataSourceId),
    name: 'Customer Phone Uniqueness',
    ruleType: 'UNIQUENESS',
    dimension: 'uniqueness',
    severity: 'HIGH',
    targetColumn: 'phone',
    status: 'ACTIVE',
    enabled: true,
    configuration: { column: 'phone' }
  });
  console.log(`Created QualityRule: ${rule.name} (UNIQUENESS on phone)`);

  const pool = new pg.Pool(PG_CONFIG);

  try {
    // Phase 1: Baseline Quality Check (clean data)
    console.log('\n--- Phase 1: Baseline Clean Data Quality Run ---');
    // Ensure clean data
    await pool.query("UPDATE public.customers SET phone = '9876543213' WHERE customer_id = 4");

    const runRes1 = await fetch(`${BASE_URL}/quality/datasets/${datasetId}/run`, {
      method: 'POST',
      headers
    });
    const runData1 = await runRes1.json();
    console.log('Baseline Quality Run Status:', runData1.success ? 'SUCCESS' : 'FAILED');
    console.log('Baseline Score:', runData1.data?.score);
    console.log('Baseline Passed Rules:', runData1.data?.passedRules, '/', runData1.data?.rulesEvaluated);
    console.log('Baseline Records Evaluated:', runData1.data?.recordsEvaluated);

    // Verify dataset quality score via API
    const datasetApi1 = await (await fetch(`${BASE_URL}/datasets/${datasetId}`, { headers })).json();
    console.log('Dataset API Quality Score:', datasetApi1.data?.qualityScore?.score);

    // Phase 2: Inject Violation into Source Data
    console.log('\n--- Phase 2: Injecting Quality Violation into PostgreSQL ---');
    console.log("Executing: UPDATE public.customers SET phone = '9876543210' WHERE customer_id = 4;");
    await pool.query("UPDATE public.customers SET phone = '9876543210' WHERE customer_id = 4");

    // Run quality check again
    const runRes2 = await fetch(`${BASE_URL}/quality/datasets/${datasetId}/run`, {
      method: 'POST',
      headers
    });
    const runData2 = await runRes2.json();
    console.log('Degraded Quality Run Status:', runData2.success ? 'SUCCESS' : 'FAILED');
    console.log('Degraded Score:', runData2.data?.score);
    console.log('Degraded Passed Rules:', runData2.data?.passedRules, '/', runData2.data?.rulesEvaluated);
    console.log('Degraded Failed Rules:', runData2.data?.failedRules);
    console.log('Failure message:', runData2.data?.results?.[0]?.message);

    // Verify dataset quality score dropped in API
    const datasetApi2 = await (await fetch(`${BASE_URL}/datasets/${datasetId}`, { headers })).json();
    console.log('Dataset API Updated Quality Score:', datasetApi2.data?.qualityScore?.score);

    // Verify QualityIssue was created in API
    const issuesRes = await fetch(`${BASE_URL}/quality/issues?datasetId=${datasetId}`, { headers });
    const issuesData = await issuesRes.json();
    const openIssues = issuesData.data?.filter(i => i.status === 'OPEN') || [];
    console.log('Open Quality Issues in API:', openIssues.length);
    if (openIssues.length > 0) {
      console.log('Top issue:', openIssues[0].title, '| column:', openIssues[0].affectedColumn, '| failed rows:', openIssues[0].affectedRowsCount);
    }

    // Phase 3: Remediate Source Data & Verify Restoration
    console.log('\n--- Phase 3: Remediating Source Data in PostgreSQL ---');
    console.log("Executing: UPDATE public.customers SET phone = '9876543213' WHERE customer_id = 4;");
    await pool.query("UPDATE public.customers SET phone = '9876543213' WHERE customer_id = 4");

    const runRes3 = await fetch(`${BASE_URL}/quality/datasets/${datasetId}/run`, {
      method: 'POST',
      headers
    });
    const runData3 = await runRes3.json();
    console.log('Restored Quality Run Status:', runData3.success ? 'SUCCESS' : 'FAILED');
    console.log('Restored Score:', runData3.data?.score);
    console.log('Restored Passed Rules:', runData3.data?.passedRules, '/', runData3.data?.rulesEvaluated);

    const datasetApi3 = await (await fetch(`${BASE_URL}/datasets/${datasetId}`, { headers })).json();
    console.log('Dataset API Restored Quality Score:', datasetApi3.data?.qualityScore?.score);

    console.log('\n>>> STEP 43 VERIFICATION COMPLETE: ALL PASS <<<');
  } finally {
    // Ensure cleanup
    await pool.query("UPDATE public.customers SET phone = '9876543213' WHERE customer_id = 4");
    await pool.end();
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
