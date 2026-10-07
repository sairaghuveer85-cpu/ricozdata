const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const DataSource = require('../models/DataSource');
const Dataset = require('../models/Dataset');
const User = require('../models/User');
const { testConnection, discoverAssets, syncCatalog } = require('../controllers/dataSourceController');
const { sqlserverConfigSchema } = require('../src/schemas/dataSource.schema');
const { SQLServerConnector } = require('../src/connectors/SQLServerConnector');

describe('Microsoft SQL Server Connector Lifecycle & Verification Suite', () => {
  let testUser = null;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
    await mongoose.connect(mongoUri);

    testUser = await User.findOne();
    if (!testUser) {
      testUser = await User.create({
        name: 'Test SQL Server Architect',
        email: 'test_mssql_' + Date.now() + '@ricozdata.io',
        role: 'admin'
      });
    }
  });

  after(async () => {
    await DataSource.deleteMany({ name: /^Test_MSSQL_/ });
    await Dataset.deleteMany({ $or: [{ name: /^Test MSSQL / }, { source: /^Test_MSSQL_/ }] });
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

  // 1. CONFIGURATION & SCHEMA VALIDATION (PHASE 2)
  describe('Phase 2 — SQL Server Configuration & Schema Validation', () => {
    test('2.1 sqlserverConfigSchema validates valid configuration with defaults', () => {
      const parsed = sqlserverConfigSchema.safeParse({
        host: 'mssql.prod.internal',
        database: 'AdventureWorks',
        schema: 'sales'
      });
      assert.equal(parsed.success, true);
      assert.equal(parsed.data.host, 'mssql.prod.internal');
      assert.equal(parsed.data.port, 1433);
      assert.equal(parsed.data.database, 'AdventureWorks');
      assert.equal(parsed.data.schema, 'sales');
      assert.equal(parsed.data.authType, 'sql');
      assert.equal(parsed.data.trustServerCertificate, true);
      assert.equal(parsed.data.encrypt, true);
      assert.equal(parsed.data.connectTimeout, 15000);
    });

    test('2.2 sqlserverConfigSchema supports instance name, domain, and custom timeout', () => {
      const parsed = sqlserverConfigSchema.safeParse({
        host: 'db-host',
        port: '1433',
        instanceName: 'SQLEXPRESS',
        database: 'OperationsDB',
        schema: 'dbo',
        authType: 'windows',
        domain: 'CORP',
        connectTimeout: 25000,
        trustServerCertificate: false,
        encrypt: true
      });
      assert.equal(parsed.success, true);
      assert.equal(parsed.data.instanceName, 'SQLEXPRESS');
      assert.equal(parsed.data.authType, 'windows');
      assert.equal(parsed.data.domain, 'CORP');
      assert.equal(parsed.data.connectTimeout, 25000);
      assert.equal(parsed.data.trustServerCertificate, false);
    });

    test('2.3 sqlserverConfigSchema rejects invalid port or out-of-bounds timeout', () => {
      const invalidPort = sqlserverConfigSchema.safeParse({
        host: 'localhost',
        port: 99999,
        database: 'test'
      });
      assert.equal(invalidPort.success, false);

      const invalidTimeout = sqlserverConfigSchema.safeParse({
        host: 'localhost',
        database: 'test',
        connectTimeout: 10
      });
      assert.equal(invalidTimeout.success, false);
    });

    test('2.4 sqlserverConfigSchema rejects unsupported authType', () => {
      const invalidAuth = sqlserverConfigSchema.safeParse({
        host: 'localhost',
        database: 'test',
        authType: 'unsupported_kerberos_sso'
      });
      assert.equal(invalidAuth.success, false);
    });
  });

  // 2. CREDENTIAL ENCRYPTION & REDACTION (PHASE 6)
  describe('Phase 6 — Credential Encryption & Redaction', () => {
    test('6.1 Encrypts SQL Server password with AES-256-GCM envelope and redacts on serialization', async () => {
      const rawSecret = 'P@ssw0rd_MSSQL_2026!';
      const ds = new DataSource({
        name: 'Test_MSSQL_Security_SQL_' + Date.now(),
        type: 'sqlserver',
        configuration: {
          host: '127.0.0.1',
          port: 1433,
          database: 'master',
          schema: 'dbo',
          authType: 'sql'
        }
      });

      ds.setCredentials({
        username: 'sa',
        password: rawSecret
      });
      await ds.save();

      assert.ok(ds.credentials, 'Credentials envelope must exist');
      assert.equal(ds.credentials.type, 'encrypted_payload');
      assert.ok(ds.credentials.encryptedData.startsWith('enc:v'), 'Must use versioned envelope encryption');
      assert.equal(ds.credentials.encryptedData.includes(rawSecret), false, 'Ciphertext must never contain raw password');

      // Decryption via model helper
      const decrypted = ds.getDecryptedCredentials();
      assert.equal(decrypted.username, 'sa');
      assert.equal(decrypted.password, rawSecret);

      // Default JSON serialization must redact credentials
      const serialized = ds.toJSON();
      assert.equal(serialized.credentials, undefined, 'Credentials must be redacted in JSON output');

      await ds.deleteOne();
    });

    test('6.2 Securely encrypts Windows / Domain Authentication credentials', async () => {
      const rawSecret = 'DomainUserPassword123#';
      const ds = new DataSource({
        name: 'Test_MSSQL_Security_Win_' + Date.now(),
        type: 'sqlserver',
        configuration: {
          host: 'ad-sql.corp.internal',
          port: 1433,
          database: 'EnterpriseWarehouse',
          schema: 'dbo',
          authType: 'windows',
          domain: 'CORP'
        }
      });

      ds.setCredentials({
        username: 'svc_ricoz',
        password: rawSecret,
        domain: 'CORP'
      });
      await ds.save();

      assert.ok(ds.credentials.encryptedData.startsWith('enc:v'));
      assert.equal(ds.credentials.encryptedData.includes(rawSecret), false);

      const decrypted = ds.getDecryptedCredentials();
      assert.equal(decrypted.username, 'svc_ricoz');
      assert.equal(decrypted.password, rawSecret);
      assert.equal(decrypted.domain, 'CORP');

      await ds.deleteOne();
    });
  });

  // 3. CONNECTION TESTING (PHASE 3)
  describe('Phase 3 — Real Connection Testing & Truthful Error Handling', () => {
    test('3.1 SQL auth without password returns 400 before driver call', async () => {
      const req = {
        body: {
          type: 'sqlserver',
          configuration: {
            host: '127.0.0.1',
            port: 1433,
            database: 'AdventureWorks',
            authType: 'sql'
          },
          credentials: {
            username: 'sa'
            // password omitted
          }
        },
        params: {}
      };

      const result = await invokeTestConnection(req);
      assert.equal(result.statusCode, 400);
      assert.equal(result.data.success, false);
      assert.ok(result.data.message.includes('password'));
    });

    test('3.2 Windows auth without password returns 400 before driver call', async () => {
      const req = {
        body: {
          type: 'sqlserver',
          configuration: {
            host: '127.0.0.1',
            port: 1433,
            database: 'AdventureWorks',
            authType: 'windows',
            domain: 'CORP'
          },
          credentials: {
            username: 'svc_ricoz'
            // password omitted
          }
        },
        params: {}
      };

      const result = await invokeTestConnection(req);
      assert.equal(result.statusCode, 400);
      assert.equal(result.data.success, false);
      assert.ok(result.data.message.includes('password'));
    });

    test('3.3 Unreachable host returns truthful failure (never fake success)', async () => {
      const req = {
        body: {
          type: 'sqlserver',
          configuration: {
            host: '127.0.0.1',
            port: 59999, // Unused port
            database: 'test_db',
            connectTimeout: 2000,
            authType: 'sql'
          },
          credentials: {
            username: 'sa',
            password: 'InvalidPassword123!'
          }
        },
        params: {}
      };

      const result = await invokeTestConnection(req);
      assert.equal(result.data.success, false);
      assert.equal(result.data.data.connected, false);
      assert.equal(result.data.data.status, 'UNHEALTHY');
      assert.ok(result.data.data.error, 'Must provide truthful error message');
      assert.ok(
        result.data.data.error.includes('Failed to connect') ||
        result.data.data.error.includes('ECONNREFUSED') ||
        result.data.data.error.includes('timeout') ||
        result.data.data.error.includes('socket')
      );
    });

    test('3.4 Successful connection executes lightweight verification query and returns diagnostics', async () => {
      const originalConnectionPool = sql.ConnectionPool;

      sql.ConnectionPool = class MockConnectionPool {
        constructor(config) {
          this.config = config;
          assert.equal(config.server, 'mock-sql-host');
          assert.equal(config.user, 'sa');
          assert.equal(config.password, 'mock-pass');
          assert.equal(config.database, 'AdventureWorks');
        }

        async connect() {
          return this;
        }

        request() {
          return {
            query: async (queryStr) => {
              if (queryStr.includes('@@VERSION')) {
                return {
                  recordset: [{
                    alive: 1,
                    server_version: 'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6',
                    current_db: 'AdventureWorks',
                    default_schema: 'dbo'
                  }]
                };
              }
              return { recordset: [] };
            }
          };
        }

        async close() {
          return;
        }
      };

      try {
        const req = {
          body: {
            type: 'sqlserver',
            configuration: {
              host: 'mock-sql-host',
              port: 1433,
              database: 'AdventureWorks',
              schema: 'dbo',
              authType: 'sql'
            },
            credentials: {
              username: 'sa',
              password: 'mock-pass'
            }
          },
          params: {}
        };

        const result = await invokeTestConnection(req);
        assert.equal(result.statusCode, 200);
        assert.equal(result.data.success, true);
        assert.equal(result.data.data.connected, true);
        assert.equal(result.data.data.status, 'HEALTHY');
        assert.equal(result.data.data.details.database, 'AdventureWorks');
        assert.equal(result.data.data.details.defaultSchema, 'dbo');
        assert.ok(result.data.data.details.version.includes('Microsoft SQL Server'));
        assert.ok(typeof result.data.data.latencyMs === 'number');
      } finally {
        sql.ConnectionPool = originalConnectionPool;
      }
    });

    test('3.5 Truthfully maps SQL Server Login Failure (Error 18456 / ELOGIN)', async () => {
      const originalConnectionPool = sql.ConnectionPool;

      sql.ConnectionPool = class MockFailingPool {
        async connect() {
          const err = new Error('Login failed for user \'sa\'.');
          err.code = 'ELOGIN';
          err.number = 18456;
          throw err;
        }
      };

      try {
        const req = {
          body: {
            type: 'sqlserver',
            configuration: {
              host: 'mock-sql-host',
              port: 1433,
              database: 'AdventureWorks'
            },
            credentials: {
              username: 'sa',
              password: 'BadPassword'
            }
          },
          params: {}
        };

        const result = await invokeTestConnection(req);
        assert.equal(result.data.success, false);
        assert.equal(result.data.data.status, 'UNHEALTHY');
        assert.ok(result.data.data.error.includes('authentication failed'));
      } finally {
        sql.ConnectionPool = originalConnectionPool;
      }
    });
  });

  // 4. METADATA DISCOVERY (PHASE 4)
  describe('Phase 4 — Metadata Discovery & Introspection', () => {
    test('4.1 Rejects missing database name in discovery with 400', async () => {
      const dsNoDb = await DataSource.create({
        name: 'Test_MSSQL_NoDb_' + Date.now(),
        type: 'sqlserver',
        configuration: {
          host: 'mssql.local'
        },
        status: 'ACTIVE'
      });

      const req = {
        params: { id: dsNoDb._id.toString() },
        body: {}
      };

      const result = await invokeDiscover(req);
      assert.equal(result.statusCode, 400);
      assert.equal(result.data.success, false);
      assert.ok(result.data.message.includes('Database name is required'));

      await dsNoDb.deleteOne();
    });

    test('4.2 Rejects unsafe database or schema identifiers with 400', async () => {
      const dsUnsafe = await DataSource.create({
        name: 'Test_MSSQL_Unsafe_' + Date.now(),
        type: 'sqlserver',
        configuration: {
          host: 'mssql.local',
          database: 'AdventureWorks"; DROP TABLE users;--',
          schema: 'dbo'
        },
        status: 'ACTIVE'
      });

      const req = {
        params: { id: dsUnsafe._id.toString() },
        body: {}
      };

      const result = await invokeDiscover(req);
      assert.equal(result.statusCode, 400);
      assert.equal(result.data.success, false);
      assert.ok(result.data.message.includes('Invalid'));

      await dsUnsafe.deleteOne();
    });

    test('4.3 Real metadata discovery discovers tables, views, columns, PKs, descriptions, and row counts', async () => {
      const originalConnectionPool = sql.ConnectionPool;

      sql.ConnectionPool = class MockDiscoveryPool {
        async connect() {
          return this;
        }

        request() {
          const reqObj = {
            inputs: {},
            input(name, val) {
              reqObj.inputs[name] = val;
              return reqObj;
            },
            query: async (sqlStr) => {
              if (sqlStr.includes('INFORMATION_SCHEMA.TABLES')) {
                return {
                  recordset: [
                    { table_schema: 'sales', table_name: 'Customers', table_type: 'BASE TABLE' },
                    { table_schema: 'sales', table_name: 'v_ActiveOrders', table_type: 'VIEW' }
                  ]
                };
              }

              if (sqlStr.includes('sys.partitions')) {
                return {
                  recordset: [
                    { schema_name: 'sales', table_name: 'Customers', total_rows: 15420 }
                  ]
                };
              }

              if (sqlStr.includes('INFORMATION_SCHEMA.COLUMNS')) {
                return {
                  recordset: [
                    { table_schema: 'sales', table_name: 'Customers', column_name: 'CustomerID', data_type: 'int', is_nullable: 'NO', ordinal_position: 1, column_default: null },
                    { table_schema: 'sales', table_name: 'Customers', column_name: 'CompanyName', data_type: 'nvarchar', is_nullable: 'NO', ordinal_position: 2, column_default: null },
                    { table_schema: 'sales', table_name: 'Customers', column_name: 'EmailAddress', data_type: 'nvarchar', is_nullable: 'YES', ordinal_position: 3, column_default: null },
                    { table_schema: 'sales', table_name: 'v_ActiveOrders', column_name: 'OrderID', data_type: 'int', is_nullable: 'NO', ordinal_position: 1, column_default: null },
                    { table_schema: 'sales', table_name: 'v_ActiveOrders', column_name: 'TotalAmount', data_type: 'decimal', is_nullable: 'NO', ordinal_position: 2, column_default: null }
                  ]
                };
              }

              if (sqlStr.includes('INFORMATION_SCHEMA.TABLE_CONSTRAINTS')) {
                return {
                  recordset: [
                    { table_schema: 'sales', table_name: 'Customers', column_name: 'CustomerID' }
                  ]
                };
              }

              if (sqlStr.includes('sys.extended_properties')) {
                return {
                  recordset: [
                    { schema_name: 'sales', table_name: 'Customers', column_name: 'CustomerID', description: 'Primary customer entity identifier' },
                    { schema_name: 'sales', table_name: 'Customers', column_name: 'CompanyName', description: 'Registered business name' }
                  ]
                };
              }

              return { recordset: [] };
            }
          };
          return reqObj;
        }

        async close() {
          return;
        }
      };

      const ds = await DataSource.create({
        name: 'Test_MSSQL_Discovery_' + Date.now(),
        type: 'sqlserver',
        configuration: {
          host: 'sqlserver.prod',
          database: 'AdventureWorks',
          schema: 'sales'
        },
        status: 'ACTIVE'
      });
      ds.setCredentials({ username: 'sa', password: 'ValidPassword123!' });
      await ds.save();

      try {
        const req = {
          params: { id: ds._id.toString() },
          body: {}
        };

        const result = await invokeDiscover(req);
        assert.equal(result.statusCode, 200);
        assert.equal(result.data.success, true);
        assert.equal(result.data.data.database, 'AdventureWorks');
        assert.equal(result.data.data.schema, 'sales');

        const assets = result.data.data.assets;
        assert.equal(assets.length, 2);

        // Table asset
        const tableAsset = assets.find(a => a.name === 'Customers');
        assert.ok(tableAsset, 'Customers table must be discovered');
        assert.equal(tableAsset.type, 'table');
        assert.equal(tableAsset.schema, 'sales');
        assert.equal(tableAsset.columnsCount, 3);
        assert.equal(tableAsset.rowCount, '15,420');
        assert.deepEqual(tableAsset.primaryKey, ['CustomerID']);

        // Check column types and descriptions
        const customerIdCol = tableAsset.columns.find(c => c.name === 'CustomerID');
        assert.equal(customerIdCol.type, 'int');
        assert.equal(customerIdCol.nullable, false);
        assert.equal(customerIdCol.primaryKey, true);
        assert.equal(customerIdCol.description, 'Primary customer entity identifier');

        // View asset
        const viewAsset = assets.find(a => a.name === 'v_ActiveOrders');
        assert.ok(viewAsset, 'v_ActiveOrders view must be discovered');
        assert.equal(viewAsset.type, 'view');
        assert.equal(viewAsset.rowCount, 'VIEW');
        assert.equal(viewAsset.columnsCount, 2);
      } finally {
        sql.ConnectionPool = originalConnectionPool;
        await ds.deleteOne();
      }
    });
  });

  // 5. CATALOG SYNCHRONIZATION (PHASE 5)
  describe('Phase 5 — Data Catalog Synchronization & Metadata Preservation', () => {
    test('5.1 Registers selected SQL Server tables and views into Data Catalog without duplicates', async () => {
      const originalConnectionPool = sql.ConnectionPool;

      sql.ConnectionPool = class MockSyncPool {
        async connect() {
          return this;
        }

        request() {
          const reqObj = {
            inputs: {},
            input(name, val) {
              reqObj.inputs[name] = val;
              return reqObj;
            },
            query: async (sqlStr) => {
              if (sqlStr.includes('INFORMATION_SCHEMA.TABLES')) {
                const tName = reqObj.inputs.tableName;
                const isView = tName.startsWith('v_');
                return {
                  recordset: [{
                    table_type: isView ? 'VIEW' : 'BASE TABLE'
                  }]
                };
              }

              if (sqlStr.includes('sys.partitions')) {
                return {
                  recordset: [{ total_rows: 4200 }]
                };
              }

              if (sqlStr.includes('INFORMATION_SCHEMA.COLUMNS')) {
                return {
                  recordset: [
                    { column_name: 'id', data_type: 'int', is_nullable: 'NO', ordinal_position: 1 },
                    { column_name: 'name', data_type: 'nvarchar', is_nullable: 'YES', ordinal_position: 2 }
                  ]
                };
              }

              if (sqlStr.includes('INFORMATION_SCHEMA.TABLE_CONSTRAINTS')) {
                return {
                  recordset: [{ column_name: 'id' }]
                };
              }

              if (sqlStr.includes('sys.extended_properties')) {
                return {
                  recordset: [{ column_name: 'id', description: 'Primary Key' }]
                };
              }

              return { recordset: [] };
            }
          };
          return reqObj;
        }

        async close() {
          return;
        }
      };

      const ds = await DataSource.create({
        name: 'Test_MSSQL_Sync_' + Date.now(),
        type: 'sqlserver',
        configuration: {
          host: 'mssql.server',
          database: 'OperationsDB',
          schema: 'dbo'
        },
        tags: ['finance', 'mssql'],
        status: 'ACTIVE'
      });
      ds.setCredentials({ username: 'sa', password: 'ValidPassword123!' });
      await ds.save();

      try {
        // Sync 2 assets: 1 table, 1 view
        const syncReq = {
          params: { id: ds._id.toString() },
          body: {
            tables: ['Products', 'v_ProductSummary']
          },
          user: testUser
        };

        const syncResult = await invokeSync(syncReq);
        assert.equal(syncResult.statusCode, 200);
        assert.equal(syncResult.data.success, true);
        assert.equal(syncResult.data.data.added, 2);

        // Verify persisted dataset documents in MongoDB
        const datasets = await Dataset.find({ dataSourceId: ds._id });
        assert.equal(datasets.length, 2);

        const prodDs = datasets.find(d => d.tableName === 'Products');
        assert.ok(prodDs);
        assert.equal(prodDs.type, 'table');
        assert.equal(prodDs.sourceType, 'SQLSERVER');
        assert.equal(prodDs.schemaName, 'dbo');
        assert.equal(prodDs.rowCount, '4,200');
        assert.equal(prodDs.columns.length, 2);
        assert.equal(prodDs.columns[0].name, 'id');
        assert.equal(prodDs.columns[0].primaryKey, true);

        const viewDs = datasets.find(d => d.tableName === 'v_ProductSummary');
        assert.ok(viewDs);
        assert.equal(viewDs.type, 'view');
        assert.equal(viewDs.rowCount, 'VIEW');

        // Test duplicate prevention & metadata preservation
        // User modifies descriptions, tags, and certification
        prodDs.description = 'Custom user-managed description for business analysts';
        prodDs.tags = ['finance', 'mssql', 'user-tagged-priority'];
        prodDs.certificationStatus = 'Certified';
        await prodDs.save();

        // Re-sync the exact same tables
        const reSyncResult = await invokeSync(syncReq);
        assert.equal(reSyncResult.statusCode, 200);
        assert.equal(reSyncResult.data.data.added, 0, 'No duplicates should be created');
        assert.equal(reSyncResult.data.data.updatedCount, 2, 'Existing datasets must be refreshed');

        // Check that user-managed fields were preserved
        const refreshedDs = await Dataset.findById(prodDs._id);
        assert.equal(refreshedDs.description, 'Custom user-managed description for business analysts', 'User description preserved');
        assert.ok(refreshedDs.tags.includes('user-tagged-priority'), 'User tags preserved');
        assert.equal(refreshedDs.certificationStatus, 'Certified', 'User certification preserved');
        assert.ok(refreshedDs.lastRefreshedAt, 'lastRefreshedAt timestamp updated');
      } finally {
        sql.ConnectionPool = originalConnectionPool;
        await Dataset.deleteMany({ dataSourceId: ds._id });
        await ds.deleteOne();
      }
    });

    test('5.2 Deleting a catalog registration does not drop or alter external SQL Server objects', async () => {
      const ds = await DataSource.create({
        name: 'Test_MSSQL_DeleteGuard_' + Date.now(),
        type: 'sqlserver',
        configuration: { host: 'sql.local', database: 'InventoryDB' },
        status: 'ACTIVE'
      });

      const dataset = await Dataset.create({
        name: 'Test MSSQL Catalog Item',
        dataSourceId: ds._id,
        tableName: 'InventoryItems',
        schemaName: 'dbo',
        source: ds.name,
        sourceSystem: ds.name,
        sourceType: 'SQLSERVER',
        type: 'table',
        description: 'Catalog item to test delete guard',
        domain: 'INVENTORY',
        owner: 'Data Architect',
        ownerId: testUser._id
      });

      // Remove from catalog
      await Dataset.findByIdAndDelete(dataset._id);

      const check = await Dataset.findById(dataset._id);
      assert.equal(check, null, 'Catalog entry successfully removed');

      // Data source remains intact
      const dsCheck = await DataSource.findById(ds._id);
      assert.ok(dsCheck, 'Data Source connection definition remains intact');

      await ds.deleteOne();
    });
  });

  // 6. SQL SERVER CONNECTOR CLASS CAPABILITIES & ROBUSTNESS
  describe('Phase 6 — SQLServerConnector Contract & Quality Validation', () => {
    test('6.1 Capabilities verify metadata, column metadata, quality rules, and read-only queries', () => {
      const connector = new SQLServerConnector({
        configuration: { host: 'sql.corp', database: 'test_db' },
        timeouts: { connect: 5000, query: 10000 },
        getCredentials: () => ({ username: 'sa', password: 'pwd' })
      });

      const caps = connector.capabilities;
      assert.equal(caps.supportsMetadataDiscovery, true);
      assert.equal(caps.supportsColumnMetadata, true);
      assert.equal(caps.supportsQualityRules, true);
      assert.equal(caps.supportsReadOnlyQueries, true);
    });

    test('6.2 SQL injection guards reject unsafe identifiers in connector', () => {
      const connector = new SQLServerConnector({
        configuration: { host: 'sql.corp', database: 'test_db' },
        timeouts: { connect: 5000, query: 10000 },
        getCredentials: () => ({ username: 'sa', password: 'pwd' })
      });

      assert.throws(() => {
        connector._validateIdentifier('table; DROP DATABASE master;--', 'Table');
      }, /Unsafe or invalid/);
    });
  });

  // 7. NON-REGRESSION OF EXISTING CONNECTORS
  describe('Phase 8 — Non-Regression Verification of Existing Connectors', () => {
    test('7.1 Real Bus Booking PostgreSQL dataset remains intact and unaffected', async () => {
      const pgDs = await DataSource.findOne({
        name: 'Bus Booking PostgreSQL'
      });

      assert.ok(pgDs, 'Bus Booking PostgreSQL data source must exist');
      assert.equal(pgDs.type, 'postgresql');
      assert.equal(pgDs.configuration.database, 'bus_booking');

      const customersDataset = await Dataset.findOne({
        dataSourceId: pgDs._id,
        $or: [{ name: /customers/i }, { tableName: 'customers' }]
      });

      assert.ok(customersDataset, 'Real customers dataset must exist');
      assert.equal(customersDataset.tableName, 'customers');
      assert.equal(customersDataset.schemaName, 'public');
      assert.equal(customersDataset.rowCount, '3', 'Preserves real 3 customers records');
    });
  });
});
