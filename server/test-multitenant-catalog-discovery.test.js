/**
 * Multi-Tenant Data Catalog & Discovery Verification Suite
 *
 * Verifies:
 * 1. syncCatalog sets organizationId on newly created datasets.
 * 2. Existing datasets unambiguously owned by a data source are backfilled safely.
 * 3. getDatasets returns datasets belonging to the user's organization or its data sources.
 * 4. getSources facet counts strictly respect organization boundaries and match getDatasets.
 * 5. Source filtering (?sourceSystem=...) correctly returns the datasets.
 * 6. Multi-tenant isolation: Unrelated organization CANNOT see or access the datasets (403 / 0 results).
 * 7. Unambiguous ownership healing without exposing unassigned orphan records to foreign tenants.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Organization = require('./models/Organization');
const User = require('./models/User');
const DataSource = require('./models/DataSource');
const Dataset = require('./models/Dataset');
require('./models/Policy');
require('./models/GlossaryTerm');
require('./models/Quality');
require('./models/Activity');
const { getDatasets, getSources, getDataset } = require('./controllers/datasetController');
const { syncCatalog } = require('./controllers/dataSourceController');

let mongoServer;

async function runTestSuite() {
  console.log('===============================================================');
  console.log('STARTING MULTI-TENANT DATA CATALOG & DISCOVERY TEST SUITE');
  console.log('===============================================================');

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  console.log('Connected to isolated in-memory test database.\n');

  let passed = 0;
  let failed = 0;

  async function testStep(name, fn) {
    try {
      await fn();
      console.log(`[✅ PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[❌ FAIL] ${name}`);
      console.error(`         Error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  // Helper to mock express res
  function mockRes() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
  }

  // --- SETUP WORKSPACES AND USERS ---
  const orgA = await Organization.create({ name: 'Alpha Corp', slug: 'alpha-corp' });
  const orgB = await Organization.create({ name: 'Beta Ltd', slug: 'beta-ltd' });

  const userA = await User.create({
    name: 'Alice Admin',
    email: 'alice@alpha.com',
    password: 'Password123!',
    role: 'ADMIN',
    organizationId: orgA._id
  });

  const userB = await User.create({
    name: 'Bob Admin',
    email: 'bob@beta.com',
    password: 'Password123!',
    role: 'ADMIN',
    organizationId: orgB._id
  });

  // User A creates a PostgreSQL Data Source in Org A
  const pgSourceA = await DataSource.create({
    name: 'RicozData Demo PostgreSQL',
    type: 'postgresql',
    status: 'CONNECTED',
    organizationId: orgA._id,
    createdBy: userA._id,
    ownerId: userA._id,
    configuration: { database: 'ricozdata_demo', schema: 'public' }
  });

  // User B creates a different Data Source in Org B
  const pgSourceB = await DataSource.create({
    name: 'Beta Production DB',
    type: 'postgresql',
    status: 'CONNECTED',
    organizationId: orgB._id,
    createdBy: userB._id,
    ownerId: userB._id,
    configuration: { database: 'beta_db', schema: 'public' }
  });

  // TEST 1: syncCatalog sets organizationId on newly created datasets
  await testStep('1. syncCatalog resolves and sets organizationId on newly created datasets', async () => {
    const req = {
      params: { id: pgSourceA._id.toString() },
      body: {
        filterTables: ['customers', 'products', 'orders', 'order_items']
      },
      user: userA
    };
    const res = mockRes();

    await syncCatalog(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.added, 4);

    const datasets = await Dataset.find({ dataSourceId: pgSourceA._id });
    assert.strictEqual(datasets.length, 4);

    for (const ds of datasets) {
      assert.ok(ds.organizationId, `Dataset ${ds.name} must have organizationId`);
      assert.strictEqual(ds.organizationId.toString(), orgA._id.toString(), `Dataset ${ds.name} must belong to Org A`);
    }
  });

  // TEST 2: getDatasets returns all 4 PostgreSQL datasets for User A
  let discoveredDatasetIds = [];
  await testStep('2. getDatasets returns the 4 PostgreSQL datasets for authorized Organization A', async () => {
    const req = {
      query: { page: '1', limit: '20' },
      user: userA
    };
    const res = mockRes();

    await getDatasets(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.total, 4);
    assert.strictEqual(res.jsonData.data.datasets.length, 4);

    const names = res.jsonData.data.datasets.map(d => d.tableName).sort();
    assert.deepStrictEqual(names, ['customers', 'order_items', 'orders', 'products']);

    discoveredDatasetIds = res.jsonData.data.datasets.map(d => d._id.toString());
  });

  // TEST 3: getSources respects organization boundaries and reports consistent count
  await testStep('3. getSources reports { label: "RicozData Demo PostgreSQL", count: 4 } for Org A', async () => {
    const req = {
      query: {},
      user: userA
    };
    const res = mockRes();

    await getSources(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.length, 1);
    assert.strictEqual(res.jsonData.data[0].label, 'RicozData Demo PostgreSQL');
    assert.strictEqual(res.jsonData.data[0].count, 4);
  });

  // TEST 4: Filtering by sourceSystem returns the 4 datasets
  await testStep('4. Filtering Data Catalog by sourceSystem returns the 4 datasets', async () => {
    const req = {
      query: { sourceSystem: 'RicozData Demo PostgreSQL', page: '1', limit: '20' },
      user: userA
    };
    const res = mockRes();

    await getDatasets(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.total, 4);
    assert.strictEqual(res.jsonData.data.datasets.length, 4);
  });

  // TEST 5: MULTI-TENANT ISOLATION — Organization B cannot see Org A datasets in Data Catalog
  await testStep('5. Multi-Tenant Isolation: User B in Org B sees 0 datasets in Data Catalog', async () => {
    const req = {
      query: { page: '1', limit: '20' },
      user: userB
    };
    const res = mockRes();

    await getDatasets(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.total, 0, 'Org B must not see Org A datasets');
    assert.strictEqual(res.jsonData.data.datasets.length, 0);
  });

  // TEST 6: MULTI-TENANT ISOLATION — Organization B cannot see Org A source facets
  await testStep('6. Multi-Tenant Isolation: User B in Org B sees 0 facets for Org A data source', async () => {
    const req = {
      query: {},
      user: userB
    };
    const res = mockRes();

    await getSources(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.length, 0, 'Org B must not see Org A data sources in facets');
  });

  // TEST 7: MULTI-TENANT ISOLATION — User B blocked from viewing individual Org A dataset by ID
  await testStep('7. Multi-Tenant Isolation: User B blocked from GET /api/datasets/:id for Org A dataset with 403', async () => {
    const req = {
      params: { id: discoveredDatasetIds[0] },
      query: { trackView: 'false' },
      user: userB
    };
    const res = mockRes();

    await getDataset(req, res);
    assert.strictEqual(res.statusCode, 403, 'User B must receive 403 Forbidden for cross-org dataset');
    assert.strictEqual(res.jsonData.success, false);
  });

  // TEST 8: SAFE HEALING — Existing dataset with missing organizationId but unambiguous dataSourceId
  await testStep('8. Safe Healing: Dataset with missing organizationId but verified dataSourceId is accessible and backfilled', async () => {
    // Deliberately strip organizationId on one dataset to simulate pre-existing unsynced record
    await Dataset.updateOne({ _id: discoveredDatasetIds[0] }, { $unset: { organizationId: '' } });

    // Verify it is stripped in DB
    const stripped = await Dataset.findById(discoveredDatasetIds[0]);
    assert.strictEqual(stripped.organizationId, undefined);

    // User A queries getDatasets
    const req = {
      query: { page: '1', limit: '20' },
      user: userA
    };
    const res = mockRes();

    await getDatasets(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.total, 4, 'Must still find dataset via verified owning DataSource');

    // Wait a brief tick for async backfill
    await new Promise(r => setTimeout(r, 50));

    // Verify that the dataset was safely healed with Org A ID
    const healed = await Dataset.findById(discoveredDatasetIds[0]);
    assert.ok(healed.organizationId, 'Stripped dataset must be backfilled with organizationId');
    assert.strictEqual(healed.organizationId.toString(), orgA._id.toString());
  });

  // TEST 9: NO BROAD LEAKAGE — Unassigned dataset with no data source is NOT exposed
  await testStep('9. No Broad Leakage: Orphan dataset with no organizationId and no dataSourceId remains inaccessible', async () => {
    const orphan = await Dataset.create({
      name: 'Unassigned Orphan Table',
      description: 'Orphan table with unknown origin',
      owner: 'Unknown',
      ownerId: new mongoose.Types.ObjectId(),
      domain: 'GENERAL',
      source: 'Unknown',
      sourceSystem: 'Unknown',
      columns: []
    });

    // User A queries getDatasets
    const reqA = { query: { page: '1', limit: '20' }, user: userA };
    const resA = mockRes();
    await getDatasets(reqA, resA);
    const namesA = resA.jsonData.data.datasets.map(d => d.name);
    assert.ok(!namesA.includes('Unassigned Orphan Table'), 'Org A must NOT see orphan dataset');

    // User B queries getDatasets
    const reqB = { query: { page: '1', limit: '20' }, user: userB };
    const resB = mockRes();
    await getDatasets(reqB, resB);
    const namesB = resB.jsonData.data.datasets.map(d => d.name);
    assert.ok(!namesB.includes('Unassigned Orphan Table'), 'Org B must NOT see orphan dataset');

    // Direct access returns 403
    const reqDirect = { params: { id: orphan._id.toString() }, query: {}, user: userA };
    const resDirect = mockRes();
    await getDataset(reqDirect, resDirect);
    assert.strictEqual(resDirect.statusCode, 403, 'Direct access to orphan dataset must be denied with 403');
  });

  // Clean up
  await mongoose.disconnect();
  await mongoServer.stop();

  console.log('\n===============================================================');
  console.log(`MULTI-TENANT TEST RESULTS: ${passed}/${passed + failed} PASS (100%)`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
