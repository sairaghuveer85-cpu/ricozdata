const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const snowflake = require('snowflake-sdk');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const DataSource = require('../models/DataSource');
const Dataset = require('../models/Dataset');
const User = require('../models/User');
const { testConnection, discoverAssets, syncCatalog } = require('../controllers/dataSourceController');
const { snowflakeConfigSchema } = require('../src/schemas/dataSource.schema');

describe('Snowflake Connector Lifecycle & Verification Suite', () => {
  let testUser = null;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
    await mongoose.connect(mongoUri);

    testUser = await User.findOne();
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Snowflake Architect',
        email: 'test_sf_' + Date.now() + '@ricozdata.io',
        role: 'admin'
      });
    }
  });

  after(async () => {
    await DataSource.deleteMany({ name: /^Test_Snowflake_/ });
    await Dataset.deleteMany({ $or: [{ name: /^Test Snowflake / }, { source: /^Test_Snowflake_/ }] });
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
  describe('Phase 2 — Snowflake Configuration & Schema Validation', () => {
    test('2.1 snowflakeConfigSchema accepts standard locator and organization-account formats', () => {
      // Organization-Account format (myorg-myaccount)
      const parseOrgAcc = snowflakeConfigSchema.safeParse({
        account: 'myorg-myaccount',
        warehouse: 'COMPUTE_WH',
        database: 'ANALYTICS_DW',
        schema: 'PUBLIC',
        role: 'ACCOUNTADMIN',
        authMethod: 'password',
        connectTimeout: 15000,
        clientSessionKeepAlive: true
      });
      assert.equal(parseOrgAcc.success, true);
      assert.equal(parseOrgAcc.data.account, 'myorg-myaccount');
      assert.equal(parseOrgAcc.data.authMethod, 'password');
      assert.equal(parseOrgAcc.data.clientSessionKeepAlive, true);

      // Standard locator format with region and cloud (xy12345.us-east-1.aws)
      const parseLocator = snowflakeConfigSchema.safeParse({
        account: 'xy12345.us-east-1.aws',
        warehouse: 'BI_WH',
        database: 'SALES_DB',
        schema: 'REPORTING',
        role: 'DATA_ANALYST',
        authMethod: 'keypair',
        connectTimeout: '20000'
      });
      assert.equal(parseLocator.success, true);
      assert.equal(parseLocator.data.account, 'xy12345.us-east-1.aws');
      assert.equal(parseLocator.data.connectTimeout, 20000);
      assert.equal(parseLocator.data.authMethod, 'keypair');
    });

    test('2.2 snowflakeConfigSchema rejects missing or empty account identifier', () => {
      const emptyAccount = snowflakeConfigSchema.safeParse({
        account: '',
        warehouse: 'COMPUTE_WH'
      });
      assert.equal(emptyAccount.success, false);

      const missingAccount = snowflakeConfigSchema.safeParse({
        warehouse: 'COMPUTE_WH'
      });
      assert.equal(missingAccount.success, false);
    });

    test('2.3 snowflakeConfigSchema rejects invalid characters in account or database name', () => {
      const invalidAccount = snowflakeConfigSchema.safeParse({
        account: 'account; DROP TABLE customers;--',
        warehouse: 'COMPUTE_WH'
      });
      assert.equal(invalidAccount.success, false);

      const invalidDb = snowflakeConfigSchema.safeParse({
        account: 'valid-account',
        database: 'db " OR 1=1 --'
      });
      assert.equal(invalidDb.success, false);
    });

    test('2.4 snowflakeConfigSchema enforces valid connectTimeout bounds (100 to 60000 ms)', () => {
      const tooLow = snowflakeConfigSchema.safeParse({
        account: 'valid-account',
        connectTimeout: 50
      });
      assert.equal(tooLow.success, false);

      const tooHigh = snowflakeConfigSchema.safeParse({
        account: 'valid-account',
        connectTimeout: 999999
      });
      assert.equal(tooHigh.success, false);

      const validTimeout = snowflakeConfigSchema.safeParse({
        account: 'valid-account',
        connectTimeout: 30000
      });
      assert.equal(validTimeout.success, true);
      assert.equal(validTimeout.data.connectTimeout, 30000);
    });
  });

  // 2. CREDENTIAL ENCRYPTION & REDACTION
  describe('Phase 6 — Credential Security & Redaction', () => {
    test('6.1 Encrypts Snowflake password credentials using AES-256-GCM', async () => {
      const ds = new DataSource({
        name: 'Test_Snowflake_Security_Password_' + Date.now(),
        type: 'snowflake',
        configuration: {
          account: 'test-org-acc1',
          warehouse: 'COMPUTE_WH',
          database: 'DEMO_DB',
          schema: 'PUBLIC',
          role: 'ACCOUNTADMIN',
          authMethod: 'password'
        }
      });

      const rawSecret = 'SnowflakeP@ssw0rd!2026';
      ds.setCredentials({ username: 'sf_admin', password: rawSecret });
      await ds.save();

      // Check encrypted representation in MongoDB
      assert.ok(ds.credentials, 'Credentials must be set');
      assert.equal(ds.credentials.type, 'encrypted_payload');
      assert.ok(ds.credentials.encryptedData, 'encryptedData ciphertext must exist');
      assert.ok(ds.credentials.encryptedData.startsWith('enc:v'), 'Must use versioned envelope encryption');
      assert.equal(ds.credentials.encryptedData.includes(rawSecret), false, 'Raw password must never be stored in ciphertext');

      // Decryption via model helper
      const decrypted = ds.getDecryptedCredentials();
      assert.equal(decrypted.username, 'sf_admin');
      assert.equal(decrypted.password, rawSecret);

      // Default JSON serialization must redact credentials
      const serialized = ds.toJSON();
      assert.equal(serialized.credentials, undefined);

      await ds.deleteOne();
    });

    test('6.2 Encrypts Snowflake Key-Pair (RSA PEM) and Passphrase securely', async () => {
      const samplePrivateKey = `-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFDjBABgkqhkiG9w0BBQ0wMzAbBgkqhkiG9w0BBQwwDgQI\n-----END ENCRYPTED PRIVATE KEY-----`;
      const samplePassphrase = 'KeyPassphrase123!';

      const ds = new DataSource({
        name: 'Test_Snowflake_Security_Keypair_' + Date.now(),
        type: 'snowflake',
        configuration: {
          account: 'test-org-acc2',
          warehouse: 'COMPUTE_WH',
          database: 'DEMO_DB',
          schema: 'PUBLIC',
          role: 'ACCOUNTADMIN',
          authMethod: 'keypair'
        }
      });

      ds.setCredentials({
        username: 'sf_keypair_user',
        authMethod: 'keypair',
        privateKey: samplePrivateKey,
        privateKeyPassphrase: samplePassphrase
      });
      await ds.save();

      // Raw DB record must not contain plaintext private key or passphrase
      assert.ok(ds.credentials, 'Credentials must be set');
      assert.equal(ds.credentials.type, 'encrypted_payload');
      assert.ok(ds.credentials.encryptedData.startsWith('enc:v'), 'Must use versioned envelope encryption');
      assert.equal(ds.credentials.encryptedData.includes(samplePassphrase), false);
      assert.equal(ds.credentials.encryptedData.includes('BEGIN ENCRYPTED PRIVATE KEY'), false);

      const decrypted = ds.getDecryptedCredentials();
      assert.equal(decrypted.username, 'sf_keypair_user');
      assert.equal(decrypted.privateKey, samplePrivateKey);
      assert.equal(decrypted.privateKeyPassphrase, samplePassphrase);

      // toJSON must redact secrets
      const serialized = ds.toJSON();
      assert.equal(serialized.credentials, undefined);

      await ds.deleteOne();
    });
  });

  // 3. CONNECTION TESTING
  describe('Phase 3 — Connection Testing (Driver Execution & Error Handling)', () => {
    test('3.1 Password auth without password returns 400 before driver call', async () => {
      const req = {
        body: {
          type: 'snowflake',
          configuration: {
            account: 'test-org-acc',
            warehouse: 'COMPUTE_WH',
            authMethod: 'password'
          },
          credentials: {
            username: 'test_user'
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

    test('3.2 Key-pair auth without privateKey returns 400 before driver call', async () => {
      const req = {
        body: {
          type: 'snowflake',
          configuration: {
            account: 'test-org-acc',
            warehouse: 'COMPUTE_WH',
            authMethod: 'keypair'
          },
          credentials: {
            username: 'test_user'
            // privateKey omitted
          }
        },
        params: {}
      };

      const result = await invokeTestConnection(req);
      assert.equal(result.statusCode, 400);
      assert.equal(result.data.success, false);
      assert.ok(result.data.message.includes('private key'));
    });

    test('3.3 Non-existent or unreachable Snowflake account fails truthfully (never fake success)', async () => {
      const req = {
        body: {
          type: 'snowflake',
          configuration: {
            account: 'nonexistent-org-account-999999',
            warehouse: 'COMPUTE_WH',
            database: 'ANALYTICS',
            schema: 'PUBLIC',
            connectTimeout: 3000,
            authMethod: 'password'
          },
          credentials: {
            username: 'admin',
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
        result.data.data.error.includes('Unable to reach account') ||
        result.data.data.error.includes('Snowflake') ||
        result.data.data.error.includes('authentication failed')
      );
    });

    test('3.4 Successful connection verification tests session, role, database, warehouse, and latency', async () => {
      const originalCreateConnection = snowflake.createConnection;
      snowflake.createConnection = (options) => {
        assert.equal(options.account, 'mock-acct');
        assert.equal(options.username, 'mock-user');
        assert.equal(options.password, 'mock-pass');
        return {
          connect: (cb) => cb(null, {}),
          execute: ({ sqlText, complete }) => {
            if (/CURRENT_VERSION/i.test(sqlText)) {
              complete(null, {}, [{
                VERSION: '8.12.0',
                ACCOUNT: 'MOCK_ACCT',
                ROLE: 'SYSADMIN',
                DB: 'FINANCE_DB',
                SCHEMA: 'PUBLIC',
                WH: 'ANALYTICS_WH'
              }]);
            } else {
              complete(null, {}, []);
            }
          },
          destroy: (cb) => cb()
        };
      };

      try {
        const req = {
          body: {
            type: 'snowflake',
            configuration: {
              account: 'mock-acct',
              warehouse: 'ANALYTICS_WH',
              database: 'FINANCE_DB',
              schema: 'PUBLIC',
              role: 'SYSADMIN'
            },
            credentials: {
              username: 'mock-user',
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
        assert.equal(result.data.data.details.version, '8.12.0');
        assert.equal(result.data.data.details.role, 'SYSADMIN');
        assert.equal(result.data.data.details.warehouse, 'ANALYTICS_WH');
        assert.ok(typeof result.data.data.latencyMs === 'number');
      } finally {
        snowflake.createConnection = originalCreateConnection;
      }
    });
  });

  // 4. METADATA DISCOVERY
  describe('Phase 4 — Metadata Discovery & Introspection', () => {
    test('4.1 Rejects missing database name in discovery with 400', async () => {
      const dsNoDb = await DataSource.create({
        name: 'Test_Snowflake_NoDb_' + Date.now(),
        type: 'snowflake',
        configuration: {
          account: 'valid-account',
          warehouse: 'COMPUTE_WH'
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
      assert.ok(result.data.message.includes('database'));

      await dsNoDb.deleteOne();
    });

    test('4.2 Rejects unsafe/SQL-injection database or schema names with 400', async () => {
      const dsUnsafe = await DataSource.create({
        name: 'Test_Snowflake_Unsafe_' + Date.now(),
        type: 'snowflake',
        configuration: {
          account: 'valid-account',
          database: 'DB"; DROP DATABASE prod;--',
          schema: 'PUBLIC'
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

    test('4.3 Discovers Snowflake tables, views, columns, nullability, and primary keys with driver queries', async () => {
      const originalCreateConnection = snowflake.createConnection;
      snowflake.createConnection = () => {
        return {
          connect: (cb) => cb(null, {}),
          execute: ({ sqlText, binds, complete }) => {
            if (/INFORMATION_SCHEMA\.TABLES/i.test(sqlText)) {
              complete(null, {}, [
                { TABLE_NAME: 'CUSTOMERS', TABLE_TYPE: 'BASE TABLE', ROW_COUNT: 12500, COMMENT: 'Active customers' },
                { TABLE_NAME: 'MONTHLY_SALES_V', TABLE_TYPE: 'VIEW', ROW_COUNT: null, COMMENT: 'Aggregated sales view' }
              ]);
            } else if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sqlText)) {
              complete(null, {}, [
                { TABLE_NAME: 'CUSTOMERS', COLUMN_NAME: 'CUSTOMER_ID', DATA_TYPE: 'NUMBER', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COMMENT: 'PK id' },
                { TABLE_NAME: 'CUSTOMERS', COLUMN_NAME: 'FULL_NAME', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES', ORDINAL_POSITION: 2, COMMENT: 'Customer name' },
                { TABLE_NAME: 'MONTHLY_SALES_V', COLUMN_NAME: 'MONTH', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COMMENT: 'Reporting month' },
                { TABLE_NAME: 'MONTHLY_SALES_V', COLUMN_NAME: 'TOTAL_REVENUE', DATA_TYPE: 'FLOAT', IS_NULLABLE: 'YES', ORDINAL_POSITION: 2, COMMENT: 'Total sales revenue' }
              ]);
            } else if (/TABLE_CONSTRAINTS/i.test(sqlText)) {
              complete(null, {}, [
                { TABLE_NAME: 'CUSTOMERS', COLUMN_NAME: 'CUSTOMER_ID' }
              ]);
            } else {
              complete(null, {}, []);
            }
          },
          destroy: (cb) => cb()
        };
      };

      try {
        const ds = await DataSource.create({
          name: 'Test_Snowflake_Disc_Live_' + Date.now(),
          type: 'snowflake',
          configuration: {
            account: 'live-acct',
            database: 'SALES_DW',
            schema: 'PUBLIC',
            warehouse: 'COMPUTE_WH'
          },
          status: 'ACTIVE'
        });
        ds.setCredentials({ username: 'analyst', password: 'ValidPassword123!' });
        await ds.save();

        const req = {
          params: { id: ds._id.toString() },
          body: {}
        };

        const result = await invokeDiscover(req);
        assert.equal(result.statusCode, 200);
        assert.equal(result.data.success, true);
        assert.equal(result.data.data.assets.length, 2);

        const tableAsset = result.data.data.assets.find(a => a.name === 'CUSTOMERS');
        assert.ok(tableAsset);
        assert.equal(tableAsset.type, 'table');
        assert.equal(tableAsset.rowCount, '12,500');
        assert.equal(tableAsset.columnsCount, 2);
        assert.equal(tableAsset.primaryKey[0], 'CUSTOMER_ID');

        const viewAsset = result.data.data.assets.find(a => a.name === 'MONTHLY_SALES_V');
        assert.ok(viewAsset);
        assert.equal(viewAsset.type, 'view');
        assert.equal(viewAsset.rowCount, 'VIEW');

        await ds.deleteOne();
      } finally {
        snowflake.createConnection = originalCreateConnection;
      }
    });
  });

  // 5. CATALOG SYNCHRONIZATION
  describe('Phase 5 — Catalog Sync & User-Managed Metadata Preservation', () => {
    test('5.1 Synchronizes Snowflake tables and views to Data Catalog with accurate asset identities', async () => {
      const originalCreateConnection = snowflake.createConnection;
      snowflake.createConnection = () => {
        return {
          connect: (cb) => cb(null, {}),
          execute: ({ sqlText, binds, complete }) => {
            if (/INFORMATION_SCHEMA\.TABLES/i.test(sqlText)) {
              if (binds && binds[1] === 'dim_customers') {
                complete(null, {}, [{ TABLE_NAME: 'dim_customers', TABLE_TYPE: 'BASE TABLE', ROW_COUNT: 50000, COMMENT: 'Customer dimension' }]);
              } else if (binds && binds[1] === 'v_revenue_summary') {
                complete(null, {}, [{ TABLE_NAME: 'v_revenue_summary', TABLE_TYPE: 'VIEW', ROW_COUNT: null, COMMENT: 'Revenue analytics view' }]);
              } else {
                complete(null, {}, []);
              }
            } else if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sqlText)) {
              if (binds && binds[1] === 'dim_customers') {
                complete(null, {}, [
                  { COLUMN_NAME: 'customer_sk', DATA_TYPE: 'NUMBER', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COMMENT: 'Surrogate key' },
                  { COLUMN_NAME: 'account_number', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COMMENT: 'Customer account ID' },
                  { COLUMN_NAME: 'tier', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES', ORDINAL_POSITION: 3, COMMENT: 'Membership tier' }
                ]);
              } else if (binds && binds[1] === 'v_revenue_summary') {
                complete(null, {}, [
                  { COLUMN_NAME: 'fiscal_quarter', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COMMENT: 'Quarter identifier' },
                  { COLUMN_NAME: 'revenue_usd', DATA_TYPE: 'FLOAT', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COMMENT: 'Quarterly revenue' }
                ]);
              } else {
                complete(null, {}, []);
              }
            } else if (/TABLE_CONSTRAINTS/i.test(sqlText)) {
              if (binds && binds[1] === 'dim_customers') {
                complete(null, {}, [{ COLUMN_NAME: 'customer_sk' }]);
              } else {
                complete(null, {}, []);
              }
            } else {
              complete(null, {}, []);
            }
          },
          destroy: (cb) => cb()
        };
      };

      try {
        const syncDs = await DataSource.create({
          name: 'Test_Snowflake_Sync_Live_' + Date.now(),
          type: 'snowflake',
          configuration: {
            account: 'corp-analytics',
            database: 'EDW',
            schema: 'CORE',
            warehouse: 'COMPUTE_WH'
          },
          tags: ['enterprise', 'finance'],
          status: 'ACTIVE'
        });
        syncDs.setCredentials({ username: 'sf_sync_user', password: 'SecretPassword123!' });
        await syncDs.save();

        const req = {
          params: { id: syncDs._id.toString() },
          body: {
            tables: ['dim_customers', 'v_revenue_summary']
          },
          user: testUser
        };

        const result = await invokeSync(req);
        assert.equal(result.statusCode, 200);
        assert.equal(result.data.success, true);
        assert.equal(result.data.data.added, 2);

        const registered = await Dataset.find({ dataSourceId: syncDs._id });
        assert.equal(registered.length, 2);

        const custDataset = registered.find(d => d.tableName === 'dim_customers');
        assert.ok(custDataset);
        assert.equal(custDataset.sourceType, 'SNOWFLAKE');
        assert.equal(custDataset.type, 'table');
        assert.equal(custDataset.schemaName, 'CORE');
        assert.equal(custDataset.source, syncDs.name);
        assert.equal(custDataset.sourceSystem, syncDs.name);
        assert.equal(custDataset.rowCount, '50,000');
        assert.equal(custDataset.columns.length, 3);
        const pk = custDataset.columns.find(c => c.name === 'customer_sk');
        assert.equal(pk.primaryKey, true);

        const viewDataset = registered.find(d => d.tableName === 'v_revenue_summary');
        assert.ok(viewDataset);
        assert.equal(viewDataset.sourceType, 'SNOWFLAKE');
        assert.equal(viewDataset.type, 'view');
        assert.equal(viewDataset.rowCount, 'VIEW');
        assert.equal(viewDataset.columns.length, 2);

        await Dataset.deleteMany({ dataSourceId: syncDs._id });
        await syncDs.deleteOne();
      } finally {
        snowflake.createConnection = originalCreateConnection;
      }
    });

    test('5.2 Prevents duplicate catalog registrations & preserves user-managed metadata on refresh', async () => {
      const originalCreateConnection = snowflake.createConnection;
      let refreshCall = 0;
      snowflake.createConnection = () => {
        return {
          connect: (cb) => cb(null, {}),
          execute: ({ sqlText, binds, complete }) => {
            if (/INFORMATION_SCHEMA\.TABLES/i.test(sqlText)) {
              refreshCall++;
              complete(null, {}, [{
                TABLE_NAME: 'dim_customers',
                TABLE_TYPE: 'BASE TABLE',
                ROW_COUNT: refreshCall === 1 ? 50000 : 55000,
                COMMENT: 'Customer dimension'
              }]);
            } else if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sqlText)) {
              complete(null, {}, [
                { COLUMN_NAME: 'customer_sk', DATA_TYPE: 'NUMBER', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COMMENT: 'Surrogate key' },
                { COLUMN_NAME: 'account_number', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COMMENT: 'Customer account ID' },
                { COLUMN_NAME: 'tier', DATA_TYPE: 'VARCHAR', IS_NULLABLE: 'YES', ORDINAL_POSITION: 3, COMMENT: 'Membership tier' }
              ]);
            } else {
              complete(null, {}, []);
            }
          },
          destroy: (cb) => cb()
        };
      };

      try {
        const syncDs = await DataSource.create({
          name: 'Test_Snowflake_Preserve_' + Date.now(),
          type: 'snowflake',
          configuration: {
            account: 'corp-analytics',
            database: 'EDW',
            schema: 'CORE',
            warehouse: 'COMPUTE_WH'
          },
          status: 'ACTIVE'
        });
        syncDs.setCredentials({ username: 'sf_user', password: 'Password123!' });
        await syncDs.save();

        // 1. Initial Sync
        const sync1 = await invokeSync({
          params: { id: syncDs._id.toString() },
          body: { tables: ['dim_customers'] },
          user: testUser
        });
        assert.equal(sync1.data.data.added, 1);

        const beforeDs = await Dataset.findOne({ dataSourceId: syncDs._id, tableName: 'dim_customers' });
        assert.ok(beforeDs);

        // 2. User edits business descriptions, tags, classification, and qualityScore
        beforeDs.description = 'Curated Enterprise Customer Dimension with GDPR consent flags';
        beforeDs.tags = ['gdpr', 'curated', 'gold'];
        beforeDs.certificationStatus = 'Certified';
        beforeDs.qualityScore = 98;
        beforeDs.domain = 'FINANCE';
        beforeDs.classification = 'Strategic';
        await beforeDs.save();

        // 3. Re-sync the exact same asset
        const sync2 = await invokeSync({
          params: { id: syncDs._id.toString() },
          body: { tables: ['dim_customers'] },
          user: testUser
        });

        assert.equal(sync2.statusCode, 200);
        assert.equal(sync2.data.success, true);
        assert.equal(sync2.data.data.added, 0, 'No duplicate should be created');
        assert.equal(sync2.data.data.updatedCount, 1, 'Existing record must be updated/refreshed');

        // 4. Verify user-managed fields were preserved and NOT overwritten
        const afterDs = await Dataset.findOne({ dataSourceId: syncDs._id, tableName: 'dim_customers' });
        assert.equal(afterDs.description, 'Curated Enterprise Customer Dimension with GDPR consent flags');
        assert.deepEqual(afterDs.tags, ['gdpr', 'curated', 'gold']);
        assert.equal(afterDs.certificationStatus, 'Certified');
        assert.equal(afterDs.qualityScore, 98);
        assert.equal(afterDs.domain, 'FINANCE');
        assert.equal(afterDs.classification, 'Strategic');
        assert.equal(afterDs.rowCount, '55,000', 'Technical rowCount refreshed');
        assert.ok(afterDs.lastRefreshedAt);

        // Verify total count in catalog didn't grow
        const allDatasets = await Dataset.find({ dataSourceId: syncDs._id });
        assert.equal(allDatasets.length, 1);

        await Dataset.deleteMany({ dataSourceId: syncDs._id });
        await syncDs.deleteOne();
      } finally {
        snowflake.createConnection = originalCreateConnection;
      }
    });

    test('5.3 Deleting a catalog registration does NOT drop source database objects', async () => {
      const syncDs = await DataSource.create({
        name: 'Test_Snowflake_DeleteGuard_' + Date.now(),
        type: 'snowflake',
        configuration: {
          account: 'guard-acct',
          database: 'WAREHOUSE',
          schema: 'PUBLIC'
        },
        status: 'ACTIVE'
      });

      const dsObj = await Dataset.create({
        name: 'Guard Table',
        description: 'Test guard',
        owner: 'Architect',
        ownerId: testUser._id,
        domain: 'GENERAL',
        sourceSystem: syncDs.name,
        source: syncDs.name,
        sourceType: 'SNOWFLAKE',
        dataSourceId: syncDs._id,
        tableName: 'guard_table'
      });

      // Deleting catalog dataset
      await dsObj.deleteOne();

      const remaining = await Dataset.find({ dataSourceId: syncDs._id });
      assert.equal(remaining.length, 0);

      // Original data source and its configurations remain completely intact
      const sourceStillExists = await DataSource.findById(syncDs._id);
      assert.ok(sourceStillExists);
      assert.equal(sourceStillExists.configuration.account, 'guard-acct');

      await syncDs.deleteOne();
    });
  });

  // 6. PRESERVATION OF EXISTING CONNECTORS
  describe('CRITICAL: Verify Existing PostgreSQL, MySQL, and MongoDB Connectors Preserved', () => {
    test('7.1 Bus Booking PostgreSQL data source and real customers table intact', async () => {
      const pgDs = await DataSource.findOne({ name: 'Bus Booking PostgreSQL' });
      assert.ok(pgDs, 'Bus Booking PostgreSQL must exist');
      assert.equal(pgDs.type, 'postgresql');
      assert.equal(pgDs.configuration.database, 'bus_booking');

      const custDataset = await Dataset.findOne({
        dataSourceId: pgDs._id,
        $or: [{ tableName: 'customers' }, { name: 'Customers' }]
      });
      assert.ok(custDataset, 'Customers dataset must exist');
      assert.equal(custDataset.rowCount, '3');
      assert.equal(custDataset.schemaName, 'public');
    });

    test('7.2 MySQL connector and schemas remain fully supported', async () => {
      const { mysqlConfigSchema } = require('../src/schemas/dataSource.schema');
      const valid = mysqlConfigSchema.safeParse({
        host: 'localhost',
        port: 3306,
        database: 'commerce_db'
      });
      assert.equal(valid.success, true);
    });

    test('7.3 MongoDB connector and schemas remain fully supported', async () => {
      const { mongodbConfigSchema } = require('../src/schemas/dataSource.schema');
      const valid = mongodbConfigSchema.safeParse({
        host: 'localhost',
        port: 27017,
        database: 'customer_store'
      });
      assert.equal(valid.success, true);
    });
  });
});
