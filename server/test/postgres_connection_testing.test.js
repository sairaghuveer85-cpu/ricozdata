const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config();

const DataSource = require('../models/DataSource');
const encryptionService = require('../services/encryptionService');
const { testConnection, createDataSource } = require('../controllers/dataSourceController');

describe('PostgreSQL Connection Testing & Password Security Suite', () => {
  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
    await mongoose.connect(mongoUri);
  });

  after(async () => {
    // Cleanup any leftover test data sources
    await DataSource.deleteMany({ name: /^Test_PG_/ });
    await mongoose.disconnect();
  });

  function invokeController(req) {
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
      testConnection(req, res, (err) => {
        resolve({ statusCode: 500, error: err });
      });
    });
  }

  test('1. Missing Password Validation: returns 400 without invoking pg client', async () => {
    const ds = new DataSource({
      name: 'Test_PG_Missing_' + Date.now(),
      type: 'postgresql',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'bus_booking'
      }
    });
    await ds.save();

    const result = await invokeController({
      params: { id: ds._id.toString() },
      body: {}
    });

    assert.strictEqual(result.statusCode, 400);
    assert.strictEqual(result.data.success, false);
    assert.match(
      result.data.error.message,
      /PostgreSQL connection requires a password/i
    );
    assert.strictEqual(
      result.data.error.message.includes('SCRAM-SERVER-FIRST-MESSAGE'),
      false
    );

    await DataSource.findByIdAndDelete(ds._id);
  });

  test('2. Empty String Password: returns 400 before pg client is called', async () => {
    const ds = new DataSource({
      name: 'Test_PG_Empty_' + Date.now(),
      type: 'postgresql',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'bus_booking'
      }
    });
    ds.setCredentials({ username: 'postgres', password: '' });
    await ds.save();

    const result = await invokeController({
      params: { id: ds._id.toString() },
      body: {}
    });

    assert.strictEqual(result.statusCode, 400);
    assert.strictEqual(result.data.success, false);
    assert.match(
      result.data.error.message,
      /PostgreSQL connection requires a password/i
    );
    assert.strictEqual(
      result.data.error.message.includes('SCRAM-SERVER-FIRST-MESSAGE'),
      false
    );

    await DataSource.findByIdAndDelete(ds._id);
  });

  test('3. Valid String Password with AES-256-GCM Encryption: connects to local bus_booking database', async () => {
    const password = '1818';
    const ds = new DataSource({
      name: 'Test_PG_Valid_' + Date.now(),
      type: 'postgresql',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'bus_booking'
      }
    });
    ds.setCredentials({ username: 'postgres', password });
    await ds.save();

    // Verify MongoDB document contains ONLY AES-256-GCM ciphertext, zero plaintext
    const rawMongoDoc = await mongoose.connection.db
      .collection('datasources')
      .findOne({ _id: ds._id });

    assert.ok(rawMongoDoc.credentials);
    assert.strictEqual(rawMongoDoc.credentials.type, 'encrypted_payload');
    assert.ok(rawMongoDoc.credentials.encryptedData);
    assert.ok(rawMongoDoc.credentials.encryptedData.startsWith('enc:v1:'));
    assert.strictEqual(
      rawMongoDoc.credentials.encryptedData.includes(password),
      false
    );
    assert.strictEqual(rawMongoDoc.credentials.password, undefined);

    // Verify toJSON redacts credentials
    const json = ds.toJSON();
    assert.strictEqual(json.credentials, undefined);
    assert.strictEqual(json.credentialStatus, 'configured');

    // Test connection against live local PostgreSQL bus_booking database
    const result = await invokeController({
      params: { id: ds._id.toString() },
      body: {}
    });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(result.data.data.connected, true);
    assert.strictEqual(result.data.data.status, 'HEALTHY');
    assert.ok(typeof result.data.data.latencyMs === 'number');

    // Verify document was updated in database
    const updated = await DataSource.findById(ds._id);
    assert.strictEqual(updated.healthStatus, 'HEALTHY');
    assert.strictEqual(updated.connectionState, 'CONNECTED');

    await DataSource.findByIdAndDelete(ds._id);
  });

  test('4. Incorrectly Serialized Numeric Password: automatically normalized to string without error', async () => {
    const ds = new DataSource({
      name: 'Test_PG_Numeric_' + Date.now(),
      type: 'postgresql',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'bus_booking'
      }
    });
    // Password passed as a number 1818 instead of string '1818'
    ds.setCredentials({ username: 'postgres', password: 1818 });
    await ds.save();

    const result = await invokeController({
      params: { id: ds._id.toString() },
      body: {}
    });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(result.data.data.connected, true);
    assert.strictEqual(result.data.data.status, 'HEALTHY');

    await DataSource.findByIdAndDelete(ds._id);
  });

  test('5. Incorrectly Serialized Object Password: extracts nested password string', async () => {
    const ds = new DataSource({
      name: 'Test_PG_NestedObj_' + Date.now(),
      type: 'postgresql',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'bus_booking'
      }
    });
    ds.setCredentials({ username: 'postgres', password: '1818' });
    await ds.save();

    // Transient override with object wrapper { password: '1818' }
    const result = await invokeController({
      params: { id: ds._id.toString() },
      body: {
        credentials: {
          username: 'postgres',
          password: { password: '1818' }
        }
      }
    });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(result.data.data.connected, true);

    await DataSource.findByIdAndDelete(ds._id);
  });

  test('6. Invalid Object Password without string: returns 400 validation error', async () => {
    const ds = new DataSource({
      name: 'Test_PG_BadObj_' + Date.now(),
      type: 'postgresql',
      configuration: {
        host: 'localhost',
        port: 5432,
        database: 'bus_booking'
      }
    });
    ds.setCredentials({ username: 'postgres', password: '1818' });
    await ds.save();

    const result = await invokeController({
      params: { id: ds._id.toString() },
      body: {
        credentials: {
          username: 'postgres',
          password: { badKey: true }
        }
      }
    });

    assert.strictEqual(result.statusCode, 400);
    assert.strictEqual(result.data.success, false);
    assert.match(result.data.error.message, /Invalid password format/i);

    await DataSource.findByIdAndDelete(ds._id);
  });

  test('7. Existing "Bus Booking PostgreSQL" data source in DB succeeds and updates status', async () => {
    const ds = await DataSource.findOne({ name: /Bus Booking/i });
    assert.ok(ds, 'Existing Bus Booking PostgreSQL data source should exist');

    const result = await invokeController({
      params: { id: ds._id.toString() },
      body: {}
    });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.data.success, true);
    assert.strictEqual(result.data.data.connected, true);
    assert.strictEqual(result.data.data.status, 'HEALTHY');

    const updated = await DataSource.findById(ds._id);
    assert.strictEqual(updated.healthStatus, 'HEALTHY');
    assert.strictEqual(updated.connectionState, 'CONNECTED');
    assert.ok(!updated.lastError);
  });
});
