const mongoose = require('mongoose');
const { Pool } = require('pg');
require('dotenv').config();

async function inspectPostgres() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata');
  const DataSource = require('../models/DataSource');
  const pgSource = await DataSource.findOne({ name: /ricoz demo postgresql/i }).select('+credentials');
  if (!pgSource) {
    console.log('PostgreSQL source not found');
    return;
  }
  const config = { ...(pgSource.configuration || {}), ...(pgSource.connectionConfig || {}) };
  let creds = typeof pgSource.getDecryptedCredentials === 'function' ? pgSource.getDecryptedCredentials() || {} : {};
  console.log('PG Config:', {
    host: config.host || config.endpoint,
    port: config.port,
    database: config.database,
    user: creds.username || config.username || config.user
  });

  const pool = new Pool({
    host: config.host || config.endpoint || 'localhost',
    port: parseInt(config.port, 10) || 5432,
    database: config.database || 'ricoz_demo',
    user: creds.username || config.username || config.user || 'postgres',
    password: creds.password !== undefined ? creds.password : config.password,
    connectionTimeoutMillis: 5000
  });

  const client = await pool.connect();
  console.log('Connected to PostgreSQL successfully!');

  // List all tables
  const tables = await client.query(`
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `);
  console.log('Tables in DB:', tables.rows);

  // Foreign keys
  const fks = await client.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_schema, tc.table_name
  `);
  console.log('Foreign Keys in DB:', fks.rows);

  // dq_quality_test inspection
  const dqCols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'dq_quality_test'
  `);
  console.log('dq_quality_test columns:', dqCols.rows);

  // Primary key for dq_quality_test
  const dqPk = await client.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_name = 'dq_quality_test'
  `);
  console.log('dq_quality_test PK:', dqPk.rows);

  client.release();
  await pool.end();
  await mongoose.disconnect();
}

inspectPostgres().catch(console.error);
