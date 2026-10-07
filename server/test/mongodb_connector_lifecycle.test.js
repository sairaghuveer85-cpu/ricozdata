const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const DataSource = require('../models/DataSource');
const Dataset = require('../models/Dataset');
const User = require('../models/User');
const { testConnection, discoverAssets, syncCatalog } = require('../controllers/dataSourceController');
const { mongodbConfigSchema } = require('../src/schemas/dataSource.schema');

describe('MongoDB Connector Lifecycle & Verification Suite', () => {
  let testUser = null;
  let mongoClient = null;
  const targetDbName = 'customer_store';

  before(async () => {
    const internalMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
    await mongoose.connect(internalMongoUri);

    testUser = await User.findOne();
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Data Engineer',
        email: 'test_mongo_de_' + Date.now() + '@ricozdata.io',
        role: 'admin'
      });
    }

    // Connect to local MongoDB engine and initialize customer_store.customers
    mongoClient = new MongoClient('mongodb://127.0.0.1:27017');
    await mongoClient.connect();
    const db = mongoClient.db(targetDbName);
    const collections = await db.listCollections({ name: 'customers' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('customers');
    }
    const col = db.collection('customers');
    const docCount = await col.countDocuments();
    if (docCount === 0) {
      await col.insertMany([
        {
          name: 'Aarav Patel',
          email: 'aarav.patel@example.com',
          tier: 'platinum',
          active: true,
          balance: 2540.75,
          signupDate: new Date('2024-01-15T08:30:00Z'),
          tags: ['vip', 'cloud']
        },
        {
          name: 'Diya Sharma',
          email: 'diya.sharma@example.com',
          tier: 'gold',
          active: true,
          balance: 1200.00,
          signupDate: new Date('2024-03-20T10:15:00Z'),
          tags: ['enterprise']
        },
        {
          name: 'Karan Verma',
          email: 'karan.verma@example.com',
          tier: 'silver',
          active: false,
          balance: 450.50,
          signupDate: new Date('2024-05-10T14:45:00Z'),
          tags: ['retail']
        }
      ]);
    }
  });

  after(async () => {
    // Clean up test data sources created during this test suite
    await DataSource.deleteMany({ name: /^Test_Mongo_/ });
    await Dataset.deleteMany({ name: /^Test Mongo / });

    if (mongoClient) {
      await mongoClient.close();
    }
    await mongoose.disconnect();
  });

  function invokeTestConnection(req) {
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

  function invokeSync(req) {
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
      syncCatalog(req, res, (err) => {
        resolve({ statusCode: 500, error: err });
      });
    });
  }

  // 1. CONFIGURATION & SCHEMA VALIDATION
  describe('Phase 2 — Configuration & Schema Validation', () => {
    test('1.1 mongodbConfigSchema accepts valid structured configuration', () => {
      const validConfig = {
        host: '127.0.0.1',
        port: 27017,
        database: 'customer_store',
        authSource: 'admin',
        replicaSet: 'rs0',
        ssl: true,
        connectTimeout: 5000
      };
      const parsed = mongodbConfigSchema.parse(validConfig);
      assert.equal(parsed.host, '127.0.0.1');
      assert.equal(parsed.port, 27017);
      assert.equal(parsed.database, 'customer_store');
      assert.equal(parsed.authSource, 'admin');
      assert.equal(parsed.replicaSet, 'rs0');
      assert.equal(parsed.ssl, true);
    });

    test('1.2 mongodbConfigSchema defaults port to 27017 when omitted', () => {
      const config = {
        host: '127.0.0.1',
        database: 'customer_store'
      };
      const parsed = mongodbConfigSchema.parse(config);
      assert.equal(parsed.port, 27017);
    });

    test('1.3 mongodbConfigSchema coerces string port to integer', () => {
      const config = {
        host: '127.0.0.1',
        port: '27018',
        database: 'analytics'
      };
      const parsed = mongodbConfigSchema.parse(config);
      assert.equal(parsed.port, 27018);
      assert.equal(typeof parsed.port, 'number');
    });

    test('1.4 mongodbConfigSchema rejects port outside valid range (1 - 65535)', () => {
      assert.throws(() => {
        mongodbConfigSchema.parse({
          host: '127.0.0.1',
          port: 999999,
          database: 'test'
        });
      });
    });

    test('1.5 mongodbConfigSchema rejects connectTimeout outside 100 - 60000ms', () => {
      assert.throws(() => {
        mongodbConfigSchema.parse({
          host: '127.0.0.1',
          database: 'test',
          connectTimeout: 50 // too low
        });
      });
      assert.throws(() => {
        mongodbConfigSchema.parse({
          host: '127.0.0.1',
          database: 'test',
          connectTimeout: 120000 // too high
        });
      });
    });

    test('1.6 mongodbConfigSchema accepts standard and srv URI configurations', () => {
      const standardUri = {
        uri: 'mongodb://dbuser:pass123@mongo1.example.com:27017/customer_store?authSource=admin',
        database: 'customer_store'
      };
      const parsedStandard = mongodbConfigSchema.parse(standardUri);
      assert.equal(parsedStandard.uri, standardUri.uri);

      const srvUri = {
        connectionString: 'mongodb+srv://cluster.example.net/customer_store',
        database: 'customer_store'
      };
      const parsedSrv = mongodbConfigSchema.parse(srvUri);
      assert.equal(parsedSrv.connectionString, srvUri.connectionString);
    });
  });

  // 2. SECURITY & CREDENTIAL HANDLING
  describe('Phase 6 — Security, Credential Encryption & Redaction', () => {
    test('2.1 DataSource encrypts credentials with AES-256-GCM envelope encryption', async () => {
      const ds = new DataSource({
        name: 'Test_Mongo_Security_' + Date.now(),
        type: 'mongodb',
        configuration: {
          host: '127.0.0.1',
          port: 27017,
          database: 'customer_store'
        },
        createdBy: testUser._id
      });

      ds.setCredentials({ username: 'app_user', password: 'SecretPassword99!' });
      await ds.save();

      // Check encrypted raw storage
      const rawInDb = await DataSource.findById(ds._id).select('+credentials');
      assert.ok(rawInDb.credentials, 'Credentials field must be present in db');
      const ciphertext = typeof rawInDb.credentials === 'string' ? rawInDb.credentials : rawInDb.credentials.encryptedData;
      assert.equal(typeof ciphertext, 'string', 'Stored credentials must be encrypted ciphertext string');
      assert.ok(!ciphertext.includes('SecretPassword99!'), 'Plaintext password must NOT be in stored ciphertext');

      // Check decrypted getter
      const decrypted = rawInDb.getDecryptedCredentials();
      assert.equal(decrypted.username, 'app_user');
      assert.equal(decrypted.password, 'SecretPassword99!');

      // Check toJSON redaction
      const jsonOutput = ds.toJSON();
      assert.equal(jsonOutput.credentials, undefined, 'credentials field must be excluded from toJSON()');
    });

    test('2.2 Unauthenticated MongoDB access succeeds without credentials', async () => {
      const req = {
        params: {},
        body: {
          type: 'mongodb',
          configuration: {
            host: '127.0.0.1',
            port: 27017,
            database: 'customer_store',
            connectTimeout: 5000
          }
        },
        user: testUser
      };

      const result = await invokeTestConnection(req);
      assert.equal(result.statusCode, 200);
      assert.equal(result.data.success, true);
      assert.equal(result.data.data.connected, true);
      assert.equal(result.data.data.status, 'HEALTHY');
    });
  });

  // 3. CONNECTION TESTING
  describe('Phase 3 — Real Connection Testing', () => {
    test('3.1 Successful connection test returns status HEALTHY, latency, and db info', async () => {
      const ds = await DataSource.create({
        name: 'Test_Mongo_TestConn_' + Date.now(),
        type: 'mongodb',
        configuration: {
          host: '127.0.0.1',
          port: 27017,
          database: 'customer_store',
          connectTimeout: 5000
        },
        createdBy: testUser._id
      });

      const req = {
        params: { id: ds._id.toString() },
        body: {},
        user: testUser
      };

      const result = await invokeTestConnection(req);
      assert.equal(result.statusCode, 200);
      assert.equal(result.data.success, true);
      assert.equal(result.data.data.connected, true);
      assert.equal(result.data.data.status, 'HEALTHY');
      assert.ok(result.data.data.latencyMs >= 0, 'Must measure connection latency');
      assert.equal(result.data.data.details.database, 'customer_store');
    });

    test('3.2 Connection test fails truthfully on unreachable port with safe timeout', async () => {
      const ds = await DataSource.create({
        name: 'Test_Mongo_Unreachable_' + Date.now(),
        type: 'mongodb',
        configuration: {
          host: '127.0.0.1',
          port: 59997, // Unreachable port
          database: 'customer_store',
          connectTimeout: 1000 // Fast timeout
        },
        createdBy: testUser._id
      });

      const req = {
        params: { id: ds._id.toString() },
        body: {},
        user: testUser
      };

      const result = await invokeTestConnection(req);
      assert.ok(result.statusCode === 502 || result.statusCode === 400, `Expected failure status, got ${result.statusCode}`);
      assert.equal(result.data.success, false);
      assert.equal(result.data.data.connected, false);
      assert.equal(result.data.data.status, 'UNHEALTHY');
      const errText = result.data.data?.message || result.data.data?.error || result.data.error?.message || result.data.message || '';
      assert.ok(errText.includes('MongoDB connection failed') || errText.includes('ECONNREFUSED') || errText.includes('timed out'));
    });

    test('3.3 Transient test connection works before persisting data source', async () => {
      const req = {
        params: { id: 'test' },
        body: {
          type: 'mongodb',
          configuration: {
            host: '127.0.0.1',
            port: 27017,
            database: 'customer_store',
            connectTimeout: 5000
          }
        },
        user: testUser
      };

      const result = await invokeTestConnection(req);
      assert.equal(result.statusCode, 200);
      assert.equal(result.data.success, true);
      assert.equal(result.data.data.connected, true);
    });
  });

  // 4. METADATA DISCOVERY
  describe('Phase 4 — Real Metadata Discovery', () => {
    test('4.1 Discovers customer_store.customers collection with observed BSON field types and indexes', async () => {
      const ds = await DataSource.create({
        name: 'Test_Mongo_Discover_' + Date.now(),
        type: 'mongodb',
        configuration: {
          host: '127.0.0.1',
          port: 27017,
          database: 'customer_store',
          connectTimeout: 5000
        },
        createdBy: testUser._id
      });

      const req = {
        params: { id: ds._id.toString() },
        body: {},
        user: testUser
      };

      const result = await invokeDiscover(req);
      assert.equal(result.statusCode, 200);
      assert.equal(result.data.success, true);

      const assets = result.data.data.assets;
      assert.ok(Array.isArray(assets), 'Assets must be an array');
      assert.ok(assets.length >= 1, 'Must discover at least the customers collection');

      const customerAsset = assets.find(a => a.name === 'customers');
      assert.ok(customerAsset, 'Must discover customers collection');
      assert.equal(customerAsset.type, 'collection');
      assert.equal(customerAsset.schema, 'customer_store');
      assert.equal(Number(customerAsset.rowCount), 3);

      // Verify discovered field metadata and inferred BSON types
      const fields = customerAsset.fields || customerAsset.columns;
      assert.ok(fields.length >= 5, 'Must discover at least 5 document fields');

      const idField = fields.find(f => f.name === '_id');
      assert.ok(idField, '_id field must be discovered');
      assert.equal(idField.isPrimaryKey, true, '_id must be marked as primary key');
      assert.equal(idField.dataType, 'objectId');

      const activeField = fields.find(f => f.name === 'active');
      assert.ok(activeField, 'active field must be discovered');
      assert.equal(activeField.dataType, 'bool');

      const balanceField = fields.find(f => f.name === 'balance');
      assert.ok(balanceField, 'balance field must be discovered');
      assert.equal(balanceField.dataType, 'double');

      const dateField = fields.find(f => f.name === 'signupDate');
      assert.ok(dateField, 'signupDate field must be discovered');
      assert.equal(dateField.dataType, 'date');

      const tagsField = fields.find(f => f.name === 'tags');
      assert.ok(tagsField, 'tags field must be discovered');
      assert.equal(tagsField.dataType, 'array');

      // Verify indexes discovery
      assert.ok(Array.isArray(customerAsset.indexes), 'Indexes must be discovered');
      assert.ok(customerAsset.indexes.length >= 1, 'Collection must have at least _id_ index');
    });

    test('4.2 Discovers empty database truthfully with 0 collections', async () => {
      // Create empty db
      const emptyDbName = 'test_empty_mongo_db_' + Date.now();
      const emptyDs = await DataSource.create({
        name: 'Test_Mongo_Empty_' + Date.now(),
        type: 'mongodb',
        configuration: {
          host: '127.0.0.1',
          port: 27017,
          database: emptyDbName,
          connectTimeout: 5000
        },
        createdBy: testUser._id
      });

      const req = {
        params: { id: emptyDs._id.toString() },
        body: {},
        user: testUser
      };

      const result = await invokeDiscover(req);
      assert.equal(result.statusCode, 200);
      assert.equal(result.data.success, true);
      assert.equal(result.data.data.assets.length, 0, 'Empty database must truthfully return 0 collections');
    });
  });

  // 5. CATALOG SYNCHRONIZATION
  describe('Phase 5 — Catalog Synchronization & Duplicate Prevention', () => {
    let syncDs = null;

    before(async () => {
      syncDs = await DataSource.create({
        name: 'Test_Mongo_Sync_' + Date.now(),
        type: 'mongodb',
        configuration: {
          host: '127.0.0.1',
          port: 27017,
          database: 'customer_store',
          connectTimeout: 5000
        },
        createdBy: testUser._id
      });
    });

    test('5.1 Synchronizes customers collection into Data Catalog with collection type and schema', async () => {
      const req = {
        params: { id: syncDs._id.toString() },
        body: {
          filterTables: ['customers']
        },
        user: testUser
      };

      const result = await invokeSync(req);
      assert.equal(result.statusCode, 200);
      assert.equal(result.data.success, true);
      assert.equal(result.data.data.added, 1);

      // Verify saved dataset in DB
      const dataset = await Dataset.findOne({
        dataSourceId: syncDs._id,
        tableName: 'customers'
      });

      assert.ok(dataset, 'Dataset must be saved in catalog');
      assert.equal(dataset.type, 'collection');
      assert.equal(dataset.schemaName, 'customer_store');
      assert.equal(Number(dataset.rowCount), 3);
      const cols = dataset.columns || dataset.schema || dataset.fields || [];
      assert.ok(cols.length >= 5, 'Dataset must store discovered document fields');
    });

    test('5.2 Duplicate prevention: Re-syncing existing collection updates without creating duplicate', async () => {
      const initialCount = await Dataset.countDocuments({
        dataSourceId: syncDs._id,
        tableName: 'customers'
      });
      assert.equal(initialCount, 1);

      const req = {
        params: { id: syncDs._id.toString() },
        body: {
          filterTables: ['customers']
        },
        user: testUser
      };

      const result = await invokeSync(req);
      assert.equal(result.statusCode, 200);
      assert.equal(result.data.success, true);
      const updated = result.data.data.updatedCount !== undefined ? result.data.data.updatedCount : result.data.data.updated;
      assert.equal(updated, 1);
      assert.equal(result.data.data.added, 0);

      const afterCount = await Dataset.countDocuments({
        dataSourceId: syncDs._id,
        tableName: 'customers'
      });
      assert.equal(afterCount, 1, 'Count must remain exactly 1 after re-sync');
    });

    test('5.3 User-managed metadata (description, tags, owner) is preserved across re-sync', async () => {
      const dataset = await Dataset.findOne({
        dataSourceId: syncDs._id,
        tableName: 'customers'
      });

      // User customizes dataset metadata
      dataset.description = 'Enterprise customer profiles for analytics';
      dataset.tags = ['crm', 'pii-sensitive', 'production'];
      dataset.owner = 'Customer Analytics Team';
      dataset.classification = 'Operational';
      dataset.sensitivity = 'Confidential';
      await dataset.save();

      // Trigger re-sync
      const req = {
        params: { id: syncDs._id.toString() },
        body: {
          filterTables: ['customers']
        },
        user: testUser
      };

      const result = await invokeSync(req);
      assert.equal(result.statusCode, 200);

      // Verify user-managed fields were preserved
      const refreshedDataset = await Dataset.findById(dataset._id);
      assert.equal(refreshedDataset.description, 'Enterprise customer profiles for analytics');
      assert.deepEqual(refreshedDataset.tags, ['crm', 'pii-sensitive', 'production']);
      assert.equal(refreshedDataset.owner, 'Customer Analytics Team');
      assert.equal(refreshedDataset.classification, 'Operational');
      assert.equal(refreshedDataset.sensitivity, 'Confidential');
    });

    test('5.4 Deleting dataset from catalog leaves MongoDB collection and documents intact', async () => {
      const dataset = await Dataset.findOne({
        dataSourceId: syncDs._id,
        tableName: 'customers'
      });

      // Remove from catalog
      await Dataset.findByIdAndDelete(dataset._id);

      // Verify external MongoDB collection and documents were NOT deleted
      const db = mongoClient.db('customer_store');
      const col = db.collection('customers');
      const remainingDocs = await col.countDocuments();
      assert.equal(remainingDocs, 3, 'External MongoDB documents must remain completely intact');
    });
  });

  // 6. INTEGRATION INTEGRITY
  describe('Phase 8 — Preservation of PostgreSQL & MySQL Integrations', () => {
    test('6.1 Bus Booking PostgreSQL data source and customers dataset remain intact', async () => {
      const pgDs = await DataSource.findOne({ name: 'Bus Booking PostgreSQL' });
      assert.ok(pgDs, 'Bus Booking PostgreSQL data source must exist');
      assert.equal(pgDs.status, 'CONNECTED');

      const pgDataset = await Dataset.findOne({
        _id: new mongoose.Types.ObjectId('6ac267d2b3d60764649d5dbb')
      });
      assert.ok(pgDataset, 'Bus Booking customers dataset must remain intact');
      assert.equal(pgDataset.name, 'Customers');
      assert.equal(pgDataset.source, 'Bus Booking PostgreSQL');
    });
  });
});
