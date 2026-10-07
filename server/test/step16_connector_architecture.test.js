import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  BaseConnector,
  ConnectorRegistry,
  connectorRegistry,
  ConnectorFactory,
  ConnectorContext,
  ConnectorError,
  ConnectorConfigurationError,
  ConnectorAuthenticationError,
  ConnectorTimeoutError,
  ConnectorUnavailableError,
  ConnectorPermissionError,
  ConnectorQueryError,
  ConnectorUnsupportedError
} from '../src/connectors/index.js';
import { DataSource } from '../src/models/DataSource.js';
import { connectDB, disconnectDB } from '../src/config/database.js';

test('Step 16 — Connector Architecture Verification', async (t) => {
  await connectDB();

  const testOrgId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();

  await t.test('1. Error model: custom connector errors inherit from ConnectorError and serialize safely', () => {
    const err = new ConnectorTimeoutError('Query took too long', { query: 'SELECT 1' });
    assert.strictEqual(err instanceof Error, true);
    assert.strictEqual(err instanceof ConnectorError, true);
    assert.strictEqual(err instanceof ConnectorTimeoutError, true);
    assert.strictEqual(err.code, 'CONNECTOR_TIMEOUT_ERROR');
    assert.strictEqual(err.statusCode, 504);
    assert.strictEqual(err.message, 'Query took too long');
    assert.deepStrictEqual(err.toJSON(), {
      code: 'CONNECTOR_TIMEOUT_ERROR',
      message: 'Query took too long',
      details: { query: 'SELECT 1' }
    });

    const authErr = new ConnectorAuthenticationError('Bad password');
    assert.strictEqual(authErr.statusCode, 401);
    assert.strictEqual(authErr.code, 'CONNECTOR_AUTHENTICATION_ERROR');

    const unsuppErr = new ConnectorUnsupportedError('Not supported');
    assert.strictEqual(unsuppErr.statusCode, 501);
    assert.strictEqual(unsuppErr.code, 'CONNECTOR_UNSUPPORTED_ERROR');
  });

  await t.test('2. ConnectorRegistry: registration, lookup, and supported types list', () => {
    const registry = new ConnectorRegistry();

    class MockPgConnector extends BaseConnector {}
    registry.register('postgresql', MockPgConnector);

    assert.strictEqual(registry.has('postgresql'), true);
    assert.strictEqual(registry.has('POSTGRESQL'), true); // case-insensitive
    assert.strictEqual(registry.get('postgresql'), MockPgConnector);
    assert.deepStrictEqual(registry.getSupportedTypes(), ['postgresql']);
  });

  await t.test('3. ConnectorRegistry: unknown connector type throws ConnectorUnsupportedError', () => {
    const registry = new ConnectorRegistry();
    assert.throws(
      () => registry.get('oracle_unsupported'),
      (err) => {
        assert.strictEqual(err instanceof ConnectorUnsupportedError, true);
        assert.match(err.message, /unsupported or has not been registered/);
        return true;
      }
    );
  });

  await t.test('4. ConnectorRegistry: invalid registration inputs are rejected', () => {
    const registry = new ConnectorRegistry();
    assert.throws(() => registry.register('', class {}), /non-empty string/);
    assert.throws(() => registry.register('pg', null), /constructor function/);
  });

  await t.test('5. ConnectorContext: sanitizes configuration and protects credentials from toJSON', () => {
    const rawConfig = {
      host: 'db.internal',
      port: 5432,
      database: 'prod',
      password: 'leak_me',
      apiKey: 'secret_key'
    };
    const creds = { password: 'mySuperSecretPassword123' };

    const ctx = new ConnectorContext({
      dataSourceId: 'ds-123',
      organizationId: 'org-456',
      sourceType: 'POSTGRESQL',
      configuration: rawConfig,
      credentials: creds
    });

    assert.strictEqual(ctx.sourceType, 'postgresql');
    assert.strictEqual(ctx.configuration.host, 'db.internal');
    assert.strictEqual(ctx.configuration.port, 5432);
    // Secret fields stripped from configuration clone
    assert.strictEqual(ctx.configuration.password, undefined);
    assert.strictEqual(ctx.configuration.apiKey, undefined);

    // toJSON representation strictly omits credentials
    const json = ctx.toJSON();
    assert.strictEqual(json.credentials, undefined);
    assert.strictEqual(json._credentials, undefined);
    assert.strictEqual(JSON.stringify(json).includes('mySuperSecretPassword123'), false);

    // Decrypted credentials remain accessible only within execution boundary
    assert.strictEqual(ctx.getCredentials().password, 'mySuperSecretPassword123');
  });

  await t.test('6. BaseConnector: default methods throw ConnectorUnsupportedError and expose capabilities', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'generic'
    });
    const connector = new BaseConnector(ctx);

    assert.strictEqual(connector.capabilities.supportsMetadataDiscovery, false);
    assert.strictEqual(connector.capabilities.supportsSampling, false);

    await assert.rejects(() => connector.connect(), ConnectorUnsupportedError);
    await assert.rejects(() => connector.test(), ConnectorUnsupportedError);
    await assert.rejects(() => connector.fetchMetadata(), ConnectorUnsupportedError);
    await assert.rejects(() => connector.sampleData(), ConnectorUnsupportedError);
  });

  await t.test('7. BaseConnector.withTimeout: aborts and throws ConnectorTimeoutError on slow operations', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-1',
      organizationId: 'org-1',
      sourceType: 'generic'
    });
    const connector = new BaseConnector(ctx);

    const slowPromise = new Promise((resolve) => setTimeout(resolve, 500));
    await assert.rejects(
      () => connector.withTimeout(slowPromise, 50, 'SlowQuery'),
      (err) => {
        assert.strictEqual(err instanceof ConnectorTimeoutError, true);
        assert.match(err.message, /SlowQuery timed out after 50ms/);
        return true;
      }
    );
  });

  await t.test('8. BaseConnector.executeWithLifecycle: enforces construct -> connect -> operate -> disconnect with cleanup', async () => {
    let connectCalled = false;
    let disconnectCalled = false;
    let operationExecuted = false;

    class LifecycleTestConnector extends BaseConnector {
      async connect() {
        connectCalled = true;
        this.isConnected = true;
      }
      async disconnect() {
        disconnectCalled = true;
        this.isConnected = false;
      }
    }

    const ctx = new ConnectorContext({
      dataSourceId: 'ds-test',
      organizationId: 'org-test',
      sourceType: 'lifecycle_test'
    });
    const connector = new LifecycleTestConnector(ctx);

    const result = await connector.executeWithLifecycle(async (conn) => {
      assert.strictEqual(conn.isConnected, true);
      operationExecuted = true;
      return 'operation_success';
    });

    assert.strictEqual(result, 'operation_success');
    assert.strictEqual(connectCalled, true);
    assert.strictEqual(operationExecuted, true);
    assert.strictEqual(disconnectCalled, true);
    assert.strictEqual(connector.isConnected, false);
  });

  await t.test('9. BaseConnector.executeWithLifecycle: guarantees disconnect cleanup even on operation failure', async () => {
    let disconnectCalled = false;

    class FaultyConnector extends BaseConnector {
      async connect() {
        this.isConnected = true;
      }
      async disconnect() {
        disconnectCalled = true;
        this.isConnected = false;
      }
    }

    const ctx = new ConnectorContext({
      dataSourceId: 'ds-test',
      organizationId: 'org-test',
      sourceType: 'faulty'
    });
    const connector = new FaultyConnector(ctx);

    await assert.rejects(
      () => connector.executeWithLifecycle(async () => {
        throw new Error('Database query failure during operation');
      }),
      /Database query failure during operation/
    );

    assert.strictEqual(disconnectCalled, true);
    assert.strictEqual(connector.isConnected, false);
  });

  await t.test('10. ConnectorFactory: creates connector from DataSource with envelope-encrypted credentials', async () => {
    class MockDbConnector extends BaseConnector {
      constructor(ctx) {
        super(ctx);
        this.receivedCredentials = ctx.getCredentials();
      }
    }

    // Register on the shared singleton registry
    connectorRegistry.register('postgresql', MockDbConnector);

    const ds = new DataSource({
      organizationId: testOrgId,
      name: 'Test Secure DB',
      type: 'postgresql',
      configuration: {
        host: 'db.example.internal',
        port: 5432
      },
      status: 'ACTIVE',
      createdBy: testUserId
    });

    // Set credentials encrypted with AES-256-GCM
    ds.setCredentials({ password: 'secretDecryptedPassword999', username: 'admin' });
    await ds.save();

    // Factory creates connector and decrypts credentials in memory
    const connectorInstance = ConnectorFactory.createFromDataSource(ds);
    assert.strictEqual(connectorInstance instanceof MockDbConnector, true);
    assert.strictEqual(connectorInstance.type, 'postgresql');
    assert.strictEqual(connectorInstance.receivedCredentials.password, 'secretDecryptedPassword999');
    assert.strictEqual(connectorInstance.receivedCredentials.username, 'admin');

    // Clean up
    await DataSource.findByIdAndDelete(ds._id);
  });

  await disconnectDB();
});
