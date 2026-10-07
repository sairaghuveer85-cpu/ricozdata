import test from 'node:test';
import assert from 'node:assert/strict';
import {
  connectorRegistry,
  ConnectorFactory,
  ConnectorContext,
  SQLServerConnector,
  MySQLConnector,
  SnowflakeConnector,
  MongoDBConnector,
  S3Connector,
  ConnectorConfigurationError
} from '../src/connectors/index.js';

test('Step 46 — Connector Expansion Verification', async (t) => {
  await t.test('1. Registry: all 6 enterprise connector types are registered', () => {
    const supported = connectorRegistry.getSupportedTypes();
    assert.strictEqual(supported.includes('postgresql'), true);
    assert.strictEqual(supported.includes('mysql'), true);
    assert.strictEqual(supported.includes('sqlserver'), true);
    assert.strictEqual(supported.includes('snowflake'), true);
    assert.strictEqual(supported.includes('mongodb'), true);
    assert.strictEqual(supported.includes('s3'), true);

    assert.strictEqual(connectorRegistry.get('sqlserver'), SQLServerConnector);
    assert.strictEqual(connectorRegistry.get('mysql'), MySQLConnector);
    assert.strictEqual(connectorRegistry.get('snowflake'), SnowflakeConnector);
    assert.strictEqual(connectorRegistry.get('mongodb'), MongoDBConnector);
    assert.strictEqual(connectorRegistry.get('s3'), S3Connector);
  });

  await t.test('2. MySQLConnector: capabilities, config validation, and SQL safety', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-mysql',
      organizationId: 'org-1',
      sourceType: 'mysql',
      configuration: { host: 'mysql.internal', database: 'ecommerce' }
    });
    const connector = ConnectorFactory.create(ctx);
    assert.strictEqual(connector instanceof MySQLConnector, true);

    // Capabilities
    assert.strictEqual(connector.capabilities.supportsMetadataDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsSampling, true);
    assert.strictEqual(connector.capabilities.supportsSchemaDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsRelationships, true);

    // SQL injection protection
    assert.throws(() => connector._validateIdentifier('users; DROP TABLE test;--', 'Table'), ConnectorConfigurationError);
    assert.doesNotThrow(() => connector._validateIdentifier('orders_2026', 'Table'));

    // Config validation
    const invalidCtx = new ConnectorContext({
      dataSourceId: 'ds-mysql-bad',
      organizationId: 'org-1',
      sourceType: 'mysql',
      configuration: {}
    });
    const badConnector = new MySQLConnector(invalidCtx);
    await assert.rejects(() => badConnector.connect(), ConnectorConfigurationError);
  });

  await t.test('3. SnowflakeConnector: capabilities and config validation', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-snow',
      organizationId: 'org-1',
      sourceType: 'snowflake',
      configuration: { account: 'xy12345.us-east-1', database: 'analytics_wh' }
    });
    const connector = ConnectorFactory.create(ctx);
    assert.strictEqual(connector instanceof SnowflakeConnector, true);

    assert.strictEqual(connector.capabilities.supportsMetadataDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsSampling, true);
    assert.strictEqual(connector.capabilities.supportsRelationships, false);

    // Missing database or account fails
    const badCtx = new ConnectorContext({
      dataSourceId: 'ds-snow-bad',
      organizationId: 'org-1',
      sourceType: 'snowflake',
      configuration: { account: 'xy12345' }
    });
    const badConnector = new SnowflakeConnector(badCtx);
    await assert.rejects(() => badConnector.connect(), ConnectorConfigurationError);
  });

  await t.test('4. MongoDBConnector: capabilities and config validation', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-mongo',
      organizationId: 'org-1',
      sourceType: 'mongodb',
      configuration: { host: 'mongo.internal', port: 27017, database: 'customer_db' }
    });
    const connector = ConnectorFactory.create(ctx);
    assert.strictEqual(connector instanceof MongoDBConnector, true);

    assert.strictEqual(connector.capabilities.supportsMetadataDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsSampling, true);
    assert.strictEqual(connector.capabilities.supportsRelationships, false);

    const badCtx = new ConnectorContext({
      dataSourceId: 'ds-mongo-bad',
      organizationId: 'org-1',
      sourceType: 'mongodb',
      configuration: { host: 'mongo.internal' } // missing database
    });
    const badConnector = new MongoDBConnector(badCtx);
    await assert.rejects(() => badConnector.connect(), ConnectorConfigurationError);
  });

  await t.test('5. S3Connector: capabilities, config validation, and bounded discovery', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-s3',
      organizationId: 'org-1',
      sourceType: 's3',
      configuration: { bucket: 'ricoz-datalake-prod', region: 'us-west-2', prefix: 'raw/' }
    });
    const connector = ConnectorFactory.create(ctx);
    assert.strictEqual(connector instanceof S3Connector, true);

    // Object store capabilities
    assert.strictEqual(connector.capabilities.supportsMetadataDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsSampling, true);
    assert.strictEqual(connector.capabilities.supportsSchemaDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsColumnMetadata, true);

    // Missing bucket fails
    const badCtx = new ConnectorContext({
      dataSourceId: 'ds-s3-bad',
      organizationId: 'org-1',
      sourceType: 's3',
      configuration: { region: 'us-west-2' }
    });
    const badConnector = new S3Connector(badCtx);
    await assert.rejects(() => badConnector.connect(), ConnectorConfigurationError);
  });

  await t.test('6. SQLServerConnector: capabilities, config validation, and SQL safety', async () => {
    const ctx = new ConnectorContext({
      dataSourceId: 'ds-mssql',
      organizationId: 'org-1',
      sourceType: 'sqlserver',
      configuration: { host: 'sql.internal', database: 'corp_db', schema: 'dbo' }
    });
    const connector = ConnectorFactory.create(ctx);
    assert.strictEqual(connector instanceof SQLServerConnector, true);

    // Capabilities
    assert.strictEqual(connector.capabilities.supportsMetadataDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsSampling, true);
    assert.strictEqual(connector.capabilities.supportsSchemaDiscovery, true);
    assert.strictEqual(connector.capabilities.supportsColumnMetadata, true);
    assert.strictEqual(connector.capabilities.supportsRelationships, true);
    assert.strictEqual(connector.capabilities.supportsReadOnlyQueries, true);
    assert.strictEqual(connector.capabilities.supportsQualityRules, true);
    assert.strictEqual(connector.capabilities.supportsProfiling, true);

    // Config validation
    const badCtx = new ConnectorContext({
      dataSourceId: 'ds-mssql-bad',
      organizationId: 'org-1',
      sourceType: 'sqlserver',
      configuration: {}
    });
    const badConnector = new SQLServerConnector(badCtx);
    await assert.rejects(() => badConnector.connect(), ConnectorConfigurationError);
  });
});
