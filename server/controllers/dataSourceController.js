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
  if (type) {
    filter.type = type.toLowerCase();
  }
  if (status) {
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
  if (req.params.id && req.params.id !== 'test' && req.params.id !== 'transient') {
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

  let connected = false;
  let errorMsg = null;
  let connectionDetails = null;

  try {
    if (dataSource.type === 'mongodb') {
      const { MongoClient } = require('mongodb');
      const { uri, clientOptions, targetDb } = buildMongoConnection(config, creds);

      let client = null;
      try {
        client = new MongoClient(uri, clientOptions);
        await client.connect();
        await client.db(targetDb).command({ ping: 1 });
        connected = true;
      } catch (mongoErr) {
        connected = false;
        errorMsg = mongoErr.message || 'MongoDB connection failed';
        if (mongoErr.codeName) {
          errorMsg = `${mongoErr.codeName}: ${errorMsg}`;
        }
      } finally {
        if (client) {
          await client.close().catch(() => {});
        }
      }
    } else if (dataSource.type === 'postgresql') {
      const host = config.host || config.endpoint;
      if (!host) {
        return res.status(400).json({
          success: false,
          message: `Data source "${dataSource.name}" is unconfigured: host is required.`,
          error: { message: `Data source "${dataSource.name}" is unconfigured: host is required.` },
          data: { connected: false, status: 'UNHEALTHY', error: 'Host is required.' }
        });
      }

      const username = creds.username || config.username || config.user || 'postgres';
      const rawPassword = creds.password !== undefined ? creds.password : config.password;

      // Validate missing credentials before calling PostgreSQL client
      if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
        return res.status(400).json({
          success: false,
          message: 'PostgreSQL connection requires a password. Please configure valid credentials.',
          error: {
            message: 'PostgreSQL connection requires a password. Please configure valid credentials.'
          },
          data: {
            connected: false,
            status: 'UNHEALTHY',
            error: 'PostgreSQL connection requires a password. Please configure valid credentials.'
          }
        });
      }

      // Safely ensure password is a string without logging or exposing value
      let passwordString;
      if (typeof rawPassword === 'string') {
        passwordString = rawPassword;
      } else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') {
        passwordString = String(rawPassword);
      } else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') {
        passwordString = rawPassword.password;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid password format. Password must be a valid string.',
          error: {
            message: 'Invalid password format. Password must be a valid string.'
          },
          data: {
            connected: false,
            status: 'UNHEALTHY',
            error: 'Invalid password format. Password must be a valid string.'
          }
        });
      }

      const { Pool } = require('pg');
      const pool = new Pool({
        host: host,
        port: parseInt(config.port, 10) || 5432,
        database: config.database || 'postgres',
        user: username,
        password: passwordString,
        connectionTimeoutMillis: 5000
      });
      const client = await pool.connect();
      await client.query('SELECT 1;');
      client.release();
      await pool.end();
      connected = true;
    } else if (dataSource.type === 'mysql') {
      const host = config.host || config.endpoint;
      if (!host) {
        return res.status(400).json({
          success: false,
          message: `Data source "${dataSource.name}" is unconfigured: host is required.`,
          error: { message: `Data source "${dataSource.name}" is unconfigured: host is required.` },
          data: { connected: false, status: 'UNHEALTHY', error: 'Host is required.' }
        });
      }

      const port = parseInt(config.port, 10) || 3306;
      if (isNaN(port) || port < 1 || port > 65535) {
        return res.status(400).json({
          success: false,
          message: `Invalid port "${config.port}". Port must be between 1 and 65535.`,
          error: { message: `Invalid port "${config.port}". Port must be between 1 and 65535.` },
          data: { connected: false, status: 'UNHEALTHY', error: 'Port must be between 1 and 65535.' }
        });
      }

      const username = creds.username || config.username || 'root';
      const rawPassword = creds.password !== undefined ? creds.password : config.password;

      let passwordString = '';
      if (typeof rawPassword === 'string') {
        passwordString = rawPassword;
      } else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') {
        passwordString = String(rawPassword);
      } else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') {
        passwordString = rawPassword.password;
      }

      let sslConfig = undefined;
      if (config.ssl === true || config.ssl === 'true' || config.ssl === 'require') {
        sslConfig = typeof config.ssl === 'object' ? config.ssl : { rejectUnauthorized: false };
      }

      const connectTimeout = parseInt(config.connectTimeout, 10) || 5000;
      const mysql = require('mysql2/promise');

      let conn;
      try {
        conn = await mysql.createConnection({
          host,
          port,
          user: username,
          password: passwordString,
          database: config.database || undefined,
          ssl: sslConfig,
          connectTimeout
        });

        await conn.query('SELECT 1 AS alive, VERSION() AS server_version, DATABASE() AS current_db;');
        connected = true;
      } catch (err) {
        connected = false;
        if (err.code === 'ECONNREFUSED') {
          errorMsg = `Connection refused at ${host}:${port}. Verify that the MySQL server is running and reachable on this port.`;
        } else if (err.code === 'ETIMEDOUT') {
          errorMsg = `Connection to ${host}:${port} timed out after ${connectTimeout}ms. Please check network routes and firewall rules.`;
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
          errorMsg = `Access denied for user "${username}". Please verify your MySQL credentials.`;
        } else if (err.code === 'ER_BAD_DB_ERROR') {
          errorMsg = `Database "${config.database}" does not exist on MySQL server at ${host}:${port}.`;
        } else if (err.code === 'ENOTFOUND') {
          errorMsg = `Host "${host}" could not be resolved. Please verify host name or IP address.`;
        } else {
          errorMsg = err.message || 'MySQL connection failed.';
        }
      } finally {
        if (conn) {
          await conn.end().catch(() => {});
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

      const username = creds.username || config.username;
      if (!username) {
        return res.status(400).json({
          success: false,
          message: 'Snowflake connection requires a username. Please configure valid credentials.',
          error: { message: 'Snowflake connection requires a username. Please configure valid credentials.' },
          data: { connected: false, status: 'UNHEALTHY', error: 'Username is required.' }
        });
      }

      const authMethod = (config.authMethod || config.authType || 'password').toLowerCase();
      const timeoutMs = parseInt(config.connectTimeout, 10) || 10000;
      const snowflake = require('snowflake-sdk');

      const connOptions = {
        account: account.trim(),
        username: username.trim(),
        warehouse: config.warehouse ? config.warehouse.trim() : undefined,
        database: config.database ? config.database.trim() : undefined,
        schema: config.schema ? config.schema.trim() : undefined,
        role: config.role ? config.role.trim() : undefined,
        timeout: timeoutMs,
        clientSessionKeepAlive: Boolean(config.clientSessionKeepAlive)
      };

      if (authMethod === 'keypair' || authMethod === 'key_pair') {
        const rawPrivateKey = creds.privateKey || config.privateKey;
        if (!rawPrivateKey) {
          return res.status(400).json({
            success: false,
            message: 'Key-pair authentication requires a private key. Please configure valid credentials.',
            error: { message: 'Key-pair authentication requires a private key. Please configure valid credentials.' },
            data: { connected: false, status: 'UNHEALTHY', error: 'Private key is required.' }
          });
        }
        connOptions.authenticator = 'SNOWFLAKE_JWT';
        connOptions.privateKey = String(rawPrivateKey).trim();
        const passphrase = creds.privateKeyPassphrase || creds.passphrase || config.privateKeyPassphrase;
        if (passphrase) {
          connOptions.privateKeyPass = String(passphrase);
        }
      } else {
        const rawPassword = creds.password !== undefined ? creds.password : config.password;
        if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
          return res.status(400).json({
            success: false,
            message: 'Snowflake connection requires a password. Please configure valid credentials.',
            error: { message: 'Snowflake connection requires a password. Please configure valid credentials.' },
            data: { connected: false, status: 'UNHEALTHY', error: 'Password is required.' }
          });
        }
        connOptions.password = String(rawPassword);
      }

      let conn = null;
      try {
        conn = snowflake.createConnection(connOptions);
        await new Promise((resolve, reject) => {
          conn.connect((err, c) => {
            if (err) return reject(err);
            resolve(c);
          });
        });

        // Ping and session introspection
        const rows = await new Promise((resolve, reject) => {
          conn.execute({
            sqlText: 'SELECT CURRENT_VERSION() AS VERSION, CURRENT_ACCOUNT() AS ACCOUNT, CURRENT_ROLE() AS ROLE, CURRENT_DATABASE() AS DB, CURRENT_SCHEMA() AS SCHEMA, CURRENT_WAREHOUSE() AS WH;',
            complete: (err, stmt, rows) => {
              if (err) return reject(err);
              resolve(rows || []);
            }
          });
        });

        connected = true;
        const row = rows[0] || {};
        connectionDetails = {
          account: row.ACCOUNT || account,
          version: row.VERSION || 'Snowflake',
          role: row.ROLE || config.role || null,
          database: row.DB || config.database || null,
          schema: row.SCHEMA || config.schema || null,
          warehouse: row.WH || config.warehouse || null
        };
      } catch (err) {
        connected = false;
        const msg = err.message || '';
        if (err.code === '407001' || /incorrect username or password/i.test(msg)) {
          errorMsg = 'Snowflake authentication failed: Invalid username or password.';
        } else if (/key.*invalid|jwt|private\s*key/i.test(msg)) {
          errorMsg = 'Snowflake key-pair authentication failed: Invalid private key or passphrase.';
        } else if (/warehouse.*does not exist|not authorized/i.test(msg)) {
          errorMsg = `Snowflake warehouse error: ${msg}`;
        } else if (/database.*does not exist/i.test(msg)) {
          errorMsg = `Snowflake database error: ${msg}`;
        } else if (err.code === '401002' || /request to snowflake failed/i.test(msg) || /enotfound/i.test(msg) || /econnrefused/i.test(msg)) {
          errorMsg = `Snowflake connection error: Unable to reach account "${account}". Please verify your account identifier and network connectivity.`;
        } else {
          errorMsg = `Snowflake error: ${msg}`;
        }
      } finally {
        if (conn) {
          await new Promise((resolve) => conn.destroy(() => resolve())).catch(() => {});
        }
      }
    } else if (dataSource.type === 'sqlserver') {
      const host = config.host || config.server;
      if (!host) {
        return res.status(400).json({
          success: false,
          message: `Data source "${dataSource.name}" is unconfigured: SQL Server host is required.`,
          error: { message: `Data source "${dataSource.name}" is unconfigured: SQL Server host is required.` },
          data: { connected: false, status: 'UNHEALTHY', error: 'Host is required.' }
        });
      }

      const port = parseInt(config.port, 10) || 1433;
      if (isNaN(port) || port < 1 || port > 65535) {
        return res.status(400).json({
          success: false,
          message: `Invalid port "${config.port}". Port must be between 1 and 65535.`,
          error: { message: `Invalid port "${config.port}". Port must be between 1 and 65535.` },
          data: { connected: false, status: 'UNHEALTHY', error: 'Port must be between 1 and 65535.' }
        });
      }

      const authType = (config.authType || 'sql').toLowerCase();
      const username = creds.username || config.username;
      const rawPassword = creds.password !== undefined ? creds.password : config.password;

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

      const passwordString = rawPassword ? String(rawPassword) : '';
      const connectTimeout = parseInt(config.connectTimeout, 10) || 15000;
      const sql = require('mssql');

      const sqlConfig = {
        user: username || undefined,
        password: passwordString || undefined,
        server: host.trim(),
        port,
        database: config.database ? config.database.trim() : undefined,
        options: {
          encrypt: config.encrypt !== false,
          trustServerCertificate: config.trustServerCertificate !== false,
          instanceName: config.instanceName ? config.instanceName.trim() : undefined,
          connectTimeout
        },
        connectionTimeout: connectTimeout,
        requestTimeout: 15000,
        pool: {
          max: 5,
          min: 0,
          idleTimeoutMillis: 30000
        }
      };

      if (authType === 'windows' && config.domain) {
        sqlConfig.domain = config.domain.trim();
      }

      let pool = null;
      try {
        pool = await new sql.ConnectionPool(sqlConfig).connect();
        const result = await pool.request().query('SELECT 1 AS alive, @@VERSION AS server_version, DB_NAME() AS current_db, SCHEMA_NAME() AS default_schema;');
        connected = true;
        const row = result.recordset && result.recordset[0] ? result.recordset[0] : {};
        connectionDetails = {
          host,
          port,
          database: row.current_db || config.database || null,
          schema: config.schema || row.default_schema || 'dbo',
          defaultSchema: row.default_schema || config.schema || 'dbo',
          version: row.server_version ? row.server_version.split('\n')[0] : 'Microsoft SQL Server'
        };
      } catch (err) {
        connected = false;
        const msg = err.message || '';
        const code = err.code || '';
        if (code === 'ELOGIN' || /login failed/i.test(msg) || /authentication failed/i.test(msg)) {
          errorMsg = `SQL Server authentication failed: Login failed for user "${username}". Please verify your credentials and permissions.`;
        } else if (/cannot open database/i.test(msg) || /4060/.test(msg)) {
          errorMsg = `Database "${config.database}" does not exist or user does not have permission to access it.`;
        } else if (code === 'ESOCKET' && /self-signed certificate/i.test(msg)) {
          errorMsg = `SSL/TLS Certificate error: self-signed certificate. Enable "Trust Server Certificate" in connection settings.`;
        } else if (code === 'ETIMEOUT' || /timeout/i.test(msg)) {
          errorMsg = `Connection to ${host}:${port} timed out after ${connectTimeout}ms. Check server status and firewall rules.`;
        } else if (code === 'ECONNREFUSED' || /connection refused/i.test(msg)) {
          errorMsg = `Connection refused at ${host}:${port}. Verify that SQL Server Browser or the SQL Server instance is running on this port.`;
        } else if (code === 'ENOTFOUND' || /getaddrinfo/i.test(msg)) {
          errorMsg = `Host "${host}" could not be resolved. Please verify the server hostname or IP address.`;
        } else {
          errorMsg = `SQL Server error: ${msg}`;
        }
      } finally {
        if (pool) {
          await pool.close().catch(() => {});
        }
      }
    } else {
      // For other enterprise connectors (Salesforce, SAP, Workday, HubSpot):
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
// @route   POST /api/data-sources/:id/discover
// @access  Private
const discoverAssets = asyncHandler(async (req, res) => {
  const dataSource = await DataSource.findById(req.params.id).select('+credentials');
  if (!dataSource) {
    return res.status(404).json({ success: false, message: 'Data source not found' });
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

  // 1. If MongoDB, introspect genuine collections from the configured external database
  if (dataSource.type === 'mongodb') {
    const targetDatabase = (req.body?.database || req.query?.database || req.body?.schema || req.query?.schema || config.database || '').trim();

    if (!targetDatabase) {
      return res.status(400).json({
        success: false,
        message: 'Database name is required for MongoDB metadata discovery. Please specify a database in the data source configuration.'
      });
    }

    if (!/^[a-zA-Z0-9_$-]+$/.test(targetDatabase)) {
      return res.status(400).json({
        success: false,
        message: `Invalid database name "${targetDatabase}". Database must contain only alphanumeric characters, underscores, dashes, or dollar signs.`
      });
    }

    const { MongoClient } = require('mongodb');
    const { uri, clientOptions, targetDb } = buildMongoConnection({ ...config, database: targetDatabase }, creds);
    let client = null;

    try {
      client = new MongoClient(uri, clientOptions);
      await client.connect();
      const db = client.db(targetDb);
      const collections = await db.listCollections().toArray();

      if (collections.length === 0) {
        return res.json({
          success: true,
          data: {
            dataSourceId: dataSource._id,
            database: targetDb,
            schema: targetDb,
            assets: [],
            tables: [],
            collections: [],
            totalCount: 0
          }
        });
      }

      const assets = [];
      for (const col of collections) {
        if (col.name.startsWith('system.')) continue;

        let rowCount = 0;
        try {
          rowCount = await db.collection(col.name).estimatedDocumentCount();
        } catch {
          try {
            rowCount = await db.collection(col.name).countDocuments();
          } catch {
            rowCount = 0;
          }
        }

        let indexes = [];
        try {
          indexes = await db.collection(col.name).indexes();
        } catch {}

        let sampleDocs = [];
        try {
          sampleDocs = await db.collection(col.name).find({}).limit(50).toArray();
        } catch {}

        const fieldMap = new Map();
        fieldMap.set('_id', {
          name: '_id',
          type: 'objectId',
          dataType: 'objectId',
          nullable: false,
          ordinalPosition: 1,
          isPrimaryKey: true,
          primaryKey: true,
          description: 'Document primary key (_id)'
        });

        let pos = 2;
        for (const doc of sampleDocs) {
          for (const [key, val] of Object.entries(doc)) {
            if (key === '_id') continue;
            const observedType = inferBsonType(val);
            if (!fieldMap.has(key)) {
              fieldMap.set(key, {
                name: key,
                type: observedType,
                dataType: observedType,
                nullable: sampleDocs.some(d => !(key in d) || d[key] === null),
                ordinalPosition: pos++,
                isPrimaryKey: false,
                primaryKey: false,
                description: `Inferred BSON field ${key} (${observedType})`
              });
            }
          }
        }

        const fields = Array.from(fieldMap.values());

        assets.push({
          id: `${targetDb}.${col.name}`,
          name: col.name,
          tableName: col.name,
          collectionName: col.name,
          schema: targetDb,
          database: targetDb,
          type: col.type || 'collection',
          columnsCount: fields.length,
          fieldsCount: fields.length,
          rowCount: Number(rowCount).toLocaleString(),
          primaryKey: ['_id'],
          indexes: indexes.map(idx => ({ name: idx.name, key: idx.key, unique: Boolean(idx.unique) })),
          columns: fields,
          fields: fields
        });
      }

      return res.json({
        success: true,
        data: {
          dataSourceId: dataSource._id,
          database: targetDb,
          schema: targetDb,
          assets,
          tables: assets,
          collections: assets,
          totalCount: assets.length
        }
      });
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `MongoDB collection discovery failed on database "${targetDb}": ${err.message}`,
        error: { message: err.message }
      });
    } finally {
      if (client) {
        await client.close().catch(() => {});
      }
    }
  }

  // 2. If PostgreSQL, introspect tables, views, columns, primary keys, and row counts
  if (dataSource.type === 'postgresql') {
    const host = config.host || config.endpoint;
    if (!host) {
      return res.status(400).json({
        success: false,
        message: `Data source "${dataSource.name}" is unconfigured: host is required.`
      });
    }

    const username = creds.username || config.username || config.user || 'postgres';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;

    let passwordString = '';
    if (typeof rawPassword === 'string') {
      passwordString = rawPassword;
    } else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') {
      passwordString = String(rawPassword);
    } else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') {
      passwordString = rawPassword.password;
    }

    const port = parseInt(config.port, 10) || 5432;
    const database = config.database || 'postgres';
    const targetSchema = (req.body?.schema || req.query?.schema || config.schema || 'public').trim();

    if (!/^[a-zA-Z0-9_]+$/.test(targetSchema)) {
      return res.status(400).json({
        success: false,
        message: `Invalid schema name "${targetSchema}". Schema must contain only alphanumeric characters and underscores.`
      });
    }

    const { Pool } = require('pg');
    const pool = new Pool({
      host,
      port,
      database,
      user: username,
      password: passwordString,
      ssl: config.ssl === true || config.ssl === 'true' || config.ssl === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });

    let client;
    try {
      client = await pool.connect();

      // Query tables and views in target schema (excluding system schemas)
      const tablesQuery = `
        SELECT 
          table_schema, 
          table_name, 
          table_type
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1')
        ORDER BY table_name ASC;
      `;
      const tablesRes = await client.query(tablesQuery, [targetSchema]);

      if (tablesRes.rows.length === 0) {
        return res.json({
          success: true,
          data: {
            dataSourceId: dataSource._id,
            database,
            schema: targetSchema,
            assets: [],
            tables: [],
            totalCount: 0
          }
        });
      }

      // Query columns for target schema
      const columnsQuery = `
        SELECT 
          table_name, 
          column_name, 
          data_type, 
          is_nullable, 
          ordinal_position, 
          column_default
        FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position ASC;
      `;
      const columnsRes = await client.query(columnsQuery, [targetSchema]);

      // Query primary keys for target schema
      const pkQuery = `
        SELECT 
          kcu.table_name, 
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
        ORDER BY kcu.ordinal_position ASC;
      `;
      const pkRes = await client.query(pkQuery, [targetSchema]);

      const assets = [];
      for (const row of tablesRes.rows) {
        const tName = row.table_name;
        const tableCols = columnsRes.rows.filter(c => c.table_name === tName);
        const tablePks = pkRes.rows.filter(p => p.table_name === tName).map(p => p.column_name);
        const pkSet = new Set(tablePks);

        let rowCount = 0;
        try {
          if (/^[a-zA-Z0-9_]+$/.test(tName)) {
            const countRes = await client.query(`SELECT count(*)::int as count FROM "${targetSchema}"."${tName}"`);
            rowCount = countRes.rows[0]?.count ?? 0;
          }
        } catch (e) {
          rowCount = 'N/A';
        }

        const formattedCols = tableCols.map(c => ({
          name: c.column_name,
          dataType: c.data_type,
          type: c.data_type,
          nullable: c.is_nullable === 'YES',
          ordinalPosition: c.ordinal_position,
          defaultValue: c.column_default,
          isPrimaryKey: pkSet.has(c.column_name)
        }));

        assets.push({
          id: `${targetSchema}.${tName}`,
          name: tName,
          tableName: tName,
          schema: targetSchema,
          type: row.table_type === 'VIEW' ? 'view' : 'table',
          columnsCount: formattedCols.length,
          rowCount: typeof rowCount === 'number' ? rowCount.toLocaleString() : rowCount,
          columns: formattedCols,
          primaryKey: tablePks
        });
      }

      return res.json({
        success: true,
        data: {
          dataSourceId: dataSource._id,
          database,
          schema: targetSchema,
          assets,
          tables: assets,
          totalCount: assets.length
        }
      });
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `PostgreSQL discovery failed on database "${database}": ${err.message}`,
        error: { message: err.message }
      });
    } finally {
      if (client) client.release();
      await pool.end().catch(() => {});
    }
  }

  // 3. If MySQL, introspect tables and columns
  if (dataSource.type === 'mysql') {
    const host = config.host || config.endpoint;
    if (!host) {
      return res.status(400).json({
        success: false,
        message: `Data source "${dataSource.name}" is unconfigured: host is required.`
      });
    }

    const port = parseInt(config.port, 10) || 3306;
    const username = creds.username || config.username || 'root';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;
    let passwordString = '';
    if (typeof rawPassword === 'string') passwordString = rawPassword;
    else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') passwordString = String(rawPassword);
    else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') passwordString = rawPassword.password;

    const targetDatabase = (req.body?.database || req.query?.database || req.body?.schema || req.query?.schema || config.database || '').trim();

    if (!targetDatabase) {
      return res.status(400).json({
        success: false,
        message: 'Database name is required for MySQL metadata discovery. Please specify a database in the data source configuration.'
      });
    }

    if (!/^[a-zA-Z0-9_$-]+$/.test(targetDatabase)) {
      return res.status(400).json({
        success: false,
        message: `Invalid database name "${targetDatabase}". Database must contain only alphanumeric characters, underscores, dashes, or dollar signs.`
      });
    }

    let sslConfig = undefined;
    if (config.ssl === true || config.ssl === 'true' || config.ssl === 'require') {
      sslConfig = typeof config.ssl === 'object' ? config.ssl : { rejectUnauthorized: false };
    }

    const connectTimeout = parseInt(config.connectTimeout, 10) || 5000;
    const mysql = require('mysql2/promise');

    let conn;
    try {
      conn = await mysql.createConnection({
        host,
        port,
        user: username,
        password: passwordString,
        database: targetDatabase,
        ssl: sslConfig,
        connectTimeout
      });

      // Query tables and views in target database (excluding internal system schemas)
      const [tablesRows] = await conn.query(
        `SELECT TABLE_NAME, TABLE_TYPE 
         FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ? 
           AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
         ORDER BY TABLE_NAME ASC;`,
        [targetDatabase]
      );

      if (tablesRows.length === 0) {
        return res.json({
          success: true,
          data: {
            dataSourceId: dataSource._id,
            database: targetDatabase,
            schema: targetDatabase,
            assets: [],
            tables: [],
            totalCount: 0
          }
        });
      }

      // Query columns for target database
      const [columnsRows] = await conn.query(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, ORDINAL_POSITION, COLUMN_KEY, COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         ORDER BY TABLE_NAME, ORDINAL_POSITION ASC;`,
        [targetDatabase]
      );

      // Query primary key constraints from information_schema
      let pkRows = [];
      try {
        const [pkResults] = await conn.query(
          `SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME
           FROM information_schema.TABLE_CONSTRAINTS tc
           JOIN information_schema.KEY_COLUMN_USAGE kcu
             ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
             AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
             AND tc.TABLE_NAME = kcu.TABLE_NAME
           WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
             AND tc.TABLE_SCHEMA = ?;`,
          [targetDatabase]
        );
        pkRows = pkResults || [];
      } catch (pkErr) {
        pkRows = [];
      }

      const assets = [];
      for (const row of tablesRows) {
        const tName = row.TABLE_NAME;
        const tableCols = columnsRows.filter(c => c.TABLE_NAME === tName);
        const tablePks = pkRows
          .filter(p => p.TABLE_NAME === tName)
          .map(p => p.COLUMN_NAME);

        // Include any columns where COLUMN_KEY === 'PRI' as primary key
        tableCols.forEach(c => {
          if (c.COLUMN_KEY === 'PRI' && !tablePks.includes(c.COLUMN_NAME)) {
            tablePks.push(c.COLUMN_NAME);
          }
        });
        const pkSet = new Set(tablePks);

        let rowCount = 0;
        try {
          if (/^[a-zA-Z0-9_]+$/.test(tName)) {
            const [countRows] = await conn.query(`SELECT count(*) as count FROM \`${targetDatabase}\`.\`${tName}\``);
            rowCount = countRows[0]?.count ?? 0;
          }
        } catch (e) {
          rowCount = 'N/A';
        }

        const formattedCols = tableCols.map(c => ({
          name: c.COLUMN_NAME,
          dataType: c.DATA_TYPE,
          type: c.DATA_TYPE,
          columnType: c.COLUMN_TYPE,
          nullable: c.IS_NULLABLE === 'YES',
          ordinalPosition: c.ORDINAL_POSITION,
          defaultValue: c.COLUMN_DEFAULT,
          extra: c.EXTRA,
          isPrimaryKey: pkSet.has(c.COLUMN_NAME)
        }));

        assets.push({
          id: `${targetDatabase}.${tName}`,
          name: tName,
          tableName: tName,
          schema: targetDatabase,
          database: targetDatabase,
          type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
          columnsCount: formattedCols.length,
          rowCount: typeof rowCount === 'number' ? rowCount.toLocaleString() : rowCount,
          columns: formattedCols,
          primaryKey: tablePks
        });
      }

      return res.json({
        success: true,
        data: {
          dataSourceId: dataSource._id,
          database: targetDatabase,
          schema: targetDatabase,
          assets,
          tables: assets,
          totalCount: assets.length
        }
      });
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `MySQL discovery failed on database "${targetDatabase}": ${err.message}`,
        error: { message: err.message }
      });
    } finally {
      if (conn) await conn.end().catch(() => {});
    }
  } else if (dataSource.type === 'snowflake') {
    const account = config.account;
    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'Snowflake account identifier is required for metadata discovery.'
      });
    }

    const targetDatabase = (req.body?.database || req.query?.database || config.database || '').trim().toUpperCase();
    if (!targetDatabase) {
      return res.status(400).json({
        success: false,
        message: 'Database name is required for Snowflake metadata discovery. Please specify a database in the data source configuration.'
      });
    }

    if (!/^[a-zA-Z0-9_$-]+$/.test(targetDatabase)) {
      return res.status(400).json({
        success: false,
        message: `Invalid database name "${targetDatabase}". Database must contain only alphanumeric characters, underscores, dashes, or dollar signs.`
      });
    }

    const targetSchema = (req.body?.schema || req.query?.schema || config.schema || 'PUBLIC').trim().toUpperCase();
    if (!/^[a-zA-Z0-9_$-]+$/.test(targetSchema)) {
      return res.status(400).json({
        success: false,
        message: `Invalid schema name "${targetSchema}". Schema must contain only alphanumeric characters, underscores, dashes, or dollar signs.`
      });
    }

    const username = creds.username || config.username;
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required to authenticate with Snowflake.'
      });
    }

    const authMethod = (config.authMethod || config.authType || 'password').toLowerCase();
    const timeoutMs = parseInt(config.connectTimeout, 10) || 15000;
    const snowflake = require('snowflake-sdk');

    const connOptions = {
      account: account.trim(),
      username: username.trim(),
      warehouse: config.warehouse ? config.warehouse.trim() : undefined,
      database: targetDatabase,
      schema: targetSchema,
      role: config.role ? config.role.trim() : undefined,
      timeout: timeoutMs,
      clientSessionKeepAlive: Boolean(config.clientSessionKeepAlive)
    };

    if (authMethod === 'keypair' || authMethod === 'key_pair') {
      const rawPrivateKey = creds.privateKey || config.privateKey;
      if (!rawPrivateKey) {
        return res.status(400).json({
          success: false,
          message: 'Key-pair authentication requires a private key. Please configure valid credentials.'
        });
      }
      connOptions.authenticator = 'SNOWFLAKE_JWT';
      connOptions.privateKey = String(rawPrivateKey).trim();
      const passphrase = creds.privateKeyPassphrase || creds.passphrase || config.privateKeyPassphrase;
      if (passphrase) connOptions.privateKeyPass = String(passphrase);
    } else {
      const rawPassword = creds.password !== undefined ? creds.password : config.password;
      if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
        return res.status(400).json({
          success: false,
          message: 'Snowflake connection requires a password. Please configure valid credentials.'
        });
      }
      connOptions.password = String(rawPassword);
    }

    let conn = null;
    try {
      conn = snowflake.createConnection(connOptions);
      await new Promise((resolve, reject) => {
        conn.connect((err, c) => {
          if (err) return reject(err);
          resolve(c);
        });
      });

      // 1. Fetch tables and views from INFORMATION_SCHEMA.TABLES
      const tablesRows = await new Promise((resolve, reject) => {
        const sql = `
          SELECT TABLE_NAME, TABLE_TYPE, ROW_COUNT, COMMENT
          FROM "${targetDatabase}".INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = :1
          ORDER BY TABLE_NAME ASC;
        `;
        conn.execute({
          sqlText: sql,
          binds: [targetSchema],
          complete: (err, stmt, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        });
      });

      if (tablesRows.length === 0) {
        return res.json({
          success: true,
          data: {
            dataSourceId: dataSource._id,
            database: targetDatabase,
            schema: targetSchema,
            assets: [],
            tables: [],
            totalCount: 0
          }
        });
      }

      // 2. Fetch columns from INFORMATION_SCHEMA.COLUMNS
      const columnsRows = await new Promise((resolve, reject) => {
        const sql = `
          SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION, COLUMN_DEFAULT, COMMENT
          FROM "${targetDatabase}".INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = :1
          ORDER BY TABLE_NAME, ORDINAL_POSITION ASC;
        `;
        conn.execute({
          sqlText: sql,
          binds: [targetSchema],
          complete: (err, stmt, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
          }
        });
      });

      // 3. Attempt primary key discovery from TABLE_CONSTRAINTS
      let pkMap = new Map();
      try {
        const pkRows = await new Promise((resolve, reject) => {
          const sql = `
            SELECT tc.TABLE_NAME, kcu.COLUMN_NAME
            FROM "${targetDatabase}".INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN "${targetDatabase}".INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
              ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
              AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
              AND tc.TABLE_NAME = kcu.TABLE_NAME
            WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
              AND tc.TABLE_SCHEMA = :1;
          `;
          conn.execute({
            sqlText: sql,
            binds: [targetSchema],
            complete: (err, stmt, rows) => {
              if (err) return resolve([]);
              resolve(rows || []);
            }
          });
        });
        for (const pk of pkRows) {
          if (!pkMap.has(pk.TABLE_NAME)) pkMap.set(pk.TABLE_NAME, new Set());
          pkMap.get(pk.TABLE_NAME).add(pk.COLUMN_NAME);
        }
      } catch (pkErr) {}

      const assets = [];
      for (const row of tablesRows) {
        const tName = row.TABLE_NAME;
        const tableCols = columnsRows.filter(c => c.TABLE_NAME === tName);
        const pks = pkMap.get(tName) || new Set();

        const formattedCols = tableCols.map(c => ({
          name: c.COLUMN_NAME,
          dataType: c.DATA_TYPE,
          type: c.DATA_TYPE ? c.DATA_TYPE.toLowerCase() : 'varchar',
          nullable: c.IS_NULLABLE === 'YES',
          ordinalPosition: c.ORDINAL_POSITION,
          defaultValue: c.COLUMN_DEFAULT,
          isPrimaryKey: pks.has(c.COLUMN_NAME),
          description: c.COMMENT || `Snowflake column ${c.COLUMN_NAME} (${c.DATA_TYPE})`
        }));

        const isView = row.TABLE_TYPE === 'VIEW';
        const rowCount = isView ? 'VIEW' : (row.ROW_COUNT !== null && row.ROW_COUNT !== undefined ? Number(row.ROW_COUNT).toLocaleString() : 'N/A');

        assets.push({
          id: `${targetDatabase}.${targetSchema}.${tName}`,
          name: tName,
          tableName: tName,
          schema: targetSchema,
          database: targetDatabase,
          type: isView ? 'view' : 'table',
          columnsCount: formattedCols.length,
          rowCount,
          columns: formattedCols,
          fields: formattedCols,
          primaryKey: Array.from(pks),
          comment: row.COMMENT || ''
        });
      }

      return res.json({
        success: true,
        data: {
          dataSourceId: dataSource._id,
          database: targetDatabase,
          schema: targetSchema,
          assets,
          tables: assets,
          totalCount: assets.length
        }
      });
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `Snowflake discovery failed on database "${targetDatabase}.${targetSchema}": ${err.message}`,
        error: { message: err.message }
      });
    } finally {
      if (conn) {
        await new Promise(r => conn.destroy(() => r())).catch(() => {});
      }
    }
  }

  // 4. Microsoft SQL Server Metadata Discovery
  if (dataSource.type === 'sqlserver') {
    const config = {
      ...(dataSource.configuration || {}),
      ...(dataSource.connectionConfig || {})
    };
    let creds = typeof dataSource.getDecryptedCredentials === 'function' ? dataSource.getDecryptedCredentials() || {} : {};

    const host = config.host || config.server || 'localhost';
    const port = parseInt(config.port, 10) || 1433;
    const targetDatabase = config.database;
    const targetSchema = config.schema ? config.schema.trim() : null;

    if (!targetDatabase) {
      return res.status(400).json({
        success: false,
        message: 'Database name is required for SQL Server metadata discovery. Please specify a database in the data source configuration.',
        error: { message: 'Database name is required.' }
      });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(targetDatabase) || (targetSchema && !/^[a-zA-Z0-9_.-]+$/.test(targetSchema))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid database or schema identifier.',
        error: { message: 'Identifiers must contain only alphanumeric characters, underscores, dashes, or dots.' }
      });
    }

    const username = creds.username || config.username || 'sa';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;
    const passwordString = rawPassword ? String(rawPassword) : '';
    const connectTimeout = parseInt(config.connectTimeout, 10) || 15000;
    const sql = require('mssql');

    const sqlConfig = {
      user: username || undefined,
      password: passwordString || undefined,
      server: host.trim(),
      port,
      database: targetDatabase.trim(),
      options: {
        encrypt: config.encrypt !== false,
        trustServerCertificate: config.trustServerCertificate !== false,
        instanceName: config.instanceName ? config.instanceName.trim() : undefined,
        connectTimeout
      },
      connectionTimeout: connectTimeout,
      requestTimeout: 20000,
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };

    if (config.authType === 'windows' && config.domain) {
      sqlConfig.domain = config.domain.trim();
    }

    let pool = null;
    try {
      pool = await new sql.ConnectionPool(sqlConfig).connect();

      // 1. Discover Tables and Views
      const tablesReq = pool.request();
      if (targetSchema) {
        tablesReq.input('targetSchema', targetSchema);
      }
      const tablesSql = `
        SELECT 
          t.TABLE_SCHEMA AS schema_name,
          t.TABLE_NAME AS table_name,
          t.TABLE_TYPE AS table_type
        FROM INFORMATION_SCHEMA.TABLES t
        WHERE (${targetSchema ? 't.TABLE_SCHEMA = @targetSchema' : "t.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')"})
        ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME;
      `;
      const tablesRes = await tablesReq.query(tablesSql);
      const tablesRows = tablesRes.recordset || [];

      // 2. Discover Columns
      const colsReq = pool.request();
      if (targetSchema) {
        colsReq.input('targetSchema', targetSchema);
      }
      const colsSql = `
        SELECT 
          c.TABLE_SCHEMA AS schema_name,
          c.TABLE_NAME AS table_name,
          c.COLUMN_NAME AS column_name,
          c.DATA_TYPE AS data_type,
          c.IS_NULLABLE AS is_nullable,
          c.ORDINAL_POSITION AS ordinal_position,
          c.COLUMN_DEFAULT AS column_default
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE (${targetSchema ? 'c.TABLE_SCHEMA = @targetSchema' : "c.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')"})
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION ASC;
      `;
      const colsRes = await colsReq.query(colsSql);
      const colsRows = colsRes.recordset || [];

      // 3. Discover Primary Keys
      const pkMap = new Map();
      try {
        const pkReq = pool.request();
        if (targetSchema) {
          pkReq.input('targetSchema', targetSchema);
        }
        const pkSql = `
          SELECT 
            tc.TABLE_SCHEMA AS schema_name,
            tc.TABLE_NAME AS table_name,
            kcu.COLUMN_NAME AS column_name
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
            AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            AND (${targetSchema ? 'tc.TABLE_SCHEMA = @targetSchema' : "tc.TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')"});
        `;
        const pkRes = await pkReq.query(pkSql);
        if (pkRes.recordset) {
          for (const pk of pkRes.recordset) {
            const s = pk.schema_name || pk.TABLE_SCHEMA || pk.table_schema;
            const t = pk.table_name || pk.TABLE_NAME || pk.table_name;
            const c = pk.column_name || pk.COLUMN_NAME;
            const key = `${s}.${t}`;
            if (!pkMap.has(key)) pkMap.set(key, new Set());
            pkMap.get(key).add(c);
          }
        }
      } catch (pkErr) {}

      // 4. Discover Table and Column Extended Descriptions
      const descMap = new Map();
      try {
        const descReq = pool.request();
        if (targetSchema) {
          descReq.input('targetSchema', targetSchema);
        }
        const descSql = `
          SELECT 
            s.name AS schema_name,
            o.name AS table_name,
            c.name AS column_name,
            CAST(ep.value AS NVARCHAR(MAX)) AS description
          FROM sys.extended_properties ep
          JOIN sys.objects o ON ep.major_id = o.object_id
          JOIN sys.schemas s ON o.schema_id = s.schema_id
          LEFT JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
          WHERE ep.name = 'MS_Description'
            AND (${targetSchema ? 's.name = @targetSchema' : "s.name NOT IN ('sys', 'INFORMATION_SCHEMA')"});
        `;
        const descRes = await descReq.query(descSql);
        if (descRes.recordset) {
          for (const d of descRes.recordset) {
            const key = d.column_name ? `${d.schema_name}.${d.table_name}.${d.column_name}` : `${d.schema_name}.${d.table_name}`;
            descMap.set(key, d.description);
          }
        }
      } catch (descErr) {}

      // 5. Discover exact row counts for physical tables without table scans
      const rowCountMap = new Map();
      try {
        const rcReq = pool.request();
        if (targetSchema) {
          rcReq.input('targetSchema', targetSchema);
        }
        const rcSql = `
          SELECT 
            s.name AS schema_name,
            t.name AS table_name,
            ISNULL(SUM(p.rows), 0) AS row_count
          FROM sys.tables t
          JOIN sys.schemas s ON t.schema_id = s.schema_id
          JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
          WHERE (${targetSchema ? 's.name = @targetSchema' : "s.name NOT IN ('sys', 'INFORMATION_SCHEMA')"})
          GROUP BY s.name, t.name;
        `;
        const rcRes = await rcReq.query(rcSql);
        if (rcRes.recordset) {
          for (const r of rcRes.recordset) {
            const countVal = r.row_count != null ? r.row_count : (r.total_rows != null ? r.total_rows : r.rows);
            rowCountMap.set(`${r.schema_name}.${r.table_name}`, countVal);
          }
        }
      } catch (rcErr) {}

      const assets = [];
      for (const row of tablesRows) {
        const sName = row.schema_name || row.TABLE_SCHEMA || row.table_schema;
        const tName = row.table_name || row.TABLE_NAME || row.table_name;
        const fullKey = `${sName}.${tName}`;
        const rawType = (row.table_type || row.TABLE_TYPE || '').toUpperCase();
        const isView = rawType.includes('VIEW');

        const tableCols = colsRows.filter(c => 
          (c.schema_name || c.TABLE_SCHEMA || c.table_schema) === sName && 
          (c.table_name || c.TABLE_NAME || c.table_name) === tName
        );
        const pks = pkMap.get(fullKey) || new Set();

        const formattedCols = tableCols.map(c => {
          const colName = c.column_name || c.COLUMN_NAME;
          const colKey = `${sName}.${tName}.${colName}`;
          const dataType = c.data_type || c.DATA_TYPE || 'nvarchar';
          const isNullable = (c.is_nullable || c.IS_NULLABLE) === 'YES' || (c.is_nullable || c.IS_NULLABLE) === true;
          const ordPos = c.ordinal_position || c.ORDINAL_POSITION;
          const colDef = c.column_default || c.COLUMN_DEFAULT;
          return {
            name: colName,
            columnName: colName,
            dataType: dataType,
            type: dataType.toLowerCase(),
            nullable: isNullable,
            ordinalPosition: ordPos,
            defaultValue: colDef,
            isPrimaryKey: pks.has(colName),
            primaryKey: pks.has(colName),
            description: descMap.get(colKey) || `SQL Server column ${colName} (${dataType})`
          };
        });

        const rawRowCount = rowCountMap.get(fullKey);
        const rowCount = isView ? 'VIEW' : (rawRowCount !== undefined && rawRowCount !== null ? Number(rawRowCount).toLocaleString() : 'N/A');

        assets.push({
          id: `${targetDatabase}.${sName}.${tName}`,
          name: tName,
          tableName: fullKey,
          schema: sName,
          database: targetDatabase,
          type: isView ? 'view' : 'table',
          columnsCount: formattedCols.length,
          rowCount,
          columns: formattedCols,
          fields: formattedCols,
          primaryKey: Array.from(pks),
          comment: descMap.get(fullKey) || ''
        });
      }

      return res.json({
        success: true,
        data: {
          dataSourceId: dataSource._id,
          database: targetDatabase,
          schema: targetSchema || 'dbo',
          assets,
          tables: assets,
          totalCount: assets.length
        }
      });
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `SQL Server discovery failed on database "${targetDatabase}": ${err.message}`,
        error: { message: err.message }
      });
    } finally {
      if (pool) {
        await pool.close().catch(() => {});
      }
    }
  }

  // 5. Fallback for external catalog datasets matching this source
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
      dataSourceId: dataSource._id,
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
// @route   POST /api/data-sources/:id/sync
// @access  Private
const syncCatalog = asyncHandler(async (req, res) => {
  const dataSource = await DataSource.findById(req.params.id).select('+credentials');
  if (!dataSource) {
    return res.status(404).json({ success: false, message: 'Data source not found' });
  }

  const rawTables = req.body?.filterTables || req.body?.tables;
  const tables = Array.isArray(rawTables) && rawTables.length > 0 ? rawTables : [];
  let addedCount = 0;
  let updatedCount = 0;

  const defaultUser = req.user || (await User.findOne({})) || { _id: null, name: 'Data Platform' };
  const domainDoc = await Domain.findOne({});

  // Prepare PG pool if syncing from PostgreSQL
  let pgPool = null;
  if (dataSource.type === 'postgresql') {
    const config = {
      ...(dataSource.configuration || {}),
      ...(dataSource.connectionConfig || {})
    };
    let creds = typeof dataSource.getDecryptedCredentials === 'function' ? dataSource.getDecryptedCredentials() || {} : {};
    const username = creds.username || config.username || config.user || 'postgres';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;
    let passwordString = '';
    if (typeof rawPassword === 'string') passwordString = rawPassword;
    else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') passwordString = String(rawPassword);
    else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') passwordString = rawPassword.password;

    const { Pool } = require('pg');
    pgPool = new Pool({
      host: config.host || config.endpoint,
      port: parseInt(config.port, 10) || 5432,
      database: config.database || 'postgres',
      user: username,
      password: passwordString,
      ssl: config.ssl === true || config.ssl === 'true' || config.ssl === 'require' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });
  }

  // Prepare MySQL connection if syncing from MySQL
  let mysqlConn = null;
  if (dataSource.type === 'mysql') {
    const config = {
      ...(dataSource.configuration || {}),
      ...(dataSource.connectionConfig || {})
    };
    let creds = typeof dataSource.getDecryptedCredentials === 'function' ? dataSource.getDecryptedCredentials() || {} : {};
    const username = creds.username || config.username || config.user || 'root';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;
    let passwordString = '';
    if (typeof rawPassword === 'string') passwordString = rawPassword;
    else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') passwordString = String(rawPassword);
    else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') passwordString = rawPassword.password;

    const mysql = require('mysql2/promise');
    const port = parseInt(config.port, 10) || 3306;
    const connectTimeout = parseInt(config.connectTimeout, 10) || 5000;
    let sslConfig = undefined;
    if (config.ssl === true || config.ssl === 'true' || config.ssl === 'require') {
      sslConfig = { rejectUnauthorized: false };
    }

    try {
      mysqlConn = await mysql.createConnection({
        host: config.host || config.endpoint || 'localhost',
        port,
        database: config.database,
        user: username,
        password: passwordString,
        ssl: sslConfig,
        connectTimeout
      });
    } catch (e) {
      console.warn('MySQL sync connection notice:', e.message);
    }
  }

  // Prepare MongoDB client if syncing from MongoDB
  let mongoClient = null;
  if (dataSource.type === 'mongodb') {
    const config = {
      ...(dataSource.configuration || {}),
      ...(dataSource.connectionConfig || {})
    };
    let creds = typeof dataSource.getDecryptedCredentials === 'function' ? dataSource.getDecryptedCredentials() || {} : {};
    const { MongoClient } = require('mongodb');
    const { uri, clientOptions } = buildMongoConnection(config, creds);

    try {
      mongoClient = new MongoClient(uri, clientOptions);
      await mongoClient.connect();
    } catch (e) {
      console.warn('MongoDB sync connection notice:', e.message);
    }
  }

  // Prepare Snowflake connection if syncing from Snowflake
  let snowflakeConn = null;
  if (dataSource.type === 'snowflake') {
    const config = {
      ...(dataSource.configuration || {}),
      ...(dataSource.connectionConfig || {})
    };
    let creds = typeof dataSource.getDecryptedCredentials === 'function' ? dataSource.getDecryptedCredentials() || {} : {};
    const snowflake = require('snowflake-sdk');

    const authMethod = (config.authMethod || creds.authMethod || 'password').toLowerCase();
    const connOptions = {
      account: (config.account || '').trim(),
      username: (creds.username || config.username || '').trim(),
      warehouse: config.warehouse ? config.warehouse.trim() : undefined,
      database: config.database ? config.database.trim() : undefined,
      schema: config.schema ? config.schema.trim() : undefined,
      role: config.role ? config.role.trim() : undefined,
      timeout: Number(config.connectTimeout) || 15000,
      clientSessionKeepAlive: config.clientSessionKeepAlive !== false
    };

    if (authMethod === 'keypair' || authMethod === 'key_pair') {
      connOptions.authenticator = 'SNOWFLAKE_JWT';
      connOptions.privateKey = String(creds.privateKey || config.privateKey || '').trim();
      const passphrase = creds.privateKeyPassphrase || creds.passphrase || config.privateKeyPassphrase;
      if (passphrase) {
        connOptions.privateKeyPass = String(passphrase);
      }
    } else {
      connOptions.password = String(creds.password !== undefined ? creds.password : (config.password || ''));
    }

    try {
      snowflakeConn = snowflake.createConnection(connOptions);
      await new Promise((resolve, reject) => {
        snowflakeConn.connect((err, conn) => {
          if (err) return reject(err);
          resolve(conn);
        });
      });
    } catch (e) {
      console.warn('Snowflake sync connection notice:', e.message);
      snowflakeConn = null;
    }
  }

  // Prepare SQL Server connection if syncing from SQL Server
  let mssqlPool = null;
  if (dataSource.type === 'sqlserver') {
    const config = {
      ...(dataSource.configuration || {}),
      ...(dataSource.connectionConfig || {})
    };
    let creds = typeof dataSource.getDecryptedCredentials === 'function' ? dataSource.getDecryptedCredentials() || {} : {};
    const sql = require('mssql');

    const host = config.host || config.server || 'localhost';
    const port = parseInt(config.port, 10) || 1433;
    const username = creds.username || config.username || 'sa';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;
    const passwordString = rawPassword ? String(rawPassword) : '';

    const sqlConfig = {
      user: username || undefined,
      password: passwordString || undefined,
      server: host.trim(),
      port,
      database: config.database ? config.database.trim() : undefined,
      options: {
        encrypt: config.encrypt !== false,
        trustServerCertificate: config.trustServerCertificate !== false,
        instanceName: config.instanceName ? config.instanceName.trim() : undefined,
        connectTimeout: parseInt(config.connectTimeout, 10) || 15000
      },
      connectionTimeout: parseInt(config.connectTimeout, 10) || 15000,
      requestTimeout: 20000,
      pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };

    if (config.authType === 'windows' && config.domain) {
      sqlConfig.domain = config.domain.trim();
    }

    try {
      mssqlPool = await new sql.ConnectionPool(sqlConfig).connect();
    } catch (e) {
      console.warn('SQL Server sync connection notice:', e.message);
      mssqlPool = null;
    }
  }

  try {
    const dsConfig = { ...(dataSource.configuration || {}), ...(dataSource.connectionConfig || {}) };
    const targetSchema = dataSource.type === 'postgresql'
      ? (dsConfig.schema || 'public')
      : (dataSource.type === 'snowflake'
        ? (dsConfig.schema || 'PUBLIC')
        : (dataSource.type === 'sqlserver'
          ? (dsConfig.schema || 'dbo')
          : (dsConfig.database || 'default')));

    // If tables list was not specified in request, discover all tables in schema
    if (tables.length === 0) {
      if (pgPool) {
        try {
          const pgClient = await pgPool.connect();
          const tRes = await pgClient.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = $1 AND table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY table_name ASC
          `, [targetSchema]);
          tables.push(...tRes.rows.map(r => r.table_name));
          pgClient.release();
        } catch (e) {}
      } else if (mysqlConn) {
        try {
          const [tRows] = await mysqlConn.query(`
            SELECT TABLE_NAME as table_name FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_NAME ASC
          `, [dsConfig.database]);
          if (Array.isArray(tRows)) tables.push(...tRows.map(r => r.table_name || r.TABLE_NAME));
        } catch (e) {}
      } else if (mssqlPool) {
        try {
          const tReq = mssqlPool.request();
          tReq.input('schemaName', targetSchema);
          const tRes = await tReq.query(`
            SELECT TABLE_NAME as table_name FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = @schemaName
            ORDER BY TABLE_NAME ASC
          `);
          if (tRes.recordset) tables.push(...tRes.recordset.map(r => r.table_name));
        } catch (e) {}
      } else if (mongoClient) {
        try {
          const cols = await mongoClient.db(dsConfig.database || 'admin').listCollections().toArray();
          tables.push(...cols.map(c => c.name).filter(n => !n.startsWith('system.')));
        } catch (e) {}
      }
      if (tables.length === 0) {
        const existingTableNames = await Dataset.find({ dataSourceId: dataSource._id }).distinct('tableName');
        if (existingTableNames.length > 0) {
          tables.push(...existingTableNames.filter(Boolean));
        }
      }
    }

    // Discover real foreign keys across all tables in target schema
    let discoveredForeignKeys = [];
    if (pgPool) {
      try {
        const pgClient = await pgPool.connect();
        const fkRes = await pgClient.query(`
          SELECT
            tc.table_name,
            kcu.column_name,
            tc.constraint_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = $1
        `, [targetSchema]);
        discoveredForeignKeys = (fkRes.rows || []).map(r => ({
          tableName: r.table_name,
          columnName: r.column_name,
          constraintName: r.constraint_name,
          referencedSchema: r.foreign_table_schema,
          referencedTable: r.foreign_table_name,
          referencedColumn: r.foreign_column_name
        }));
        pgClient.release();
      } catch (e) {
        console.warn('PostgreSQL sync FK discovery notice:', e.message);
      }
    } else if (mysqlConn) {
      try {
        const targetDb = dsConfig.database;
        const [fkRows] = await mysqlConn.query(`
          SELECT
            TABLE_NAME AS tableName,
            COLUMN_NAME AS columnName,
            CONSTRAINT_NAME AS constraintName,
            REFERENCED_TABLE_SCHEMA AS referencedSchema,
            REFERENCED_TABLE_NAME AS referencedTable,
            REFERENCED_COLUMN_NAME AS referencedColumn
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
        `, [targetDb]);
        if (Array.isArray(fkRows)) {
          discoveredForeignKeys = fkRows;
        }
      } catch (e) {
        console.warn('MySQL sync FK discovery notice:', e.message);
      }
    } else if (mssqlPool) {
      try {
        const fkReq = mssqlPool.request();
        fkReq.input('schemaName', targetSchema);
        const fkRes = await fkReq.query(`
          SELECT 
            tp.name AS tableName,
            cp.name AS columnName,
            fk.name AS constraintName,
            SCHEMA_NAME(tr.schema_id) AS referencedSchema,
            tr.name AS referencedTable,
            cr.name AS referencedColumn
          FROM sys.foreign_keys fk
          JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
          JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
          JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
          JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
          JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
          WHERE SCHEMA_NAME(tp.schema_id) = @schemaName
        `);
        if (fkRes.recordset) {
          discoveredForeignKeys = fkRes.recordset;
        }
      } catch (e) {
        console.warn('SQL Server sync FK discovery notice:', e.message);
      }
    }

    for (const tableName of tables) {
      let assetType = dataSource.type === 'mongodb' ? 'collection' : 'table';
      const formattedName = tableName
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      // Introspect real fields from PostgreSQL, MySQL, or MongoDB if available
      let schemaCols = [
        { name: 'id', type: 'integer', nullable: false, primaryKey: true, description: 'Primary identifier' },
        { name: 'name', type: 'string', nullable: false, description: 'Entity title / name' },
        { name: 'status', type: 'string', nullable: true, description: 'Operational lifecycle status' },
        { name: 'created_at', type: 'timestamp', nullable: false, description: 'Creation timestamp' },
        { name: 'updated_at', type: 'timestamp', nullable: false, description: 'Last updated timestamp' }
      ];
      let realRowCount = '0';

      if (pgPool) {
        try {
          const pgClient = await pgPool.connect();
          const colsRes = await pgClient.query(`
            SELECT column_name, data_type, is_nullable, ordinal_position
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position ASC
          `, [targetSchema, tableName]);

          const pkRes = await pgClient.query(`
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = $1 AND tc.table_name = $2
          `, [targetSchema, tableName]);
          const pkSet = new Set(pkRes.rows.map(r => r.column_name));

          if (colsRes.rows.length > 0) {
            schemaCols = colsRes.rows.map(c => ({
              name: c.column_name,
              type: c.data_type,
              nullable: c.is_nullable === 'YES',
              primaryKey: pkSet.has(c.column_name),
              description: `Introspected column ${c.column_name} (${c.data_type})`
            }));
          }

          if (/^[a-zA-Z0-9_]+$/.test(targetSchema) && /^[a-zA-Z0-9_]+$/.test(tableName)) {
            const countRes = await pgClient.query(`SELECT count(*)::int as count FROM "${targetSchema}"."${tableName}"`);
            realRowCount = countRes.rows[0]?.count != null ? countRes.rows[0].count.toLocaleString() : realRowCount;
          }
          pgClient.release();
        } catch (e) {
          console.warn('PostgreSQL sync introspection notice:', e.message);
        }
      } else if (mysqlConn) {
        try {
          const targetDb = dsConfig.database;
          const [colsRes] = await mysqlConn.query(
            `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION, COLUMN_KEY, COLUMN_COMMENT
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
             ORDER BY ORDINAL_POSITION ASC`,
            [targetDb, tableName]
          );

          if (Array.isArray(colsRes) && colsRes.length > 0) {
            schemaCols = colsRes.map(c => ({
              name: c.COLUMN_NAME,
              type: c.DATA_TYPE ? c.DATA_TYPE.toLowerCase() : 'varchar',
              nullable: c.IS_NULLABLE === 'YES',
              primaryKey: c.COLUMN_KEY === 'PRI',
              description: c.COLUMN_COMMENT || `Introspected column ${c.COLUMN_NAME} (${c.DATA_TYPE})`
            }));
          }

          if (/^[a-zA-Z0-9_]+$/.test(tableName)) {
            const [countRes] = await mysqlConn.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
            if (Array.isArray(countRes) && countRes.length > 0 && countRes[0].total != null) {
              realRowCount = Number(countRes[0].total).toLocaleString();
            }
          }
        } catch (e) {
          console.warn('MySQL sync introspection notice:', e.message);
        }
      } else if (mongoClient) {
        try {
          const targetDb = dsConfig.database || 'admin';
          const db = mongoClient.db(targetDb);
          const col = db.collection(tableName);

          let count = 0;
          try {
            count = await col.countDocuments();
          } catch {
            count = await col.estimatedDocumentCount().catch(() => 0);
          }
          realRowCount = Number(count).toLocaleString();

          const sampleDocs = await col.find({}).limit(50).toArray();
          const fieldMap = new Map();
          fieldMap.set('_id', {
            name: '_id',
            type: 'objectId',
            nullable: false,
            primaryKey: true,
            description: 'Document primary key (_id)'
          });

          for (const doc of sampleDocs) {
            for (const [key, val] of Object.entries(doc)) {
              if (key === '_id') continue;
              const observedType = inferBsonType(val);
              if (!fieldMap.has(key)) {
                fieldMap.set(key, {
                  name: key,
                  type: observedType,
                  nullable: sampleDocs.some(d => !(key in d) || d[key] === null),
                  primaryKey: false,
                  description: `Inferred BSON field ${key} (${observedType})`
                });
              }
            }
          }

          if (fieldMap.size > 0) {
            schemaCols = Array.from(fieldMap.values());
          }
        } catch (e) {
          console.warn('MongoDB sync collection introspection notice:', e.message);
        }
      } else if (snowflakeConn) {
        try {
          const targetDb = dsConfig.database;
          const targetSch = dsConfig.schema || 'PUBLIC';

          const executeSnowflake = (sqlText, binds = []) => {
            return new Promise((resolve, reject) => {
              snowflakeConn.execute({
                sqlText,
                binds,
                complete: (err, stmt, rows) => {
                  if (err) return reject(err);
                  resolve(rows || []);
                }
              });
            });
          };

          // Check if table or view, get row count and comment
          try {
            const tableRows = await executeSnowflake(
              `SELECT TABLE_NAME, TABLE_TYPE, ROW_COUNT, COMMENT
               FROM "${targetDb}".INFORMATION_SCHEMA.TABLES
               WHERE TABLE_SCHEMA = :1 AND TABLE_NAME = :2`,
              [targetSch, tableName]
            );
            if (tableRows && tableRows.length > 0) {
              const tRow = tableRows[0];
              const rawType = (tRow.TABLE_TYPE || '').toUpperCase();
              if (rawType.includes('VIEW')) {
                assetType = 'view';
                realRowCount = 'VIEW';
              } else {
                assetType = 'table';
                if (tRow.ROW_COUNT !== null && tRow.ROW_COUNT !== undefined) {
                  realRowCount = Number(tRow.ROW_COUNT).toLocaleString();
                }
              }
            }
          } catch (tErr) {}

          // Query columns
          let colRows = [];
          try {
            colRows = await executeSnowflake(
              `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION, COMMENT
               FROM "${targetDb}".INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA = :1 AND TABLE_NAME = :2
               ORDER BY ORDINAL_POSITION ASC`,
              [targetSch, tableName]
            );
          } catch (colErr) {}

          // Query PK constraints
          const pkSet = new Set();
          try {
            const pkRows = await executeSnowflake(
              `SELECT kcu.COLUMN_NAME
               FROM "${targetDb}".INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
               JOIN "${targetDb}".INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                 ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                 AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
                 AND tc.TABLE_CATALOG = kcu.TABLE_CATALOG
               WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                 AND tc.TABLE_SCHEMA = :1 AND tc.TABLE_NAME = :2`,
              [targetSch, tableName]
            );
            if (Array.isArray(pkRows)) {
              pkRows.forEach(r => pkSet.add(r.COLUMN_NAME));
            }
          } catch (pkErr) {}

          if (Array.isArray(colRows) && colRows.length > 0) {
            schemaCols = colRows.map(c => ({
              name: c.COLUMN_NAME,
              type: c.DATA_TYPE ? c.DATA_TYPE.toLowerCase() : 'varchar',
              nullable: c.IS_NULLABLE === 'YES',
              primaryKey: pkSet.has(c.COLUMN_NAME),
              description: c.COMMENT || `Introspected Snowflake column ${c.COLUMN_NAME} (${c.DATA_TYPE})`
            }));
          }
        } catch (e) {
          console.warn('Snowflake sync introspection notice:', e.message);
        }
      } else if (mssqlPool) {
        try {
          let sName = targetSchema;
          let tName = tableName;
          if (tableName.includes('.')) {
            const parts = tableName.split('.');
            sName = parts[0];
            tName = parts.slice(1).join('.');
          }

          // Check if table or view, get row count and comment
          try {
            const request = mssqlPool.request();
            request.input('schemaName', sName);
            request.input('tableName', tName);

            const tableRes = await request.query(`
              SELECT 
                t.TABLE_TYPE AS table_type
              FROM INFORMATION_SCHEMA.TABLES t
              WHERE t.TABLE_SCHEMA = @schemaName AND t.TABLE_NAME = @tableName
            `);

            if (tableRes.recordset && tableRes.recordset.length > 0) {
              const rawType = (tableRes.recordset[0].table_type || '').toUpperCase();
              if (rawType.includes('VIEW')) {
                assetType = 'view';
                realRowCount = 'VIEW';
              } else {
                assetType = 'table';
              }
            }

            if (assetType === 'table') {
              try {
                const countReq = mssqlPool.request();
                countReq.input('schemaName', sName);
                countReq.input('tableName', tName);
                const countRes = await countReq.query(`
                  SELECT ISNULL(SUM(p.rows), 0) AS total_rows
                  FROM sys.tables t
                  JOIN sys.schemas s ON t.schema_id = s.schema_id
                  JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
                  WHERE s.name = @schemaName AND t.name = @tableName
                `);
                if (countRes.recordset && countRes.recordset.length > 0) {
                  realRowCount = Number(countRes.recordset[0].total_rows).toLocaleString();
                }
              } catch (cntErr) {}
            }
          } catch (tErr) {}

          // Query columns
          let colRows = [];
          try {
            const colReq = mssqlPool.request();
            colReq.input('schemaName', sName);
            colReq.input('tableName', tName);
            const colRes = await colReq.query(`
              SELECT 
                c.COLUMN_NAME AS column_name,
                c.DATA_TYPE AS data_type,
                c.IS_NULLABLE AS is_nullable,
                c.ORDINAL_POSITION AS ordinal_position,
                c.COLUMN_DEFAULT AS column_default
              FROM INFORMATION_SCHEMA.COLUMNS c
              WHERE c.TABLE_SCHEMA = @schemaName AND c.TABLE_NAME = @tableName
              ORDER BY c.ORDINAL_POSITION ASC
            `);
            colRows = colRes.recordset || [];
          } catch (colErr) {}

          // Query PK constraints
          const pkSet = new Set();
          try {
            const pkReq = mssqlPool.request();
            pkReq.input('schemaName', sName);
            pkReq.input('tableName', tName);
            const pkRes = await pkReq.query(`
              SELECT kcu.COLUMN_NAME AS column_name
              FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
              JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
              WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                AND tc.TABLE_SCHEMA = @schemaName AND tc.TABLE_NAME = @tableName
            `);
            if (pkRes.recordset) {
              pkRes.recordset.forEach(r => pkSet.add(r.column_name));
            }
          } catch (pkErr) {}

          // Query column extended descriptions if available
          const commentMap = new Map();
          try {
            const descReq = mssqlPool.request();
            descReq.input('schemaName', sName);
            descReq.input('tableName', tName);
            const descRes = await descReq.query(`
              SELECT 
                c.name AS column_name,
                CAST(ep.value AS NVARCHAR(MAX)) AS description
              FROM sys.extended_properties ep
              JOIN sys.objects o ON ep.major_id = o.object_id
              JOIN sys.schemas s ON o.schema_id = s.schema_id
              JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
              WHERE ep.name = 'MS_Description'
                AND s.name = @schemaName AND o.name = @tableName
            `);
            if (descRes.recordset) {
              descRes.recordset.forEach(r => commentMap.set(r.column_name, r.description));
            }
          } catch (descErr) {}

          if (Array.isArray(colRows) && colRows.length > 0) {
            schemaCols = colRows.map(c => ({
              name: c.column_name,
              type: c.data_type ? c.data_type.toLowerCase() : 'nvarchar',
              nullable: c.is_nullable === 'YES',
              primaryKey: pkSet.has(c.column_name),
              description: commentMap.get(c.column_name) || `Introspected SQL Server column ${c.column_name} (${c.data_type})`
            }));
          }
        } catch (e) {
          console.warn('SQL Server sync introspection notice:', e.message);
        }
      } else if (mongoose.connection && mongoose.connection.db) {
        try {
          const sample = await mongoose.connection.db.collection(tableName).findOne();
          if (sample) {
            schemaCols = Object.keys(sample).map(key => ({
              name: key,
              type: typeof sample[key] === 'object' && sample[key] instanceof Date ? 'timestamp' : typeof sample[key],
              nullable: true,
              primaryKey: key === '_id' || key === 'id' || key.endsWith('_id'),
              description: `Introspected attribute ${key}`
            }));
          }
        } catch (e) {}
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
          description: `Synchronized production ${dataSource.type === 'mongodb' ? 'collection' : 'table'} from ${dataSource.name}`,
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
            datasetId: existingDs._id,
            timestamp: new Date()
          });
        } catch (e) {}
      } else {
        // Refresh technical schema and row counts while preserving user-managed fields
        // (descriptions, tags, owner, steward, domain, classification, glossary terms)
        existingDs.dataSourceId = existingDs.dataSourceId || dataSource._id;
        existingDs.tableName = existingDs.tableName || tableName;
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
  } finally {
    if (pgPool) {
      await pgPool.end().catch(() => {});
    }
    if (mysqlConn) {
      await mysqlConn.end().catch(() => {});
    }
    if (mongoClient) {
      await mongoClient.close().catch(() => {});
    }
    if (snowflakeConn) {
      await new Promise(r => snowflakeConn.destroy(() => r())).catch(() => {});
    }
    if (mssqlPool) {
      await mssqlPool.close().catch(() => {});
    }
  }

  dataSource.lastSyncedAt = new Date();
  dataSource.tablesCount = (dataSource.tablesCount || 0) + addedCount;
  await dataSource.save();

  res.json({
    success: true,
    data: {
      dataSourceId: dataSource._id,
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
