const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function runTest() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata');
  const DataSource = require('../models/DataSource');
  const Dataset = require('../models/Dataset');
  const Lineage = require('../models/Lineage');
  const User = require('../models/User');

  const pgSource = await DataSource.findOne({ name: /ricoz demo postgresql/i }).select('+credentials');
  if (!pgSource) {
    throw new Error('Ricoz Demo PostgreSQL source not found');
  }

  const adminUser = await User.findOne({ status: 'ACTIVE' });
  console.log('✓ Found DataSource:', pgSource.name, pgSource._id);

  // 1. Invoke syncCatalog
  const { syncCatalog } = require('../controllers/dataSourceController');
  const req = {
    params: { id: pgSource._id },
    body: { tables: ['customers', 'dq_quality_test', 'orders', 'payments', 'products'] },
    user: adminUser
  };

  let syncResult = null;
  const res = {
    json: (payload) => { syncResult = payload; return res; },
    status: (code) => { console.log('Sync status code:', code); return res; }
  };

  console.log('\n--- Running Initial DataSource Sync ---');
  await syncCatalog(req, res);
  console.log('Sync response:', syncResult?.data?.message || syncResult);

  // 2. Verify Lineage Records in MongoDB
  const datasets = await Dataset.find({ dataSourceId: pgSource._id });
  console.log(`\n--- Verifying Lineage for ${datasets.length} Datasets ---`);

  for (const ds of datasets) {
    const lineage = await Lineage.findOne({ datasetId: ds._id });
    console.log(`\nDataset: "${ds.name}" (table: ${ds.tableName})`);
    if (!lineage) {
      console.log('  ❌ NO LINEAGE RECORD FOUND!');
      continue;
    }
    console.log(`  Nodes count: ${lineage.nodes?.length}`);
    lineage.nodes.forEach(n => {
      console.log(`    - [${n.data?.category}] ${n.data?.label} (type: ${n.data?.typeLabel}, isPrimary: ${!!n.data?.isPrimary})`);
    });
    console.log(`  Edges count: ${lineage.edges?.length}`);
    lineage.edges.forEach(e => {
      console.log(`    - ${e.source} -> ${e.target} (${e.data?.relationshipType}) evidence: "${e.data?.evidence || ''}"`);
    });
    console.log(`  Source Datasets:`, lineage.sourceDatasets);
    console.log(`  Destination Datasets:`, lineage.destinationDatasets);
    console.log(`  Transformation Info:`, lineage.transformationInfo);
  }

  // 3. Verify Idempotency on repeated sync
  console.log('\n--- Running Second DataSource Sync (Idempotency Test) ---');
  await syncCatalog(req, res);

  for (const ds of datasets) {
    const lineage = await Lineage.findOne({ datasetId: ds._id });
    const nodeIds = lineage.nodes.map(n => n.id);
    const edgeIds = lineage.edges.map(e => e.id);
    const uniqueNodeIds = new Set(nodeIds);
    const uniqueEdgeIds = new Set(edgeIds);

    if (nodeIds.length !== uniqueNodeIds.size) {
      console.error(`  ❌ Duplicate nodes found in dataset ${ds.name}!`);
    } else {
      console.log(`  ✓ ${ds.name}: Nodes deduplicated and unique (${nodeIds.length} nodes).`);
    }

    if (edgeIds.length !== uniqueEdgeIds.size) {
      console.error(`  ❌ Duplicate edges found in dataset ${ds.name}!`);
    } else {
      console.log(`  ✓ ${ds.name}: Edges deduplicated and unique (${edgeIds.length} edges).`);
    }
  }

  // 4. Test GET /api/lineage/:datasetId via HTTP
  console.log('\n--- Testing Lineage API Endpoint for Customers and Orders ---');
  const token = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET || 'super-secret-jwt-key-1234567890');
  
  const ordersDs = datasets.find(d => d.tableName === 'orders');
  const customersDs = datasets.find(d => d.tableName === 'customers');
  const dqDs = datasets.find(d => d.tableName === 'dq_quality_test');

  const ordersRes = await fetch(`http://localhost:5000/api/lineage/${ordersDs._id}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const ordersData = await ordersRes.json();
  console.log('Orders API success:', ordersData.success, 'nodes:', ordersData.data?.nodes?.length, 'edges:', ordersData.data?.edges?.length);

  const dqRes = await fetch(`http://localhost:5000/api/lineage/${dqDs._id}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  const dqData = await dqRes.json();
  console.log('Dq Quality Test API success:', dqData.success, 'nodes:', dqData.data?.nodes?.length, 'edges:', dqData.data?.edges?.length);

  await mongoose.disconnect();
}

runTest().catch(console.error);
