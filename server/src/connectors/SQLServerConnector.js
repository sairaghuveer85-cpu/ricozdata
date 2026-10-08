import sql from 'mssql';
import { BaseConnector } from './BaseConnector.js';
import {
  ConnectorConfigurationError,
  ConnectorAuthenticationError,
  ConnectorTimeoutError,
  ConnectorUnavailableError,
  ConnectorPermissionError,
  ConnectorQueryError
} from './errors.js';
import { validateCustomSql, validateSafeRegex } from '../utils/securityValidators.js';

/**
 * Enterprise Microsoft SQL Server Connector for RicozData.
 * Implements connection pooling, system metadata introspection,
 * parameterized queries, bounded sampling, quality rules, and statistical profiling.
 */
export class SQLServerConnector extends BaseConnector {
  constructor(context) {
    super(context);
    this.pool = null;
    this.schema = this.context.configuration.schema || 'dbo';
  }

  get capabilities() {
    return {
      supportsMetadataDiscovery: true,
      supportsSampling: true,
      supportsSchemaDiscovery: true,
      supportsColumnMetadata: true,
      supportsRelationships: true,
      supportsStreaming: false,
      supportsQualityRules: true,
      supportsProfiling: true,
      supportsReadOnlyQueries: true
    };
  }

  /**
   * Initializes SQL Server connection pool using mssql driver.
   */
  async connect() {
    if (this.pool && this.isConnected) return;

    const config = this.context.configuration;
    const creds = this.context.getCredentials();

    const host = config.host || config.server;
    if (!host) {
      throw new ConnectorConfigurationError('SQL Server host or server address is required in configuration');
    }
    if (!config.database) {
      throw new ConnectorConfigurationError('SQL Server database name is required in configuration');
    }

    const username = creds.username || config.username || '';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;

    if (username && (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === ''))) {
      throw new ConnectorAuthenticationError('SQL Server connection requires a password. Please configure valid credentials.');
    }

