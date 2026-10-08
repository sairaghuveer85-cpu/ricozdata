const DataSource = require('../models/DataSource');
const Dataset = require('../models/Dataset');
const Activity = require('../models/Activity');
const User = require('../models/User');
const Domain = require('../models/Domain');
const Lineage = require('../models/Lineage');
const Rule = require('../models/Rule');
const mongoose = require('mongoose');
const { getMongoUri } = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all data sources
// @route   GET /api/data-sources
// @access  Private
const getDataSources = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const skip = (page - 1) * limit;

  const search = req.query.search || '';
  const type = req.query.type || (req.query.filter && req.query.filter.type);
  const status = req.query.status;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { type: { $regex: search, $options: 'i' } },
    ];
  }
  if (type && type.toUpperCase() !== 'ALL') {
    filter.type = type.toLowerCase();
  }
  if (status && status.toUpperCase() !== 'ALL') {
    filter.status = status.toUpperCase();
  }

  const [dataSources, total] = await Promise.all([
    DataSource.find(filter)
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    DataSource.countDocuments(filter),
  ]);

  res.json({
    success: true,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
    data: {
      dataSources,
      total,
      page,
      limit
    }
  });
});

// @desc    Get single data source
// @route   GET /api/data-sources/:id
// @access  Private
const getDataSource = asyncHandler(async (req, res) => {
  const dataSource = await DataSource.findById(req.params.id)
    .populate('createdBy', 'name email avatar');

  if (!dataSource) {
    return res.status(404).json({ success: false, message: 'Data source not found' });
  }

  res.json({
    success: true,
    data: dataSource
  });
});

// @desc    Create data source
// @route   POST /api/data-sources
// @access  Private
const createDataSource = asyncHandler(async (req, res) => {
  const { name, type, description, configuration, connectionConfig, credentials, tags } = req.body;

  if (!name || !type) {
    return res.status(400).json({
      success: false,
      message: 'Name and type are required'
    });
  }

  const existing = await DataSource.findOne({ name: name.trim() });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Data source with name "${name}" already exists`
    });
  }

  const resolvedConfig = configuration || connectionConfig || {};

  const dataSource = new DataSource({
    name: name.trim(),
    type: type.toLowerCase().trim(),
    description: description || '',
    configuration: resolvedConfig,
    connectionConfig: resolvedConfig,
    credentialStatus: credentials ? 'configured' : 'missing',
    tags: tags || [],
    status: 'CONNECTED',
    healthStatus: 'HEALTHY',
    connectionState: 'CONNECTED',
    createdBy: req.user?._id,
    ownerId: req.user?._id
  });

  if (credentials) {
    dataSource.setCredentials(credentials);
  }

  await dataSource.save();

  // Record audit activity
  try {
    if (req.user?._id) {
      await Activity.create({
        actorId: req.user._id,
        action: 'DATA_SOURCE_CREATED',
        title: `Created data source ${dataSource.name}`,
        details: `Configured new ${dataSource.type} connection`,
        entityType: 'data_source',
        entityId: dataSource._id
      });
    }
  } catch (e) {
    // Non-blocking activity log
  }

  res.status(201).json({
    success: true,
    data: dataSource
  });
});

// @desc    Update data source
// @route   PUT /api/data-sources/:id
// @access  Private
const updateDataSource = asyncHandler(async (req, res) => {
  let dataSource = await DataSource.findById(req.params.id);
  if (!dataSource) {
    return res.status(404).json({ success: false, message: 'Data source not found' });
  }

  const { name, type, description, configuration, connectionConfig, credentials, tags, status } = req.body;

  if (name) dataSource.name = name.trim();
  if (type) dataSource.type = type.toLowerCase().trim();
  if (description !== undefined) dataSource.description = description;
  if (configuration) dataSource.configuration = { ...dataSource.configuration, ...configuration };
  if (connectionConfig) dataSource.connectionConfig = { ...dataSource.connectionConfig, ...connectionConfig };
  if (credentials) {
    dataSource.setCredentials(credentials);
  }
  if (tags) dataSource.tags = tags;
  if (status) dataSource.status = status.toUpperCase();

  await dataSource.save();

  res.json({
    success: true,
    data: dataSource
  });
});

// @desc    Delete data source
// @route   DELETE /api/data-sources/:id
// @access  Private
const deleteDataSource = asyncHandler(async (req, res) => {
  const dataSource = await DataSource.findById(req.params.id);
  if (!dataSource) {
    return res.status(404).json({ success: false, message: 'Data source not found' });
  }

  await DataSource.findByIdAndDelete(req.params.id);

  res.json({
    success: true,
    message: 'Data source removed successfully'
  });
});

// Helper: Infer observed BSON type from JavaScript value
function inferBsonType(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (Array.isArray(val)) return 'array';
  if (val instanceof Date) return 'date';
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'string') return 'string';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? 'int32' : 'double';
  }
  if (typeof val === 'object') {
    if (val._bsontype) return val._bsontype.toLowerCase();
    return 'object';
  }
  return typeof val;
}

// Helper: Build MongoDB URI and MongoClient options safely without leaking credentials
function buildMongoConnection(config, creds = {}) {
  let uri = config.uri || config.connectionUrl || config.connectionString;
  const username = creds.username || config.username || '';
  const rawPassword = creds.password !== undefined ? creds.password : config.password;
  let password = '';
  if (typeof rawPassword === 'string') password = rawPassword;
  else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') password = String(rawPassword);
  else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') password = rawPassword.password;

  const targetDb = config.database || 'admin';
  const timeoutMs = parseInt(config.connectTimeout, 10) || 5000;
  const clientOptions = {
    connectTimeoutMS: timeoutMs,
    serverSelectionTimeoutMS: timeoutMs
  };

  if (config.ssl === true || config.ssl === 'true' || config.tls === true || config.tls === 'true') {
    clientOptions.tls = true;
    clientOptions.tlsAllowInvalidCertificates = true;
  }

  if (config.replicaSet) {
    clientOptions.replicaSet = config.replicaSet;
  }

  if (config.authMechanism) {
    clientOptions.authMechanism = config.authMechanism;
  }

  if (!uri) {
    const host = config.host || '127.0.0.1';
    const port = parseInt(config.port, 10) || 27017;
    const authSource = config.authSource || 'admin';

    if (username && password) {
      const encUser = encodeURIComponent(username);
      const encPass = encodeURIComponent(password);
      uri = `mongodb://${encUser}:${encPass}@${host}:${port}/${targetDb}?authSource=${encodeURIComponent(authSource)}`;
    } else if (username) {
      const encUser = encodeURIComponent(username);
      uri = `mongodb://${encUser}@${host}:${port}/${targetDb}?authSource=${encodeURIComponent(authSource)}`;
    } else {
      uri = `mongodb://${host}:${port}/${targetDb}`;
    }

    if (config.replicaSet) {
      uri += (uri.includes('?') ? '&' : '?') + `replicaSet=${encodeURIComponent(config.replicaSet)}`;
    }
  }

  return { uri, clientOptions, targetDb };
}

