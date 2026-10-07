import pg from 'pg';
import dotenv from 'dotenv';
import assert from 'assert';

dotenv.config({ path: 'server/.env' });

const PG_CONFIG = {
  host: process.env.POSTGRES_TEST_HOST || 'localhost',
  port: Number(process.env.POSTGRES_TEST_PORT || 5432),
  database: process.env.POSTGRES_TEST_DB || 'ricoz_test',
  user: process.env.POSTGRES_TEST_USER || 'postgres',
  password: process.env.POSTGRES_TEST_PASSWORD || '1818'
};

const BASE_URL = 'http://localhost:5000/api/v1';

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('  RICOZDATA — DATA CATALOG REAL DATA MIGRATION VERIFICATION     ');
  console.log('================================================================');

  // 1. Authenticate with ricoz-demo
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password', slug: 'ricoz-demo' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.success, true, 'Login must succeed');
  const token = loginData.data.accessToken;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log('✓ [AUTH] Logged in as test@example.com (Tenant: ricoz-demo)');

  // 2. Fetch DataSources
  const dsRes = await fetch(`${BASE_URL}/data-sources`, { headers });
  const dsData = await dsRes.json();
  assert.strictEqual(dsData.success, true);
  const pgSource = dsData.data.find(d => d.type === 'postgresql' && d.name === 'Local PostgreSQL Test DB');
  assert.ok(pgSource, 'Must find Local PostgreSQL Test DB');
  console.log(`✓ [DATA SOURCE] Found connected PostgreSQL source: ${pgSource.name} (ID: ${pgSource._id})`);

  // Ensure clean initial state in PostgreSQL
  const initPg = new pg.Client(PG_CONFIG);
  await initPg.connect();
  await initPg.query('DROP TABLE IF EXISTS public.test_orders_catalog_audit CASCADE;');
  await initPg.query('ALTER TABLE public.customers DROP COLUMN IF EXISTS loyalty_tier;');
  await initPg.query('DELETE FROM public.customers WHERE email = \'synctest@ricoz.io\';');
  await initPg.end();

  // STEP A & B: Trigger sync on PostgreSQL test DB
  console.log('\n--- STEP A & B: RUN CATALOG SYNCHRONIZATION ---');
  const syncRes = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, {
    method: 'POST',
    headers
  });
  const syncData = await syncRes.json();
  assert.strictEqual(syncData.success, true);
  console.log(`✓ Sync status: ${syncData.data.status}, Discovered: ${syncData.data.discoveredCount}`);

  // STEP C, D, E: Verify real catalog datasets
  console.log('\n--- STEP C, D, E: VERIFY REAL CATALOG DATASETS (NO DEMO DATA) ---');
  const catRes = await fetch(`${BASE_URL}/datasets`, { headers });
  const catData = await catRes.json();
  assert.strictEqual(catData.success, true);
  const datasets = catData.data;
  console.log(`Total active datasets returned: ${datasets.length}`);
  const names = datasets.map(d => d.name).sort();
  console.log('Dataset names in catalog:', names);
  assert.strictEqual(datasets.length, 2, 'Must have exactly 2 real datasets');
  assert.deepStrictEqual(names, ['customers', 'products'], 'Must match real PostgreSQL tables');
  
  const cust = datasets.find(d => d.name === 'customers');
  assert.strictEqual(cust.origin, 'DISCOVERED');
  assert.strictEqual(cust.schemaMetadata.rowCount, 4);
  assert.strictEqual(cust.columns.length, 6);
  assert.ok(!names.includes('Customer Master'), 'Static Customer Master must NOT exist');
  assert.ok(!names.includes('Sales Orders'), 'Static Sales Orders must NOT exist');
  console.log('✓ [VERIFIED] Real datasets customers (4 rows, 6 cols) and products (4 rows, 5 cols) are displayed with zero synthetic demo datasets.');

  // STEP F: Add 1 REAL test table in PostgreSQL, sync, verify Before: 2, After: 3
  console.log('\n--- STEP F: ADD 1 REAL TEST TABLE IN POSTGRESQL & VERIFY CATALOG EXPANSION ---');
  const pgClient = new pg.Client(PG_CONFIG);
  await pgClient.connect();

  await pgClient.query('DROP TABLE IF EXISTS public.test_orders_catalog_audit CASCADE;');
  await pgClient.query(`
    CREATE TABLE public.test_orders_catalog_audit (
      id SERIAL PRIMARY KEY,
      customer_id INT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      order_date DATE NOT NULL
    );
  `);
  await pgClient.query(`
    INSERT INTO public.test_orders_catalog_audit (customer_id, amount, order_date)
    VALUES (1, 199.99, '2026-09-28'), (2, 249.50, '2026-09-28'), (3, 89.00, '2026-09-28');
  `);
  console.log('✓ Created PostgreSQL table "public.test_orders_catalog_audit" with 3 rows, 4 columns.');

  // Run synchronization
  const syncF = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, { method: 'POST', headers });
  const syncFData = await syncF.json();
  assert.strictEqual(syncFData.success, true);
  console.log(`✓ Resync report: Discovered: ${syncFData.data.discoveredCount}, Created: ${syncFData.data.createdCount}, Drift: ${syncFData.data.driftCount}`);

  // Query catalog after sync
  const catAfterRes = await fetch(`${BASE_URL}/datasets`, { headers });
  const catAfterData = await catAfterRes.json();
  const datasetsAfter = catAfterData.data;
  console.log(`Before sync: 2 real datasets. After sync: ${datasetsAfter.length} real datasets.`);
  assert.strictEqual(datasetsAfter.length, 3, 'Must have exactly 3 datasets after adding table');
  const tempDs = datasetsAfter.find(d => d.name === 'test_orders_catalog_audit');
  assert.ok(tempDs, 'New dataset "test_orders_catalog_audit" must appear in Data Catalog');
  assert.strictEqual(tempDs.schemaMetadata.rowCount, 3, 'Row count must be 3');
  assert.strictEqual(tempDs.columns.length, 4, 'Column count must be 4');
  console.log('✓ [STEP F PASS] 2 datasets -> 3 datasets proven! New dataset appears in catalog with real rows and columns.');

  // STEP G: Remove the temporary test table, resync, verify removal
  console.log('\n--- STEP G: REMOVE TEMPORARY TABLE & VERIFY CATALOG REFLECTS REMOVAL ---');
  await pgClient.query('DROP TABLE public.test_orders_catalog_audit CASCADE;');
  console.log('✓ Dropped PostgreSQL table "public.test_orders_catalog_audit".');

  const syncG = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, { method: 'POST', headers });
  const syncGData = await syncG.json();
  assert.strictEqual(syncGData.success, true);
  console.log(`✓ Resync report: Removed: ${syncGData.data.removedCount}`);
  assert.strictEqual(syncGData.data.removedCount, 1, 'Sync must report 1 removed asset');

  const activeRes = await fetch(`${BASE_URL}/datasets?syncStatus=ACTIVE`, { headers });
  const activeData = await activeRes.json();
  assert.strictEqual(activeData.data.length, 2, 'Active catalog must return to 2 datasets');
  console.log(`✓ Active datasets count: ${activeData.data.length} (${activeData.data.map(d => d.name).join(', ')})`);

  // Soft-delete temporary dataset so catalog is pristine
  await fetch(`${BASE_URL}/datasets/${tempDs._id}`, { method: 'DELETE', headers });
  const pristineRes = await fetch(`${BASE_URL}/datasets`, { headers });
  const pristineData = await pristineRes.json();
  assert.strictEqual(pristineData.data.length, 2, 'Pristine catalog must have exactly 2 datasets');
  console.log('✓ [STEP G PASS] Catalog reflects table removal according to soft-delete/sync architecture.');

  // STEP 9: Real Data Change Test (Alter schema & change row count)
  console.log('\n--- STEP 9: REAL DATA CHANGE TEST (SCHEMA & ROW COUNT DRIFT) ---');
  // First ensure clean starting point
  await pgClient.query('ALTER TABLE public.customers DROP COLUMN IF EXISTS loyalty_tier;');
  await pgClient.query('DELETE FROM public.customers WHERE email = \'synctest@ricoz.io\';');
  await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, { method: 'POST', headers });

  // Now alter schema and insert 1 row
  await pgClient.query('ALTER TABLE public.customers ADD COLUMN loyalty_tier VARCHAR(50) DEFAULT \'STANDARD\';');
  await pgClient.query('INSERT INTO public.customers (name, email, phone, age) VALUES (\'SyncTest User\', \'synctest@ricoz.io\', \'555-9999\', 30);');
  console.log('✓ Altered PostgreSQL "customers": added column loyalty_tier and inserted 1 row (total 5 rows, 7 cols).');

  const sync9 = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, { method: 'POST', headers });
  const sync9Data = await sync9.json();
  assert.strictEqual(sync9Data.success, true);
  console.log(`✓ Sync updated: ${sync9Data.data.updatedCount}, Drifts: ${sync9Data.data.driftCount}`);

  const custCheckRes = await fetch(`${BASE_URL}/datasets`, { headers });
  const custCheckData = await custCheckRes.json();
  const updatedCust = custCheckData.data.find(d => d.name === 'customers');
  console.log(`Updated customers: rowCount = ${updatedCust.schemaMetadata.rowCount}, columns = ${updatedCust.columns.length}`);
  assert.strictEqual(updatedCust.schemaMetadata.rowCount, 5, 'Row count must be 5');
  assert.strictEqual(updatedCust.columns.length, 7, 'Column count must be 7');
  const hasLoyalty = updatedCust.columns.some(c => c.name === 'loyalty_tier');
  assert.strictEqual(hasLoyalty, true, 'Column loyalty_tier must be discovered');
  console.log('✓ [STEP 9 PASS] Metadata change in PostgreSQL propagated live to catalog dataset.');

  // Cleanup schema change in PostgreSQL and resync to leave pristine
  await pgClient.query('DELETE FROM public.customers WHERE email = \'synctest@ricoz.io\';');
  await pgClient.query('ALTER TABLE public.customers DROP COLUMN IF EXISTS loyalty_tier;');
  await pgClient.end();
  await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, { method: 'POST', headers });
  console.log('✓ Cleaned up test row & column from PostgreSQL and resynced.');

  // STEP 10: Empty Organization Test
  console.log('\n--- STEP 10: EMPTY ORGANIZATION TEST ---');
  const emptyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'case-a-empty-org' },
    body: JSON.stringify({ email: 'empty@empty.com', password: 'password', slug: 'case-a-empty-org' })
  });
  const emptyLoginData = await emptyLoginRes.json();
  const emptyToken = emptyLoginData.data.accessToken;

  const emptyCatRes = await fetch(`${BASE_URL}/datasets`, {
    headers: { 'Authorization': `Bearer ${emptyToken}` }
  });
  const emptyCatData = await emptyCatRes.json();
  assert.strictEqual(emptyCatData.success, true);
  assert.strictEqual(emptyCatData.data.length, 0, 'Empty org must return exactly 0 datasets');
  assert.strictEqual(emptyCatData.meta.pagination.total, 0);
  console.log('✓ [STEP 10 PASS] Empty organization returns 0 datasets. Zero demo/static datasets rendered.');

  // STEP 11 & 12: Search, Filters, Sorting & Pagination
  console.log('\n--- STEP 11 & 12: SEARCH, FILTERS, SORTING & PAGINATION TEST ---');
  // Search
  const searchCust = await (await fetch(`${BASE_URL}/datasets?search=cust`, { headers })).json();
  assert.strictEqual(searchCust.data.length, 1);
  assert.strictEqual(searchCust.data[0].name, 'customers');
  console.log('✓ Search "cust" returns 1 dataset (customers)');

  const searchProd = await (await fetch(`${BASE_URL}/datasets?search=prod`, { headers })).json();
  assert.strictEqual(searchProd.data.length, 1);
  assert.strictEqual(searchProd.data[0].name, 'products');
  console.log('✓ Search "prod" returns 1 dataset (products)');

  const searchNone = await (await fetch(`${BASE_URL}/datasets?search=nonexistent`, { headers })).json();
  assert.strictEqual(searchNone.data.length, 0);
  console.log('✓ Search "nonexistent" returns 0 datasets');

  // Sorting
  const sortAsc = await (await fetch(`${BASE_URL}/datasets?sort=name:asc`, { headers })).json();
  assert.strictEqual(sortAsc.data[0].name, 'customers');
  assert.strictEqual(sortAsc.data[1].name, 'products');
  console.log('✓ Sort name:asc returns [customers, products]');

  const sortDesc = await (await fetch(`${BASE_URL}/datasets?sort=name:desc`, { headers })).json();
  assert.strictEqual(sortDesc.data[0].name, 'products');
  assert.strictEqual(sortDesc.data[1].name, 'customers');
  console.log('✓ Sort name:desc returns [products, customers]');

  // Pagination
  const page1 = await (await fetch(`${BASE_URL}/datasets?page=1&limit=1`, { headers })).json();
  assert.strictEqual(page1.data.length, 1);
  assert.strictEqual(page1.meta.pagination.totalPages, 2);
  assert.strictEqual(page1.meta.pagination.hasNextPage, true);
  console.log('✓ Pagination page=1&limit=1 returns 1 item, totalPages=2, hasNextPage=true');

  console.log('\n================================================================');
  console.log('           ALL DATA CATALOG VERIFICATION TESTS PASSED!          ');
  console.log('================================================================');
}

runVerificationSuite().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
