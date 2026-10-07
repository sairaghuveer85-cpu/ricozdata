import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { normalizeBackendDataset } from '../../src/utils/normalizeDataset.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-1234567890';
const BASE_URL = 'http://localhost:5000/api';

test('Dataset Detail & Preview Real-Data Integrity Suite', async (t) => {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const token = jwt.sign({ id: '6ac258b135ae36221abe22d5' }, JWT_SECRET);

  await t.test('1. Products dataset returns authoritative PostgreSQL metadata (7 columns, not 48)', async () => {
    const productsDoc = await db.collection('datasets').findOne({ name: 'Products' });
    assert.ok(productsDoc, 'Products dataset must exist');

    const res = await fetch(`${BASE_URL}/datasets/${productsDoc._id}?trackView=false`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    const data = body.data;

    assert.strictEqual(data.name, 'Products');
    assert.strictEqual(data.columnsCount, 7, 'Products must have exactly 7 columns, NEVER 48');
    assert.strictEqual(data.columns.length, 7);
    assert.strictEqual(data.source, 'Ricoz Demo PostgreSQL');
    assert.strictEqual(data.sourceType?.toLowerCase(), 'postgresql');
    assert.strictEqual(data.qualityScore, 100);
    assert.strictEqual(data.notAssessed, false);
    assert.strictEqual(data.status, 'active');
    assert.strictEqual(data.sensitivity, 'Confidential');
  });

  await t.test('2. Unassessed dataset returns Not Assessed rather than fake 100%', async () => {
    const unassessedDoc = await db.collection('datasets').findOne({ qualityScore: null });
    assert.ok(unassessedDoc, 'An unassessed dataset must exist for verification');

    const res = await fetch(`${BASE_URL}/datasets/${unassessedDoc._id}?trackView=false`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const data = body.data;

    assert.strictEqual(data.quality, null, 'Quality score must be null when unassessed');
    assert.strictEqual(data.notAssessed, true, 'notAssessed flag must be true');
    assert.strictEqual(data.qualityStatus, 'Not Assessed', 'qualityStatus must be "Not Assessed"');

    // Also test frontend normalizer
    const normalized = normalizeBackendDataset(data);
    assert.strictEqual(normalized.quality, null);
    assert.strictEqual(normalized.notAssessed, true);
    assert.strictEqual(normalized.qualityStatus, 'Not Assessed');
  });

  await t.test('3. View count increments atomically and logs activity record', async () => {
    const productsDoc = await db.collection('datasets').findOne({ name: 'Products' });
    const initialViews = productsDoc.views || productsDoc.viewCount || 0;

    // Call GET without trackView=false (default: records view)
    const res = await fetch(`${BASE_URL}/datasets/${productsDoc._id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const updatedData = body.data;

    assert.strictEqual(updatedData.views, initialViews + 1, 'View count must increment by exactly 1');
    assert.strictEqual(updatedData.viewCount, initialViews + 1);

    // Verify persisted directly in MongoDB
    const persisted = await db.collection('datasets').findOne({ _id: productsDoc._id });
    assert.strictEqual(persisted.views, initialViews + 1);

    // Verify activity record exists
    const activity = await db.collection('activities').findOne({
      datasetId: productsDoc._id,
      $or: [
        { 'metadata.action': 'VIEW_DATASET' },
        { title: `Viewed dataset ${productsDoc.name}` }
      ]
    }, { sort: { createdAt: -1 } });
    assert.ok(activity, 'Activity record must be created for dataset view');
    assert.strictEqual(activity.metadata?.action, 'VIEW_DATASET');
    assert.strictEqual(activity.type, 'access');
  });

  await t.test('4. Idempotency: trackView=false prevents duplicate view increments (StrictMode/re-render guard)', async () => {
    const productsDoc = await db.collection('datasets').findOne({ name: 'Products' });
    const currentViews = productsDoc.views || 0;

    // Call GET with trackView=false
    const res = await fetch(`${BASE_URL}/datasets/${productsDoc._id}?trackView=false`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.views, currentViews, 'Views must NOT increment when trackView=false');

    const persisted = await db.collection('datasets').findOne({ _id: productsDoc._id });
    assert.strictEqual(persisted.views, currentViews, 'Database views must remain identical');
  });

  await t.test('5. Dq Quality Test returns authoritative metadata (6 columns, 10 rows, 63% quality)', async () => {
    const dqDoc = await db.collection('datasets').findOne({ name: 'Dq Quality Test' });
    assert.ok(dqDoc, 'Dq Quality Test dataset must exist');

    const res = await fetch(`${BASE_URL}/datasets/${dqDoc._id}?trackView=false`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const data = body.data;

    assert.strictEqual(data.columnsCount, 6, 'Dq Quality Test must have exactly 6 columns, NEVER 48');
    assert.strictEqual(data.qualityScore, 63, 'Dq Quality Test must have real persisted quality 63%');
    assert.strictEqual(data.source, 'Ricoz Demo PostgreSQL');

    const normalized = normalizeBackendDataset(data);
    assert.strictEqual(normalized.columnsCount, 6);
    assert.strictEqual(normalized.quality, 63);
    assert.strictEqual(normalized.usage, `${data.views} views`);
  });

  await t.test('6. MongoDB Quality Test returns authoritative MongoDB metadata (6 columns, MongoDB type)', async () => {
    const mongoDoc = await db.collection('datasets').findOne({ name: 'MongoDB Quality Test' });
    if (mongoDoc) {
      const res = await fetch(`${BASE_URL}/datasets/${mongoDoc._id}?trackView=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const data = body.data;

      assert.strictEqual(data.columnsCount, 6, 'MongoDB Quality Test must have 6 columns');
      assert.strictEqual(data.sourceType?.toLowerCase(), 'mongodb');

      const normalized = normalizeBackendDataset(data);
      assert.strictEqual(normalized.columnsCount, 6);
      assert.strictEqual(normalized.sourceType, 'MongoDB');
    }
  });

  await t.test('7. Unauthorized access is rejected with 401', async () => {
    const productsDoc = await db.collection('datasets').findOne({ name: 'Products' });
    const res = await fetch(`${BASE_URL}/datasets/${productsDoc._id}`);
    assert.strictEqual(res.status, 401, 'Request without token must be rejected');
  });

  await t.test('8. normalizeBackendDataset eliminates all fake enterprise fallbacks', async () => {
    const sample = {
      _id: 'sample_id',
      name: 'Sample Table',
      columns: [{ name: 'col1', type: 'varchar' }, { name: 'col2', type: 'integer' }],
      rowCount: 150,
      qualityScore: null,
      views: 42,
      owner: null,
      tags: [],
      source: 'Custom DB'
    };

    const norm = normalizeBackendDataset(sample);
    assert.strictEqual(norm.columnsCount, 2, 'Must be 2 columns, never 48');
    assert.strictEqual(norm.quality, null, 'Must be null, never 100%');
    assert.strictEqual(norm.notAssessed, true);
    assert.strictEqual(norm.qualityStatus, 'Not Assessed');
    assert.strictEqual(norm.usage, '42 views', 'Must be "42 views", never "1.2k views"');
    assert.strictEqual(norm.owner, 'Unassigned', 'Must be Unassigned, never Demo Administrator or Priya S.');
    assert.deepStrictEqual(norm.tags, [], 'Must be empty array, never fake tags');
  });

  await t.test('9. GET /api/datasets list endpoint returns 200 without hasQuality ReferenceError', async () => {
    const res = await fetch(`${BASE_URL}/datasets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200, 'GET /api/datasets must return 200 OK');
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.datasets));
    assert.strictEqual(body.data.datasets.length > 0, true);

    // Verify all datasets have isQualityAssessed / notAssessed defined without ReferenceError
    for (const ds of body.data.datasets) {
      assert.strictEqual(typeof ds.notAssessed, 'boolean');
      assert.strictEqual(typeof ds.columnsCount, 'number');
    }
  });

  await t.test('10. Data Catalog filters: Ricoz Demo PostgreSQL (5 datasets) & PostgreSQL (9 datasets)', async () => {
    // 10a. Ricoz Demo PostgreSQL
    const resDemo = await fetch(`${BASE_URL}/datasets?sourceSystem=Ricoz%20Demo%20PostgreSQL`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(resDemo.status, 200);
    const bodyDemo = await resDemo.json();
    assert.strictEqual(bodyDemo.data.datasets.length, 5, 'Ricoz Demo PostgreSQL must return exactly 5 datasets');

    const expectedDemoNames = ['Products', 'Orders', 'Payments', 'Customers', 'Dq Quality Test'];
    const returnedDemoNames = bodyDemo.data.datasets.map(d => d.name);
    for (const name of expectedDemoNames) {
      assert.ok(returnedDemoNames.includes(name), `Must include dataset ${name}`);
    }

    // 10b. PostgreSQL
    const resPg = await fetch(`${BASE_URL}/datasets?sourceSystem=PostgreSQL`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(resPg.status, 200);
    const bodyPg = await resPg.json();
    assert.strictEqual(bodyPg.data.datasets.length, 9, 'PostgreSQL must return exactly 9 datasets');
    for (const d of bodyPg.data.datasets) {
      assert.strictEqual(d.notAssessed, true, `${d.name} must be notAssessed: true`);
    }
  });

  await mongoose.disconnect();
});