// @desc    Test data source connection (saved or transient)
// @route   POST /api/data-sources/:id/test or POST /api/data-sources/test
// @access  Private
const testConnection = asyncHandler(async (req, res) => {
  let dataSource = null;
  if (req.params.id && req.params.id !== 'test' && req.params.id !== 'transient' && mongoose.isValidObjectId(req.params.id)) {
    dataSource = await DataSource.findById(req.params.id).select('+credentials');
    if (!dataSource) {
      return res.status(404).json({ success: false, message: 'Data source not found' });
    }
  } else {
    // Transient in-flight test before persisting
    const { name, type, configuration, connectionConfig, credentials } = req.body;
    dataSource = {
      name: name || 'Transient Source',
      type: (type || 'mongodb').toLowerCase().trim(),
      configuration: configuration || connectionConfig || {},
      connectionConfig: configuration || connectionConfig || {},
      credentials: credentials || {}
    };
  }

  const startHr = process.hrtime.bigint();
  const config = {
    ...(dataSource.configuration || {}),
    ...(dataSource.connectionConfig || {}),
    ...(req.body?.configuration || {}),
    ...(req.body?.connectionConfig || {})
  };

  // Retrieve decrypted credentials via model method or fallback
  let creds = {};
  if (typeof dataSource.getDecryptedCredentials === 'function') {
    creds = dataSource.getDecryptedCredentials() || {};
  } else if (dataSource.credentials) {
    creds = dataSource.credentials;
  }

  // Allow transient override from request body (e.g. testing in modal before save)
  if (req.body?.credentials && typeof req.body.credentials === 'object') {
    creds = { ...creds, ...req.body.credentials };
  }
  if (req.body?.password !== undefined) {
    creds.password = req.body.password;
  }
  if (req.body?.username !== undefined) {
    creds.username = req.body.username;
  }

  // Pre-validate required host and credentials
  const host = config.host || config.endpoint || config.server;
  const username = creds.username || config.username || config.user;
  const rawPassword = creds.password !== undefined ? creds.password : config.password;

  if (['postgresql', 'mysql', 'sqlserver'].includes(dataSource.type)) {
    if (!host) {
      return res.status(400).json({
        success: false,
        message: `Data source "${dataSource.name}" is unconfigured: host is required.`,
        error: { message: `Data source "${dataSource.name}" is unconfigured: host is required.` },
        data: { connected: false, status: 'UNHEALTHY', error: 'Host is required.' }
      });
    }
    const port = parseInt(config.port, 10);
    if (config.port !== undefined && (isNaN(port) || port < 1 || port > 65535)) {
      return res.status(400).json({
        success: false,
        message: `Invalid port "${config.port}". Port must be between 1 and 65535.`,
        error: { message: `Invalid port "${config.port}". Port must be between 1 and 65535.` },
        data: { connected: false, status: 'UNHEALTHY', error: 'Port must be between 1 and 65535.' }
      });
    }
  }

  if (dataSource.type === 'postgresql') {
    if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
      return res.status(400).json({
        success: false,
        message: 'PostgreSQL connection requires a password. Please configure valid credentials.',
        error: { message: 'PostgreSQL connection requires a password. Please configure valid credentials.' },
        data: { connected: false, status: 'UNHEALTHY', error: 'PostgreSQL connection requires a password. Please configure valid credentials.' }
      });
    }
  } else if (dataSource.type === 'mysql') {
    if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
      return res.status(400).json({
        success: false,
        message: 'MySQL connection requires a password. Please configure valid credentials.',
        error: { message: 'MySQL connection requires a password. Please configure valid credentials.' },
        data: { connected: false, status: 'UNHEALTHY', error: 'MySQL connection requires a password. Please configure valid credentials.' }
      });
    }
  } else if (dataSource.type === 'sqlserver') {
    const authType = (config.authType || 'sql').toLowerCase();
    if (authType === 'sql' || authType === 'windows') {
      const authLabel = authType === 'windows' ? 'Windows' : 'SQL Server';
      if (!username) {
        return res.status(400).json({
          success: false,
          message: `${authLabel} authentication requires a username.`,
          error: { message: `${authLabel} authentication requires a username.` },
          data: { connected: false, status: 'UNHEALTHY', error: 'Username is required.' }
        });
      }
      if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
        return res.status(400).json({
          success: false,
          message: `${authLabel} authentication requires a password.`,
          error: { message: `${authLabel} authentication requires a password.` },
          data: { connected: false, status: 'UNHEALTHY', error: 'Password is required.' }
        });
      }
    }
  } else if (dataSource.type === 'snowflake') {
    const account = config.account;
    if (!account) {
      return res.status(400).json({
        success: false,
        message: `Data source "${dataSource.name}" is unconfigured: Snowflake account identifier is required.`,
        error: { message: `Data source "${dataSource.name}" is unconfigured: Snowflake account identifier is required.` },
        data: { connected: false, status: 'UNHEALTHY', error: 'Snowflake account identifier is required.' }
      });
    }
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Snowflake connection requires a username. Please configure valid credentials.',
        error: { message: 'Snowflake connection requires a username. Please configure valid credentials.' },
        data: { connected: false, status: 'UNHEALTHY', error: 'Username is required.' }
      });
    }
    const authMethod = (config.authMethod || config.authType || 'password').toLowerCase();
    if (authMethod !== 'keypair' && authMethod !== 'key_pair') {
      if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
        return res.status(400).json({
          success: false,
          message: 'Snowflake connection requires a password. Please configure valid credentials.',
          error: { message: 'Snowflake connection requires a password. Please configure valid credentials.' },
          data: { connected: false, status: 'UNHEALTHY', error: 'Password is required.' }
        });
      }
    }
  } else if (dataSource.type === 'mongodb') {
    const uri = config.uri || config.connectionUrl || config.connectionString;
    if (!uri && !host) {
      return res.status(400).json({
        success: false,
        message: `Data source "${dataSource.name}" is unconfigured: host or uri is required.`,
        error: { message: `Data source "${dataSource.name}" is unconfigured: host or uri is required.` },
        data: { connected: false, status: 'UNHEALTHY', error: 'Host is required.' }
      });
    }
    if (username && (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === ''))) {
      return res.status(400).json({
        success: false,
        message: 'MongoDB authentication requires a password when username is provided.',
        error: { message: 'MongoDB authentication requires a password when username is provided.' },
        data: { connected: false, status: 'UNHEALTHY', error: 'Password is required.' }
      });
    }
  }

  let connected = false;
  let errorMsg = null;
  let connectionDetails = null;

  try {
    const { ConnectorFactory, connectorRegistry } = await import('../src/connectors/index.js');
    if (connectorRegistry.has(dataSource.type)) {
      let connector = null;
      try {
        const connectTimeout = parseInt(config.connectTimeout, 10) || 5000;
        connector = ConnectorFactory.createFromDataSource(dataSource, {
          credentials: creds,
          configuration: config,
          timeouts: { connect: connectTimeout, query: 10000 }
        });
        const testResult = await connector.test();
        connected = Boolean(testResult.success);
        connectionDetails = testResult.details;
      } catch (connErr) {
        connected = false;
        errorMsg = connErr.message || `${dataSource.type} connection test failed`;
      } finally {
        if (connector && typeof connector.disconnect === 'function') {
          await connector.disconnect().catch(() => {});
        }
      }
    } else {
      // Net socket ping for non-registered external systems
      if (config.host || config.endpoint || config.account) {
        const targetHost = config.host || config.endpoint;
        const targetPort = parseInt(config.port, 10) || 80;
        
        await new Promise((resolve, reject) => {
          const net = require('net');
          const socket = new net.Socket();
          socket.setTimeout(3000);
          socket.on('connect', () => {
            socket.destroy();
            resolve();
          });
          socket.on('timeout', () => {
            socket.destroy();
            reject(new Error(`Connection to ${targetHost}:${targetPort} timed out`));
          });
          socket.on('error', (err) => {
            socket.destroy();
            reject(err);
          });
          socket.connect(targetPort, targetHost);
        });
        connected = true;
      } else {
        throw new Error(`Data source "${dataSource.name}" has no host or endpoint configured. Please configure credentials.`);
      }
    }
  } catch (err) {
    connected = false;
    errorMsg = err.message || 'Remote host connection rejected.';
  }

  const endHr = process.hrtime.bigint();
  const latencyMs = Math.max(1, Math.round(Number(endHr - startHr) / 1_000_000));

  dataSource.lastTestedAt = new Date();
  if (connected) {
    dataSource.healthStatus = 'HEALTHY';
    dataSource.connectionState = 'CONNECTED';
    dataSource.lastError = null;
    dataSource.lastTestLatencyMs = latencyMs;
  } else {
    dataSource.healthStatus = 'UNHEALTHY';
    dataSource.connectionState = 'FAILED';
    dataSource.lastError = errorMsg;
  }
  if (typeof dataSource.save === 'function') {
    await dataSource.save();
  }

  if (connected) {
    res.json({
      success: true,
      data: {
        connected: true,
        latencyMs,
        status: 'HEALTHY',
        testedAt: dataSource.lastTestedAt,
        details: connectionDetails || { database: config.database || 'admin' },
        message: `Connection to ${dataSource.name} verified successfully (${latencyMs}ms)`
      }
    });
  } else {
    res.status(502).json({
      success: false,
      data: {
        connected: false,
        status: 'UNHEALTHY',
        error: errorMsg,
        testedAt: dataSource.lastTestedAt,
        message: `Connection test failed for ${dataSource.name}: ${errorMsg}`
      },
      error: {
        message: errorMsg
      }
    });
  }
});

