const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DEMO_DATASET_NAMES = [
  'Customer Master',
  'Customer Transactions',
  'Sales Orders',
  'Sales Analytics',
  'Product Master',
  'Inventory',
  'Employee Records',
  'Finance Transactions',
  'Marketing Campaigns',
  'Marketing Leads'
];

const DEMO_COLLECTIONS = [
  'customer_master',
  'customer_transactions',
  'sales_orders',
  'sales_analytics',
  'product_master',
  'inventory',
  'employee_records',
  'finance_transactions',
  'marketing_campaigns',
  'marketing_leads'
];

const DEMO_POLICY_NAMES = [
  'PII Data Access Policy',
  'Data Retention Policy',
  'Sensitive Data Masking Policy',
  'External Data Sharing Policy',
  'Data Quality Threshold Policy',
  'Access Review Policy',
  'Production Data Usage Policy'
];

const DEMO_GLOSSARY_TERMS = [
  'Active Customer',
  'Churn Rate',
  'Customer Lifetime Value',
  'Net Revenue',
  'Gross Revenue',
  'Order Fulfillment Rate',
  'Average Order Value',
  'Customer Acquisition Cost',
  'Monthly Active Users',
  'Inventory Turnover',
  'Data Owner',
  'Data Steward',
  'Personally Identifiable Information',
  'Critical Data Element'
];

