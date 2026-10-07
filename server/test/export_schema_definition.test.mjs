import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { buildSchemaDefinition } from '../../src/utils/schemaExporter.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-1234567890';
const BASE_URL = 'http://localhost:5000/api';

test('Export Schema Definition Suite', async (t) => {
  await mongoose.connect(MONGO_URI);
  const Dataset = mongoose.model('Dataset', new mongoose.Schema({}, { strict: false }));
  const token = jwt.sign({ id: '6ac258b135ae36221abe22d5' }, JWT_SECRET);

  await t.test('1. Dq Quality Test schema export from real PostgreSQL metadata', async () => {
    const dqId = '6ac3c904531d1367725aeb59';
    const ds = await Dataset.findById(dqId).lean();
    assert.ok(ds, 'Dq Quality Test dataset must exist in MongoDB');

    const schemaDef = buildSchemaDefinition(ds);
    assert.ok(schemaDef, 'Schema definition must be generated');
    assert.strictEqual(schemaDef.dataset, 'Dq Quality Test');
    assert.strictEqual(schemaDef.source, 'Ricoz Demo PostgreSQL');
    assert.strictEqual(schemaDef.databaseType, 'PostgreSQL');
    assert.strictEqual(schemaDef.schema, 'public');
    assert.strictEqual(schemaDef.table, 'dq_quality_test');
    assert.strictEqual(Array.isArray(schemaDef.columns), true);
    assert.strictEqual(schemaDef.columns.length, 6, 'Dq Quality Test must have exactly 6 columns');

    // Check columns
    const idCol = schemaDef.columns.find(c => c.name === 'id');
    assert.ok(idCol, 'Must have column "id"');
    assert.strictEqual(idCol.dataType, 'integer');
    assert.strictEqual(idCol.nullable, false);
    assert.strictEqual(idCol.primaryKey, true);

    const nameCol = schemaDef.columns.find(c => c.name === 'customer_name');
    assert.ok(nameCol, 'Must have column "customer_name"');
    assert.strictEqual(nameCol.dataType, 'character varying');
    assert.strictEqual(nameCol.nullable, true);

    // Verify valid JSON without [object Object] or undefined
    const jsonString = JSON.stringify(schemaDef, null, 2);
    assert.ok(!jsonString.includes('[object Object]'), 'JSON must not contain [object Object]');
    assert.ok(!jsonString.includes('undefined'), 'JSON must not contain "undefined"');
    const parsed = JSON.parse(jsonString);
    assert.strictEqual(parsed.dataset, 'Dq Quality Test');
  });

  await t.test('2. Backend GET /api/datasets/:id/export-schema endpoint returns authoritative JSON', async () => {
    const dqId = '6ac3c904531d1367725aeb59';
    const res = await fetch(`${BASE_URL}/datasets/${dqId}/export-schema`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200, 'Endpoint must return 200 OK');
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.filename, 'Dq_Quality_Test_schema.json');
    assert.strictEqual(body.data.dataset, 'Dq Quality Test');
    assert.strictEqual(body.data.schema, 'public');
    assert.strictEqual(body.data.table, 'dq_quality_test');
    assert.strictEqual(body.data.columns.length, 6);
  });

  await t.test('3. Relational foreign key schema export (Orders -> Customers)', async () => {
    const ordersId = '6ac3a2ba8bc0f57828b62a28';
    const ordersDs = await Dataset.findById(ordersId).lean();
    assert.ok(ordersDs);

    const ordersDef = buildSchemaDefinition(ordersDs);
    assert.strictEqual(ordersDef.table, 'orders');
    const custIdCol = ordersDef.columns.find(c => c.name === 'customer_id');
    assert.ok(custIdCol);
    assert.strictEqual(custIdCol.foreignKey, 'customers.customer_id');
  });

  await t.test('4. Database-agnostic: MongoDB schema definition does not force SQL schema', async () => {
    const mongoId = '6ac3db05de1b6bf9bde10aeb';
    const mongoDs = await Dataset.findById(mongoId).lean();
    assert.ok(mongoDs);

    const mongoDef = buildSchemaDefinition(mongoDs);
    assert.strictEqual(mongoDef.databaseType, 'MongoDB');
    assert.strictEqual(mongoDef.collection, 'dq_quality_test_mongo');
    assert.strictEqual(mongoDef.schema, undefined, 'MongoDB must not have SQL schema');
    assert.ok(mongoDef.columns.length > 0);
  });

  await t.test('5. Empty dataset without schema returns null / 400 with helpful warning', async () => {
    const emptyId = '6ac3952b46ce81bee1847706';
    const emptyDs = await Dataset.findById(emptyId).lean();
    assert.ok(emptyDs);

    const emptyDef = buildSchemaDefinition(emptyDs);
    assert.strictEqual(emptyDef, null, 'Must return null for dataset without columns');

    const res = await fetch(`${BASE_URL}/datasets/${emptyId}/export-schema`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 400, 'Must return 400 Bad Request');
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('Schema metadata is unavailable'));
  });

  await mongoose.disconnect();
});
