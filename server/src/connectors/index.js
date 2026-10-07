export * from './errors.js';
export * from './ConnectorContext.js';
export * from './BaseConnector.js';
export * from './ConnectorRegistry.js';
export * from './ConnectorFactory.js';
export * from './ConnectorService.js';
export * from './PostgreSQLConnector.js';
export * from './MySQLConnector.js';
export * from './SnowflakeConnector.js';
export * from './MongoDBConnector.js';
export * from './S3Connector.js';
export * from './SQLServerConnector.js';

import { connectorRegistry } from './ConnectorRegistry.js';
import { PostgreSQLConnector } from './PostgreSQLConnector.js';
import { MySQLConnector } from './MySQLConnector.js';
import { SQLServerConnector } from './SQLServerConnector.js';
import { SnowflakeConnector } from './SnowflakeConnector.js';
import { MongoDBConnector } from './MongoDBConnector.js';
import { S3Connector } from './S3Connector.js';

// Centralized registry of enterprise connectors
connectorRegistry.register('postgresql', PostgreSQLConnector);
connectorRegistry.register('mysql', MySQLConnector);
connectorRegistry.register('sqlserver', SQLServerConnector);
connectorRegistry.register('snowflake', SnowflakeConnector);
connectorRegistry.register('mongodb', MongoDBConnector);
connectorRegistry.register('s3', S3Connector);