async function purgeDemoData(execute = false) {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ricozdata';
  console.log(`[Purge] Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. Check Data Sources - MUST preserve Bus Booking PostgreSQL
  const dataSources = await db.collection('datasources').find({}).toArray();
  console.log(`[Data Sources] Found ${dataSources.length} data source(s):`);
  dataSources.forEach(ds => console.log(`  - ${ds.name} (${ds.type}) [ID: ${ds._id}]`));

  const busBookingSource = dataSources.find(ds => ds.name === 'Bus Booking PostgreSQL');
  if (!busBookingSource) {
    throw new Error('FATAL: "Bus Booking PostgreSQL" data source not found! Aborting purge.');
  }

  // 2. Identify Demo Datasets vs Real Datasets
  const allDatasets = await db.collection('datasets').find({}).toArray();
  const demoDatasets = allDatasets.filter(d => DEMO_DATASET_NAMES.includes(d.name));
  const realDatasets = allDatasets.filter(d => !DEMO_DATASET_NAMES.includes(d.name));

  console.log(`[Datasets] Total: ${allDatasets.length} | Demo to remove: ${demoDatasets.length} | Real to PRESERVE: ${realDatasets.length}`);
  realDatasets.forEach(d => console.log(`  PRESERVED: "${d.name}" (source: ${d.source}) [ID: ${d._id}]`));

  const demoDatasetIds = demoDatasets.map(d => d._id);

  // 3. Demo collections to drop
  const existingCols = (await db.listCollections().toArray()).map(c => c.name);
  const collectionsToDrop = DEMO_COLLECTIONS.filter(name => existingCols.includes(name));
  console.log(`[Underlying Mock Collections] ${collectionsToDrop.length} found to drop:`, collectionsToDrop);

  // 4. Lineages, Qualities, Rules, Issues, Activities
  const demoLineages = await db.collection('lineages').countDocuments({ datasetId: { $in: demoDatasetIds } });
  const realLineages = await db.collection('lineages').countDocuments({ datasetId: { $nin: demoDatasetIds } });

  const demoQualities = await db.collection('qualities').countDocuments({ datasetId: { $in: demoDatasetIds } });
  const realQualities = await db.collection('qualities').countDocuments({ datasetId: { $nin: demoDatasetIds } });

  const demoRules = await db.collection('rules').countDocuments({ datasetId: { $in: demoDatasetIds } });
  const realRules = await db.collection('rules').countDocuments({ datasetId: { $nin: demoDatasetIds } });

  const demoIssues = await db.collection('qualityissues').countDocuments({ datasetId: { $in: demoDatasetIds } });
  const realIssues = await db.collection('qualityissues').countDocuments({ datasetId: { $nin: demoDatasetIds } });

  const demoActivities = await db.collection('activities').countDocuments({ datasetId: { $in: demoDatasetIds } });
  const realActivities = await db.collection('activities').countDocuments({ datasetId: { $nin: demoDatasetIds } });

  const demoPolicies = await db.collection('policies').countDocuments({ name: { $in: DEMO_POLICY_NAMES } });
  const demoGlossary = await db.collection('glossaryterms').countDocuments({ term: { $in: DEMO_GLOSSARY_TERMS } });

  console.log('[Entity Breakdown]');
  console.log(`  Lineages: ${demoLineages} demo to remove, ${realLineages} real preserved`);
  console.log(`  Qualities: ${demoQualities} demo to remove, ${realQualities} real preserved`);
  console.log(`  Rules: ${demoRules} demo to remove, ${realRules} real preserved`);
  console.log(`  Issues: ${demoIssues} demo to remove, ${realIssues} real preserved`);
  console.log(`  Activities: ${demoActivities} demo to remove, ${realActivities} real preserved`);
  console.log(`  Policies: ${demoPolicies} demo to remove`);
  console.log(`  Glossary Terms: ${demoGlossary} demo to remove`);

  if (!execute) {
    console.log('\n[DRY RUN ONLY] No changes were made. Pass --execute to perform purge.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n[EXECUTING SAFE PURGE]...');

  // Delete demo datasets
  if (demoDatasetIds.length > 0) {
    const res = await db.collection('datasets').deleteMany({ _id: { $in: demoDatasetIds } });
    console.log(`  Deleted ${res.deletedCount} demo datasets.`);
  }

  // Drop demo mock collections
  for (const colName of collectionsToDrop) {
    await db.collection(colName).drop();
    console.log(`  Dropped mock collection: ${colName}`);
  }

  // Delete demo lineages, qualities, rules, issues, activities
  if (demoDatasetIds.length > 0) {
    const lRes = await db.collection('lineages').deleteMany({ datasetId: { $in: demoDatasetIds } });
    console.log(`  Deleted ${lRes.deletedCount} demo lineages.`);

    const qRes = await db.collection('qualities').deleteMany({ datasetId: { $in: demoDatasetIds } });
    console.log(`  Deleted ${qRes.deletedCount} demo qualities.`);

    const rRes = await db.collection('rules').deleteMany({ datasetId: { $in: demoDatasetIds } });
    console.log(`  Deleted ${rRes.deletedCount} demo rules.`);

    const iRes = await db.collection('qualityissues').deleteMany({ datasetId: { $in: demoDatasetIds } });
    console.log(`  Deleted ${iRes.deletedCount} demo quality issues.`);

    const aRes = await db.collection('activities').deleteMany({ datasetId: { $in: demoDatasetIds } });
    console.log(`  Deleted ${aRes.deletedCount} demo activities.`);
  }

  // Delete demo policies and glossary terms
  const pRes = await db.collection('policies').deleteMany({ name: { $in: DEMO_POLICY_NAMES } });
  console.log(`  Deleted ${pRes.deletedCount} demo policies.`);

  const gRes = await db.collection('glossaryterms').deleteMany({ term: { $in: DEMO_GLOSSARY_TERMS } });
  console.log(`  Deleted ${gRes.deletedCount} demo glossary terms.`);

  console.log('\n[POST-PURGE VERIFICATION]');
  const remainingDatasets = await db.collection('datasets').find({}).toArray();
  console.log(`  Remaining datasets (${remainingDatasets.length}):`);
  remainingDatasets.forEach(d => console.log(`    - ${d.name} (${d.source})`));

  const remainingDS = await db.collection('datasources').find({}).toArray();
  console.log(`  Remaining data sources (${remainingDS.length}):`);
  remainingDS.forEach(ds => console.log(`    - ${ds.name} (${ds.type})`));

  await mongoose.disconnect();
  console.log('✅ Purge Completed Successfully.');
}

const shouldExecute = process.argv.includes('--execute');
purgeDemoData(shouldExecute).catch(err => {
  console.error('Purge error:', err);
  process.exit(1);
});
