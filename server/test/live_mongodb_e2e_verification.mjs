import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const API_BASE = 'http://localhost:5000/api';
const TARGET_DB = 'customer_store';
const TARGET_COL = 'customers';

async function runLiveVerification() {
  console.log('================================================================');
  console.log('🚀 RicozData — Live MongoDB End-to-End Integration Verification');
  console.log('================================================================\n');

  // STEP 1 & 2 & 3 & 4: Ensure target database, collection, and test documents
  console.log('Step 1-4: Preparing external MongoDB database & collection...');
  const externalClient = new MongoClient('mongodb://127.0.0.1:27017');
  await externalClient.connect();
  const extDb = externalClient.db(TARGET_DB);

  const collections = await extDb.listCollections({ name: TARGET_COL }).toArray();
  if (collections.length === 0) {
    await extDb.createCollection(TARGET_COL);
  }
  const col = extDb.collection(TARGET_COL);
  let count = await col.countDocuments();
  if (count === 0) {
    await col.insertMany([
      { name: 'Aarav Patel', email: 'aarav.patel@example.com', tier: 'platinum', active: true, balance: 2540.75, signupDate: new Date('2024-01-15T08:30:00Z'), tags: ['vip', 'cloud'] },
      { name: 'Diya Sharma', email: 'diya.sharma@example.com', tier: 'gold', active: true, balance: 1200.00, signupDate: new Date('2024-03-20T10:15:00Z'), tags: ['enterprise'] },
      { name: 'Karan Verma', email: 'karan.verma@example.com', tier: 'silver', active: false, balance: 450.50, signupDate: new Date('2024-05-10T14:45:00Z'), tags: ['retail'] }
    ]);
    count = await col.countDocuments();
  }
  console.log(`   ✓ External MongoDB: Database="${TARGET_DB}", Collection="${TARGET_COL}", Documents=${count}`);

  // Connect to internal RicozData DB to get admin token
  const internalUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
  await mongoose.connect(internalUri);
  const user = await mongoose.connection.db.collection('users').findOne({});
  if (!user) throw new Error('No user found in platform');

  const token = jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_SECRET || 'super-secret-jwt-key-1234567890',
    { expiresIn: '1h' }
  );
  console.log(`   ✓ Authenticated as ${user.email} (User ID: ${user._id})`);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // STEP 5: Test Connection (In-Flight / Transient)
  console.log('\nStep 5: Testing in-flight MongoDB connection via API (POST /api/data-sources/test)...');
  const testPayload = {
    name: 'Customer Store MongoDB',
    type: 'mongodb',
    configuration: {
      host: '127.0.0.1',
      port: 27017,
      database: TARGET_DB,
      authSource: 'admin',
      connectTimeout: 5000
    }
  };

  const transientRes = await fetch(`${API_BASE}/data-sources/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify(testPayload)
  });
  const transientData = await transientRes.json();
  if (!transientData.success || !transientData.data?.connected) {
    throw new Error(`Transient test failed: ${JSON.stringify(transientData)}`);
  }
  console.log(`   ✓ Transient Connection: SUCCESS (Status: ${transientData.data.status}, Latency: ${transientData.data.latencyMs}ms)`);

  // STEP 6: Create MongoDB Data Source in RicozData
  console.log('\nStep 6: Registering MongoDB Data Source (POST /api/data-sources)...');
  const createRes = await fetch(`${API_BASE}/data-sources`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...testPayload,
      description: 'Production customer profiles document database',
      tags: ['production', 'customers', 'mongodb']
    })
  });
  const createData = await createRes.json();
  if (!createData.success) {
    throw new Error(`Create data source failed: ${JSON.stringify(createData)}`);
  }
  const dataSourceId = createData.data._id || createData.data.id;
  console.log(`   ✓ Data Source Created: ID=${dataSourceId}, Name="${createData.data.name}", Type=${createData.data.type}`);

  // Test persisted connection
  console.log('\nStep 6b: Testing persisted connection (POST /api/data-sources/:id/test)...');
  const persistTestRes = await fetch(`${API_BASE}/data-sources/${dataSourceId}/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const persistTestData = await persistTestRes.json();
  if (!persistTestData.success) {
    throw new Error(`Persisted test failed: ${JSON.stringify(persistTestData)}`);
  }
  console.log(`   ✓ Persisted Connection Test: HEALTHY (Latency: ${persistTestData.data.latencyMs}ms)`);

  // STEP 7: Discover actual collections
  console.log('\nStep 7: Discovering collections & BSON metadata (POST /api/data-sources/:id/discover)...');
  const discoverRes = await fetch(`${API_BASE}/data-sources/${dataSourceId}/discover`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const discoverData = await discoverRes.json();
  if (!discoverData.success) {
    throw new Error(`Discovery failed: ${JSON.stringify(discoverData)}`);
  }

  const assets = discoverData.data.assets || [];
  console.log(`   ✓ Discovered Assets Count: ${assets.length}`);
  const customerAsset = assets.find(a => a.name === TARGET_COL);
  if (!customerAsset) {
    throw new Error(`Collection ${TARGET_COL} not found in discovery output`);
  }

  console.log(`   ✓ Collection Name: "${customerAsset.name}"`);
  console.log(`   ✓ Collection Type: "${customerAsset.type}"`);
  console.log(`   ✓ Database / Schema: "${customerAsset.schema}"`);
  console.log(`   ✓ Observed Document Count: ${customerAsset.rowCount}`);
  console.log(`   ✓ Discovered Fields (${customerAsset.columns.length}):`);
  customerAsset.columns.forEach(f => {
    console.log(`       - ${f.name} [BSON: ${f.dataType || f.type}] ${f.isPrimaryKey ? '(PRIMARY KEY)' : ''}`);
  });
  console.log(`   ✓ Indexes (${customerAsset.indexes.length}):`, customerAsset.indexes.map(i => i.name).join(', '));

  // STEP 8: Sync collection to Data Catalog
  console.log('\nStep 8: Synchronizing collection to Data Catalog (POST /api/data-sources/:id/sync)...');
  const syncRes = await fetch(`${API_BASE}/data-sources/${dataSourceId}/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filterTables: [TARGET_COL] })
  });
  const syncData = await syncRes.json();
  if (!syncData.success) {
    throw new Error(`Catalog sync failed: ${JSON.stringify(syncData)}`);
  }
  console.log(`   ✓ Catalog Synchronization: Added=${syncData.data.added}, Updated=${syncData.data.updatedCount || 0}, Total=${syncData.data.total}`);

  // STEP 9: View dataset in Data Catalog
  console.log('\nStep 9: Verifying catalog dataset & metadata in Data Catalog...');
  const catalogDataset = await mongoose.connection.db.collection('datasets').findOne({
    dataSourceId: new mongoose.Types.ObjectId(dataSourceId),
    tableName: TARGET_COL
  });
  if (!catalogDataset) {
    throw new Error('Dataset not found in catalog');
  }
  console.log(`   ✓ Catalog Dataset ID: ${catalogDataset._id}`);
  console.log(`   ✓ Dataset Name: "${catalogDataset.name}"`);
  console.log(`   ✓ Source: "${catalogDataset.source}"`);
  console.log(`   ✓ Source Type: "${catalogDataset.sourceType}"`);
  console.log(`   ✓ Dataset Type: "${catalogDataset.type}" (Document Collection)`);
  console.log(`   ✓ Document Row Count: ${catalogDataset.rowCount}`);
  console.log(`   ✓ Schema Columns Count: ${catalogDataset.columns?.length}`);

  // STEP 10: Safe deletion - verify external database intact
  console.log('\nStep 10: Removing catalog dataset registration & verifying external DB intact...');
  await mongoose.connection.db.collection('datasets').deleteOne({ _id: catalogDataset._id });
  console.log(`   ✓ Catalog dataset ${catalogDataset._id} removed from RicozData catalog.`);

  const postDeleteDocsCount = await col.countDocuments();
  console.log(`   ✓ External MongoDB Document Count After Catalog Deletion: ${postDeleteDocsCount}`);
  if (postDeleteDocsCount !== 3) {
    throw new Error(`Expected 3 external documents, but found ${postDeleteDocsCount}`);
  }
  console.log('   ✓ Confirmation: External MongoDB collection and documents remain completely INTACT!');

  // STEP 11: Verify PostgreSQL Bus Booking data remains untouched
  console.log('\nStep 11: Verifying Bus Booking PostgreSQL & Customers table integrity...');
  const pgDs = await mongoose.connection.db.collection('datasources').findOne({ name: 'Bus Booking PostgreSQL' });
  if (!pgDs) throw new Error('Bus Booking PostgreSQL data source was deleted!');
  console.log(`   ✓ Bus Booking PostgreSQL DataSource: Status=${pgDs.status}, Host=${pgDs.configuration?.host}`);

  const pgCustDataset = await mongoose.connection.db.collection('datasets').findOne({
    _id: new mongoose.Types.ObjectId('6ac267d2b3d60764649d5dbb')
  });
  if (!pgCustDataset) throw new Error('Bus Booking Customers dataset was lost!');
  console.log(`   ✓ Bus Booking Customers Dataset: Name="${pgCustDataset.name}", Records=${pgCustDataset.rowCount}, Source="${pgCustDataset.source}"`);

  // Cleanup test data source
  await fetch(`${API_BASE}/data-sources/${dataSourceId}`, {
    method: 'DELETE',
    headers
  });
  console.log(`   ✓ Cleaned up temporary Data Source ${dataSourceId}.`);

  await externalClient.close();
  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('🎉 ALL 10 LIVE MONGODB INTEGRATION STEPS COMPLETED & VERIFIED!');
  console.log('================================================================\n');
}

runLiveVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
