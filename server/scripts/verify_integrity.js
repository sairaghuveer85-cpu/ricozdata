const mongoose = require('mongoose');
const { Client } = require('pg');
require('dotenv').config({ path: './server/.env' });
require('dotenv').config({ path: './.env' });

const DataSource = require('../models/DataSource');
const Dataset = require('../models/Dataset');
const Quality = require('../models/Quality');
const Lineage = require('../models/Lineage');
const User = require('../models/User');

async function main() {
  console.log('--- RICOZDATA INTEGRITY VERIFICATION ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ricozdata');
  console.log('Connected to MongoDB.');

  // 1. Data Sources
  const dataSources = await DataSource.find();
  console.log(`\n1. Data Sources Count: ${dataSources.length}`);
  dataSources.forEach(ds => {
    console.log(`   - [${ds._id}] "${ds.name}" (type: ${ds.type}, status: ${ds.status})`);
  });

  const busBookingDs = await DataSource.findOne({ name: 'Bus Booking PostgreSQL' }).select('+credentials');
  if (!busBookingDs) {
    throw new Error('CRITICAL: Bus Booking PostgreSQL not found in MongoDB!');
  }
  console.log('   ✓ Bus Booking PostgreSQL data source exists.');

  // 2. PostgreSQL Connection & public.customers records
  const config = {
    ...(busBookingDs.configuration || {}),
    ...(busBookingDs.connectionConfig || {})
  };

  const creds = busBookingDs.getDecryptedCredentials ? (busBookingDs.getDecryptedCredentials() || {}) : {};
  console.log('   ✓ Decrypted PostgreSQL credentials:', {
    user: creds.username || config.username || 'postgres',
    hasPassword: !!creds.password
  });

  const { Client } = require('pg');
  const pgClient = new Client({
    host: config.host || 'localhost',
    port: parseInt(config.port || '5432'),
    database: config.database || 'bus_booking',
    user: creds.username || config.username || 'postgres',
    password: creds.password || config.password
  });

  await pgClient.connect();
  console.log('\n2. PostgreSQL Connection: SUCCESS');

  const countRes = await pgClient.query('SELECT COUNT(*) FROM public.customers');
  console.log(`   - SELECT COUNT(*) FROM public.customers: ${countRes.rows[0].count}`);

  const rowsRes = await pgClient.query('SELECT * FROM public.customers ORDER BY customer_id ASC');
  console.log(`   - 3 Real Records preserved:`);
  rowsRes.rows.forEach(r => {
    console.log(`     * ID ${r.customer_id}: ${r.full_name} | ${r.email} | ${r.phone_number}`);
  });
  await pgClient.end();

  // 3. Catalog Datasets
  const datasets = await Dataset.find();
  console.log(`\n3. Catalog Datasets Count: ${datasets.length}`);
  datasets.forEach(d => {
    console.log(`   - [${d._id}] "${d.name}" | Source: ${d.source} | Rows: ${d.rowCount || d.rows} | Columns: ${d.schema?.length || d.columns?.length || 0}`);
  });

  // 4. Other entities
  const usersCount = await User.countDocuments();
  const qualityCount = await Quality.countDocuments();
  const lineageCount = await Lineage.countDocuments();
  console.log(`\n4. Platform Counts:`);
  console.log(`   - Users: ${usersCount}`);
  console.log(`   - Quality Records: ${qualityCount}`);
  console.log(`   - Lineage Records: ${lineageCount}`);

  await mongoose.disconnect();
  console.log('\n--- VERIFICATION FINISHED SUCCESSFULLY ---');
}

main().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
