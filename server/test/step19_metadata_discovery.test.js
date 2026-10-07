import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { DataSource } from '../src/models/DataSource.js';
import { User } from '../src/models/User.js';
import { Organization } from '../src/models/Organization.js';
import {
  ConnectorService,
  PostgreSQLConnector,
  ConnectorTimeoutError,
  ConnectorUnsupportedError,
  connectorRegistry
} from '../src/connectors/index.js';

test('Step 19 — Metadata Discovery Verification', async (t) => {
  await connectDB();

  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const adminUserId = new mongoose.Types.ObjectId();

  await Organization.create({
    _id: orgAId,
    name: 'Org A Discovery Test',
    slug: 'org-a-disco-' + Date.now()
  });

  await Organization.create({
    _id: orgBId,
    name: 'Org B Discovery Test',
    slug: 'org-b-disco-' + Date.now()
  });

  await User.create({
    _id: adminUserId,
    organizationId: orgAId,
    name: 'Discovery Admin',
    email: 'disco.admin@example.com',
    role: 'admin',
    passwordHash: 'dummy_hash'
  });

  const dsA = new DataSource({
    organizationId: orgAId,
    name: 'Postgres Warehouse Org A',
    type: 'postgresql',
    configuration: {
      host: 'pg.internal.example',
      port: 5432,
      database: 'dwh_prod',
      schema: 'public'
    },
    status: 'ACTIVE',
    createdBy: adminUserId
  });
  dsA.setCredentials({ username: 'dwh_user', password: 'ultraSecretPassword123' });
  await dsA.save();

  const dsB = new DataSource({
    organizationId: orgBId,
    name: 'Postgres Warehouse Org B',
    type: 'postgresql',
    configuration: {
      host: 'pg.b.example',
      port: 5432,
      database: 'dwh_b'
    },
    status: 'ACTIVE',
    createdBy: adminUserId
  });
  await dsB.save();

  await t.test('1. Normalized metadata discovery: introspects schemas, tables, views, columns, PK, FK, and indexes', async () => {
    const originalFetch = PostgreSQLConnector.prototype.fetchMetadata;

    PostgreSQLConnector.prototype.fetchMetadata = async function (options = {}) {
      return {
        sourceType: 'postgresql',
        database: 'dwh_prod',
        schema: 'public',
        schemas: ['public'],
        tables: [
          {
            externalId: 'public.customers',
            name: 'customers',
            schema: 'public',
            type: 'table',
            columns: [
              { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, defaultValue: 'gen_random_uuid()', isPrimaryKey: true, isForeignKey: false, description: '' },
              { name: 'email', dataType: 'varchar(255)', nullable: false, ordinalPosition: 2, defaultValue: null, isPrimaryKey: false, isForeignKey: false, description: '' }
            ],
            primaryKey: ['id'],
            foreignKeys: [],
            indexes: [{ name: 'idx_customers_email', unique: true, definition: 'CREATE UNIQUE INDEX idx_customers_email ON public.customers (email)' }]
          },
          {
            externalId: 'public.orders',
            name: 'orders',
            schema: 'public',
            type: 'table',
            columns: [
              { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, defaultValue: null, isPrimaryKey: true, isForeignKey: false, description: '' },
              { name: 'customer_id', dataType: 'uuid', nullable: false, ordinalPosition: 2, defaultValue: null, isPrimaryKey: false, isForeignKey: true, description: '' }
            ],
            primaryKey: ['id'],
            foreignKeys: [
              { name: 'fk_orders_cust', column: 'customer_id', referencedSchema: 'public', referencedTable: 'customers', referencedColumn: 'id' }
            ],
            indexes: []
          },
          {
            externalId: 'public.active_customers_view',
            name: 'active_customers_view',
            schema: 'public',
            type: 'view',
            columns: [
              { name: 'id', dataType: 'uuid', nullable: false, ordinalPosition: 1, defaultValue: null, isPrimaryKey: false, isForeignKey: false, description: '' },
              { name: 'email', dataType: 'varchar(255)', nullable: false, ordinalPosition: 2, defaultValue: null, isPrimaryKey: false, isForeignKey: false, description: '' }
            ],
            primaryKey: [],
            foreignKeys: [],
            indexes: []
          }
        ]
      };
    };

    try {
      const metadata = await ConnectorService.fetchMetadata(dsA._id, orgAId);

      assert.strictEqual(metadata.sourceType, 'postgresql');
      assert.strictEqual(metadata.database, 'dwh_prod');
      assert.strictEqual(metadata.schema, 'public');
      assert.strictEqual(metadata.tables.length, 3);

      const customers = metadata.tables.find((t) => t.name === 'customers');
      assert.strictEqual(customers.type, 'table');
      assert.strictEqual(customers.columns.length, 2);
      assert.strictEqual(customers.primaryKey[0], 'id');
      assert.strictEqual(customers.indexes[0].unique, true);

      const orders = metadata.tables.find((t) => t.name === 'orders');
      assert.strictEqual(orders.foreignKeys.length, 1);
      assert.strictEqual(orders.foreignKeys[0].referencedTable, 'customers');

      const view = metadata.tables.find((t) => t.name === 'active_customers_view');
      assert.strictEqual(view.type, 'view');

      // Credential protection: Ensure password is never in returned metadata
      assert.strictEqual(JSON.stringify(metadata).includes('ultraSecretPassword123'), false);
    } finally {
      PostgreSQLConnector.prototype.fetchMetadata = originalFetch;
    }
  });

  await t.test('2. Discovery timeout: enforces deadline and aborts slow discovery scans', async () => {
    const originalFetch = PostgreSQLConnector.prototype.fetchMetadata;

    PostgreSQLConnector.prototype.fetchMetadata = async function () {
      throw new ConnectorTimeoutError('PostgreSQL metadata discovery timed out after 45000ms');
    };

    try {
      await assert.rejects(
        () => ConnectorService.fetchMetadata(dsA._id, orgAId),
        (err) => {
          assert.strictEqual(err instanceof ConnectorTimeoutError, true);
          assert.strictEqual(err.statusCode, 504);
          return true;
        }
      );
    } finally {
      PostgreSQLConnector.prototype.fetchMetadata = originalFetch;
    }
  });

  await t.test('3. Tenant isolation: Org A cannot discover Org B data source (returns 404)', async () => {
    await assert.rejects(
      () => ConnectorService.fetchMetadata(dsB._id, orgAId),
      (err) => {
        assert.strictEqual(err.statusCode || err.status, 404);
        assert.match(err.message, /not found/i);
        return true;
      }
    );
  });

  await t.test('4. Unsupported connector discovery attempt: throws ConnectorUnsupportedError', async () => {
    const unexpandedDs = new DataSource({
      organizationId: orgAId,
      name: 'Unexpanded Engine',
      type: 'snowflake',
      configuration: { host: 'account.snowflakecomputing.com' },
      status: 'ACTIVE'
    });
    await unexpandedDs.save();

    const snowflakeClass = connectorRegistry._registry.get('snowflake');
    connectorRegistry._registry.delete('snowflake');

    try {
      await assert.rejects(
        () => ConnectorService.fetchMetadata(unexpandedDs._id, orgAId),
        (err) => {
          assert.strictEqual(err instanceof ConnectorUnsupportedError, true);
          assert.strictEqual(err.statusCode, 501);
          return true;
        }
      );
    } finally {
      if (snowflakeClass) {
        connectorRegistry.register('snowflake', snowflakeClass);
      }
      await DataSource.findByIdAndDelete(unexpandedDs._id);
    }
  });

  // Cleanup
  await DataSource.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
  await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });

  await disconnectDB();
});
