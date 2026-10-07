const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const DataSource = require('../models/DataSource');
const { discoverAssets } = require('../controllers/dataSourceController');

describe('PostgreSQL Metadata Discovery Suite', () => {
  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
    await mongoose.connect(mongoUri);
  });

  after(async () => {
    await DataSource.deleteMany({ name: /^Test_PG_Disco_/ });
    await mongoose.disconnect();
  });

  function invokeDiscover(req) {
    return new Promise((resolve) => {
      let statusCode = 200;
      const res = {
        status(c) {
          statusCode = c;
          return res;
        },
        json(data) {
          resolve({ statusCode, data });
        }
      };
      discoverAssets(req, res, (err) => {
        resolve({ statusCode: 500, error: err });
      });
    });
  }

  test('1. Discover real PostgreSQL table: Bus Booking PostgreSQL finds public.customers', async () => {
    const ds = await DataSource.findOne({ name: /Bus Booking/i });
    assert.ok(ds, 'Bus Booking PostgreSQL data source must exist in database');

    const result = await invokeDiscover({
      params: { id: ds._id.toString() },
      body: {},
      query: {}
    });

    assert.strictEqual(result.statusCode, 200, `Expected 200 OK, got ${result.statusCode}: ${JSON.stringify(result.data)}`);
    assert.strictEqual(result.data.success, true);
    assert.ok(Array.isArray(result.data.data.assets), 'data.assets must be an array');
    assert.ok(result.data.data.assets.length >= 1, 'Expected at least 1 discovered asset');

    const customersAsset = result.data.data.assets.find(a => a.name === 'customers' || a.tableName === 'customers');
    assert.ok(customersAsset, 'customers table must be discovered in public schema');
    assert.strictEqual(customersAsset.schema, 'public');
    assert.strictEqual(customersAsset.type, 'table');
    assert.ok(customersAsset.columnsCount >= 5, `Expected >= 5 columns, got ${customersAsset.columnsCount}`);

    const colNames = customersAsset.columns.map(c => c.name);
    assert.ok(colNames.includes('customer_id'), 'columns must include customer_id');
    assert.ok(colNames.includes('full_name'), 'columns must include full_name');
    assert.ok(colNames.includes('phone_number'), 'columns must include phone_number');
    assert.ok(colNames.includes('email'), 'columns must include email');
    assert.ok(colNames.includes('created_at'), 'columns must include created_at');

    const pkCol = customersAsset.columns.find(c => c.name === 'customer_id');
    assert.strictEqual(pkCol.isPrimaryKey, true, 'customer_id must be identified as primary key');
    assert.ok(customersAsset.primaryKey.includes('customer_id'), 'primaryKey list must include customer_id');

    // Verify row count from real database
    assert.strictEqual(customersAsset.rowCount, '3', 'Row count must accurately reflect 3 customer records');
  });

  test('2. Empty schema handling: returns 200 with 0 assets when schema has no tables', async () => {
    const ds = await DataSource.findOne({ name: /Bus Booking/i });
    assert.ok(ds, 'Bus Booking PostgreSQL data source must exist');

    const result = await invokeDiscover({
      params: { id: ds._id.toString() },
      body: { schema: 'empty_schema_test' },
      query: {}
    });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(result.data.data.schema, 'empty_schema_test');
    assert.deepStrictEqual(result.data.data.assets, []);
    assert.strictEqual(result.data.data.totalCount, 0);
  });

  test('3. Schema validation: rejects unsafe/invalid schema names with 400', async () => {
    const ds = await DataSource.findOne({ name: /Bus Booking/i });
    assert.ok(ds, 'Bus Booking PostgreSQL data source must exist');

    const result = await invokeDiscover({
      params: { id: ds._id.toString() },
      body: { schema: 'public; DROP TABLE customers;' },
      query: {}
    });

    assert.strictEqual(result.statusCode, 400);
    assert.strictEqual(result.data.success, false);
    assert.match(result.data.message, /Invalid schema name/i);
  });

  test('4. Connection failure handling: returns 502 when database is unreachable', async () => {
    const ds = new DataSource({
      name: 'Test_PG_Disco_Unreachable_' + Date.now(),
      type: 'postgresql',
      configuration: {
        host: '127.0.0.1',
        port: 59999, // Unused port
        database: 'bus_booking'
      }
    });
    ds.setCredentials({ username: 'postgres', password: 'password' });
    await ds.save();

    const result = await invokeDiscover({
      params: { id: ds._id.toString() },
      body: {},
      query: {}
    });

    assert.strictEqual(result.statusCode, 502);
    assert.strictEqual(result.data.success, false);
    assert.match(result.data.message, /PostgreSQL discovery failed/i);

    await DataSource.findByIdAndDelete(ds._id);
  });

  test('5. Non-existent data source: returns 404', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await invokeDiscover({
      params: { id: fakeId.toString() },
      body: {},
      query: {}
    });

    assert.strictEqual(result.statusCode, 404);
    assert.strictEqual(result.data.success, false);
  });
});
