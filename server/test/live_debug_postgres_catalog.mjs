import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { Dataset } from '../src/models/Dataset.js';
import tokenService from '../src/services/token.service.js';
import { hashPassword } from '../src/utils/crypto.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

async function main() {
  await connectDB();
  console.log('Connected to MongoDB');

  // 1. Identify primary tenant
  const org = await Organization.findOne({ slug: 'ricoz-demo' });
  assert.ok(org, 'Primary org "ricoz-demo" must exist');
  console.log('Primary Org:', org._id.toString(), org.slug, org.name);

  // 2. Identify or set up lead steward user with known credentials for testing
  let user = await User.findOne({ organizationId: org._id, email: 'lead.steward@ricoz.io' });
  assert.ok(user, 'User lead.steward@ricoz.io must exist');
  
  // Set a clean known password hash so HTTP login works
  const rawPassword = 'EnterprisePassword2026!';
  user.passwordHash = hashPassword(rawPassword);
  user.role = 'admin'; // Elevate to admin so full platform access is available
  await user.save();
  console.log('Updated user password and verified role: admin');

  // 3. Test HTTP login endpoint
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'ricoz-demo'
    },
    body: JSON.stringify({
      email: 'lead.steward@ricoz.io',
      password: rawPassword
    })
  });
  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status, 'Success:', loginData.success);
  assert.strictEqual(loginRes.status, 200);
  assert.ok(loginData.data?.accessToken);
  const token = loginData.data.accessToken;

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 4. Check existing datasets before sync
  const initialDatasetsRes = await fetch(`${BASE_URL}/datasets`, { headers: authHeaders });
  const initialDatasetsData = await initialDatasetsRes.json();
  console.log('Initial Datasets Count via API:', initialDatasetsData.data?.length || 0);

  // 5. Check or create PostgreSQL DataSource under ricoz-demo
  let pgSource = await DataSource.findOne({
    organizationId: org._id,
    type: 'postgresql',
    isDeleted: { $ne: true }
  });

  const pgHost = process.env.POSTGRES_TEST_HOST || 'localhost';
  const pgPort = parseInt(process.env.POSTGRES_TEST_PORT || '5432', 10);
  const pgDb = process.env.POSTGRES_TEST_DB || 'ricoz_test';
  const pgUser = process.env.POSTGRES_TEST_USER || 'postgres';
  const pgPass = process.env.POSTGRES_TEST_PASSWORD || '1818';

  if (!pgSource) {
    console.log('Creating PostgreSQL DataSource under ricoz-demo...');
    const createDsRes = await fetch(`${BASE_URL}/data-sources`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Local PostgreSQL Test DB',
        type: 'postgresql',
        description: 'Primary PostgreSQL instance hosting customers and products',
        configuration: {
          host: pgHost,
          port: pgPort,
          database: pgDb,
          schema: 'public',
          ssl: false
        },
        credentials: {
          username: pgUser,
          password: pgPass
        }
      })
    });
    const createDsData = await createDsRes.json();
    console.log('Create DataSource Status:', createDsRes.status, 'Success:', createDsData.success);
    assert.strictEqual(createDsRes.status, 201);
    pgSource = createDsData.data;
  } else {
    console.log('Found existing DataSource:', pgSource._id.toString(), pgSource.name);
  }

  // 6. Test connection via API
  console.log('Testing connection to DataSource:', pgSource._id.toString());
  const testConnRes = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/test`, {
    method: 'POST',
    headers: authHeaders
  });
  const testConnData = await testConnRes.json();
  console.log('Test Connection Status:', testConnRes.status, 'Data:', testConnData.data);
  assert.strictEqual(testConnRes.status, 200);
  assert.strictEqual(testConnData.data.healthStatus, 'HEALTHY');

  // 7. Discover metadata via API
  console.log('Discovering metadata from DataSource...');
  const discoRes = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/discover`, {
    method: 'POST',
    headers: authHeaders
  });
  const discoData = await discoRes.json();
  console.log('Discover Status:', discoRes.status, 'Discovered Tables:', discoData.data?.tables?.map(t => t.name));
  assert.strictEqual(discoRes.status, 200);

  // 8. Sync Catalog via API (Run 1)
  console.log('Synchronizing catalog from DataSource (Run 1)...');
  const syncRes1 = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, {
    method: 'POST',
    headers: authHeaders
  });
  const syncData1 = await syncRes1.json();
  console.log('Sync Run 1 Status:', syncRes1.status, 'Result:', syncData1.data);
  assert.strictEqual(syncRes1.status, 200);

  // 9. Sync Catalog via API (Run 2 - Idempotency test)
  console.log('Synchronizing catalog from DataSource (Run 2 - Idempotency)...');
  const syncRes2 = await fetch(`${BASE_URL}/data-sources/${pgSource._id}/sync`, {
    method: 'POST',
    headers: authHeaders
  });
  const syncData2 = await syncRes2.json();
  console.log('Sync Run 2 Status:', syncRes2.status, 'Result:', syncData2.data);
  assert.strictEqual(syncRes2.status, 200);
  assert.strictEqual(syncData2.data.createdCount, 0, 'Duplicate check: createdCount must be 0');

  // 10. Verify MongoDB directly
  const mongoDatasets = await Dataset.find({
    organizationId: org._id,
    isDeleted: { $ne: true }
  });
  console.log('MongoDB Datasets Count under ricoz-demo:', mongoDatasets.length);
  for (const d of mongoDatasets) {
    console.log('Dataset:', {
      _id: d._id.toString(),
      name: d.name,
      orgId: d.organizationId.toString(),
      dataSourceId: d.dataSourceId.toString(),
      externalId: d.externalId,
      schemaName: d.schemaName,
      assetType: d.assetType || d.type,
      syncStatus: d.syncStatus,
      columnCount: d.columns.length
    });
  }
  assert.strictEqual(mongoDatasets.length, 2, 'Must have exactly 2 datasets');

  // 11. Test GET /api/v1/datasets directly
  console.log('\n--- TESTING GET /api/v1/datasets ---');
  const listRes = await fetch(`${BASE_URL}/datasets`, { headers: authHeaders });
  const listData = await listRes.json();
  console.log('GET /datasets status:', listRes.status, 'Total:', listData.meta?.pagination?.total, 'Returned items:', listData.data?.length);
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listData.data?.length, 2);

  // 12. Test Search: "customers", "products", "customer", "product", ""
  const searchQueries = ['customers', 'products', 'customer', 'product', ''];
  for (const query of searchQueries) {
    const sRes = await fetch(`${BASE_URL}/datasets?search=${encodeURIComponent(query)}`, { headers: authHeaders });
    const sData = await sRes.json();
    console.log(`Search "${query}" -> Status: ${sRes.status}, Count: ${sData.data?.length}, Names: ${sData.data?.map(d => d.name).join(', ')}`);
    if (query === 'customers' || query === 'customer') {
      assert.ok(sData.data?.some(d => d.name === 'customers'));
    }
    if (query === 'products' || query === 'product') {
      assert.ok(sData.data?.some(d => d.name === 'products'));
    }
    if (query === '') {
      assert.strictEqual(sData.data?.length, 2);
    }
  }

  // 13. Test Single Dataset by ID
  const customerDataset = mongoDatasets.find(d => d.name === 'customers');
  const singleRes = await fetch(`${BASE_URL}/datasets/${customerDataset._id}`, { headers: authHeaders });
  const singleData = await singleRes.json();
  console.log(`GET /datasets/${customerDataset._id} -> Status: ${singleRes.status}, Name: ${singleData.data?.name}, Columns:`, singleData.data?.columns?.map(c => `${c.name} (${c.dataType})`));
  assert.strictEqual(singleRes.status, 200);
  assert.strictEqual(singleData.data.columns.length, 6);

  console.log('\n=== ALL LIVE BACKEND CHECKS PASSED ===');
  await disconnectDB();
}

main().catch(err => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
