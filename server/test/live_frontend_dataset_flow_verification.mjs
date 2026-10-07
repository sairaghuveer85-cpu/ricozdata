import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Dataset } from '../src/models/Dataset.js';
import { normalizeBackendDataset } from '../../src/utils/normalizeDataset.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function runLiveFrontendDatasetFlowVerification() {
  console.log('============================================================');
  console.log('LIVE RUNTIME VERIFICATION ACROSS ALL DATASETS');
  console.log('============================================================\n');

  await connectDB();
  const org = await Organization.findOne({ slug: 'ricoz-demo' });
  assert.ok(org);

  // Authenticate
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ email: 'lead.steward@ricoz.io', password: 'EnterprisePassword2026!' })
  });
  const token = (await loginRes.json()).data.accessToken;
  assert.ok(token, 'Must receive token');

  // Fetch all datasets from API
  const listRes = await fetch(`${BASE_URL}/datasets?limit=50`, {
    headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' }
  });
  const listData = await listRes.json();
  assert.ok(listData.success, 'Dataset list API must succeed');
  const allDatasets = listData.data;

  console.log(`Discovered ${allDatasets.length} total datasets in active tenant (${org.name}):\n`);

  const verificationMatrix = [];

  for (const ds of allDatasets) {
    const dsId = String(ds._id || ds.id);
    console.log(`------------------------------------------------------------`);
    console.log(`VERIFYING DATASET: "${ds.name}" (ID: ${dsId})`);
    console.log(`------------------------------------------------------------`);

    // 1. Dataset Details API
    const detailRes = await fetch(`${BASE_URL}/datasets/${dsId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' }
    });
    const detailData = await detailRes.json();
    assert.equal(detailRes.status, 200, `Details API for ${ds.name} must return 200`);
    const rawBackend = detailData.data;
    const normalized = normalizeBackendDataset(rawBackend);

    // Verify no fake data in normalized dataset
    assert.notEqual(normalized.owner, 'Priya S.', 'Must not contain fake owner Priya S.');
    assert.notEqual(normalized.owner, 'Aria Vance', 'Must not contain fake owner Aria Vance');
    assert.notEqual(normalized.rows, '12.4M', 'Must not contain fake row count 12.4M');
    assert.notEqual(normalized.source, 'Snowflake', 'Must not contain fake source Snowflake');
    assert.notEqual(normalized.updated, 'Aug 14, 2026', 'Must not contain fake certification date');

    console.log(`✓ Details loaded: ${normalized.name} | Rows: ${normalized.rows} | Cols: ${normalized.columnsCount} | Source: ${normalized.source}`);

    // 2. Schema Definition
    const schemaFields = normalized.schema || [];
    console.log(`✓ Schema fields (${schemaFields.length}):`, schemaFields.map(f => `${f.name} (${f.type})`).join(', ') || 'None');

    // 3. SQL Studio Execution
    let sqlStatus = 'N/A';
    let sqlRowCount = 0;
    if (ds.dataSourceId) {
      const safeQuery = `SELECT * FROM "${normalized.schemaName || 'public'}"."${normalized.name}" LIMIT 50;`;
      const queryRes = await fetch(`${BASE_URL}/datasets/${dsId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' },
        body: JSON.stringify({ query: safeQuery })
      });
      const queryData = await queryRes.json();
      if (queryRes.status === 200 && queryData.success) {
        sqlStatus = 'SUCCESS';
        sqlRowCount = queryData.data?.rowCount ?? 0;
        console.log(`✓ SQL Studio: Query succeeded, returned ${sqlRowCount} rows with fields: [${queryData.data?.fields?.join(', ')}]`);
      } else {
        sqlStatus = `ERROR: ${queryData.message}`;
        console.log(`✗ SQL Studio error:`, queryData.message);
      }
    } else {
      sqlStatus = 'MANUAL_DATASET_NO_SOURCE';
      console.log(`ℹ SQL Studio: Manual dataset with no connected source`);
    }

    // 4. Lineage Graph API
    const linRes = await fetch(`${BASE_URL}/lineage/datasets/${dsId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' }
    });
    const linData = await linRes.json();
    const nodeCount = linData.data?.nodes?.length || 0;
    const edgeCount = linData.data?.edges?.length || 0;
    console.log(`✓ Lineage: Graph returned ${nodeCount} nodes, ${edgeCount} edges`);

    // 5. Quality Health API
    const qualRes = await fetch(`${BASE_URL}/quality/datasets/${dsId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' }
    });
    const qualData = await qualRes.json();
    const qualScore = qualData.data?.dataset?.score ?? null;
    const rulesEvaluated = qualData.data?.rulesSummary?.total ?? 0;
    console.log(`✓ Quality: Score: ${qualScore !== null ? qualScore + '%' : 'Not Evaluated'} (${rulesEvaluated} rules)`);

    // 6. Activity API
    const actRes = await fetch(`${BASE_URL}/dashboard/activity?datasetId=${dsId}&limit=10`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' }
    });
    const actData = await actRes.json();
    const actCount = actData.data?.activities?.length || 0;
    console.log(`✓ Activity: ${actCount} historical audit events found`);

    verificationMatrix.push({
      dataset: normalized.name,
      id: dsId,
      source: normalized.source,
      schema: normalized.schemaName,
      rows: normalized.rows,
      cols: normalized.columnsCount,
      sqlStatus,
      sqlRowCount,
      lineage: `${nodeCount} nodes, ${edgeCount} edges`,
      quality: qualScore !== null ? `${qualScore}%` : 'Not Evaluated',
      activity: `${actCount} events`,
      isReal: normalized.origin === 'DISCOVERED' ? 'REAL DISCOVERED' : 'MANUALLY CREATED'
    });
  }

  console.log('\n============================================================');
  console.log('RUNTIME VERIFICATION MATRIX:');
  console.log('============================================================');
  console.table(verificationMatrix);

  await disconnectDB();
}

runLiveFrontendDatasetFlowVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
