import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PostgreSQLConnector,
  ConnectorContext,
  ConnectorConfigurationError,
  ConnectorAuthenticationError,
  ConnectorUnavailableError,
  ConnectorTimeoutError,
  ConnectorPermissionError
} from '../src/connectors/index.js';

test('Step 17 — PostgreSQL Connector Verification', async (t) => {
  await t.test('1. Capabilities: exposes full metadata, sampling, and relationship discovery', () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-pg-1',
      organizationId: 'org-pg-1',
      sourceType: 'postgresql',
      configuration: { host: 'localhost', database: 'analytics' }
    });
    const connector = new PostgreSQLConnector(ctx);

    assert.strictEqual(connector.capabilities.supportsMetadataDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsSampling, true);
    assert.strictEqual(connector.capabilities.supportsSchemaDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsColumnMetadata, true);
    assert.strictEqual(connector.capabilities.supportsRelationships, true);
    assert.strictEqual(connector.capabilities.supportsStreaming, false);
  });

  await t.test('2. Configuration validation: missing host or database throws ConnectorConfigurationError', async () => {
    const noHostCtx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { database: 'analytics' }
    });
    const connector1 = new PostgreSQLConnector(noHostCtx);
    await assert.rejects(() => connector1.connect(), ConnectorConfigurationError);

    const noDbCtx = new ConnectorContext({
      dataSourceId: 'ds-2',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: 'localhost' }
    });
    const connector2 = new PostgreSQLConnector(noDbCtx);
    await assert.rejects(() => connector2.connect(), ConnectorConfigurationError);
  });

  await t.test('3. SQL Injection Defense: validates identifiers and rejects malicious characters', () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: 'localhost', database: 'analytics' }
    });
    const connector = new PostgreSQLConnector(ctx);

    // Malicious identifiers with SQL injection payloads
    assert.throws(
      () => connector._validateIdentifier('users; DROP TABLE test;--', 'Table'),
      (err) => {
        assert.strictEqual(err instanceof ConnectorConfigurationError, true);
        assert.match(err.message, /Invalid or unsafe table identifier/);
        return true;
      }
    );

    assert.throws(
      () => connector._validateIdentifier('public" OR 1=1--', 'Schema'),
      (err) => {
        assert.strictEqual(err instanceof ConnectorConfigurationError, true);
        return true;
      }
    );

    // Safe identifiers pass validation
    assert.doesNotThrow(() => connector._validateIdentifier('public', 'Schema'));
    assert.doesNotThrow(() => connector._validateIdentifier('user_profiles_2026', 'Table'));
  });

  await t.test('4. Safe Identifier Quoting: properly wraps valid identifiers in double quotes', () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: 'localhost', database: 'analytics' }
    });
    const connector = new PostgreSQLConnector(ctx);

    assert.strictEqual(connector._quoteIdentifier('public'), '"public"');
    assert.strictEqual(connector._quoteIdentifier('dim_customers'), '"dim_customers"');
  });

  await t.test('5. Error Mapping: maps PostgreSQL driver error codes to normalized connector errors', () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: 'db.example.com', database: 'analytics' }
    });
    const connector = new PostgreSQLConnector(ctx);

    // Auth error (28P01)
    const authErr = connector._mapError({ code: '28P01', message: 'password authentication failed for user "test"' });
    assert.strictEqual(authErr instanceof ConnectorAuthenticationError, true);
    assert.strictEqual(authErr.statusCode, 401);

    // Connection refused (ECONNREFUSED)
    const refusedErr = connector._mapError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' });
    assert.strictEqual(refusedErr instanceof ConnectorUnavailableError, true);
    assert.strictEqual(refusedErr.statusCode, 503);

    // Timeout (57014)
    const timeoutErr = connector._mapError({ code: '57014', message: 'canceling statement due to statement timeout' });
    assert.strictEqual(timeoutErr instanceof ConnectorTimeoutError, true);
    assert.strictEqual(timeoutErr.statusCode, 504);

    // Permission denied (42501)
    const permErr = connector._mapError({ code: '42501', message: 'permission denied for table users' });
    assert.strictEqual(permErr instanceof ConnectorPermissionError, true);
    assert.strictEqual(permErr.statusCode, 403);
  });

  await t.test('6. Pool lifecycle & disconnect: closes pool cleanly and resets state', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: '127.0.0.1', port: 5432, database: 'analytics', poolSize: 3 },
      credentials: { username: 'testuser', password: 'secretPassword123' }
    });
    const connector = new PostgreSQLConnector(ctx);

    await connector.connect();
    assert.strictEqual(connector.isConnected, true);
    assert.notStrictEqual(connector.pool, null);

    await connector.disconnect();
    assert.strictEqual(connector.isConnected, false);
    assert.strictEqual(connector.pool, null);
  });

  await t.test('7. Mocked Client Integration: test() executes SELECT 1 and returns health response', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: '127.0.0.1', database: 'analytics', schema: 'public' },
      credentials: { username: 'testuser', password: 'secretPassword123' }
    });
    const connector = new PostgreSQLConnector(ctx);

    // Mock pool client
    const mockClient = {
      query: async (queryText) => {
        if (queryText.includes('SELECT 1')) {
          return {
            rows: [
              {
                alive: 1,
                server_version: 'PostgreSQL 16.2 on x86_64',
                current_db: 'analytics'
              }
            ]
          };
        }
        return { rows: [] };
      },
      release: () => {}
    };

    connector.pool = {
      connect: async () => mockClient,
      end: async () => {}
    };
    connector.isConnected = true;

    const result = await connector.test();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'HEALTHY');
    assert.strictEqual(result.connectorType, 'postgresql');
    assert.strictEqual(typeof result.latencyMs, 'number');
    assert.strictEqual(result.details.database, 'analytics');
    assert.strictEqual(result.details.schema, 'public');
    // Ensure no password in result
    assert.strictEqual(JSON.stringify(result).includes('secretPassword123'), false);
  });

  await t.test('8. Mocked Client Integration: fetchMetadata introspects tables, columns, PKs, FKs, and indexes', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: '127.0.0.1', database: 'analytics', schema: 'public' }
    });
    const connector = new PostgreSQLConnector(ctx);

    const mockClient = {
      query: async (sql, params) => {
        if (sql.includes('FROM information_schema.tables')) {
          return {
            rows: [
              { table_schema: 'public', table_name: 'orders', table_type: 'BASE TABLE' },
              { table_schema: 'public', table_name: 'order_summary_view', table_type: 'VIEW' }
            ]
          };
        }
        if (sql.includes('FROM information_schema.columns')) {
          return {
            rows: [
              { table_name: 'orders', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', ordinal_position: 1, column_default: 'gen_random_uuid()' },
              { table_name: 'orders', column_name: 'customer_id', data_type: 'uuid', is_nullable: 'NO', ordinal_position: 2, column_default: null },
              { table_name: 'orders', column_name: 'total_amount', data_type: 'numeric', is_nullable: 'YES', ordinal_position: 3, column_default: '0.00' }
            ]
          };
        }
        if (sql.includes('FROM information_schema.table_constraints tc') && sql.includes('PRIMARY KEY')) {
          return {
            rows: [
              { table_name: 'orders', column_name: 'id' }
            ]
          };
        }
        if (sql.includes('FOREIGN KEY')) {
          return {
            rows: [
              {
                table_name: 'orders',
                column_name: 'customer_id',
                constraint_name: 'fk_orders_customer',
                foreign_table_schema: 'public',
                foreign_table_name: 'customers',
                foreign_column_name: 'id'
              }
            ]
          };
        }
        if (sql.includes('FROM pg_indexes')) {
          return {
            rows: [
              { tablename: 'orders', indexname: 'idx_orders_customer_id', indexdef: 'CREATE INDEX idx_orders_customer_id ON public.orders (customer_id)' }
            ]
          };
        }
        return { rows: [] };
      },
      release: () => {}
    };

    connector.pool = {
      connect: async () => mockClient,
      end: async () => {}
    };
    connector.isConnected = true;

    const metadata = await connector.fetchMetadata();
    assert.strictEqual(metadata.sourceType, 'postgresql');
    assert.strictEqual(metadata.database, 'analytics');
    assert.strictEqual(metadata.schema, 'public');
    assert.strictEqual(metadata.tables.length, 2);

    const ordersTable = metadata.tables.find((t) => t.name === 'orders');
    assert.notStrictEqual(ordersTable, undefined);
    assert.strictEqual(ordersTable.externalId, 'public.orders');
    assert.strictEqual(ordersTable.type, 'table');
    assert.strictEqual(ordersTable.columns.length, 3);

    const idCol = ordersTable.columns.find((c) => c.name === 'id');
    assert.strictEqual(idCol.isPrimaryKey, true);
    assert.strictEqual(idCol.nullable, false);

    const custCol = ordersTable.columns.find((c) => c.name === 'customer_id');
    assert.strictEqual(custCol.isForeignKey, true);

    assert.strictEqual(ordersTable.primaryKey[0], 'id');
    assert.strictEqual(ordersTable.foreignKeys[0].referencedTable, 'customers');
    assert.strictEqual(ordersTable.indexes[0].name, 'idx_orders_customer_id');

    const view = metadata.tables.find((t) => t.name === 'order_summary_view');
    assert.strictEqual(view.type, 'view');
  });

  await t.test('9. Mocked Client Integration: sampleData enforces bounded limit and parameterized queries', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'postgresql',
      configuration: { host: '127.0.0.1', database: 'analytics', schema: 'public' }
    });
    const connector = new PostgreSQLConnector(ctx);

    let executedQuery = '';
    let executedParams = [];

    const mockClient = {
      query: async (sql, params) => {
        executedQuery = sql;
        executedParams = params;
        return {
          fields: [{ name: 'id' }, { name: 'email' }, { name: 'balance' }],
          rowCount: 2,
          rows: [
            { id: 1, email: 'user1@example.com', balance: 100 },
            { id: 2, email: 'user2@example.com', balance: 250 }
          ]
        };
      },
      release: () => {}
    };

    connector.pool = {
      connect: async () => mockClient,
      end: async () => {}
    };
    connector.isConnected = true;

    const sample = await connector.sampleData({ tableName: 'customers', limit: 25 });
    assert.strictEqual(executedQuery, 'SELECT * FROM "public"."customers" LIMIT $1');
    assert.deepStrictEqual(executedParams, [25]);
    assert.strictEqual(sample.datasetName, 'customers');
    assert.strictEqual(sample.rowCount, 2);
    assert.deepStrictEqual(sample.columns, ['id', 'email', 'balance']);
    assert.strictEqual(sample.rows.length, 2);
  });

  await t.test('10. Live connectivity failure behavior: non-existent local port throws ConnectorUnavailableError', async () => {
    // Port 54399 is unused and will refuse connection immediately
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-unreachable',
      organizationId: 'org-unreachable',
      sourceType: 'postgresql',
      configuration: { host: '127.0.0.1', port: 54399, database: 'unreachable_db' },
      credentials: { username: 'nobody', password: 'nopassword' },
      timeouts: { connect: 1000 }
    });
    const connector = new PostgreSQLConnector(ctx);

    await assert.rejects(
      () => connector.test(),
      (err) => {
        assert.strictEqual(
          err instanceof ConnectorUnavailableError || err instanceof ConnectorTimeoutError,
          true
        );
        return true;
      }
    );
  });
});
