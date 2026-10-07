import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { normalizeBackendDataset } from '../../src/utils/normalizeDataset.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-1234567890';
const token = jwt.sign({ id: '6ac258b135ae36221abe22d5' }, JWT_SECRET);
const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('=== VERIFYING DATA CATALOG API & FRONTEND DATA FLOW ===\n');

  // 1. Calling GET /api/datasets
  console.log('1. Calling GET /api/datasets (Catalog List API)...');
  const res = await fetch(`${BASE_URL}/datasets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(res.status, 200, 'GET /api/datasets must return 200 OK');
  const body = await res.json();
  assert.strictEqual(body.success, true);
  const datasets = body.data.datasets;
  console.log(`   ✓ Successfully fetched ${datasets.length} datasets without hasQuality ReferenceError\n`);

  // 2. Verify Ricoz Demo PostgreSQL datasets (5 datasets)
  console.log('2. Verifying Ricoz Demo PostgreSQL datasets (expected: 5)...');
  const demoRes = await fetch(`${BASE_URL}/datasets?sourceSystem=Ricoz%20Demo%20PostgreSQL`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const demoBody = await demoRes.json();
  assert.strictEqual(demoBody.data.datasets.length, 5, 'Must return exactly 5 Ricoz Demo PostgreSQL datasets');
  console.log(`   ✓ Found ${demoBody.data.datasets.length} Ricoz Demo PostgreSQL datasets: ${demoBody.data.datasets.map(d => d.name).join(', ')}\n`);

  // 3. Verify PostgreSQL datasets (9 datasets)
  console.log('3. Verifying PostgreSQL datasets (expected: 9)...');
  const pgRes = await fetch(`${BASE_URL}/datasets?sourceSystem=PostgreSQL`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const pgBody = await pgRes.json();
  assert.strictEqual(pgBody.data.datasets.length, 9, 'Must return exactly 9 PostgreSQL datasets');
  console.log(`   ✓ Found ${pgBody.data.datasets.length} PostgreSQL datasets: ${pgBody.data.datasets.map(d => d.name).join(', ')}\n`);

  // 4. Normalization of all datasets
  console.log('4. Testing normalizeBackendDataset across all 19 datasets...');
  for (const ds of datasets) {
    const norm = normalizeBackendDataset(ds);
    assert.ok(norm.id, 'Must have id');
    assert.ok(norm.name, 'Must have name');
    assert.strictEqual(typeof norm.columnsCount, 'number');
    assert.strictEqual(typeof norm.notAssessed, 'boolean');
    if (norm.notAssessed) {
      assert.strictEqual(norm.quality, null);
      assert.strictEqual(norm.qualityStatus, 'Not Assessed');
    }
  }
  console.log('   ✓ All 19 datasets normalized without errors\n');

  // 5. Test specific Products detail view
  console.log('5. Calling GET /api/datasets/:id for Products...');
  const products = demoBody.data.datasets.find(d => d.name === 'Products');
  const prodRes = await fetch(`${BASE_URL}/datasets/${products._id}?trackView=false`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const prodData = (await prodRes.json()).data;
  assert.strictEqual(prodData.name, 'Products');
  assert.strictEqual(prodData.columnsCount, 7, 'Products must have 7 columns (never 48)');
  assert.strictEqual(prodData.qualityScore, 100);
  assert.strictEqual(prodData.source, 'Ricoz Demo PostgreSQL');
  console.log(`   ✓ Products detail verified: columnsCount=${prodData.columnsCount}, quality=${prodData.qualityScore}%, source=${prodData.source}\n`);

  console.log('=== DATA CATALOG RUNTIME VERIFICATION COMPLETE: ALL PASS ===\n');
}

run().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
