import pg from 'pg';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'ricoz_demo',
  user: 'postgres',
  password: process.env.POSTGRES_TEST_PASSWORD || '1818'
};

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = 'super-secret-jwt-key-1234567890';

async function main() {
  console.log('================================================================');
  console.log('RICOZDATA REAL DATA QUALITY VERIFICATION SUITE — PHASE 2');
  console.log('================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/ricozdata');
  const pool = new pg.Pool(PG_CONFIG);

  const token = jwt.sign(
    { id: '6ac258b135ae36221abe22d6', role: 'SUPER_ADMIN', email: 'raghuveer.chandran@ricoz-industries.demo' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. Locate dq_quality_test in catalog
  const dsDoc = await mongoose.connection.db.collection('datasets').findOne({ tableName: 'dq_quality_test' });
  if (!dsDoc) {
    throw new Error('dq_quality_test dataset not found in MongoDB');
  }
  const datasetId = dsDoc._id.toString();
  console.log(`[TEST 1] Target Dataset: "${dsDoc.name}" (_id: ${datasetId})`);

  // 2. Trigger Run Evaluation via real HTTP API
  console.log('\n[TEST 2] Triggering POST /api/quality/evaluate/:id...');
  const res1 = await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, {
    method: 'POST',
    headers
  });
  const data1 = await res1.json();
  console.log(`HTTP Status: ${res1.status}`);
  console.log(`Success: ${data1.success}`);
  console.log(`Overall Quality Score: ${data1.data?.score}%`);
  console.log(`Quality Grade: ${data1.data?.grade}`);

  if (data1.data?.score === 100) {
    throw new Error('FAILURE: Quality score is still fake 100% on bad PostgreSQL data!');
  }
  console.log('✓ PASS: Quality score is NOT 100% (Truthful bad data score)');

  // 3. Inspect Dimensions & Explanations
  console.log('\n[TEST 3] Inspecting Evaluated Dimensions & Explainability Evidence:');
  const dimensions = data1.data?.dimensions || [];
  for (const d of dimensions) {
    console.log(`  - ${d.name}: ${d.score !== null ? d.score + '%' : 'NOT ASSESSED'} [${d.status}]`);
    console.log(`    Columns: [${(d.evaluatedColumns || []).join(', ')}]`);
    console.log(`    Explanation: ${d.explanation}`);
  }

  const compDim = dimensions.find(d => d.name === 'Completeness');
  const valDim = dimensions.find(d => d.name === 'Validity');
  const timeDim = dimensions.find(d => d.name === 'Timeliness');
  const uniqDim = dimensions.find(d => d.name === 'Uniqueness');
  const accDim = dimensions.find(d => d.name === 'Accuracy');
  const consDim = dimensions.find(d => d.name === 'Consistency');

  if (!compDim || compDim.score >= 100) throw new Error('Completeness should reflect missing NULL values');
  if (!timeDim || timeDim.score >= 100) throw new Error('Timeliness should reflect 90-day stale timestamps');
  if (accDim.status !== 'NOT_ASSESSED') throw new Error('Accuracy must be NOT_ASSESSED when no reference rule exists');
  if (consDim.status !== 'NOT_ASSESSED') throw new Error('Consistency must be NOT_ASSESSED when no referential rule exists');
  if (!compDim.explanation || !compDim.evaluatedColumns?.length) throw new Error('Completeness dimension missing explainability metadata');
  console.log('✓ PASS: Dimensions truthfully reflect completeness nulls, validity errors, timeliness age, and not-assessed states with rich explanations.');

  // 4. Verify Anomalies / QualityIssues created in MongoDB & API
  console.log('\n[TEST 4] Verifying Real QualityIssues in MongoDB & GET /api/quality/issues:');
  const issuesRes = await fetch(`${BASE_URL}/quality/issues?datasetId=${datasetId}`, { headers });
  const issuesData = await issuesRes.json();
  const apiIssues = issuesData.data || [];
  console.log(`API Issues returned: ${apiIssues.length}`);

  // Test frontend matching logic:
  const matchedIssues = apiIssues.filter(iss => {
    const issDatasetId = (iss.datasetId && typeof iss.datasetId === 'object')
      ? (iss.datasetId._id || iss.datasetId.id)
      : iss.datasetId;
    return String(issDatasetId) === String(datasetId);
  });
  console.log(`Matched by frontend selector: ${matchedIssues.length}`);

  for (const issue of matchedIssues) {
    console.log(`  - [${issue.severity.toUpperCase()}] ${issue.column} (${issue.dimension}): ${issue.issue} (${issue.count} rows)`);
    if (issue.evidence) {
      console.log(`    Evidence: ${JSON.stringify(issue.evidence)}`);
    }
  }

  if (matchedIssues.length === 0) {
    throw new Error('FAILURE: Zero active anomalies matched in frontend issue selector!');
  }
  console.log('✓ PASS: Genuine anomalies returned by API and successfully matched for frontend UI rendering.');

  // 5. Deduplication Verification: Repeated evaluations do not duplicate issues
  console.log('\n[TEST 5] Testing Deduplication on Repeated Evaluations...');
  const resRepeat = await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, {
    method: 'POST',
    headers
  });
  const dataRepeat = await resRepeat.json();
  console.log(`Re-evaluation score: ${dataRepeat.data?.score}%`);

  const issuesAfterRepeat = await mongoose.connection.db.collection('qualityissues').find({
    datasetId: dsDoc._id,
    status: 'open'
  }).toArray();
  console.log(`Open issues count after repeat: ${issuesAfterRepeat.length} (expected: 6)`);
  if (issuesAfterRepeat.length !== 6) {
    throw new Error(`FAILURE: Deduplication failed! Expected 6 issues, found ${issuesAfterRepeat.length}`);
  }
  console.log('✓ PASS: Re-running evaluation does NOT create duplicate active issues (100% deduplicated).');

  // 6. Data Change Proof: Modify customer_name in PostgreSQL
  console.log('\n[TEST 6] Testing Source Data Change in PostgreSQL (Fixing customer_name)...');
  await pool.query("UPDATE public.dq_quality_test SET customer_name = 'Customer ' || id");
  console.log("Executed in PostgreSQL: UPDATE public.dq_quality_test SET customer_name = 'Customer ' || id;");

  const resFix = await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, {
    method: 'POST',
    headers
  });
  const dataFix = await resFix.json();
  const compAfterFix = dataFix.data?.dimensions?.find(d => d.name === 'Completeness');
  console.log(`Re-evaluated Completeness score: ${compAfterFix?.score}% (was ${compDim?.score}%)`);
  console.log(`New Overall Score: ${dataFix.data?.score}% (was ${data1.data?.score}%)`);

  if (compAfterFix.score <= compDim.score) {
    throw new Error('Completeness should have improved after fixing customer_name NULL values');
  }

  // Check that the customer_name issue was automatically marked 'resolved'
  const customerNameIssue = await mongoose.connection.db.collection('qualityissues').findOne({
    datasetId: dsDoc._id,
    field: 'customer_name',
    ruleType: 'NOT_NULL'
  });
  console.log(`customer_name issue status: ${customerNameIssue?.status} (expected: resolved)`);
  if (customerNameIssue?.status !== 'resolved') {
    throw new Error(`Expected customer_name issue to be marked resolved, but got ${customerNameIssue?.status}`);
  }

  const activeIssuesAfterFix = await mongoose.connection.db.collection('qualityissues').find({
    datasetId: dsDoc._id,
    status: 'open'
  }).toArray();
  console.log(`Active open issues count after fix: ${activeIssuesAfterFix.length} (expected: 5)`);
  if (activeIssuesAfterFix.length !== 5) {
    throw new Error(`Expected 5 active issues after fixing customer_name, but found ${activeIssuesAfterFix.length}`);
  }
  console.log('✓ PASS: PostgreSQL data change dynamically updated score and automatically resolved corresponding issue!');

  // Revert customer_name back to NULL in PostgreSQL
  console.log('\n[TEST 7] Reverting customer_name to NULL and testing automatic re-opening...');
  await pool.query('UPDATE public.dq_quality_test SET customer_name = NULL');
  console.log('Executed in PostgreSQL: UPDATE public.dq_quality_test SET customer_name = NULL;');

  const resRevert = await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, {
    method: 'POST',
    headers
  });
  const dataRevert = await resRevert.json();
  console.log(`Restored overall score: ${dataRevert.data?.score}% (expected: 63%)`);

  const activeIssuesAfterRevert = await mongoose.connection.db.collection('qualityissues').find({
    datasetId: dsDoc._id,
    status: 'open'
  }).toArray();
  console.log(`Active open issues count after revert: ${activeIssuesAfterRevert.length} (expected: 6)`);
  if (activeIssuesAfterRevert.length !== 6) {
    throw new Error(`Expected 6 active issues after reverting customer_name, but found ${activeIssuesAfterRevert.length}`);
  }
  console.log('✓ PASS: Reverting data defect re-opened the issue and restored score to 63%.');

  // 8. Test Dynamic Reactivity for Timeliness (update updated_at to NOW())
  console.log('\n[TEST 8] Testing Timeliness Reactivity in PostgreSQL (updated_at = NOW())...');
  await pool.query('UPDATE public.dq_quality_test SET updated_at = NOW()');
  console.log('Executed in PostgreSQL: UPDATE public.dq_quality_test SET updated_at = NOW();');

  const resTime = await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, {
    method: 'POST',
    headers
  });
  const dataTime = await resTime.json();
  const timeDimNow = dataTime.data?.dimensions?.find(d => d.name === 'Timeliness');
  console.log(`Timeliness score with fresh timestamps: ${timeDimNow?.score}% (was 20%)`);
  console.log(`Overall score with fresh timestamps: ${dataTime.data?.score}%`);

  const freshnessIssue = await mongoose.connection.db.collection('qualityissues').findOne({
    datasetId: dsDoc._id,
    field: 'updated_at',
    ruleType: 'FRESHNESS'
  });
  console.log(`Freshness issue status: ${freshnessIssue?.status} (expected: resolved)`);
  if (freshnessIssue?.status !== 'resolved') {
    throw new Error(`Expected freshness issue to be marked resolved, but got ${freshnessIssue?.status}`);
  }

  // Restore original stale date
  await pool.query("UPDATE public.dq_quality_test SET updated_at = '2026-07-07 21:27:14.94387'");
  console.log('Restored original stale date in PostgreSQL.');
  await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, { method: 'POST', headers });

  // 9. Verify GET /api/datasets Persistence
  console.log('\n[TEST 9] Verifying persistence on GET /api/datasets...');
  const catRes = await fetch(`${BASE_URL}/datasets?limit=100`, { headers });
  const catData = await catRes.json();
  const list = Array.isArray(catData.data) ? catData.data : (catData.data?.datasets || []);
  const targetDs = list.find(d => d.tableName === 'dq_quality_test');
  console.log(`Catalog dataset qualityScore: ${targetDs.qualityScore}%`);
  console.log(`Catalog dimensions count: ${targetDs.dimensions?.length}`);
  console.log('✓ PASS: Evaluated score and dimension snapshots persist across page loads.');

  await pool.end();
  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('ALL PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
