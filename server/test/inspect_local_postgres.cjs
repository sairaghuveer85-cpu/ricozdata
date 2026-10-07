const { Client } = require('pg');
require('dotenv').config();

async function inspect() {
  const client = new Client({
    host: process.env.POSTGRES_TEST_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_TEST_PORT || '5432', 10),
    database: process.env.POSTGRES_TEST_DB || 'ricoz_test',
    user: process.env.POSTGRES_TEST_USER || 'postgres',
    password: process.env.POSTGRES_TEST_PASSWORD
  });

  try {
    await client.connect();
    console.log('[PG] Connected successfully to', process.env.POSTGRES_TEST_DB);

    const tablesRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('[PG] Discovered Tables:', tablesRes.rows.map(r => r.table_name));

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const colsRes = await client.query(
        "SELECT column_name, data_type, is_nullable, ordinal_position FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [tableName]
      );
      console.log(`[PG] Columns for "${tableName}":`, colsRes.rows);

      const countRes = await client.query(`SELECT COUNT(*) AS total FROM "${tableName}"`);
      console.log(`[PG] Row count for "${tableName}":`, countRes.rows[0].total);

      const sampleRes = await client.query(`SELECT * FROM "${tableName}" LIMIT 3`);
      console.log(`[PG] Bounded sample rows for "${tableName}":`, sampleRes.rows);
    }
  } catch (err) {
    console.error('[PG] Inspection error:', err.message);
  } finally {
    await client.end();
  }
}

inspect();