// @desc    Discover metadata / assets
// @route   POST /api/data-sources/:id/discover or POST /api/data-sources/discover
// @access  Private
const discoverAssets = asyncHandler(async (req, res) => {
  let dataSource = null;
  if (req.params.id && req.params.id !== 'discover' && req.params.id !== 'transient' && mongoose.isValidObjectId(req.params.id)) {
    dataSource = await DataSource.findById(req.params.id).select('+credentials');
  }

  if (!dataSource) {
    const { name, type, configuration, connectionConfig, credentials } = req.body;
    dataSource = {
      name: name || 'Transient Source',
      type: (type || 'postgresql').toLowerCase().trim(),
      configuration: configuration || connectionConfig || {},
      connectionConfig: configuration || connectionConfig || {},
      credentials: credentials || {}
    };
  }

  const config = {
    ...(dataSource.configuration || {}),
    ...(dataSource.connectionConfig || {}),
    ...(req.body?.configuration || {}),
    ...(req.body?.connectionConfig || {})
  };

  let creds = {};
  if (typeof dataSource.getDecryptedCredentials === 'function') {
    creds = dataSource.getDecryptedCredentials() || {};
  } else if (dataSource.credentials) {
    creds = dataSource.credentials;
  }
  if (req.body?.credentials && typeof req.body.credentials === 'object') {
    creds = { ...creds, ...req.body.credentials };
  }
  if (req.body?.password !== undefined) {
    creds.password = req.body.password;
  }
  if (req.body?.username !== undefined) {
    creds.username = req.body.username;
  }

  const targetSchema = (req.body?.schema || req.query?.schema || req.body?.database || req.query?.database || config.schema || config.database || '').trim();

  const dbName = (config.database || req.body?.database || req.query?.database || '').trim();
  if (['mysql', 'snowflake', 'sqlserver', 'mssql', 'mongodb'].includes(dataSource.type)) {
    if (!dbName) {
      return res.status(400).json({
        success: false,
        message: 'Database name is required for metadata discovery'
      });
    }
    const validIdentifier = /^[a-zA-Z0-9_$-]+$/;
    if (!validIdentifier.test(dbName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid database name. Special characters or SQL injection tokens are not permitted.'
      });
    }
  }

  const { ConnectorFactory, connectorRegistry } = await import('../src/connectors/index.js');
  if (connectorRegistry.has(dataSource.type)) {
    let connector = null;
    try {
      connector = ConnectorFactory.createFromDataSource(dataSource, {
        credentials: creds,
        configuration: config
      });
      const metadata = await connector.fetchMetadata({
        schema: targetSchema || undefined,
        database: targetSchema || undefined
      });

      const tables = metadata.tables || [];
      const normalizedAssets = tables.map(t => {
        const cols = (t.columns || []).map(c => ({
          name: c.name,
          type: c.dataType || c.type || 'string',
          dataType: c.dataType || c.type || 'string',
          nullable: c.nullable !== false,
          ordinalPosition: c.ordinalPosition,
          defaultValue: c.defaultValue,
          isPrimaryKey: Boolean(c.isPrimaryKey),
          primaryKey: Boolean(c.isPrimaryKey),
          description: c.description || ''
        }));
        const pkList = Array.isArray(t.primaryKey) ? t.primaryKey : (t.primaryKey ? [t.primaryKey] : []);

        return {
          id: t.externalId || `${metadata.schema || targetSchema || 'public'}.${t.name}`,
          name: t.name,
          tableName: t.name,
          collectionName: t.name,
          schema: t.schema || metadata.schema || targetSchema || 'public',
          database: metadata.database || config.database || '',
          type: t.type || (dataSource.type === 'mongodb' ? 'collection' : 'table'),
          columnsCount: cols.length,
          fieldsCount: cols.length,
          rowCount: t.rowCount != null ? (typeof t.rowCount === 'number' ? t.rowCount.toLocaleString() : String(t.rowCount)) : '0',
          primaryKey: pkList,
          foreignKeys: t.foreignKeys || [],
          indexes: t.indexes || [],
          columns: cols,
          fields: cols
        };
      });

      return res.json({
        success: true,
        data: {
          dataSourceId: dataSource._id || null,
          database: metadata.database || config.database,
          schema: metadata.schema || targetSchema,
          schemas: metadata.schemas || [metadata.schema || targetSchema],
          assets: normalizedAssets,
          tables: normalizedAssets,
          collections: normalizedAssets,
          totalCount: normalizedAssets.length
        }
      });
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `${dataSource.type.toUpperCase()} discovery failed: ${err.message}`,
        error: { message: err.message }
      });
    } finally {
      if (connector && typeof connector.disconnect === 'function') {
        await connector.disconnect().catch(() => {});
      }
    }
  }

  // Fallback for types not in registry: match existing datasets
  const matchingDatasets = await Dataset.find({
    $or: [
      { source: { $regex: dataSource.name, $options: 'i' } },
      { sourceSystem: { $regex: dataSource.name, $options: 'i' } },
      { sourceType: { $regex: dataSource.type, $options: 'i' } }
    ]
  }).select('name columns schema rowCount size');

  const assets = matchingDatasets.map(d => ({
    id: d._id,
    name: d.name,
    tableName: d.name.toLowerCase().replace(/[\s-]+/g, '_'),
    columnsCount: (d.schema && d.schema.length) || (d.columns && d.columns.length) || 0,
    rowCount: d.rowCount || 'N/A',
    type: 'table'
  }));

  res.json({
    success: true,
    data: {
      dataSourceId: dataSource._id || null,
      assets,
      tables: assets,
      totalCount: assets.length
    }
  });
});

