const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const DataSource = require('../models/DataSource');
const Dataset = require('../models/Dataset');
const User = require('../models/User');
const { testConnection, discoverAssets, syncCatalog } = require('../controllers/dataSourceController');
const { mysqlConfigSchema } = require('../src/schemas/dataSource.schema');

describe('MySQL Connector Lifecycle & Verification Suite', () => {
  let testUser = null;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ricozdata';
    await mongoose.connect(mongoUri);

    testUser = await User.findOne();
    if (!testUser) {
      testUser = await User.create({
        name: 'Test Data Engineer',
        email: 'test_de_' + Date.now() + '@ricozdata.io',
        role: 'admin'
      });
    }
  });

  after(async () => {
    await DataSource.deleteMany({ name: /^Test_MySQL_/ });
    await Dataset.deleteMany({ name: /^Test MySQL / });
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

  // 1. FORM & SCHEMA VALIDATION
  describe('Phase 2 — Configuration & Schema Validation', () => {
    test('1.1 mysqlConfigSchema accepts valid configuration', () => {
      const validConfig = {
        host: 'mysql.internal',
        port: 3306,
        database: 'commerce_db',
        ssl: true,
        connectTimeout: 5000
      };
      const parsed = mysqlConfigSchema.parse(validConfig);
      assert.strictEqual(parsed.host, 'mysql.internal');
      assert.strictEqual(parsed.port, 3306);
      assert.strictEqual(parsed.database, 'commerce_db');
      assert.strictEqual(parsed.ssl, true);
      assert.strictEqual(parsed.connectTimeout, 5000);
    });

    test('1.2 mysqlConfigSchema coerces string port and timeout', () => {
      const parsed = mysqlConfigSchema.parse({
        host: '127.0.0.1',
        port: '3306',
        database: 'sales',
        connectTimeout: '8000'
      });
      assert.strictEqual(parsed.port, 3306);
      assert.strictEqual(parsed.connectTimeout, 8000);
    });

    test('1.3 mysqlConfigSchema rejects invalid port', () => {
      assert.throws(() => {
        mysqlConfigSchema.parse({
          host: '127.0.0.1',
          port: 70000
        });
      });
    });

    test('1.4 mysqlConfigSchema rejects invalid connectTimeout', () => {
      assert.throws(() => {
        mysqlConfigSchema.parse({
          host: '127.0.0.1',
          port: 3306,
          connectTimeout: 50 // below min 100
        });
      });
    });
  });

  // 2. CREDENTIAL ENCRYPTION & REDACTION
  describe('Phase 6 — Credential Security & Redaction', () => {
    test('2.1 Encrypts MySQL password using AES-256-GCM', async () => {
      const ds = new DataSource({
        name: 'Test_MySQL_Sec_' + Date.now(),
        type: 'mysql',
        configuration: {
          host: '127.0.0.1',
          port: 3306,
          database: 'test_db'
        }
      });
      ds.setCredentials({ username: 'db_admin', password: 'SuperSecretPassword_2026!' });
      await ds.save();

      // Ensure credentials is encrypted and not raw plaintext
      assert.ok(ds.credentials, 'credentials must be set');
      assert.strictEqual(ds.credentials.type, 'encrypted_payload');
      assert.ok(ds.credentials.encryptedData, 'encryptedData must be set');
      assert.strictEqual(ds.credentials.encryptedData.startsWith('enc:v'), true);
      assert.strictEqual(ds.credentials.encryptedData.includes('SuperSecretPassword_2026!'), false);

      // Decrypted credentials must accurately retrieve original password
      const decrypted = ds.getDecryptedCredentials();
      assert.strictEqual(decrypted.username, 'db_admin');
      assert.strictEqual(decrypted.password, 'SuperSecretPassword_2026!');

      // toJSON must redact encrypted credentials and secrets
      const json = ds.toJSON();
      assert.strictEqual(json.credentials, undefined);

      await DataSource.findByIdAndDelete(ds._id);
    });
  });

  // 3. REAL CONNECTION TESTING (TRUTHFUL REPORTING)
  describe('Phase 3 — Connection Testing (Honest Error Handling)', () => {
    test('3.1 Unreachable host/port fails truthfully with ECONNREFUSED or ETIMEDOUT (never mock success)', async () => {
      const ds = new DataSource({
        name: 'Test_MySQL_Unreachable_' + Date.now(),
        type: 'mysql',
        configuration: {
          host: '127.0.0.1',
          port: 59997, // Unused port
          database: 'commerce_db',
          connectTimeout: 1000
        }
      });
      ds.setCredentials({ username: 'root', password: 'test_password' });
      await ds.save();

      const result = await invokeTestConnection({
        params: { id: ds._id.toString() },
        body: {},
        user: testUser
      });

      assert.strictEqual(result.statusCode, 502);
      assert.strictEqual(result.data.success, false);
      assert.ok(result.data.error, 'Error object must be returned');
      assert.match(
        result.data.error.message || result.data.message,
        /Connection refused|unreachable|timed out|ECONNREFUSED|ETIMEDOUT/i
      );

      await DataSource.findByIdAndDelete(ds._id);
    });

    test('3.2 Missing database validation in discoverAssets returns 400', async () => {
      const ds = new DataSource({
        name: 'Test_MySQL_NoDb_' + Date.now(),
        type: 'mysql',
        configuration: {
          host: '127.0.0.1',
          port: 3306
          // database missing
        }
      });
      await ds.save();

      const result = await invokeDiscover({
        params: { id: ds._id.toString() },
        body: {},
        query: {},
        user: testUser
      });

      assert.strictEqual(result.statusCode, 400);
      assert.strictEqual(result.data.success, false);
      assert.match(result.data.message, /database name is required/i);

      await DataSource.findByIdAndDelete(ds._id);
    });

    test('3.3 SQL injection attempt in database name is rejected with 400', async () => {
      const ds = new DataSource({
        name: 'Test_MySQL_SqlInj_' + Date.now(),
        type: 'mysql',
        configuration: {
          host: '127.0.0.1',
          port: 3306,
          database: 'test_db; DROP TABLE customers; --'
        }
      });
      await ds.save();

      const result = await invokeDiscover({
        params: { id: ds._id.toString() },
        body: {},
        query: {},
        user: testUser
      });

      assert.strictEqual(result.statusCode, 400);
      assert.strictEqual(result.data.success, false);
      assert.match(result.data.message, /Invalid database name/i);

      await DataSource.findByIdAndDelete(ds._id);
    });
  });

  // 4. METADATA DISCOVERY & ASSET SELECTION
  describe('Phase 4 — Metadata Discovery & Introspection', () => {
    test('4.1 Discovers tables, views, columns, types, nullability, and primary keys correctly', async () => {
      const originalCreateConnection = mysql.createConnection;

      // Mock mysql2.createConnection to return authentic information_schema data
      mysql.createConnection = async (opts) => {
        return {
          query: async (sql, params) => {
            if (/FROM information_schema\.TABLES/i.test(sql)) {
              return [
                [
                  { TABLE_NAME: 'orders', TABLE_TYPE: 'BASE TABLE', TABLE_COMMENT: 'Customer purchase orders' },
                  { TABLE_NAME: 'order_items', TABLE_TYPE: 'BASE TABLE', TABLE_COMMENT: 'Items within orders' },
                  { TABLE_NAME: 'customer_order_summary', TABLE_TYPE: 'VIEW', TABLE_COMMENT: 'Aggregated view of customer totals' }
                ]
              ];
            }
            if (/FROM information_schema\.COLUMNS/i.test(sql)) {
              return [
                [
                  { TABLE_NAME: 'orders', COLUMN_NAME: 'order_id', DATA_TYPE: 'int', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COLUMN_DEFAULT: null, COLUMN_COMMENT: 'Primary order key', COLUMN_KEY: 'PRI', EXTRA: 'auto_increment' },
                  { TABLE_NAME: 'orders', COLUMN_NAME: 'customer_id', DATA_TYPE: 'int', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COLUMN_DEFAULT: null, COLUMN_COMMENT: 'Customer foreign key', COLUMN_KEY: 'MUL', EXTRA: '' },
                  { TABLE_NAME: 'orders', COLUMN_NAME: 'total_amount', DATA_TYPE: 'decimal', COLUMN_TYPE: 'decimal(10,2)', IS_NULLABLE: 'NO', ORDINAL_POSITION: 3, COLUMN_DEFAULT: '0.00', COLUMN_COMMENT: 'Total billed amount', COLUMN_KEY: '', EXTRA: '' },
                  { TABLE_NAME: 'orders', COLUMN_NAME: 'status', DATA_TYPE: 'varchar', COLUMN_TYPE: 'varchar(50)', IS_NULLABLE: 'YES', ORDINAL_POSITION: 4, COLUMN_DEFAULT: 'PENDING', COLUMN_COMMENT: 'Order status', COLUMN_KEY: '', EXTRA: '' },
                  { TABLE_NAME: 'orders', COLUMN_NAME: 'created_at', DATA_TYPE: 'datetime', COLUMN_TYPE: 'datetime', IS_NULLABLE: 'NO', ORDINAL_POSITION: 5, COLUMN_DEFAULT: 'CURRENT_TIMESTAMP', COLUMN_COMMENT: 'Order placement timestamp', COLUMN_KEY: '', EXTRA: '' },
                  { TABLE_NAME: 'order_items', COLUMN_NAME: 'item_id', DATA_TYPE: 'int', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COLUMN_DEFAULT: null, COLUMN_COMMENT: 'Item identifier', COLUMN_KEY: 'PRI', EXTRA: 'auto_increment' },
                  { TABLE_NAME: 'order_items', COLUMN_NAME: 'order_id', DATA_TYPE: 'int', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COLUMN_DEFAULT: null, COLUMN_COMMENT: 'Order link', COLUMN_KEY: 'MUL', EXTRA: '' },
                  { TABLE_NAME: 'order_items', COLUMN_NAME: 'quantity', DATA_TYPE: 'int', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 3, COLUMN_DEFAULT: '1', COLUMN_COMMENT: 'Quantity ordered', COLUMN_KEY: '', EXTRA: '' },
                  { TABLE_NAME: 'customer_order_summary', COLUMN_NAME: 'customer_id', DATA_TYPE: 'int', COLUMN_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COLUMN_DEFAULT: null, COLUMN_COMMENT: 'Customer identifier', COLUMN_KEY: '', EXTRA: '' },
                  { TABLE_NAME: 'customer_order_summary', COLUMN_NAME: 'total_orders', DATA_TYPE: 'bigint', COLUMN_TYPE: 'bigint', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COLUMN_DEFAULT: null, COLUMN_COMMENT: 'Total count of orders', COLUMN_KEY: '', EXTRA: '' }
                ]
              ];
            }
            if (/FROM information_schema\.TABLE_CONSTRAINTS/i.test(sql)) {
              return [
                [
                  { TABLE_NAME: 'orders', COLUMN_NAME: 'order_id' },
                  { TABLE_NAME: 'order_items', COLUMN_NAME: 'item_id' }
                ]
              ];
            }
            if (/SELECT count\(\*\)/i.test(sql)) {
              return [[{ count: 1420 }]];
            }
            return [[]];
          },
          end: async () => {}
        };
      };

      try {
        const ds = new DataSource({
          name: 'Test_MySQL_Disco_' + Date.now(),
          type: 'mysql',
          configuration: {
            host: '127.0.0.1',
            port: 3306,
            database: 'ecommerce_prod'
          }
        });
        ds.setCredentials({ username: 'root', password: 'secure_password' });
        await ds.save();

        const result = await invokeDiscover({
          params: { id: ds._id.toString() },
          body: {},
          query: {},
          user: testUser
        });

        assert.strictEqual(result.statusCode, 200);
        assert.strictEqual(result.data.success, true);
        const { assets, totalCount, database: discoDb } = result.data.data;
        assert.strictEqual(discoDb, 'ecommerce_prod');
        assert.strictEqual(totalCount, 3);
        assert.strictEqual(assets.length, 3);

        // Verify 'orders' table
        const ordersAsset = assets.find(a => a.name === 'orders');
        assert.ok(ordersAsset, 'orders table must be discovered');
        assert.strictEqual(ordersAsset.type, 'table');
        assert.strictEqual(ordersAsset.schema, 'ecommerce_prod');
        assert.strictEqual(ordersAsset.columnsCount, 5);
        assert.strictEqual(ordersAsset.rowCount, '1,420');
        assert.deepStrictEqual(ordersAsset.primaryKey, ['order_id']);

        const orderIdCol = ordersAsset.columns.find(c => c.name === 'order_id');
        assert.strictEqual(orderIdCol.type, 'int');
        assert.strictEqual(orderIdCol.isPrimaryKey, true);
        assert.strictEqual(orderIdCol.nullable, false);

        // Verify 'customer_order_summary' view
        const viewAsset = assets.find(a => a.name === 'customer_order_summary');
        assert.ok(viewAsset, 'customer_order_summary view must be discovered');
        assert.strictEqual(viewAsset.type, 'view');
        assert.strictEqual(viewAsset.columnsCount, 2);

        await DataSource.findByIdAndDelete(ds._id);
      } finally {
        mysql.createConnection = originalCreateConnection;
      }
    });

    test('4.2 Returns honest empty state when MySQL database has 0 tables', async () => {
      const originalCreateConnection = mysql.createConnection;

      mysql.createConnection = async () => {
        return {
          query: async () => [[]], // 0 tables
          end: async () => {}
        };
      };

      try {
        const ds = new DataSource({
          name: 'Test_MySQL_EmptyDb_' + Date.now(),
          type: 'mysql',
          configuration: {
            host: '127.0.0.1',
            port: 3306,
            database: 'empty_catalog_db'
          }
        });
        await ds.save();

        const result = await invokeDiscover({
          params: { id: ds._id.toString() },
          body: {},
          query: {},
          user: testUser
        });

        assert.strictEqual(result.statusCode, 200);
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.data.data.totalCount, 0);
        assert.deepStrictEqual(result.data.data.assets, []);

        await DataSource.findByIdAndDelete(ds._id);
      } finally {
        mysql.createConnection = originalCreateConnection;
      }
    });
  });

  // 5. CATALOG SYNCHRONIZATION & DUPLICATE PREVENTION
  describe('Phase 5 — Catalog Sync & User-Managed Metadata Preservation', () => {
    test('5.1 Synchronizes MySQL tables to Data Catalog with real schema and row counts', async () => {
      const originalCreateConnection = mysql.createConnection;

      mysql.createConnection = async () => {
        return {
          query: async (sql, params) => {
            if (/FROM information_schema\.COLUMNS/i.test(sql)) {
              return [
                [
                  { COLUMN_NAME: 'id', DATA_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COLUMN_KEY: 'PRI', COLUMN_COMMENT: 'Identifier' },
                  { COLUMN_NAME: 'sku', DATA_TYPE: 'varchar', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COLUMN_KEY: 'UNI', COLUMN_COMMENT: 'SKU code' },
                  { COLUMN_NAME: 'price', DATA_TYPE: 'decimal', IS_NULLABLE: 'NO', ORDINAL_POSITION: 3, COLUMN_KEY: '', COLUMN_COMMENT: 'Unit price' }
                ]
              ];
            }
            if (/SELECT COUNT\(\*\)/i.test(sql)) {
              return [[{ total: 540 }]];
            }
            return [[]];
          },
          end: async () => {}
        };
      };

      try {
        const ds = new DataSource({
          name: 'Test_MySQL_Sync_' + Date.now(),
          type: 'mysql',
          configuration: {
            host: '127.0.0.1',
            port: 3306,
            database: 'inventory_db'
          }
        });
        await ds.save();

        const syncResult = await invokeSync({
          params: { id: ds._id.toString() },
          body: {
            tables: ['products']
          },
          user: testUser
        });

        assert.strictEqual(syncResult.statusCode, 200);
        assert.strictEqual(syncResult.data.success, true);
        assert.strictEqual(syncResult.data.data.added, 1);

        const dataset = await Dataset.findOne({ tableName: 'products', dataSourceId: ds._id });
        assert.ok(dataset, 'Dataset must be created in catalog');
        assert.strictEqual(dataset.name, 'Products');
        assert.strictEqual(dataset.sourceType, 'MYSQL');
        assert.strictEqual(dataset.schemaName, 'inventory_db');
        assert.strictEqual(dataset.rowCount, '540');
        assert.strictEqual(dataset.columns.length, 3);

        const pkCol = dataset.columns.find(c => c.name === 'id');
        assert.strictEqual(pkCol.primaryKey, true);
        assert.strictEqual(pkCol.type, 'int');

        // Clean up
        await Dataset.findByIdAndDelete(dataset._id);
        await DataSource.findByIdAndDelete(ds._id);
      } finally {
        mysql.createConnection = originalCreateConnection;
      }
    });

    test('5.2 Prevents duplicate catalog registrations & preserves user-managed metadata on refresh', async () => {
      const originalCreateConnection = mysql.createConnection;

      let callCount = 0;
      mysql.createConnection = async () => {
        return {
          query: async (sql) => {
            if (/FROM information_schema\.COLUMNS/i.test(sql)) {
              return [
                [
                  { COLUMN_NAME: 'id', DATA_TYPE: 'int', IS_NULLABLE: 'NO', ORDINAL_POSITION: 1, COLUMN_KEY: 'PRI', COLUMN_COMMENT: 'Identifier' },
                  { COLUMN_NAME: 'title', DATA_TYPE: 'varchar', IS_NULLABLE: 'NO', ORDINAL_POSITION: 2, COLUMN_KEY: '', COLUMN_COMMENT: 'Title' }
                ]
              ];
            }
            if (/SELECT COUNT\(\*\)/i.test(sql)) {
              callCount++;
              return [[{ total: callCount === 1 ? 100 : 150 }]];
            }
            return [[]];
          },
          end: async () => {}
        };
      };

      try {
        const ds = new DataSource({
          name: 'Test_MySQL_Preserve_' + Date.now(),
          type: 'mysql',
          configuration: {
            host: '127.0.0.1',
            port: 3306,
            database: 'cms_db'
          }
        });
        await ds.save();

        // 1. Initial Sync
        const sync1 = await invokeSync({
          params: { id: ds._id.toString() },
          body: { tables: ['articles'] },
          user: testUser
        });
        assert.strictEqual(sync1.data.data.added, 1);

        let dataset = await Dataset.findOne({ tableName: 'articles', dataSourceId: ds._id });
        assert.ok(dataset);

        // 2. User edits business descriptions, tags, classification, and owner
        dataset.description = 'Curated editorial publications approved by chief editor';
        dataset.tags = ['editorial', 'curated-content', 'high-priority'];
        dataset.classification = 'Strategic';
        dataset.sensitivity = 'Restricted';
        await dataset.save();

        // 3. Second Sync (Refresh metadata)
        const sync2 = await invokeSync({
          params: { id: ds._id.toString() },
          body: { tables: ['articles'] },
          user: testUser
        });

        // Must update existing, not add duplicate
        assert.strictEqual(sync2.data.data.added, 0);
        assert.strictEqual(sync2.data.data.updatedCount, 1);

        const totalArticlesDs = await Dataset.countDocuments({ tableName: 'articles', dataSourceId: ds._id });
        assert.strictEqual(totalArticlesDs, 1, 'Duplicate datasets must not be created');

        // 4. Verify user-managed fields were preserved while technical fields refreshed
        const refreshed = await Dataset.findById(dataset._id);
        assert.strictEqual(refreshed.description, 'Curated editorial publications approved by chief editor');
        assert.ok(refreshed.tags.includes('high-priority'));
        assert.strictEqual(refreshed.classification, 'Strategic');
        assert.strictEqual(refreshed.sensitivity, 'Restricted');
        assert.strictEqual(refreshed.rowCount, '150', 'Row count must be updated from latest scan');

        // Clean up
        await Dataset.findByIdAndDelete(dataset._id);
        await DataSource.findByIdAndDelete(ds._id);
      } finally {
        mysql.createConnection = originalCreateConnection;
      }
    });
  });

  // 6. CONFIRMATION OF EXISTING POSTGRESQL INTEGRATION
  describe('CRITICAL: Verify PostgreSQL Bus Booking & Customers Table Preserved', () => {
    test('6.1 Bus Booking PostgreSQL data source exists with valid configuration intact', async () => {
      const pgDs = await DataSource.findOne({ name: /Bus Booking/i });
      assert.ok(pgDs, 'Bus Booking PostgreSQL data source MUST exist');
      assert.strictEqual(pgDs.type, 'postgresql');
      assert.strictEqual(pgDs.configuration.database, 'bus_booking');
      assert.strictEqual(pgDs.configuration.schema, 'public');
      assert.strictEqual(pgDs.configuration.port, 5432);
    });

    test('6.2 Customers dataset exists and retains its 3 customer records', async () => {
      const customersDs = await Dataset.findOne({ name: /Customers/i });
      assert.ok(customersDs, 'Customers dataset MUST exist in catalog');
      assert.strictEqual(customersDs.rowCount, '3', 'Customers dataset must retain 3 customer records');
      assert.ok(customersDs.columns.some(c => c.name === 'customer_id'), 'customer_id column must exist');
    });
  });
});
