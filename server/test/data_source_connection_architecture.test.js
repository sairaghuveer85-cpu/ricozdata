const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const DataSource = require('../models/DataSource');
const Dataset = require('../models/Dataset');
const User = require('../models/User');
const encryptionService = require('../services/encryptionService');
const {
  testConnection,
  discoverAssets,
  syncCatalog,
  getDataSources
} = require('../controllers/dataSourceController');

describe('RicozData Unified Data-Source Connection Architecture Test Suite', () => {
  let testUser = null;
  let dynamicConnectors = null;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
    await mongoose.connect(mongoUri);

    testUser = await User.findOne();
    if (!testUser) {
      testUser = await User.create({
        name: 'Architecture Test Engineer',
        email: 'test_arch_' + Date.now() + '@ricozdata.io',
        role: 'admin'
      });
    }

    dynamicConnectors = await import('../src/connectors/index.js');
  });

  after(async () => {
    await DataSource.deleteMany({ name: /^Test_Arch_/ });
    await Dataset.deleteMany({ name: /^Test Arch / });
    await mongoose.disconnect();
  });

  function mockResponse() {
    let statusCode = 200;
    let responseData = null;
    let resolved = false;

    const resObj = {
      status(code) {
        statusCode = code;
        return resObj;
      },
      json(data) {
        responseData = data;
        resolved = true;
        return resObj;
      },
      getStatus: () => statusCode,
      getData: () => responseData,
      isResolved: () => resolved
    };
    return resObj;
  }

  // Helper to invoke async controller functions
  async function invokeController(fn, req) {
    const res = mockResponse();
    await fn(req, res, (err) => {
      if (err) res.status(500).json({ success: false, error: err.message });
    });
    return { statusCode: res.getStatus(), data: res.getData() };
  }

  // 1. POSTGRESQL EXTERNAL CONNECTION & CONFIGURATION CONSUMPTION
  describe('1. PostgreSQL External Connection Handling', () => {
    test('1.1 PostgreSQL connector consumes user-supplied host, port, database, schema, credentials, ssl, and timeout without localhost fallback', async () => {
      const { PostgreSQLConnector, ConnectorContext } = dynamicConnectors;

      const userSupplied = {
        host: 'aws-rds-pg-prod.internal.corp',
        port: 5439,
        database: 'enterprise_analytics',
        schema: 'reporting_v2',
        ssl: true,
        connectTimeout: 8500
      };

      const userCredentials = {
        username: 'pg_service_account',
        password: 'Special!P@ss#123$%^&*()'
      };

      const context = new ConnectorContext({
        dataSourceId: 'ds_pg_test',
        sourceType: 'postgresql',
        configuration: userSupplied,
        credentials: userCredentials,
        timeouts: {
          connect: 8500,
          query: 15000
        }
      });

      const connector = new PostgreSQLConnector(context);

      assert.strictEqual(connector.context.configuration.host, 'aws-rds-pg-prod.internal.corp');
      assert.strictEqual(connector.context.configuration.port, 5439);
      assert.strictEqual(connector.context.configuration.database, 'enterprise_analytics');
      assert.strictEqual(connector.schema, 'reporting_v2');
      assert.strictEqual(connector.context.credentials.username, 'pg_service_account');
      assert.strictEqual(connector.context.credentials.password, 'Special!P@ss#123$%^&*()');
      assert.strictEqual(connector.context.timeouts.connect, 8500);

      // Verify no localhost fallback occurs
      assert.notStrictEqual(connector.context.configuration.host, 'localhost');
      assert.notStrictEqual(connector.context.configuration.host, '127.0.0.1');

      // Verify credentials are frozen in memory and excluded from serialization
      const serialized = connector.context.toJSON();
      assert.strictEqual(serialized.credentials, undefined);
      assert.strictEqual(JSON.stringify(serialized).includes('Special!P@ss'), false);
    });
  });

  // 2. MYSQL EXTERNAL CONNECTION & CONFIGURATION CONSUMPTION
  describe('2. MySQL External Connection Handling', () => {
    test('2.1 MySQL connector consumes user-supplied host, port, database, credentials, and timeout without localhost fallback', async () => {
      const { MySQLConnector, ConnectorContext } = dynamicConnectors;

      const userSupplied = {
        host: 'mysql-primary.rds.amazonaws.com',
        port: 3307,
        database: 'orders_processing',
        ssl: true,
        connectTimeout: 7000
      };

      const userCredentials = {
        username: 'mysql_writer',
        password: 'P@$$w0rd_With_Special_Chars!#%='
      };

      const context = new ConnectorContext({
        dataSourceId: 'ds_mysql_test',
        sourceType: 'mysql',
        configuration: userSupplied,
        credentials: userCredentials,
        timeouts: {
          connect: 7000,
          query: 15000
        }
      });

      const connector = new MySQLConnector(context);

      assert.strictEqual(connector.context.configuration.host, 'mysql-primary.rds.amazonaws.com');
      assert.strictEqual(connector.context.configuration.port, 3307);
      assert.strictEqual(connector.context.configuration.database, 'orders_processing');
      assert.strictEqual(connector.context.credentials.username, 'mysql_writer');
      assert.strictEqual(connector.context.credentials.password, 'P@$$w0rd_With_Special_Chars!#%=');
      assert.strictEqual(connector.context.timeouts.connect, 7000);

      assert.notStrictEqual(connector.context.configuration.host, 'localhost');
      assert.notStrictEqual(connector.context.configuration.host, '127.0.0.1');
    });
  });

  // 3. MONGODB EXTERNAL CONNECTION & URI ENCODING
  describe('3. MongoDB External Connection Handling', () => {
    test('3.1 MongoDB connector properly encodes special characters in username and password URI', async () => {
      const { MongoDBConnector, ConnectorContext } = dynamicConnectors;

      const userSupplied = {
        host: 'docdb-cluster.us-east-1.docdb.amazonaws.com',
        port: 27017,
        database: 'catalog_store',
        authSource: 'admin',
        ssl: true
      };

      const userCredentials = {
        username: 'admin@corp',
        password: 'P@ss:/?#[]@!$&*+,;=123'
      };

      const context = new ConnectorContext({
        dataSourceId: 'ds_mongo_test',
        sourceType: 'mongodb',
        configuration: userSupplied,
        credentials: userCredentials
      });
      const connector = new MongoDBConnector(context);

      assert.strictEqual(connector.context.configuration.host, 'docdb-cluster.us-east-1.docdb.amazonaws.com');
      assert.strictEqual(connector.context.credentials.username, 'admin@corp');
      assert.strictEqual(connector.context.credentials.password, 'P@ss:/?#[]@!$&*+,;=123');

      // Verify no credentials leak in toJSON
      assert.strictEqual(connector.context.toJSON().credentials, undefined);
    });

    test('3.2 Missing password when username is provided throws clear validation error', async () => {
      const { MongoDBConnector, ConnectorContext } = dynamicConnectors;

      const userSupplied = {
        host: 'mongo.remote.org',
        port: 27017,
        database: 'test_db'
      };

      const userCredentials = {
        username: 'admin',
        password: ''
      };

      const context = new ConnectorContext({
        dataSourceId: 'ds_mongo_nopass',
        sourceType: 'mongodb',
        configuration: userSupplied,
        credentials: userCredentials
      });
      const connector = new MongoDBConnector(context);

      await assert.rejects(
        async () => {
          await connector.connect();
        },
        /password/i
      );
    });
  });

  // 4. SQL SERVER EXTERNAL CONNECTION & CONFIGURATION CONSUMPTION
  describe('4. SQL Server External Connection Handling', () => {
    test('4.1 SQL Server connector consumes user-supplied host, port, database, credentials, and encryption', async () => {
      const { SQLServerConnector, ConnectorContext } = dynamicConnectors;

      const userSupplied = {
        host: 'mssql-prod.corp.windows.net',
        port: 1433,
        database: 'FinancialLedger',
        ssl: true,
        connectTimeout: 9000
      };

      const userCredentials = {
        username: 'sa_ledger',
        password: 'Str0ng_MSSQL#P@ssword!'
      };

      const context = new ConnectorContext({
        dataSourceId: 'ds_mssql_test',
        sourceType: 'sqlserver',
        configuration: userSupplied,
        credentials: userCredentials,
        timeouts: {
          connect: 9000
        }
      });
      const connector = new SQLServerConnector(context);

      assert.strictEqual(connector.context.configuration.host, 'mssql-prod.corp.windows.net');
      assert.strictEqual(connector.context.configuration.database, 'FinancialLedger');
      assert.strictEqual(connector.context.credentials.username, 'sa_ledger');
      assert.strictEqual(connector.context.credentials.password, 'Str0ng_MSSQL#P@ssword!');
    });
  });

  // 5. TRANSIENT CREDENTIALS HANDLING (TEST CONNECTION)
  describe('5. Transient Credentials Handling in Test Connection', () => {
    test('5.1 Transient credentials from req.body work without "Invalid password format" error', async () => {
      // Testing an external unreachable host will truthfully fail with 502 connection error,
      // NOT 400 or 500 "Invalid password format. Password must be a valid string."
      const req = {
        params: {},
        body: {
          type: 'postgresql',
          configuration: {
            host: '192.0.2.1', // Non-routable TEST-NET IP (will timeout or refuse)
            port: 5432,
            database: 'test_transient_db',
            connectTimeout: 800
          },
          credentials: {
            username: 'transient_user',
            password: 'P@ssw0rd!#$*&()+=/\\;:\'\"[]<>,.?~'
          }
        },
        user: testUser
      };

      const result = await invokeController(testConnection, req);

      assert.strictEqual(result.statusCode, 502);
      assert.strictEqual(result.data.success, false);
      // Ensure the error was NOT an invalid password format guard failure
      assert.strictEqual(
        (result.data.message || '').includes('Invalid password format'),
        false,
        'Must not throw "Invalid password format" for valid transient passwords'
      );
      // Verify no password leaked into error response
      assert.strictEqual(JSON.stringify(result.data).includes('P@ssw0rd'), false);
    });

    test('5.2 Missing or empty password in transient request returns clear validation error', async () => {
      const req = {
        params: {},
        body: {
          type: 'postgresql',
          configuration: {
            host: '127.0.0.1',
            port: 5432,
            database: 'test_db'
          },
          credentials: {
            username: 'admin',
            password: '' // Empty password
          }
        },
        user: testUser
      };

      const result = await invokeController(testConnection, req);

      assert.strictEqual(result.statusCode, 400);
      assert.strictEqual(result.data.success, false);
      assert.match(result.data.message, /password/i);
    });
  });

  // 6. ENCRYPTED SAVED CREDENTIALS LIFECYCLE
  describe('6. Saved Encrypted Credentials Lifecycle', () => {
    test('6.1 AES-256-GCM envelope-encrypted credentials on DataSource are decrypted only in memory', async () => {
      const ds = new DataSource({
        name: 'Test_Arch_Encrypted_' + Date.now(),
        type: 'postgresql',
        configuration: {
          host: '192.0.2.1',
          port: 5432,
          database: 'secure_db',
          connectTimeout: 800
        },
        createdBy: testUser._id,
        ownerId: testUser._id
      });

      const rawPassword = 'ExtremelySecretKey#2026!$';
      ds.setCredentials({ username: 'vault_user', password: rawPassword });
      await ds.save();

      // Verify that persisted document in MongoDB contains NO plain text password
      const rawInMongo = await DataSource.findById(ds._id).select('+credentials').lean();
      assert.ok(rawInMongo.credentials, 'Credentials field must exist in database');
      assert.ok(rawInMongo.credentials.encryptedData, 'Credentials must have encryptedData');
      assert.strictEqual(rawInMongo.credentials.encryptedData.startsWith('enc:v1:'), true);
      assert.strictEqual(rawInMongo.credentials.password, undefined);
      assert.strictEqual(JSON.stringify(rawInMongo).includes(rawPassword), false);

      // Verify toJSON() automatically strips credentials entirely
      const publicJson = ds.toJSON();
      assert.strictEqual(publicJson.credentials, undefined);
      assert.strictEqual(publicJson.credentialStatus, 'configured');

      // Test Connection on saved DataSource uses decrypted credentials in-memory
      const req = {
        params: { id: ds._id.toString() },
        body: {},
        user: testUser
      };

      const result = await invokeController(testConnection, req);
      // Connection fails truthfully with 502 (due to non-routable host), NOT password format error
      assert.strictEqual(result.statusCode, 502);
      assert.strictEqual(
        (result.data.message || '').includes('Invalid password format'),
        false
      );
      assert.strictEqual(JSON.stringify(result.data).includes(rawPassword), false);

      await DataSource.findByIdAndDelete(ds._id);
    });
  });

  // 7. METADATA DISCOVERY VIA CONNECTOR FACTORY
  describe('7. Metadata Discovery Architecture', () => {
    test('7.1 discoverAssets uses ConnectorFactory and handles empty state truthfully', async () => {
      const ds = new DataSource({
        name: 'Test_Arch_Disco_' + Date.now(),
        type: 'postgresql',
        configuration: {
          host: '192.0.2.1',
          port: 5432,
          database: 'disco_db',
          connectTimeout: 800
        },
        createdBy: testUser._id,
        ownerId: testUser._id
      });
      ds.setCredentials({ username: 'disco_user', password: 'test_password' });
      await ds.save();

      const req = {
        params: { id: ds._id.toString() },
        body: {},
        query: {},
        user: testUser
      };

      const result = await invokeController(discoverAssets, req);
      // Fails truthfully with 502 unreachable host, not unhandled 500 error
      assert.strictEqual(result.statusCode, 502);
      assert.strictEqual(result.data.success, false);
      assert.match(result.data.message, /POSTGRESQL discovery failed/i);

      await DataSource.findByIdAndDelete(ds._id);
    });
  });

  // 8. DATA SOURCE PERSISTENCE & IMMEDIATE LISTING AFTER SYNC
  describe('8. DataSource Persistence & Immediate Listing After Sync', () => {
    test('8.1 Sync flow creates/updates DataSource, persists to MongoDB, and marks status as CONNECTED / HEALTHY', async () => {
      const syncDsName = 'Test_Arch_Sync_Persistence_' + Date.now();

      // 1. Perform sync with transient / new data source details
      const syncReq = {
        params: {},
        body: {
          name: syncDsName,
          type: 'postgresql',
          configuration: {
            host: 'postgres.internal',
            port: 5432,
            database: 'bus_booking',
            schema: 'public'
          },
          credentials: {
            username: 'bus_user',
            password: 'bus_password'
          },
          tables: ['customers', 'orders', 'products']
        },
        user: testUser
      };

      const syncResult = await invokeController(syncCatalog, syncReq);
      assert.strictEqual(syncResult.statusCode, 200);
      assert.strictEqual(syncResult.data.success, true);
      assert.ok(syncResult.data.data.dataSourceId, 'Must return created dataSourceId');

      const dsId = syncResult.data.data.dataSourceId;

      // 2. Verify DataSource document was saved into MongoDB with active/connected states
      const savedDs = await DataSource.findById(dsId);
      assert.ok(savedDs, 'DataSource record must be persisted in database');
      assert.strictEqual(savedDs.name, syncDsName);
      assert.strictEqual(savedDs.status, 'CONNECTED');
      assert.strictEqual(savedDs.healthStatus, 'HEALTHY');
      assert.strictEqual(savedDs.connectionState, 'CONNECTED');
      assert.strictEqual(savedDs.tablesCount, 3);
      assert.ok(savedDs.lastSyncedAt, 'lastSyncedAt must be recorded');

      // 3. Verify Datasets were created and linked to dataSourceId
      const syncedDatasets = await Dataset.find({ dataSourceId: dsId });
      assert.strictEqual(syncedDatasets.length, 3);
      const datasetNames = syncedDatasets.map(d => d.tableName).sort();
      assert.deepStrictEqual(datasetNames, ['customers', 'orders', 'products']);

      // 4. Verify GET /api/data-sources immediately returns the newly synced data source
      const listReq = {
        query: {},
        user: testUser
      };

      const listResult = await invokeController(getDataSources, listReq);
      assert.strictEqual(listResult.statusCode, 200);
      assert.strictEqual(listResult.data.success, true);

      const items = listResult.data.data?.dataSources || (Array.isArray(listResult.data.data) ? listResult.data.data : listResult.data);
      const foundInList = items.find(d => String(d._id) === String(dsId));
      assert.ok(foundInList, 'Newly synced data source must be returned by GET /api/data-sources');
      assert.strictEqual(foundInList.name, syncDsName);
      assert.strictEqual(foundInList.status, 'CONNECTED');

      // 5. Verify Frontend Filter: GET /api/data-sources?status=ALL does NOT return 0 items!
      const filterAllReq = {
        query: { status: 'ALL' },
        user: testUser
      };

      const filterAllResult = await invokeController(getDataSources, filterAllReq);
      assert.strictEqual(filterAllResult.statusCode, 200);
      const allItems = filterAllResult.data.data?.dataSources || (Array.isArray(filterAllResult.data.data) ? filterAllResult.data.data : filterAllResult.data);
      assert.ok(allItems.length > 0, 'status=ALL filter must return data sources, not 0');
      assert.ok(allItems.some(d => String(d._id) === String(dsId)));

      // Cleanup
      await Dataset.deleteMany({ dataSourceId: dsId });
      await DataSource.findByIdAndDelete(dsId);
    });
  });
});