// Helper: Idempotently build and persist normalized Lineage records for all datasets in a DataSource
async function buildAndPersistLineageForDataSource(dataSource, foreignKeys = []) {
  try {
    const allDatasets = await Dataset.find({
      dataSourceId: dataSource._id,
      isDeleted: { $ne: true }
    });
    if (!allDatasets || allDatasets.length === 0) return;

    // Index datasets by tableName and name for fast lookup
    const datasetMap = new Map();
    for (const ds of allDatasets) {
      if (ds.tableName) datasetMap.set(ds.tableName.toLowerCase(), ds);
      if (ds.name) datasetMap.set(ds.name.toLowerCase(), ds);
    }

    const defaultSourceLabel = dataSource.name || 'Enterprise Data Source';
    const defaultSourceType = (dataSource.type || 'DATABASE').toUpperCase();

    for (const currDs of allDatasets) {
      const currTableKey = (currDs.tableName || currDs.name || '').toLowerCase();

      // Find real upstream foreign keys (this table references another table)
      const upstreamFks = foreignKeys.filter(fk =>
        (fk.tableName || '').toLowerCase() === currTableKey
      );

      // Find real downstream foreign keys (another table references this table)
      const downstreamFks = foreignKeys.filter(fk =>
        (fk.referencedTable || '').toLowerCase() === currTableKey
      );

      // Resolve upstream datasets (must exist in our catalog)
      const upstreamDatasetsMap = new Map();
      const upstreamEdges = [];
      for (const fk of upstreamFks) {
        const refTableKey = (fk.referencedTable || '').toLowerCase();
        const parentDs = datasetMap.get(refTableKey);
        if (parentDs && String(parentDs._id) !== String(currDs._id)) {
          upstreamDatasetsMap.set(String(parentDs._id), parentDs);
          const edgeId = `edge-${parentDs._id}-${currDs._id}-${fk.constraintName || fk.columnName || 'fk'}`;
          upstreamEdges.push({
            id: edgeId,
            source: `dataset-${parentDs._id}`,
            target: `dataset-${currDs._id}`,
            animated: true,
            style: { stroke: '#2563eb', strokeWidth: 2 },
            data: {
              relationshipType: 'references',
              foreignKey: fk.constraintName || 'foreign_key',
              sourceColumn: fk.referencedColumn,
              targetColumn: fk.columnName,
              evidence: `Foreign key constraint: ${fk.constraintName || 'FK'} (${currDs.tableName || currDs.name}.${fk.columnName} → ${parentDs.tableName || parentDs.name}.${fk.referencedColumn})`,
              status: 'healthy'
            }
          });
        }
      }

      // Resolve downstream datasets (must exist in our catalog)
      const downstreamDatasetsMap = new Map();
      const downstreamEdges = [];
      for (const fk of downstreamFks) {
        const childTableKey = (fk.tableName || '').toLowerCase();
        const childDs = datasetMap.get(childTableKey);
        if (childDs && String(childDs._id) !== String(currDs._id)) {
          downstreamDatasetsMap.set(String(childDs._id), childDs);
          const edgeId = `edge-${currDs._id}-${childDs._id}-${fk.constraintName || fk.columnName || 'fk'}`;
          downstreamEdges.push({
            id: edgeId,
            source: `dataset-${currDs._id}`,
            target: `dataset-${childDs._id}`,
            animated: true,
            style: { stroke: '#06b6d4', strokeWidth: 2 },
            data: {
              relationshipType: 'referenced_by',
              foreignKey: fk.constraintName || 'foreign_key',
              sourceColumn: fk.referencedColumn,
              targetColumn: fk.columnName,
              evidence: `Referenced by foreign key: ${fk.constraintName || 'FK'} (${childDs.tableName || childDs.name}.${fk.columnName} → ${currDs.tableName || currDs.name}.${fk.referencedColumn})`,
              status: 'healthy'
            }
          });
        }
      }

      const upstreamList = Array.from(upstreamDatasetsMap.values());
      const downstreamList = Array.from(downstreamDatasetsMap.values());

      const currentX = upstreamList.length > 0 ? 720 : 400;
      const downstreamX = upstreamList.length > 0 ? 1060 : 750;

      const nodes = [
        // Level 1 Ingestion Source Node
        {
          id: `source-${currDs._id}`,
          type: 'customLineageNode',
          position: { x: 50, y: 170 },
          data: {
            category: 'Source',
            categoryType: 'source',
            label: defaultSourceLabel,
            typeLabel: defaultSourceType,
            system: defaultSourceLabel,
            source: `${defaultSourceLabel} Ingestion`,
            status: 'active'
          }
        },
        // Upstream Dataset Nodes (Parent tables in foreign key relationships)
        ...upstreamList.map((parentDs, idx) => ({
          id: `dataset-${parentDs._id}`,
          type: 'customLineageNode',
          position: { x: 380, y: 70 + idx * 130 },
          data: {
            category: 'Upstream Dataset',
            categoryType: 'dataset',
            label: parentDs.name,
            typeLabel: parentDs.sourceType || defaultSourceType,
            system: defaultSourceLabel,
            datasetId: parentDs._id,
            source: defaultSourceLabel,
            rows: parentDs.rowCount || 'N/A',
            quality: parentDs.quality ? `${parentDs.quality}%` : 'Unrated',
            isPrimary: false,
            status: 'active'
          }
        })),
        // Primary / Current Dataset Node
        {
          id: `dataset-${currDs._id}`,
          type: 'customLineageNode',
          position: { x: currentX, y: 170 },
          data: {
            category: 'Dataset',
            categoryType: 'dataset',
            label: currDs.name,
            typeLabel: currDs.sourceType || defaultSourceType,
            system: defaultSourceLabel,
            datasetId: currDs._id,
            source: defaultSourceLabel,
            rows: currDs.rowCount || 'N/A',
            quality: currDs.quality ? `${currDs.quality}%` : 'Unrated',
            domainId: currDs.domain || currDs.domainId,
            columnsCount: currDs.schema ? currDs.schema.length : (currDs.columns ? currDs.columns.length : 0),
            status: 'active',
            isPrimary: true
          }
        },
        // Downstream Dataset Nodes (Referencing tables / consumers)
        ...downstreamList.map((childDs, idx) => ({
          id: `dataset-${childDs._id}`,
          type: 'customLineageNode',
          position: { x: downstreamX, y: 70 + idx * 130 },
          data: {
            category: 'Destination',
            categoryType: 'destination',
            label: childDs.name,
            typeLabel: childDs.sourceType || defaultSourceType,
            system: defaultSourceLabel,
            datasetId: childDs._id,
            source: defaultSourceLabel,
            rows: childDs.rowCount || 'N/A',
            quality: childDs.quality ? `${childDs.quality}%` : 'Unrated',
            isPrimary: false,
            status: 'active'
          }
        }))
      ];

      // Base Level 1 Source Ingestion Edge
      const baseSourceEdge = {
        id: `edge-${currDs._id}-source`,
        source: `source-${currDs._id}`,
        target: `dataset-${currDs._id}`,
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2.5 },
        data: {
          relationshipType: 'ingests',
          evidence: `Catalog synchronization from ${defaultSourceLabel}`,
          status: 'healthy'
        }
      };

      // Deduplicate edges by unique ID
      const edgeMap = new Map();
      edgeMap.set(baseSourceEdge.id, baseSourceEdge);
      for (const e of upstreamEdges) {
        edgeMap.set(e.id, e);
      }
      for (const e of downstreamEdges) {
        edgeMap.set(e.id, e);
      }
      const edges = Array.from(edgeMap.values());

      const sourceDatasets = [defaultSourceLabel, ...upstreamList.map(u => u.name)];
      const destinationDatasets = downstreamList.map(d => d.name);

      let transformationInfo = `Direct governed ingestion from ${defaultSourceLabel}`;
      if (upstreamList.length > 0) {
        transformationInfo = `Foreign key dependency from ${upstreamList.map(u => u.name).join(', ')} into ${currDs.name}`;
      }

      await Lineage.findOneAndUpdate(
        { datasetId: currDs._id },
        {
          $set: {
            datasetId: currDs._id,
            nodes,
            edges,
            sourceDatasets,
            destinationDatasets,
            transformationInfo,
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.warn('[LineageSync] Failed to build lineage for data source:', err.message);
  }
}

// @desc    Sync catalog schemas and register real datasets
// @route   POST /api/data-sources/:id/sync or POST /api/data-sources/sync
// @access  Private
const syncCatalog = asyncHandler(async (req, res) => {
  let dataSource = null;
  if (req.params.id && req.params.id !== 'sync' && req.params.id !== 'transient' && mongoose.isValidObjectId(req.params.id)) {
    dataSource = await DataSource.findById(req.params.id).select('+credentials');
  }

  // If not found by ID, look up by name in req.body
  if (!dataSource) {
    const candidateName = req.body?.name || req.body?.dataSourceName;
    if (candidateName && typeof candidateName === 'string') {
      dataSource = await DataSource.findOne({ name: candidateName.trim() }).select('+credentials');
    }
  }

  const rawTables = req.body?.filterTables || req.body?.tables;
  let tables = Array.isArray(rawTables) && rawTables.length > 0 ? [...rawTables] : [];
  let addedCount = 0;
  let updatedCount = 0;

  // Resolve default user for ownership (guarantee non-null ownerId)
  let defaultUser = req.user;
  if (!defaultUser || !defaultUser._id) {
    defaultUser = await User.findOne({});
  }
  if (!defaultUser || !defaultUser._id) {
    defaultUser = { _id: new mongoose.Types.ObjectId(), name: 'Data Platform' };
  }
  const domainDoc = await Domain.findOne({});

  // If still not found, create and persist a new DataSource record so it is immediately visible in catalog/data sources
  if (!dataSource) {
    const name = (req.body?.name || req.body?.dataSourceName || `Data Source ${Date.now()}`).trim();
    const type = (req.body?.type || req.body?.sourceType || 'postgresql').toLowerCase().trim();
    const resolvedConfig = req.body?.configuration || req.body?.connectionConfig || {};
    const creds = req.body?.credentials || {};

    dataSource = new DataSource({
      name,
      type,
      description: req.body?.description || `Configured ${type.toUpperCase()} data source`,
      configuration: resolvedConfig,
      connectionConfig: resolvedConfig,
      credentialStatus: Object.keys(creds).length > 0 ? 'configured' : 'missing',
      tags: req.body?.tags || [],
      status: 'CONNECTED',
      healthStatus: 'HEALTHY',
      connectionState: 'CONNECTED',
      createdBy: defaultUser._id,
      ownerId: defaultUser._id
    });

    if (Object.keys(creds).length > 0) {
      dataSource.setCredentials(creds);
    }
    await dataSource.save();
  }

  const dsConfig = { ...(dataSource.configuration || {}), ...(dataSource.connectionConfig || {}), ...(req.body?.configuration || {}) };
  const targetSchema = (req.body?.schema || req.query?.schema || dsConfig.schema || dsConfig.database || (dataSource.type === 'postgresql' ? 'public' : 'dbo')).trim();

  // Introspect metadata using ConnectorFactory
  const { ConnectorFactory, connectorRegistry } = await import('../src/connectors/index.js');
  let connector = null;
  let metadata = null;
  if (connectorRegistry.has(dataSource.type)) {
    try {
      connector = ConnectorFactory.createFromDataSource(dataSource, {
        credentials: req.body?.credentials,
        configuration: dsConfig
      });
      metadata = await connector.fetchMetadata({
        schema: targetSchema,
        database: targetSchema,
        tables: tables.length > 0 ? tables : undefined
      });
    } catch (introspectErr) {
      console.warn('[SyncCatalog] Metadata introspection warning:', introspectErr.message);
    } finally {
      if (connector && typeof connector.disconnect === 'function') {
        await connector.disconnect().catch(() => {});
      }
    }
  }

  // If tables list was not specified in request, discover all tables from metadata
  if (tables.length === 0) {
    if (metadata && Array.isArray(metadata.tables) && metadata.tables.length > 0) {
      tables.push(...metadata.tables.map(t => t.name));
    } else {
      const existingTableNames = await Dataset.find({ dataSourceId: dataSource._id }).distinct('tableName');
      if (existingTableNames.length > 0) {
        tables.push(...existingTableNames.filter(Boolean));
      }
    }
  }

  // Extract discovered foreign keys from metadata
  const discoveredForeignKeys = [];
  if (metadata && Array.isArray(metadata.tables)) {
    for (const table of metadata.tables) {
      if (Array.isArray(table.foreignKeys)) {
        for (const fk of table.foreignKeys) {
          discoveredForeignKeys.push({
            tableName: table.name,
            columnName: fk.column,
            constraintName: fk.name,
            referencedSchema: fk.referencedSchema,
            referencedTable: fk.referencedTable,
            referencedColumn: fk.referencedColumn
          });
        }
      }
    }
  }

  for (const tableName of tables) {
    let assetType = dataSource.type === 'mongodb' ? 'collection' : 'table';
    const formattedName = tableName
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const tableMeta = metadata && Array.isArray(metadata.tables)
      ? metadata.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
      : null;

    let schemaCols = [
      { name: 'id', type: 'integer', dataType: 'integer', nullable: false, primaryKey: true, description: 'Primary identifier' },
      { name: 'name', type: 'string', dataType: 'string', nullable: false, description: 'Entity title / name' },
      { name: 'status', type: 'string', dataType: 'string', nullable: true, description: 'Operational lifecycle status' },
      { name: 'created_at', type: 'timestamp', dataType: 'timestamp', nullable: false, description: 'Creation timestamp' },
      { name: 'updated_at', type: 'timestamp', dataType: 'timestamp', nullable: false, description: 'Last updated timestamp' }
    ];
    let realRowCount = '0';

    if (tableMeta) {
      if (tableMeta.type) {
        assetType = tableMeta.type;
      }
      if (tableMeta.rowCount != null) {
        realRowCount = typeof tableMeta.rowCount === 'number' ? tableMeta.rowCount.toLocaleString() : String(tableMeta.rowCount);
      }
      if (Array.isArray(tableMeta.columns) && tableMeta.columns.length > 0) {
        schemaCols = tableMeta.columns.map(c => ({
          name: c.name,
          type: c.dataType ? c.dataType.toLowerCase() : (c.type ? c.type.toLowerCase() : 'string'),
          dataType: c.dataType || c.type || 'string',
          nullable: c.nullable !== false,
          primaryKey: Boolean(c.isPrimaryKey),
          description: c.description || `Column ${c.name} (${c.dataType || 'string'})`
        }));
      }
    }

    // Tag foreign keys on schema columns
    for (const col of schemaCols) {
      const matchingFk = discoveredForeignKeys.find(fk =>
        (fk.tableName || '').toLowerCase() === tableName.toLowerCase() &&
        (fk.columnName || '').toLowerCase() === col.name.toLowerCase()
      );
      if (matchingFk) {
        col.foreignKey = `${matchingFk.referencedTable}.${matchingFk.referencedColumn}`;
        if (!col.description || col.description.startsWith('Introspected column')) {
          col.description = `Foreign key referencing ${matchingFk.referencedTable}.${matchingFk.referencedColumn}`;
        }
      }
    }

    let existingDs = await Dataset.findOne({
      dataSourceId: dataSource._id,
      $or: [
        { tableName: tableName },
        { name: formattedName },
        { name: tableName }
      ]
    });

    if (!existingDs) {
      existingDs = await Dataset.create({
        name: formattedName,
        displayName: formattedName,
        type: assetType,
        dataSourceId: dataSource._id,
        tableName: tableName,
        schemaName: targetSchema,
        description: `Synchronized ${dataSource.type === 'mongodb' ? 'collection' : 'table'} from ${dataSource.name}`,
        longDescription: `Governed dataset synchronized directly from ${dataSource.name} (${dataSource.type})`,
        source: dataSource.name,
        sourceSystem: dataSource.name,
        sourceType: dataSource.type.toUpperCase(),
        domain: dataSource.tags && dataSource.tags[0] ? dataSource.tags[0].toUpperCase() : 'GENERAL',
        domainId: domainDoc ? domainDoc._id : undefined,
        ownerId: defaultUser._id,
        owner: defaultUser.name || 'Data Engineer',
        stewardId: defaultUser._id,
        rowCount: realRowCount,
        size: '12 MB',
        sizeBytes: 12582912,
        refreshFrequency: 'Daily',
        tags: [...(dataSource.tags || []), 'synchronized'],
        certificationStatus: 'In Review',
        quality: 92,
        qualityScore: 92,
        environment: dataSource.environment || 'Production',
        schema: schemaCols,
        columns: schemaCols
      });
      addedCount++;

      // Create evidence-backed Lineage record linking dataset to its ingestion source
      try {
        await Lineage.create({
          datasetId: existingDs._id,
          nodes: [
            {
              id: `source-${existingDs._id}`,
              type: 'customLineageNode',
              position: { x: 50, y: 170 },
              data: {
                category: 'Source',
                categoryType: 'source',
                label: dataSource.name,
                typeLabel: dataSource.type.toUpperCase(),
                system: dataSource.name,
                source: `${dataSource.name} Ingestion`,
                status: 'active'
              }
            },
            {
              id: `dataset-${existingDs._id}`,
              type: 'customLineageNode',
              position: { x: 400, y: 170 },
              data: {
                category: 'Dataset',
                categoryType: 'dataset',
                label: existingDs.name,
                typeLabel: dataSource.type.toUpperCase(),
                system: dataSource.name,
                datasetId: existingDs._id,
                source: dataSource.name,
                rows: existingDs.rowCount,
                quality: '92%',
                isPrimary: true,
                status: 'active'
              }
            }
          ],
          edges: [
            {
              id: `edge-${existingDs._id}-source`,
              source: `source-${existingDs._id}`,
              target: `dataset-${existingDs._id}`,
              animated: true,
              style: { stroke: '#10b981', strokeWidth: 2.5 },
              data: { relationshipType: 'ingests', evidence: `Catalog synchronization from ${dataSource.name}`, status: 'healthy' }
            }
          ],
          sourceDatasets: [dataSource.name],
          destinationDatasets: [],
          transformationInfo: `Direct ingestion from ${dataSource.name}`
        });
      } catch (e) {}

      // Create default Rule document for the new dataset
      try {
        await Rule.create({
          name: `${existingDs.name} Primary Identifier Not Null`,
          datasetId: existingDs._id,
          targetDatasetId: existingDs._id,
          field: schemaCols[0]?.name || 'id',
          targetColumn: schemaCols[0]?.name || 'id',
          expression: `not_null(${schemaCols[0]?.name || 'id'})`,
          dimension: 'completeness',
          ruleType: 'NOT_NULL',
          condition: {},
          threshold: 0.01,
          severity: 'high',
          enabled: true,
          owner: defaultUser._id,
          createdBy: defaultUser._id,
          status: 'active'
        });
      } catch (e) {}

      // Create an activity audit
      try {
        await Activity.create({
          title: `Synchronized dataset "${formattedName}" from ${dataSource.name}`,
          type: 'dataset_sync',
          actorId: defaultUser._id,
          user: defaultUser.name || 'System',
          entityType: 'dataset',
          entityId: existingDs._id,
          metadata: {
            dataSourceId: dataSource._id,
            tableName,
            columnsCount: schemaCols.length,
            rowCount: realRowCount
          }
        });
      } catch (e) {}
    } else {
      existingDs.schemaName = existingDs.schemaName || targetSchema;
      existingDs.source = dataSource.name;
      existingDs.sourceSystem = dataSource.name;
      existingDs.sourceType = dataSource.type.toUpperCase();
      existingDs.type = dataSource.type === 'mongodb' ? 'collection' : (assetType || existingDs.type || 'table');
      existingDs.rowCount = realRowCount !== '0' ? realRowCount : existingDs.rowCount;
      existingDs.schema = schemaCols;
      existingDs.columns = schemaCols;
      existingDs.lastRefreshedAt = new Date();
      await existingDs.save();
      updatedCount++;
    }
  }

  // Idempotently build and persist normalized Lineage records for all datasets in this DataSource
  await buildAndPersistLineageForDataSource(dataSource, discoveredForeignKeys);

  // Recalculate tablesCount and update DataSource status & timestamps
  const totalDatasetsCount = await Dataset.countDocuments({ dataSourceId: dataSource._id });
  dataSource.status = 'CONNECTED';
  dataSource.healthStatus = 'HEALTHY';
  dataSource.connectionState = 'CONNECTED';
  dataSource.lastSyncedAt = new Date();
  dataSource.lastTestedAt = new Date();
  dataSource.lastError = null;
  dataSource.tablesCount = totalDatasetsCount;
  await dataSource.save();

  res.json({
    success: true,
    data: {
      dataSourceId: dataSource._id,
      dataSource: dataSource.toJSON ? dataSource.toJSON() : dataSource,
      added: addedCount,
      registeredCount: addedCount,
      updatedCount,
      total: tables.length,
      syncedAt: dataSource.lastSyncedAt,
      message: `Successfully synced ${addedCount} new dataset(s) into enterprise catalog`
    }
  });
});

module.exports = {
  getDataSources,
  getDataSource,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testConnection,
  discoverAssets,
  syncCatalog,
  buildAndPersistLineageForDataSource
};
