import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function inspectPg() {
  const client = new pg.Client({
    host: process.env.POSTGRES_TEST_HOST || 'localhost',
    port: Number(process.env.POSTGRES_TEST_PORT || 5432),
    database: process.env.POSTGRES_TEST_DB || 'ricoz_demo',
    user: process.env.POSTGRES_TEST_USER || 'postgres',
    password: process.env.POSTGRES_TEST_PASSWORD || '1818'
  });
  await client.connect();
  const tablesRes = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
  `);
  console.log('--- POSTGRESQL TABLES ---');
  console.log(tablesRes.rows);

  for (const t of tablesRes.rows) {
    const countRes = await client.query(`SELECT count(*)::int as count FROM "${t.table_schema}"."${t.table_name}"`);
    const colsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `, [t.table_schema, t.table_name]);
    console.log(`=== ${t.table_schema}.${t.table_name} (Rows: ${countRes.rows[0].count}, Columns: ${colsRes.rows.length}) ===`);
    console.log(colsRes.rows.map(c => `${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));
  }
  await client.end();
}

inspectPg().catch(console.error);
