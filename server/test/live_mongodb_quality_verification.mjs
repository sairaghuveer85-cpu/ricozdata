import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoDBConnector } from '../src/connectors/MongoDBConnector.js';
import { ConnectorContext } from '../src/connectors/ConnectorContext.js';

const MONGO_URI = 'mongodb://127.0.0.1:27017/ricozdata';
const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = 'super-secret-jwt-key-1234567890';

async function main() {
  console.log('================================================================');
  console.log('RICOZDATA REAL DATA QUALITY VERIFICATION — MONGODB');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Seed controlled test collection with deliberate defects
  const colName = 'dq_quality_test_mongo';
  await db.collection(colName).drop().catch(() => {});

  const badDocs = [
    { code: 'C01', email: 'not-an-email', status: 'INVALID', amount: -100, updated_at: new Date('2026-06-01') }, // customer_name missing
    { code: 'C02', email: 'not-an-email', status: 'UNKNOWN', amount: -50, updated_at: new Date('2026-06-05') }, // customer_name missing
    { code: 'C03', customer_name: null, email: null, status: 'WRONG', amount: null, updated_at: new Date('2026-07-01') },
    { code: 'C04', customer_name: null, email: null, status: 'PENDING', amount: null, updated_at: new Date('2026-07-01') },
    { code: 'C05', customer_name: null, email: 'abc', status: 'ACTIVE', amount: 150, updated_at: new Date('2026-07-05') },
    { code: 'C06', customer_name: null, email: 'abc', status: 'ACTIVE', amount: 200, updated_at: new Date('2026-07-05') },
    { code: 'C07', customer_name: 'Alice', email: 'alice@example.com', status: 'ACTIVE', amount: 300, updated_at: new Date('2026-07-10') },
    { code: 'C08', customer_name: 'Bob', email: 'bob@example.com', status: 'ACTIVE', amount: 400, updated_at: new Date('2026-07-10') },
    { code: 'C09', customer_name: 'Charlie', email: 'charlie@example.com', status: 'ACTIVE', amount: 500, updated_at: new Date('2026-07-10') },
    { code: 'C10', customer_name: 'David', email: 'david@example.com', status: 'ACTIVE', amount: 600, updated_at: new Date('2026-07-10') },
  ];

  await db.collection(colName).insertMany(badDocs);
  console.log(`[SETUP] Seeded 10 controlled test documents into MongoDB collection "${colName}"`);

  // 2. Direct connector profiling test
  console.log('\n[TEST 1] Testing MongoDBConnector.profileDataset & executeQualityRule pushdowns...');
  const context = new ConnectorContext({
    dataSourceId: 'mongo-source-1',
    organizationId: 'org-test',
    sourceType: 'mongodb',
    configuration: { host: '127.0.0.1', port: 27017, database: 'ricozdata' },
    credentials: {}
  });
  const connector = new MongoDBConnector(context);
  await connector.connect();

  const profile = await connector.profileDataset({
    tableName: colName,
    columns: [
      { name: 'customer_name', dataType: 'string' },
      { name: 'email', dataType: 'string' },
      { name: 'status', dataType: 'string' },
      { name: 'amount', dataType: 'number' },
      { name: 'updated_at', dataType: 'date' }
    ]
  });

  console.log(`Profile total rows: ${profile.rowCount}`);
  console.log(`Profile column count: ${profile.columns.length}`);

  const custCol = profile.columns.find(c => c.columnName === 'customer_name');
  console.log(`customer_name: missingCount=${custCol.missingCount}, explicitNullCount=${custCol.explicitNullCount}, totalNull=${custCol.nullCount}`);
  if (custCol.missingCount !== 2 || custCol.explicitNullCount !== 4 || custCol.nullCount !== 6) {
    throw new Error(`MongoDB missing vs null count mismatch: expected 2 missing, 4 explicit nulls, got ${custCol.missingCount} / ${custCol.explicitNullCount}`);
  }
  console.log('✓ PASS: MongoDB successfully distinguished missing fields from explicit null fields!');

  // Test regex rule pushdown on MongoDB
  const emailRuleRes = await connector.executeQualityRule({
    name: 'Email Format',
    ruleType: 'REGEX_PATTERN',
    targetColumn: 'email',
    configuration: { pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' }
  }, { tableName: colName });
  console.log(`Email regex rule: evaluated=${emailRuleRes.recordsEvaluated}, failed=${emailRuleRes.recordsFailed}, passed=${emailRuleRes.passed}`);
  if (emailRuleRes.recordsFailed !== 4) { // 2 'not-an-email', 2 'abc'
    throw new Error(`Expected 4 failing emails in MongoDB, got ${emailRuleRes.recordsFailed}`);
  }
  console.log('✓ PASS: MongoDB regex rule pushdown executed correctly (detected 4 invalid emails).');

  // Test range rule pushdown on MongoDB
  const rangeRuleRes = await connector.executeQualityRule({
    name: 'Non-Negative Amount',
    ruleType: 'VALUE_RANGE',
    targetColumn: 'amount',
    configuration: { min: 0 }
  }, { tableName: colName });
  console.log(`Amount range rule: evaluated=${rangeRuleRes.recordsEvaluated}, failed=${rangeRuleRes.recordsFailed}`);
  if (rangeRuleRes.recordsFailed !== 2) { // -100, -50
    throw new Error(`Expected 2 negative amounts in MongoDB, got ${rangeRuleRes.recordsFailed}`);
  }
  console.log('✓ PASS: MongoDB range rule pushdown executed correctly (detected 2 negative amounts).');

  await connector.disconnect();

  // 3. Register DataSource and Dataset in catalog to test full API flow
  console.log('\n[TEST 2] Registering MongoDB DataSource and Dataset in RicozData Catalog...');
  let ds = await db.collection('datasources').findOne({ name: 'Local MongoDB Demo' });
  if (!ds) {
    const dsInsert = await db.collection('datasources').insertOne({
      name: 'Local MongoDB Demo',
      type: 'mongodb',
      status: 'connected',
      configuration: { host: '127.0.0.1', port: 27017, database: 'ricozdata' },
      credentials: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });
    ds = { _id: dsInsert.insertedId, name: 'Local MongoDB Demo', type: 'mongodb' };
  } else {
    await db.collection('datasources').updateOne(
      { _id: ds._id },
      { $set: { configuration: { host: '127.0.0.1', port: 27017, database: 'ricozdata' } } }
    );
  }

  let dataset = await db.collection('datasets').findOne({ tableName: colName });
  if (!dataset) {
    const dsDoc = await db.collection('datasets').insertOne({
      name: 'MongoDB Quality Test',
      tableName: colName,
      dataSourceId: ds._id,
      source: ds.name,
      sourceSystem: ds.name,
      sourceType: 'mongodb',
      columns: [
        { name: 'code', dataType: 'string', primaryKey: true },
        { name: 'customer_name', dataType: 'string' },
        { name: 'email', dataType: 'string' },
        { name: 'status', dataType: 'string' },
        { name: 'amount', dataType: 'number' },
        { name: 'updated_at', dataType: 'date' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    dataset = { _id: dsDoc.insertedId, name: 'MongoDB Quality Test' };
  }

  const datasetId = dataset._id.toString();

  // 4. Trigger HTTP evaluation
  console.log(`\n[TEST 3] Triggering POST /api/quality/evaluate/${datasetId}...`);
  const token = jwt.sign(
    { id: '6ac258b135ae36221abe22d6', role: 'SUPER_ADMIN', email: 'raghuveer.chandran@ricoz-industries.demo' },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const evalRes = await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, {
    method: 'POST',
    headers
  });
  const evalData = await evalRes.json();
  console.log(`Status: ${evalRes.status}, Success: ${evalData.success}`);
  console.log(`Score: ${evalData.data?.score}%, Grade: ${evalData.data?.grade}`);

  const dims = evalData.data?.dimensions || [];
  for (const d of dims) {
    console.log(`  - ${d.name}: ${d.score !== null ? d.score + '%' : 'NOT ASSESSED'} [${d.status}]`);
  }

  if (evalData.data?.score === 100) {
    throw new Error('FAILURE: Quality score is fake 100% on bad MongoDB data!');
  }
  console.log('✓ PASS: MongoDB quality score evaluated accurately from real MongoDB documents!');

  // 5. Verify issues generated
  console.log('\n[TEST 4] Verifying Quality Issues generated for MongoDB...');
  const issuesRes = await fetch(`${BASE_URL}/quality/issues?datasetId=${datasetId}`, { headers });
  const issuesData = await issuesRes.json();
  const issues = (issuesData.data || []).filter(i => String(i.datasetId?._id || i.datasetId) === datasetId);
  console.log(`Found ${issues.length} issues in MongoDB dataset:`);
  for (const iss of issues) {
    console.log(`  - [${iss.severity.toUpperCase()}] ${iss.field} (${iss.dimension}): ${iss.issue}`);
  }
  if (issues.length === 0) {
    throw new Error('Expected quality issues for bad MongoDB data, found 0');
  }
  console.log('✓ PASS: Quality issues successfully persisted for MongoDB defects.');

  // 6. Fix bad records in MongoDB and test re-evaluation reactivity
  console.log('\n[TEST 5] Fixing customer_name and amounts in MongoDB and re-evaluating...');
  await db.collection(colName).updateMany(
    {},
    { $set: { customer_name: 'Fixed Customer' } }
  );
  await db.collection(colName).updateMany(
    { amount: { $lt: 0 } },
    { $set: { amount: 100 } }
  );

  const evalRes2 = await fetch(`${BASE_URL}/quality/evaluate/${datasetId}`, {
    method: 'POST',
    headers
  });
  const evalData2 = await evalRes2.json();
  console.log(`New Score: ${evalData2.data?.score}% (was ${evalData.data?.score}%)`);
  if (evalData2.data?.score <= evalData.data?.score) {
    throw new Error('Score did not improve after fixing bad documents!');
  }
  console.log('✓ PASS: MongoDB Data Quality is dynamic and reacted truthfully to live MongoDB database updates!');

  // Cleanup test collection
  await db.collection(colName).drop().catch(() => {});
  console.log('\n================================================================');
  console.log('ALL MONGODB DATA QUALITY TESTS PASSED SUCCESSFULLY');
  console.log('================================================================');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
