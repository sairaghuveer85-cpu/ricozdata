import pg from 'pg';
import assert from 'assert';

const PG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'ricoz_test',
  user: 'postgres',
  password: process.env.POSTGRES_TEST_PASSWORD || '1818'
};

const BASE_URL = 'http://localhost:5000/api/v1';

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'ricoz-demo'
    },
    body: JSON.stringify({
      email: 'lead.steward@ricoz.io',
      password: 'EnterprisePassword2026!'
    })
  });
  const data = await res.json();
  if (!data.success) throw new Error('Login failed: ' + JSON.stringify(data));
  return { token: data.data.accessToken, orgId: data.data.organization?._id };
}

async function run() {
  console.log('============================================================');
  console.log('SQL STUDIO FINAL CORRECTNESS & ERROR CATEGORIZATION TEST');
  console.log('============================================================\n');

  const { token } = await login();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Tenant-Slug': 'ricoz-demo'
  };

  // 1. Fetch Datasets
  const dsRes = await fetch(`${BASE_URL}/datasets?limit=20`, { headers });
  const dsData = await dsRes.json();
  const datasets = dsData.data;

  const customersDs = datasets.find(d => d.name === 'customers');
  const productsDs = datasets.find(d => d.name === 'products');
  const phoneNumbersDs = datasets.find(d => d.name === 'phone numbers');

  assert.ok(customersDs, 'customers dataset must exist');
  assert.ok(productsDs, 'products dataset must exist');
  assert.ok(phoneNumbersDs, 'phone numbers dataset must exist');

  // --- TEST A: customers SELECT * ---
  console.log('--- TEST A: customers SELECT * ---');
  const qA = 'SELECT * FROM "public"."customers" LIMIT 50;';
  const resA = await fetch(`${BASE_URL}/datasets/${customersDs._id}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: qA })
  });
  const dataA = await resA.json();
  assert.strictEqual(resA.status, 200, 'TEST A must return HTTP 200');
  assert.strictEqual(dataA.success, true, 'TEST A must be successful');
  assert.strictEqual(dataA.data.rowCount, 4, 'TEST A must return 4 rows');
  assert.ok(dataA.data.fields.includes('name'), 'TEST A fields must contain name');
  assert.ok(dataA.data.fields.includes('phone'), 'TEST A fields must contain phone');
  assert.ok(!dataA.data.fields.includes('price'), 'TEST A fields must NOT contain product price');
  console.log(`✓ TEST A PASS: 4 rows returned, fields: [${dataA.data.fields.join(', ')}]`);

  // --- TEST B: products SELECT * ---
  console.log('\n--- TEST B: products SELECT * ---');
  const qB = 'SELECT * FROM "public"."products" LIMIT 50;';
  const resB = await fetch(`${BASE_URL}/datasets/${productsDs._id}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: qB })
  });
  const dataB = await resB.json();
  assert.strictEqual(resB.status, 200, 'TEST B must return HTTP 200');
  assert.strictEqual(dataB.success, true, 'TEST B must be successful');
  assert.strictEqual(dataB.data.rowCount, 4, 'TEST B must return 4 rows');
  assert.ok(dataB.data.fields.includes('product_name'), 'TEST B fields must contain product_name');
  assert.ok(dataB.data.fields.includes('price'), 'TEST B fields must contain price');
  assert.ok(!dataB.data.fields.includes('email'), 'TEST B fields must NOT contain customer email');
  console.log(`✓ TEST B PASS: 4 rows returned, fields: [${dataB.data.fields.join(', ')}]`);

  // --- TEST C: customers SELECT COUNT(*) ---
  console.log('\n--- TEST C: customers SELECT COUNT(*) ---');
  const qC = 'SELECT COUNT(*) AS total_count FROM "public"."customers";';
  const resC = await fetch(`${BASE_URL}/datasets/${customersDs._id}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: qC })
  });
  const dataC = await resC.json();
  assert.strictEqual(resC.status, 200, 'TEST C must return HTTP 200');
  assert.strictEqual(dataC.success, true, 'TEST C must be successful');
  assert.strictEqual(parseInt(dataC.data.rows[0].total_count, 10), 4, 'TEST C count must equal 4');
  console.log(`✓ TEST C PASS: COUNT(*) = ${dataC.data.rows[0].total_count}`);

  // --- TEST D: Nonexistent table on manual dataset (phone numbers) ---
  console.log('\n--- TEST D: Nonexistent table on manual dataset (phone numbers) ---');
  const qD = 'SELECT * FROM "public"."phone numbers" LIMIT 50;';
  const resD = await fetch(`${BASE_URL}/datasets/${phoneNumbersDs._id}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: qD })
  });
  const dataD = await resD.json();
  assert.strictEqual(resD.status, 404, 'TEST D must return HTTP 404');
  assert.strictEqual(dataD.success, false, 'TEST D must indicate failure');
  assert.strictEqual(dataD.error.code, 'SOURCE_TABLE_NOT_FOUND', 'TEST D code must be SOURCE_TABLE_NOT_FOUND');
  assert.ok(dataD.error.message.includes('Source table not found'), 'TEST D message must state table not found');
  assert.ok(!dataD.error.message.includes('No records returned'), 'TEST D must NOT say No records returned');
  console.log(`✓ TEST D PASS: Correctly identified SOURCE_TABLE_NOT_FOUND: "${dataD.error.message}"`);

  // --- TEST E: Legitimate empty source table ---
  console.log('\n--- TEST E: Legitimate empty source table ---');
  const pool = new pg.Pool(PG_CONFIG);
  try {
    await pool.query('CREATE TABLE IF NOT EXISTS public.test_empty_catalog_table (id serial primary key, note text, created_at timestamp default now());');
    await pool.query('TRUNCATE TABLE public.test_empty_catalog_table;');

    const qE = 'SELECT * FROM "public"."test_empty_catalog_table" LIMIT 50;';
    const resE = await fetch(`${BASE_URL}/datasets/${customersDs._id}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: qE })
    });
    const dataE = await resE.json();
    assert.strictEqual(resE.status, 200, 'TEST E must return HTTP 200');
    assert.strictEqual(dataE.success, true, 'TEST E must be successful');
    assert.strictEqual(dataE.data.rowCount, 0, 'TEST E must return 0 rowCount');
    assert.deepStrictEqual(dataE.data.rows, [], 'TEST E rows must be empty array');
    assert.ok(Array.isArray(dataE.data.fields) && dataE.data.fields.length > 0, 'TEST E must return column metadata');
    console.log(`✓ TEST E PASS: Successful zero-row query: rowCount=${dataE.data.rowCount}, fields=[${dataE.data.fields.join(', ')}]`);
  } finally {
    await pool.query('DROP TABLE IF EXISTS public.test_empty_catalog_table;');
    await pool.end();
  }

  // --- TEST F: Security Validation (Forbidden Statements) ---
  console.log('\n--- TEST F: Security Validation ---');
  // 1. Destructive DROP TABLE
  const resF1 = await fetch(`${BASE_URL}/datasets/${customersDs._id}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'DROP TABLE customers;' })
  });
  const dataF1 = await resF1.json();
  assert.strictEqual(resF1.status, 403, 'DROP TABLE must return HTTP 403');
  assert.strictEqual(dataF1.error.code, 'FORBIDDEN_SQL');
  console.log('✓ TEST F1 PASS: Blocked DROP TABLE with 403 FORBIDDEN_SQL');

  // 2. Multi-statement injection
  const resF2 = await fetch(`${BASE_URL}/datasets/${customersDs._id}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'SELECT 1; SELECT 2;' })
  });
  const dataF2 = await resF2.json();
  assert.strictEqual(resF2.status, 403, 'Multi-statement query must return HTTP 403');
  assert.strictEqual(dataF2.error.code, 'FORBIDDEN_SQL');
  console.log('✓ TEST F2 PASS: Blocked Multi-statement query with 403 FORBIDDEN_SQL');

  // 3. Syntax error
  const resF3 = await fetch(`${BASE_URL}/datasets/${customersDs._id}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'SELECT FROM WHERE;' })
  });
  const dataF3 = await resF3.json();
  assert.strictEqual(resF3.status, 400, 'Syntax error query must return HTTP 400');
  assert.strictEqual(dataF3.error.code, 'INVALID_SQL');
  console.log('✓ TEST F3 PASS: Blocked Invalid syntax with 400 INVALID_SQL');

  console.log('\n============================================================');
  console.log('ALL SQL STUDIO CORRECTNESS TESTS PASSED (TESTS A THROUGH F)');
  console.log('============================================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