    let passwordString;
    if (typeof rawPassword === 'string') {
      passwordString = rawPassword;
    } else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') {
      passwordString = String(rawPassword);
    } else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') {
      passwordString = rawPassword.password;
    } else if (rawPassword !== undefined && rawPassword !== null) {
      throw new ConnectorAuthenticationError('Invalid password format. Password must be a valid string.');
    }

    const encrypt = config.ssl === true || config.ssl === 'true' || config.encrypt === true || config.encrypt === 'true';
    const trustServerCertificate = config.trustServerCertificate !== false && config.sslRejectUnauthorized !== true;

    const sqlConfig = {
      server: host,
      port: config.instanceName ? undefined : (parseInt(config.port, 10) || 1433),
      database: config.database,
      user: username,
      password: passwordString !== undefined ? passwordString : undefined,
      domain: config.domain ? String(config.domain).trim() : undefined,
      options: {
        encrypt,
        trustServerCertificate,
        enableArithAbort: true,
        instanceName: config.instanceName ? String(config.instanceName).trim() : undefined,
        domain: config.domain ? String(config.domain).trim() : undefined,
        connectTimeout: this.context.timeouts.connect || 10000,
        requestTimeout: this.context.timeouts.query || 15000
      },
      pool: {
        max: Math.min(Math.max(parseInt(config.poolSize, 10) || 5, 1), 20),
        min: 0,
        idleTimeoutMillis: 10000
      }
    };

    try {
      this.pool = new sql.ConnectionPool(sqlConfig);
      await this.withTimeout(
        this.pool.connect(),
        this.context.timeouts.connect || 10000,
        'SQL Server connection'
      );
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      throw this._mapError(err);
    }
  }

  /**
   * Performs lightweight connectivity validation on SQL Server.
   */
  async test() {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        try {
          const result = await this.pool.request().query('SELECT 1 AS alive, @@VERSION AS server_version, DB_NAME() AS current_db');
          const endHr = process.hrtime.bigint();
          const latencyMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          const row = result.recordset?.[0] || {};
          const serverVer = String(row.server_version || '').split('\n')[0] || 'Microsoft SQL Server';
          return {
            success: true,
            connectorType: 'sqlserver',
            status: 'HEALTHY',
            latencyMs,
            checkedAt: new Date().toISOString(),
            details: {
              database: row.current_db || this.context.configuration.database,
              serverVersion: serverVer,
              version: serverVer,
              schema: this.schema,
              defaultSchema: row.default_schema || this.schema
            }
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.connect || 10000,
      'SQL Server test connection'
    );
  }

  /**
   * Introspects SQL Server INFORMATION_SCHEMA to discover normalized metadata.
   */
  async fetchMetadata(options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const targetSchema = options.schema || this.schema;
        const dbName = this.context.configuration.database;

        try {
          const req = this.pool.request();
          
          let tableFilter = '';
          if (targetSchema && targetSchema !== '*') {
            req.input('targetSchema', sql.NVarChar, targetSchema);
            tableFilter = 'WHERE t.TABLE_SCHEMA = @targetSchema';
          }

          // 1. Fetch tables and views
          const tablesSql = `
            SELECT t.TABLE_CATALOG, t.TABLE_SCHEMA, t.TABLE_NAME, t.TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES t
            ${tableFilter}
            ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME ASC;
          `;
          const tablesRes = await req.query(tablesSql);

          // 2. Fetch columns
          const colReq = this.pool.request();
          let colFilter = '';
          if (targetSchema && targetSchema !== '*') {
            colReq.input('targetSchema', sql.NVarChar, targetSchema);
            colFilter = 'WHERE c.TABLE_SCHEMA = @targetSchema';
          }

          const colsSql = `
            SELECT 
              c.TABLE_SCHEMA,
              c.TABLE_NAME,
              c.COLUMN_NAME,
              c.DATA_TYPE,
              c.IS_NULLABLE,
              c.ORDINAL_POSITION,
              c.COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS c
            ${colFilter}
            ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION ASC;
          `;
          const colsRes = await colReq.query(colsSql);

          // 3. Fetch primary keys
          const pkReq = this.pool.request();
          const pkSql = `
            SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
              ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
              AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
            WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY';
          `;
          const pkRes = await pkReq.query(pkSql);

          const pkMap = new Map();
          for (const pk of pkRes.recordset || []) {
            const key = `${pk.TABLE_SCHEMA}.${pk.TABLE_NAME}`;
            if (!pkMap.has(key)) pkMap.set(key, new Set());
            pkMap.get(key).add(pk.COLUMN_NAME);
          }

          // Assemble normalized catalog map
          const tablesMap = new Map();
          const schemasSet = new Set();

          for (const row of tablesRes.recordset || []) {
            schemasSet.add(row.TABLE_SCHEMA);
            const externalId = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
            const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
            const pks = pkMap.get(key) || new Set();

            tablesMap.set(key, {
              externalId,
              name: row.TABLE_NAME,
              schema: row.TABLE_SCHEMA,
              type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
              columns: [],
              primaryKey: Array.from(pks),
              foreignKeys: [],
              indexes: []
            });
          }

          for (const col of colsRes.recordset || []) {
            const key = `${col.TABLE_SCHEMA}.${col.TABLE_NAME}`;
            const table = tablesMap.get(key);
            if (table) {
              const isPk = table.primaryKey.includes(col.COLUMN_NAME);
              table.columns.push({
                name: col.COLUMN_NAME,
                dataType: col.DATA_TYPE,
                nullable: col.IS_NULLABLE === 'YES',
                ordinalPosition: col.ORDINAL_POSITION,
                defaultValue: col.COLUMN_DEFAULT,
                isPrimaryKey: isPk,
                isForeignKey: false,
                description: ''
              });
            }
          }

          // Discover real foreign keys
          try {
            const fkReq = new sql.Request(this.pool);
            const fkSql = `
              SELECT 
                tp.name AS table_name,
                SCHEMA_NAME(tp.schema_id) AS table_schema,
                cp.name AS column_name,
                fk.name AS constraint_name,
                SCHEMA_NAME(tr.schema_id) AS foreign_table_schema,
                tr.name AS foreign_table_name,
                cr.name AS foreign_column_name
              FROM sys.foreign_keys fk
              JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
              JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
              JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
              JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
              JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
            `;
            const fkRes = await fkReq.query(fkSql);
            for (const fk of fkRes.recordset || []) {
              const key = `${fk.table_schema}.${fk.table_name}`;
              const table = tablesMap.get(key);
              if (table) {
                table.foreignKeys.push({
                  name: fk.constraint_name,
                  column: fk.column_name,
                  referencedSchema: fk.foreign_table_schema,
                  referencedTable: fk.foreign_table_name,
                  referencedColumn: fk.foreign_column_name
                });
              }
            }
          } catch (fkErr) {
            // Non-blocking FK introspection notice
          }

          return {
            sourceType: 'sqlserver',
            database: dbName,
            schema: targetSchema || (schemasSet.values().next().value || 'dbo'),
            schemas: Array.from(schemasSet),
            tables: Array.from(tablesMap.values())
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.metadata || 45000,
      'SQL Server metadata discovery'
    );
  }

  /**
   * Bounded data sampling with TOP N statement.
   */
  async sampleData(params = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const tableName = params.tableName;
        const schema = params.schema || this.schema || 'dbo';
        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 100);

        this._validateIdentifier(tableName, 'Table');
        this._validateIdentifier(schema, 'Schema');

        try {
          const req = this.pool.request();
          req.input('limit', sql.Int, limit);

          const query = `SELECT TOP (@limit) * FROM [${schema}].[${tableName}];`;
          const result = await req.query(query);

          const rows = result.recordset || [];
          const columns = result.recordset?.columns ? Object.keys(result.recordset.columns) : (rows[0] ? Object.keys(rows[0]) : []);

          return {
            datasetName: tableName,
            schema,
            rowCount: rows.length,
            columns,
            rows,
            sampledAt: new Date().toISOString(),
            truncated: rows.length === limit
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.sample || 15000,
      'SQL Server data sampling'
    );
  }

  /**
   * Execute read-only query with strict safety checks and bounded limits.
   */
  async executeQueryReadOnly(sqlQuery, params = [], options = {}) {
    if (!sqlQuery || typeof sqlQuery !== 'string' || !sqlQuery.trim()) {
      throw new ConnectorConfigurationError('Query cannot be empty');
    }

    validateCustomSql(sqlQuery);

    const maxRows = Math.min(Math.max(parseInt(options.maxRows, 10) || 50, 1), 100);
    const timeoutMs = options.timeoutMs || this.context.timeouts.query || 15000;

    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        try {
          const req = this.pool.request();
          req.timeout = timeoutMs;

          // Wrap query inside a bounded subquery if not already TOP-limited
          let finalSql = sqlQuery.trim();
          if (!/SELECT\s+TOP\s+/i.test(finalSql)) {
            finalSql = `SELECT TOP (${maxRows}) * FROM (${finalSql.replace(/;$/, '')}) AS __ricoz_bounded_subq;`;
          }

          const result = await req.query(finalSql);
          const endHr = process.hrtime.bigint();
          const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          const rows = result.recordset || [];
          const fields = result.recordset?.columns ? Object.keys(result.recordset.columns) : (rows[0] ? Object.keys(rows[0]) : []);

          return {
            rowCount: rows.length,
            fields,
            rows,
            durationMs,
            truncated: rows.length === maxRows
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      timeoutMs,
      'SQL Server query execution'
    );
  }

  /**
   * Evaluates quality rule against a target dataset using SQL Server pushdown queries.
   */
  async executeQualityRule(rule, dataset, options = {}) {
    if (!this.pool || !this.isConnected) {
      await this.connect();
    }

    const schema = dataset.schemaName || this.schema || 'dbo';
    const tableName = dataset.tableName || dataset.name;
    this._validateIdentifier(schema, 'Schema');
    this._validateIdentifier(tableName, 'Table');

    const qualifiedTable = `[${schema}].[${tableName}]`;
    const ruleType = String(rule.ruleType || '').toUpperCase().trim();
    const config = rule.configuration || rule.parameters || {};
    const targetCol = rule.targetColumn || config.column;
    if (targetCol) this._validateIdentifier(targetCol, 'Column');

    const startHr = process.hrtime.bigint();
    const req = this.pool.request();

    try {
      const countRes = await req.query(`SELECT COUNT(*) AS total FROM ${qualifiedTable};`);
      const totalRecords = parseInt(countRes.recordset[0]?.total || 0, 10);

      if (totalRecords === 0) {
        return {
          ruleId: rule._id,
          ruleName: rule.name,
          ruleType: rule.ruleType,
          severity: rule.severity || 'MEDIUM',
          targetColumn: targetCol,
          targetColumns: rule.targetColumns,
          passed: true,
          recordsEvaluated: 0,
          recordsPassed: 0,
          recordsFailed: 0,
          passPercentage: 100,
          message: 'Dataset is empty. 0 records evaluated.',
          evidenceSummary: null,
          executionDurationMs: 0
        };
      }

      let failedRecords = 0;
      let evidenceSummary = null;
      let message = '';

      switch (ruleType) {
        case 'COMPLETENESS':
        case 'NULL_CHECK': {
          if (!targetCol) throw new ConnectorConfigurationError('NULL_CHECK rule requires targetColumn');
          const allowEmpty = config.allowEmptyString === true;
          const condition = allowEmpty
            ? `[${targetCol}] IS NULL`
            : `[${targetCol}] IS NULL OR CAST([${targetCol}] AS NVARCHAR(MAX)) = ''`;

          const checkRes = await req.query(`
            SELECT COUNT(CASE WHEN ${condition} THEN 1 END) AS failed_cnt
            FROM ${qualifiedTable};
          `);
          failedRecords = parseInt(checkRes.recordset[0]?.failed_cnt || 0, 10);

          if (failedRecords > 0) {
            const sampleRes = await req.query(`
              SELECT TOP 5 CAST([${targetCol}] AS NVARCHAR(MAX)) AS failing_value
              FROM ${qualifiedTable}
              WHERE ${condition};
            `);
            evidenceSummary = {
              failingCount: failedRecords,
              sampleFailingValues: sampleRes.recordset
            };
          }
          message = failedRecords === 0
            ? `Column "${targetCol}" contains 0 null values`
            : `Column "${targetCol}" contains ${failedRecords} null values`;
          break;
        }

        case 'UNIQUENESS': {
          const cols = (rule.targetColumns && rule.targetColumns.length > 0)
            ? rule.targetColumns
            : [targetCol];
          if (!cols || cols.length === 0 || !cols[0]) {
            throw new ConnectorConfigurationError('UNIQUENESS rule requires at least one target column');
          }
          cols.forEach(c => this._validateIdentifier(c, 'Column'));
          const quotedCols = cols.map(c => `[${c}]`);

          if (cols.length === 1) {
            const checkRes = await req.query(`
              SELECT (COUNT(*) - COUNT(DISTINCT ${quotedCols[0]})) AS dup_cnt
              FROM ${qualifiedTable};
            `);
            failedRecords = parseInt(checkRes.recordset[0]?.dup_cnt || 0, 10);
          } else {
            const checkRes = await req.query(`
              SELECT ISNULL(SUM(dup_count - 1), 0) AS dup_cnt
              FROM (
                SELECT ${quotedCols.join(', ')}, COUNT(*) AS dup_count
                FROM ${qualifiedTable}
                GROUP BY ${quotedCols.join(', ')}
                HAVING COUNT(*) > 1
              ) sub;
            `);
            failedRecords = parseInt(checkRes.recordset[0]?.dup_cnt || 0, 10);
          }

          if (failedRecords > 0) {
            const sampleRes = await req.query(`
              SELECT TOP 5 ${quotedCols.join(', ')}, COUNT(*) AS occurrences
              FROM ${qualifiedTable}
              GROUP BY ${quotedCols.join(', ')}
              HAVING COUNT(*) > 1;
            `);
            evidenceSummary = {
              duplicateCount: failedRecords,
              sampleDuplicates: sampleRes.recordset
            };
          }
          message = failedRecords === 0
            ? `Uniqueness verified for [${cols.join(', ')}] with 0 duplicates`
            : `Found ${failedRecords} duplicate rows for [${cols.join(', ')}]`;
          break;
        }

        case 'REGEX_PATTERN': {
          if (!targetCol) throw new ConnectorConfigurationError('REGEX_PATTERN rule requires targetColumn');
          const pattern = config.pattern;
          const regValidation = validateSafeRegex(pattern);
          if (!regValidation.valid) {
            throw new ConnectorConfigurationError(regValidation.error);
          }

          // If pattern is a standard email pattern
          if (pattern.includes('@')) {
            const emailCond = `[${targetCol}] IS NOT NULL AND ([${targetCol}] NOT LIKE '%_@__%.__%' OR [${targetCol}] LIKE '% %' OR [${targetCol}] LIKE '%..%')`;
            const checkRes = await req.query(`
              SELECT COUNT(CASE WHEN ${emailCond} THEN 1 END) AS failed_cnt
              FROM ${qualifiedTable};
            `);
            failedRecords = parseInt(checkRes.recordset[0]?.failed_cnt || 0, 10);

            if (failedRecords > 0) {
              const sampleRes = await req.query(`
                SELECT TOP 5 CAST([${targetCol}] AS NVARCHAR(MAX)) AS failing_value
                FROM ${qualifiedTable}
                WHERE ${emailCond};
              `);
              evidenceSummary = {
                failingCount: failedRecords,
                pattern,
                sampleFailingValues: sampleRes.recordset
              };
            }
          } else {
            // For custom regex patterns, evaluate non-null values with safe client verification
            const sampleRes = await req.query(`
              SELECT TOP 1000 CAST([${targetCol}] AS NVARCHAR(MAX)) AS val
              FROM ${qualifiedTable}
              WHERE [${targetCol}] IS NOT NULL;
            `);
            const rx = new RegExp(pattern);
            const failing = sampleRes.recordset.filter(r => !rx.test(String(r.val || '')));
            failedRecords = failing.length;
            evidenceSummary = {
              failingCount: failedRecords,
              pattern,
              sampleFailingValues: failing.slice(0, 5)
            };
          }

          message = failedRecords === 0
            ? `Column "${targetCol}" matches regex pattern "${pattern}"`
            : `Column "${targetCol}" had ${failedRecords} values failing regex pattern "${pattern}"`;
          break;
        }

        case 'VALUE_RANGE': {
          if (!targetCol) throw new ConnectorConfigurationError('VALUE_RANGE rule requires targetColumn');
          const min = config.min;
          const max = config.max;
          if (min === undefined && max === undefined) {
            throw new ConnectorConfigurationError('VALUE_RANGE rule requires at least min or max');
          }

          const conditions = [];
          if (min !== undefined) conditions.push(`[${targetCol}] < ${Number(min)}`);
          if (max !== undefined) conditions.push(`[${targetCol}] > ${Number(max)}`);
          const rangeClause = conditions.join(' OR ');

          const checkRes = await req.query(`
            SELECT COUNT(CASE WHEN [${targetCol}] IS NOT NULL AND (${rangeClause}) THEN 1 END) AS failed_cnt
            FROM ${qualifiedTable};
          `);
          failedRecords = parseInt(checkRes.recordset[0]?.failed_cnt || 0, 10);

          if (failedRecords > 0) {
            const sampleRes = await req.query(`
              SELECT TOP 5 CAST([${targetCol}] AS NVARCHAR(MAX)) AS failing_value
              FROM ${qualifiedTable}
              WHERE [${targetCol}] IS NOT NULL AND (${rangeClause});
            `);
            evidenceSummary = {
              failingCount: failedRecords,
              range: { min, max },
              sampleFailingValues: sampleRes.recordset
            };
          }

          message = failedRecords === 0
            ? `All values in "${targetCol}" are within acceptable range [${min ?? '-∞'}, ${max ?? '+∞'}]`
            : `Column "${targetCol}" had ${failedRecords} values outside range [${min ?? '-∞'}, ${max ?? '+∞'}]`;
          break;
        }

        case 'ALLOWED_VALUES':
        case 'ENUM': {
          if (!targetCol) throw new ConnectorConfigurationError('ALLOWED_VALUES rule requires targetColumn');
          const allowed = Array.isArray(config.values) ? config.values : [];
          if (allowed.length === 0) {
            throw new ConnectorConfigurationError('ALLOWED_VALUES rule requires non-empty values list');
          }

          const escapedValues = allowed.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ');
          const checkRes = await req.query(`
            SELECT COUNT(CASE WHEN [${targetCol}] IS NOT NULL AND [${targetCol}] NOT IN (${escapedValues}) THEN 1 END) AS failed_cnt
            FROM ${qualifiedTable};
          `);
          failedRecords = parseInt(checkRes.recordset[0]?.failed_cnt || 0, 10);

          if (failedRecords > 0) {
            const sampleRes = await req.query(`
              SELECT TOP 5 CAST([${targetCol}] AS NVARCHAR(MAX)) AS failing_value
              FROM ${qualifiedTable}
              WHERE [${targetCol}] IS NOT NULL AND [${targetCol}] NOT IN (${escapedValues});
            `);
            evidenceSummary = {
              failingCount: failedRecords,
              allowedValues: allowed,
              sampleFailingValues: sampleRes.recordset
            };
          }

          message = failedRecords === 0
            ? `All values in "${targetCol}" match allowed set`
            : `Column "${targetCol}" had ${failedRecords} values not in allowed set`;
          break;
        }

        case 'FRESHNESS':
        case 'TIMELINESS': {
          if (!targetCol) throw new ConnectorConfigurationError('FRESHNESS rule requires targetColumn');
          const maxAgeDays = Number(config.maxAgeDays || 1);

          const checkRes = await req.query(`
            SELECT 
              MAX([${targetCol}]) AS latest_timestamp,
              DATEDIFF(day, MAX([${targetCol}]), GETDATE()) AS age_days
            FROM ${qualifiedTable};
          `);
          const row = checkRes.recordset[0] || {};
          const ageDays = parseInt(row.age_days || 0, 10);
          const latestTs = row.latest_timestamp;

          if (ageDays > maxAgeDays) {
            failedRecords = totalRecords;
            evidenceSummary = {
              latestTimestamp: latestTs,
              ageDays,
              maxAgeDays,
              slaViolated: true
            };
            message = `Data freshness SLA violated: latest record in "${targetCol}" is ${ageDays} days old (max SLA: ${maxAgeDays} days)`;
          } else {
            failedRecords = 0;
            message = `Data is fresh: latest record in "${targetCol}" is ${ageDays} days old`;
          }
          break;
        }

        case 'REFERENCE_INTEGRITY': {
          const foreignKey = targetCol;
          const refTable = config.referenceTable;
          const refCol = config.referenceColumn || 'id';
          const refSchema = config.referenceSchema || schema;

          this._validateIdentifier(foreignKey, 'Column');
          this._validateIdentifier(refTable, 'Reference Table');
          this._validateIdentifier(refCol, 'Reference Column');
          this._validateIdentifier(refSchema, 'Reference Schema');

          const checkRes = await req.query(`
            SELECT COUNT(a.[${foreignKey}]) AS orphan_cnt
            FROM ${qualifiedTable} a
            LEFT JOIN [${refSchema}].[${refTable}] b ON a.[${foreignKey}] = b.[${refCol}]
            WHERE a.[${foreignKey}] IS NOT NULL AND b.[${refCol}] IS NULL;
          `);
          failedRecords = parseInt(checkRes.recordset[0]?.orphan_cnt || 0, 10);

          message = failedRecords === 0
            ? `Referential integrity verified with [${refSchema}].[${refTable}].[${refCol}]`
            : `Found ${failedRecords} orphaned records not present in [${refSchema}].[${refTable}].[${refCol}]`;
          break;
        }

        case 'CUSTOM_SQL': {
          const sqlQuery = config.sql || config.query;
          const queryRes = await this.executeQueryReadOnly(sqlQuery);
          failedRecords = queryRes.rowCount || 0;
          evidenceSummary = { failingCount: failedRecords, sampleFailingValues: queryRes.rows.slice(0, 5) };
          message = failedRecords === 0
            ? 'Custom SQL quality check passed'
            : `Custom SQL quality check returned ${failedRecords} failing rows`;
          break;
        }

        default: {
          failedRecords = 0;
          message = `Evaluated rule ${ruleType} on ${qualifiedTable}`;
          break;
        }
      }

      const endHr = process.hrtime.bigint();
      const executionDurationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;
      const recordsPassed = Math.max(0, totalRecords - failedRecords);
      const passPercentage = totalRecords > 0 ? Math.round((recordsPassed / totalRecords) * 10000) / 100 : 100;
      const threshold = rule.threshold ? (rule.threshold <= 1 ? rule.threshold * 100 : rule.threshold) : 95;
      const passed = passPercentage >= threshold;

      return {
        ruleId: rule._id,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        severity: rule.severity,
        targetColumn: targetCol,
        targetColumns: rule.targetColumns,
        passed,
        recordsEvaluated: totalRecords,
        recordsPassed,
        recordsFailed: failedRecords,
        passPercentage,
        message,
        evidenceSummary,
        executionDurationMs
      };
    } catch (err) {
      throw this._mapError(err);
    }
  }

  /**
   * Statistical column profiling using SQL Server aggregation pushdown.
   */
  async profileDataset(dataset, options = {}) {
    if (!this.pool || !this.isConnected) {
      await this.connect();
    }

    const startHr = process.hrtime.bigint();
    const schema = dataset.schemaName || this.schema || 'dbo';
    const tableName = dataset.tableName || dataset.name;
    this._validateIdentifier(schema, 'Schema');
    this._validateIdentifier(tableName, 'Table');

    const qualifiedTable = `[${schema}].[${tableName}]`;

    try {
      const req = this.pool.request();

      // Discover table columns if not passed
      let columns = dataset.columns || [];
      if (!columns || columns.length === 0) {
        const colsRes = await req.query(`
          SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = '${schema.replace(/'/g, "''")}'
            AND TABLE_NAME = '${tableName.replace(/'/g, "''")}'
          ORDER BY ORDINAL_POSITION ASC;
        `);
        columns = colsRes.recordset.map(r => ({ name: r.column_name, dataType: r.data_type }));
      }

      const countRes = await req.query(`SELECT COUNT(*) AS total_rows FROM ${qualifiedTable};`);
      const totalRows = parseInt(countRes.recordset[0]?.total_rows, 10) || 0;

      const columnProfiles = [];
      for (const col of columns.slice(0, 100)) {
        const colName = col.name;
        const dataType = String(col.dataType || '').toLowerCase();
        this._validateIdentifier(colName, 'Column');

        if (totalRows === 0) {
          columnProfiles.push({
            columnName: colName,
            name: colName,
            dataType,
            rowCount: 0,
            totalCount: 0,
            nullCount: 0,
            nullPercentage: 0,
            completenessPercentage: 100,
            distinctCount: 0,
            cardinality: 0,
            minValue: null,
            maxValue: null,
            meanValue: null,
            medianValue: null,
            stdDevValue: null,
            histogram: [],
            profiledAt: new Date().toISOString()
          });
          continue;
        }

        try {
          const colReq = this.pool.request();
          const statsRes = await colReq.query(`
            SELECT 
              (COUNT(*) - COUNT([${colName}])) AS null_cnt,
              COUNT(DISTINCT [${colName}]) AS distinct_cnt,
              MIN(CAST([${colName}] AS NVARCHAR(4000))) AS min_val,
              MAX(CAST([${colName}] AS NVARCHAR(4000))) AS max_val
            FROM ${qualifiedTable};
          `);
          const row = statsRes.recordset[0] || {};
          const nullCount = parseInt(row.null_cnt, 10) || 0;
          const distinctCount = parseInt(row.distinct_cnt, 10) || 0;
          const nullPercentage = Math.round((nullCount / totalRows) * 10000) / 100;
          const completenessPercentage = Math.round(((totalRows - nullCount) / totalRows) * 10000) / 100;
          const cardinality = Math.round((distinctCount / totalRows) * 10000) / 10000;

          let meanValue = null;
          let stdDevValue = null;
          const isNumeric = ['int', 'smallint', 'bigint', 'decimal', 'numeric', 'float', 'real', 'money'].some(t => dataType.includes(t));

          if (isNumeric && (totalRows - nullCount) > 0) {
            try {
              const numReq = this.pool.request();
              const numRes = await numReq.query(`
                SELECT 
                  AVG(CAST([${colName}] AS FLOAT)) AS mean_val,
                  STDEV(CAST([${colName}] AS FLOAT)) AS std_dev
                FROM ${qualifiedTable}
                WHERE [${colName}] IS NOT NULL;
              `);
              const numRow = numRes.recordset[0] || {};
              meanValue = numRow.mean_val !== null ? Math.round(Number(numRow.mean_val) * 100) / 100 : null;
              stdDevValue = numRow.std_dev !== null ? Math.round(Number(numRow.std_dev) * 100) / 100 : null;
            } catch {}
          }

          let histogram = [];
          try {
            const histReq = this.pool.request();
            const histRes = await histReq.query(`
              SELECT TOP 5 CAST([${colName}] AS NVARCHAR(4000)) AS bucket_val, COUNT(*) AS bucket_cnt
              FROM ${qualifiedTable}
              WHERE [${colName}] IS NOT NULL
              GROUP BY CAST([${colName}] AS NVARCHAR(4000))
              ORDER BY bucket_cnt DESC;
            `);
            histogram = histRes.recordset.map(r => ({
              bucket: r.bucket_val ?? 'null',
              count: parseInt(r.bucket_cnt, 10),
              percentage: Math.round((parseInt(r.bucket_cnt, 10) / totalRows) * 10000) / 100
            }));
          } catch {}

          columnProfiles.push({
            columnName: colName,
            name: colName,
            dataType,
            rowCount: totalRows,
            totalCount: totalRows,
            nullCount,
            nullPercentage,
            completenessPercentage,
            distinctCount,
            cardinality,
            minValue: row.min_val ?? null,
            maxValue: row.max_val ?? null,
            meanValue,
            medianValue: meanValue,
            stdDevValue,
            histogram,
            profiledAt: new Date().toISOString()
          });
        } catch {
          // If a column cannot be queried individually, skip or push basic record
        }
      }

      const endHr = process.hrtime.bigint();
      const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      return {
        datasetId: dataset._id,
        datasetName: tableName,
        schema,
        rowCount: totalRows,
        columnCount: columnProfiles.length,
        columns: columnProfiles,
        columnProfiles,
        profiledAt: new Date().toISOString(),
        durationMs
      };
    } catch (err) {
      throw this._mapError(err);
    }
  }

  /**
   * Closes SQL Server connection pool gracefully.
   */
  async disconnect() {
    this.isConnected = false;
    if (this.pool) {
      try {
        await this.pool.close();
      } catch (err) {
        this.context.logger?.warn('Error closing SQL Server pool', { error: err.message });
      } finally {
        this.pool = null;
      }
    }
  }

  _validateIdentifier(id, type = 'Identifier') {
    if (!id || typeof id !== 'string') {
      throw new ConnectorConfigurationError(`${type} name must be a non-empty string`);
    }
    if (!/^[a-zA-Z0-9_#$]+$/.test(id)) {
      throw new ConnectorConfigurationError(`Unsafe or invalid ${type.toLowerCase()} identifier "${id}"`);
    }
  }

  _mapError(err) {
    if (!err) return new ConnectorQueryError('Unknown SQL Server error');
    if (err instanceof ConnectorConfigurationError || err instanceof ConnectorTimeoutError) return err;

    const msg = err.message || '';
    const number = err.number;

    if (number === 18456 || msg.includes('Login failed')) {
      return new ConnectorAuthenticationError('SQL Server authentication failed. Invalid username or password.');
    }
    if (number === 4060 || msg.includes('Cannot open database')) {
      return new ConnectorConfigurationError(`SQL Server database "${this.context.configuration.database}" cannot be opened or does not exist.`);
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('Failed to connect to')) {
      return new ConnectorUnavailableError(`Unable to connect to SQL Server host at ${this.context.configuration.host}:${this.context.configuration.port || 1433}`);
    }
    if (msg.includes('timeout') || err.code === 'ETIMEOUT') {
      return new ConnectorTimeoutError('SQL Server connection or query timed out.');
    }
    if (number === 208 || msg.includes('Invalid object name')) {
      return new ConnectorQueryError(`Source table not found in SQL Server database: ${msg}`);
    }

    return new ConnectorQueryError(msg.length > 250 ? `${msg.substring(0, 247)}...` : msg, { sqlServerNumber: number });
  }
}

export default SQLServerConnector;
