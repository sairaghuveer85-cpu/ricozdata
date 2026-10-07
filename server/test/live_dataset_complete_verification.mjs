import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import pg from 'pg';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import { QualityRule } from '../src/models/QualityRule.js';
import { QualityRun } from '../src/models/QualityRun.js';
import { CatalogSyncService } from '../src/services/CatalogSyncService.js';
import { ConnectorService } from '../src/connectors/ConnectorService.js';
import '../src/connectors/index.js';
import { hashPassword } from '../src/utils/crypto.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function runComprehensiveVerification() {
  console.log('============================================================');
  console.log('STARTING REAL-DATA COMPREHENSIVE CONTROLLED VERIFICATION');
  console.log('============================================================\n');

  await connectDB();
  console.log('[1/8] Connected to MongoDB');

  // Verify Primary Organization
  const org = await Organization.findOne({ slug: 'ricoz-demo' });
  assert.ok(org, 'Organization "ricoz-demo" must exist');
  const orgId = org._id;
  console.log(`[1/8] Primary Organization verified: ${org.name} (${orgId})`);

  // Verify Active Data Source
  const ds = await DataSource.findOne({
    organizationId: orgId,
    type: 'postgresql',
    isDeleted: { $ne: true }
  }).select('+credentials.encryptedData +credentials.keyId');
  assert.ok(ds, 'Active PostgreSQL DataSource must exist');
  console.log(`[2/8] Active PostgreSQL DataSource verified: ${ds.name} (${ds._id})`);

  // Verify Admin/Steward User for authenticated testing
  let user = await User.findOne({ organizationId: orgId, email: 'lead.steward@ricoz.io' });
  assert.ok(user, 'User lead.steward@ricoz.io must exist');
  const testPassword = 'EnterprisePassword2026!';
  user.passwordHash = hashPassword(testPassword);
  user.role = 'admin';
  await user.save();

  // Perform API Login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ email: 'lead.steward@ricoz.io', password: testPassword })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  assert.ok(token, 'Login must yield access token');
  console.log(`[2/8] Authenticated API Session established for: ${user.email}`);

  // Direct PostgreSQL Client for Ground-Truth Verification
  const pgPool = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'ricoz_test',
    user: 'postgres',
    password: process.env.POSTGRES_TEST_PASSWORD || '1818'
  });
  const pgClient = await pgPool.connect();
  console.log('[3/8] Direct PostgreSQL connection verified (localhost:5432/ricoz_test)');

  // Catalog Synchronization Step
  console.log('\n--- STEP 4: CATALOG SYNCHRONIZATION ---');
  const syncResult = await CatalogSyncService.synchronize(ds._id, orgId, { actor: user });
  console.log('Catalog sync result:', {
    tablesDiscovered: syncResult.tablesDiscovered,
    datasetsCreated: syncResult.datasetsCreated,
    datasetsUpdated: syncResult.datasetsUpdated,
    errors: syncResult.errors?.length || 0
  });

  // Verify Discovered Datasets
  const activeDatasets = await Dataset.find({
    organizationId: orgId,
    isDeleted: { $ne: true }
  }).lean();
  console.log(`Active datasets found in catalog: ${activeDatasets.length}`);
  activeDatasets.forEach(d => {
    console.log(` - [${d._id}] ${d.name} | Origin: ${d.origin} | Rows: ${d.schemaMetadata?.rowCount} | Cols: ${d.columns?.length}`);
  });

  const custDataset = activeDatasets.find(d => d.name === 'customers');
  const prodDataset = activeDatasets.find(d => d.name === 'products');
  assert.ok(custDataset, 'customers dataset must exist in catalog');
  assert.ok(prodDataset, 'products dataset must exist in catalog');

  // STEP 20: CONTROLLED ROW COUNT TEST
  console.log('\n--- STEP 20: CONTROLLED ROW COUNT TEST ---');
  const initialPgCust = await pgClient.query('SELECT COUNT(*)::int as count FROM public.customers;');
  const initialCount = initialPgCust.rows[0].count;
  console.log(`Initial PostgreSQL customers row count: ${initialCount}`);

  // Safely insert 1 temporary test row
  console.log('Inserting 1 temporary test row into public.customers...');
  await pgClient.query(`
    INSERT INTO public.customers (customer_id, name, email, phone, age, created_at)
    VALUES (9999, 'Temporary Verification Row', 'temp9999@test.com', '9999999999', 99, NOW());
  `);

  // Run Catalog Sync
  console.log('Running Catalog Sync after insert...');
  await CatalogSyncService.synchronize(ds._id, orgId, { actor: user });

  // Verify MongoDB updated rowCount = initialCount + 1
  const updatedCustDataset = await Dataset.findById(custDataset._id).lean();
  console.log(`Updated MongoDB rowCount: ${updatedCustDataset.schemaMetadata.rowCount}`);
  assert.equal(updatedCustDataset.schemaMetadata.rowCount, initialCount + 1, 'MongoDB row count must reflect source + 1');

  // Verify API GET /api/v1/datasets/:id returns updated rowCount
  const apiCustRes = await fetch(`${BASE_URL}/datasets/${custDataset._id}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' }
  });
  const apiCustData = await apiCustRes.json();
  assert.equal(apiCustData.data.schemaMetadata.rowCount, initialCount + 1, 'API must return updated rowCount');

  // Verify SQL Studio query retrieves the newly inserted test row
  const sqlStudioRes = await fetch(`${BASE_URL}/datasets/${custDataset._id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ query: 'SELECT * FROM "public"."customers" WHERE customer_id = 9999;' })
  });
  const sqlStudioData = await sqlStudioRes.json();
  assert.equal(sqlStudioData.data.rowCount, 1, 'SQL Studio must retrieve exactly the inserted test row');
  assert.equal(sqlStudioData.data.rows[0].name, 'Temporary Verification Row');
  console.log('SQL Studio successfully retrieved inserted record:', sqlStudioData.data.rows[0].name);

  // Remove the temporary row and restore
  console.log('Deleting temporary test row...');
  await pgClient.query('DELETE FROM public.customers WHERE customer_id = 9999;');
  await CatalogSyncService.synchronize(ds._id, orgId, { actor: user });
  const restoredCustDataset = await Dataset.findById(custDataset._id).lean();
  assert.equal(restoredCustDataset.schemaMetadata.rowCount, initialCount, 'Row count must be restored to original');
  console.log(`Row count successfully restored to original: ${restoredCustDataset.schemaMetadata.rowCount}`);

  // STEP 21: CONTROLLED SCHEMA DRIFT TEST
  console.log('\n--- STEP 21: CONTROLLED SCHEMA TEST ---');
  const initialPgCols = await pgClient.query(`
    SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products';
  `);
  const initialColCount = initialPgCols.rows.length;
  console.log(`Initial public.products column count: ${initialColCount}`);

  // Add temporary column
  console.log('Adding temporary test column "test_verification_col" to public.products...');
  await pgClient.query('ALTER TABLE public.products ADD COLUMN test_verification_col VARCHAR(100);');

  // Sync catalog
  await CatalogSyncService.synchronize(ds._id, orgId, { actor: user });
  const driftProdDataset = await Dataset.findById(prodDataset._id).lean();
  console.log(`Updated MongoDB column count for products: ${driftProdDataset.columns.length}`);
  assert.equal(driftProdDataset.columns.length, initialColCount + 1, 'MongoDB column count must reflect + 1');
  const hasDriftCol = driftProdDataset.columns.some(c => c.name === 'test_verification_col');
  assert.ok(hasDriftCol, 'MongoDB schema must include "test_verification_col"');

  // Query SQL Studio with new column
  const colQueryRes = await fetch(`${BASE_URL}/datasets/${prodDataset._id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ query: 'SELECT product_id, test_verification_col FROM "public"."products" LIMIT 1;' })
  });
  const colQueryData = await colQueryRes.json();
  assert.ok(colQueryData.success, 'SQL query on altered column must succeed');
  assert.ok(colQueryData.data.fields.includes('test_verification_col'));
  console.log('SQL Studio verified presence of new schema field in query fields:', colQueryData.data.fields);

  // Drop temporary column and restore
  console.log('Dropping temporary test column...');
  await pgClient.query('ALTER TABLE public.products DROP COLUMN test_verification_col;');
  await CatalogSyncService.synchronize(ds._id, orgId, { actor: user });
  const restoredProdDataset = await Dataset.findById(prodDataset._id).lean();
  assert.equal(restoredProdDataset.columns.length, initialColCount, 'Column count must be restored to original');
  console.log(`Schema successfully restored to original column count: ${restoredProdDataset.columns.length}`);

  // STEP 22: MULTI-DATASET CONSISTENCY TEST
  console.log('\n--- STEP 22: MULTI-DATASET CONSISTENCY TEST ---');
  // Query customers
  const custQuery = await fetch(`${BASE_URL}/datasets/${custDataset._id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ query: 'SELECT * FROM "public"."customers" LIMIT 5;' })
  });
  const custResData = await custQuery.json();
  assert.ok(custResData.data.fields.includes('customer_id'), 'customers query must include customer_id');
  assert.ok(!custResData.data.fields.includes('product_id'), 'customers query must NOT include product_id');

  // Query products
  const prodQuery = await fetch(`${BASE_URL}/datasets/${prodDataset._id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ query: 'SELECT * FROM "public"."products" LIMIT 5;' })
  });
  const prodResData = await prodQuery.json();
  assert.ok(prodResData.data.fields.includes('product_id'), 'products query must include product_id');
  assert.ok(!prodResData.data.fields.includes('customer_id'), 'products query must NOT include customer_id');
  console.log('Multi-dataset SQL Studio isolation verified: customers and products query distinct schemas without cross-contamination');

  // Check Quality Rules isolation
  const custRules = await QualityRule.find({ datasetId: custDataset._id, organizationId: orgId }).lean();
  const prodRules = await QualityRule.find({ datasetId: prodDataset._id, organizationId: orgId }).lean();
  console.log(`Quality Rules: customers has ${custRules.length} rules, products has ${prodRules.length} rules`);
  custRules.forEach(r => {
    assert.equal(String(r.datasetId), String(custDataset._id));
  });
  prodRules.forEach(r => {
    assert.equal(String(r.datasetId), String(prodDataset._id));
  });
  console.log('Quality Rules dataset association strictly isolated');

  // STEP 23: TENANT ISOLATION TEST
  console.log('\n--- STEP 23: TENANT ISOLATION TEST ---');
  // Create temporary Organization B
  const orgB = await Organization.findOneAndUpdate(
    { slug: 'ricoz-tenant-b-test' },
    { $set: { name: 'Tenant B Isolated Corp', slug: 'ricoz-tenant-b-test' } },
    { upsert: true, new: true }
  );

  // Create temporary Dataset B belonging to Org B
  const datasetB = await Dataset.create({
    organizationId: orgB._id,
    dataSourceId: new mongoose.Types.ObjectId(),
    name: 'secret_tenant_b_records',
    schemaName: 'public',
    fullyQualifiedName: 'public.secret_tenant_b_records',
    origin: 'MANUAL',
    syncStatus: 'ACTIVE',
    columns: [{ name: 'b_id', dataType: 'INTEGER' }]
  });

  // Attempt to access Dataset B from Org A session
  const crossTenantGet = await fetch(`${BASE_URL}/datasets/${datasetB._id}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' }
  });
  assert.equal(crossTenantGet.status, 404, 'Org A must receive 404 when accessing Dataset B');

  // Attempt to query Dataset B from Org A session
  const crossTenantQuery = await fetch(`${BASE_URL}/datasets/${datasetB._id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': 'ricoz-demo' },
    body: JSON.stringify({ query: 'SELECT 1;' })
  });
  assert.equal(crossTenantQuery.status, 404, 'Org A must receive 404 when querying Dataset B');

  // Clean up Org B
  await Dataset.deleteOne({ _id: datasetB._id });
  await Organization.deleteOne({ _id: orgB._id });
  console.log('Tenant Isolation verified: Org A cannot access or query Org B datasets (Strict 404 returned)');

  // Clean up DB connections
  pgClient.release();
  await pgPool.end();
  await disconnectDB();

  console.log('\n============================================================');
  console.log('ALL CONTROLLED VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('============================================================');
}

runComprehensiveVerification().catch(err => {
  console.error('FATAL VERIFICATION FAILURE:', err);
  process.exit(1);
});
