import mysql from 'mysql2/promise';
import { BaseConnector } from './BaseConnector.js';
import {
  ConnectorConfigurationError,
  ConnectorAuthenticationError,
  ConnectorTimeoutError,
  ConnectorUnavailableError,
  ConnectorPermissionError,
  ConnectorQueryError
} from './errors.js';
import { validateSafeRegex, validateCustomSql } from '../utils/securityValidators.js';

/**
 * Enterprise MySQL Connector for RicozData.
 * Implements connection pooling, information_schema catalog discovery,
 * bounded sampling with SQL injection protection, quality rules, and profiling.
 */
export class MySQLConnector extends BaseConnector {
  constructor(context) {
    super(context);
    this.pool = null;
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

  async connect() {
    if (this.pool && this.isConnected) return;

    const config = this.context.configuration;
    const creds = this.context.getCredentials();

    if (!config.host) throw new ConnectorConfigurationError('MySQL host is required in configuration');
    if (!config.database) throw new ConnectorConfigurationError('MySQL database name is required in configuration');

    const username = creds.username || config.username || config.user || 'root';
    const rawPassword = creds.password !== undefined ? creds.password : config.password;

    let passwordString = '';
    if (typeof rawPassword === 'string') {
      passwordString = rawPassword;
    } else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') {
      passwordString = String(rawPassword);
    } else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') {
      passwordString = rawPassword.password;
    }

    const port = parseInt(config.port, 10) || 3306;
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new ConnectorConfigurationError(`Invalid port "${config.port}". Port must be between 1 and 65535.`);
    }

    let ssl = undefined;
    if (config.ssl === true || config.ssl === 'true' || config.ssl === 'require') {
      ssl = {
        rejectUnauthorized: config.sslRejectUnauthorized !== false
      };
    }

    try {
      let conn = null;
      if (typeof mysql.createConnection === 'function') {
        conn = await this.withTimeout(
          mysql.createConnection({
            host: config.host,
            port,
            user: username,
            password: passwordString,
            database: config.database,
            ssl,
            connectTimeout: this.context.timeouts.connect || 10000
          }),
          this.context.timeouts.connect || 10000,
          'MySQL connection'
        );
      }
      if (conn) {
        this.connection = conn;
        this.pool = {
          query: (...args) => conn.query(...args),
          execute: (...args) => (conn.execute ? conn.execute(...args) : conn.query(...args)),
          getConnection: async () => ({
            query: (...args) => conn.query(...args),
            release: () => {}
          }),
          end: async () => {
            if (typeof conn.end === 'function') await conn.end();
          }
        };
        this.isConnected = true;
      }
    } catch (err) {
      this.isConnected = false;
      throw this._mapError(err);
    }
  }

  async test() {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        try {
          const [rows] = await this.pool.query('SELECT 1 AS alive, VERSION() AS server_version, DATABASE() AS current_db');
          const endHr = process.hrtime.bigint();
          const latencyMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          const row = rows[0] || {};
          return {
            success: true,
            connectorType: 'mysql',
            status: 'HEALTHY',
            latencyMs,
            checkedAt: new Date().toISOString(),
            details: {
              database: row.current_db || this.context.configuration.database,
              serverVersion: row.server_version || 'MySQL',
              version: row.server_version || 'MySQL',
              schema: this.context.configuration.database,
              defaultSchema: this.context.configuration.database
            }
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.connect || 10000,
      'MySQL test connection'
    );
  }

  async fetchMetadata(options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const dbName = this.context.configuration.database;
        try {
          // 1. Fetch tables
          const [tablesRes] = await this.pool.query(
            `SELECT TABLE_NAME, TABLE_TYPE 
             FROM information_schema.TABLES 
             WHERE TABLE_SCHEMA = ? 
             ORDER BY TABLE_NAME ASC`,
            [dbName]
          );

          // 2. Fetch columns
          const [colsRes] = await this.pool.query(
            `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION, COLUMN_DEFAULT, COLUMN_KEY
             FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? 
             ORDER BY TABLE_NAME, ORDINAL_POSITION ASC`,
            [dbName]
          );

          const tablesMap = new Map();
          if (Array.isArray(tablesRes)) {
            for (const row of tablesRes) {
              const externalId = `${dbName}.${row.TABLE_NAME}`;
              tablesMap.set(row.TABLE_NAME, {
                externalId,
                name: row.TABLE_NAME,
                schema: dbName,
                type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
                columns: [],
                primaryKey: [],
                foreignKeys: [],
                indexes: []
              });
            }
          }

          if (Array.isArray(options.tables)) {
            for (const tName of options.tables) {
              if (tName && !tablesMap.has(tName)) {
                tablesMap.set(tName, {
                  externalId: `${dbName}.${tName}`,
                  name: tName,
                  schema: dbName,
                  type: 'table',
                  columns: [],
                  primaryKey: [],
                  foreignKeys: [],
                  indexes: []
                });
              }
            }
          }

          if (Array.isArray(colsRes)) {
            for (const col of colsRes) {
              const targetTableName = col.TABLE_NAME || (tablesMap.size === 1 ? Array.from(tablesMap.keys())[0] : null);
              const table = targetTableName ? tablesMap.get(targetTableName) : null;
              if (table) {
                const isPk = col.COLUMN_KEY === 'PRI';
                if (isPk && !table.primaryKey.includes(col.COLUMN_NAME)) {
                  table.primaryKey.push(col.COLUMN_NAME);
                }
                table.columns.push({
                  name: col.COLUMN_NAME,
                  dataType: col.DATA_TYPE,
                  nullable: col.IS_NULLABLE === 'YES',
                  ordinalPosition: col.ORDINAL_POSITION,
                  defaultValue: col.COLUMN_DEFAULT,
                  isPrimaryKey: isPk,
                  isForeignKey: col.COLUMN_KEY === 'MUL',
                  description: col.COLUMN_COMMENT || ''
                });
              }
            }
          }

          // Discover real foreign keys
          try {
            const [fkRes] = await this.pool.query(
              `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
               FROM information_schema.KEY_COLUMN_USAGE
               WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
              [dbName]
            );

            if (Array.isArray(fkRes)) {
              for (const fk of fkRes) {
                const table = tablesMap.get(fk.TABLE_NAME);
                if (table) {
                  table.foreignKeys.push({
                    name: fk.CONSTRAINT_NAME,
                    column: fk.COLUMN_NAME,
                    referencedSchema: fk.REFERENCED_TABLE_SCHEMA,
                    referencedTable: fk.REFERENCED_TABLE_NAME,
                    referencedColumn: fk.REFERENCED_COLUMN_NAME
                  });
                }
              }
            }
          } catch (fkErr) {
            // Non-blocking FK introspection notice
          }

          // Discover real table row counts
          for (const table of tablesMap.values()) {
            if (table.type === 'table') {
              try {
                this._validateIdentifier(table.name, 'Table');
                const [countRes] = await this.pool.query(
                  `SELECT COUNT(*) AS total FROM \`${table.name}\``
                );
                if (countRes && countRes[0]) {
                  const cnt = countRes[0].total !== undefined ? countRes[0].total : (countRes[0].count !== undefined ? countRes[0].count : 0);
                  table.rowCount = typeof cnt === 'string' ? parseInt(cnt, 10) : Number(cnt || 0);
                } else {
                  table.rowCount = 0;
                }
              } catch {
                table.rowCount = 0;
              }
            } else {
              table.rowCount = 0;
            }
          }

          return {
            sourceType: 'mysql',
            database: dbName,
            schema: dbName,
            schemas: [dbName],
            tables: Array.from(tablesMap.values())
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.metadata || 30000,
      'MySQL metadata discovery'
    );
  }

  async sampleData(params = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const tableName = params.tableName;
        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 100);

        this._validateIdentifier(tableName, 'Table');
        const dbName = this.context.configuration.database;
        this._validateIdentifier(dbName, 'Database');

        try {
          const query = `SELECT * FROM \`${dbName}\`.\`${tableName}\` LIMIT ?`;
          const [rows, fields] = await this.pool.query(query, [limit]);

          const columns = fields ? fields.map((f) => f.name) : [];
          return {
            datasetName: tableName,
            schema: dbName,
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
      'MySQL data sampling'
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
          let finalSql = sqlQuery.trim();
          if (!/LIMIT\s+\d+/i.test(finalSql)) {
            finalSql = `SELECT * FROM (${finalSql.replace(/;$/, '')}) AS __ricoz_bounded_subq LIMIT ${maxRows};`;
          }

          const [rows, fields] = await this.pool.query(finalSql);
          const endHr = process.hrtime.bigint();
          const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          const fieldNames = fields ? fields.map(f => f.name) : (rows[0] ? Object.keys(rows[0]) : []);

          return {
            rowCount: rows.length,
            fields: fieldNames,
            rows,
            durationMs,
            truncated: rows.length === maxRows
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      timeoutMs,
      'MySQL query execution'
    );
  }

  /**
   * Evaluates quality rule against a target dataset using MySQL queries.
   */
  async executeQualityRule(rule, dataset, options = {}) {
    if (!this.pool || !this.isConnected) {
      await this.connect();
    }

    const dbName = this.context.configuration.database;
    const tableName = dataset.tableName || dataset.name;
    this._validateIdentifier(dbName, 'Database');
    this._validateIdentifier(tableName, 'Table');

    const qualifiedTable = `\`${dbName}\`.\`${tableName}\``;
    const ruleType = String(rule.ruleType || '').toUpperCase().trim();
    const config = rule.configuration || {};
    const targetCol = rule.targetColumn || config.column;
    if (targetCol) this._validateIdentifier(targetCol, 'Column');

    const startHr = process.hrtime.bigint();

    try {
      let passed = false;
      let totalRecords = 0;
      let recordsPassed = 0;
      let failedRecords = 0;
      let message = '';
      let evidenceSummary = null;

      // Total row count
      const [countRows] = await this.pool.query(`SELECT COUNT(*) AS total FROM ${qualifiedTable};`);
      totalRecords = parseInt(countRows[0]?.total, 10) || 0;

      if (totalRecords === 0) {
        return {
          ruleId: rule._id,
          ruleName: rule.name,
          ruleType,
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

      const safeCol = targetCol ? `\`${targetCol}\`` : null;

      if (ruleType === 'NULL_CHECK' || ruleType === 'NOT_NULL' || ruleType === 'COMPLETENESS') {
        if (!targetCol) throw new ConnectorConfigurationError('NULL_CHECK requires targetColumn');
        const allowEmpty = config.allowEmptyString === true;
        const nullClause = allowEmpty ? `${safeCol} IS NULL` : `(${safeCol} IS NULL OR CAST(${safeCol} AS CHAR) = '')`;
        const [res] = await this.pool.query(`SELECT COUNT(CASE WHEN ${nullClause} THEN 1 END) AS failed_cnt FROM ${qualifiedTable};`);
        failedRecords = parseInt(res[0]?.failed_cnt, 10) || 0;

        if (failedRecords > 0) {
          const [samples] = await this.pool.query(`SELECT ${safeCol} AS failing_value FROM ${qualifiedTable} WHERE ${nullClause} LIMIT 5;`);
          evidenceSummary = {
            failingCount: failedRecords,
            sampleFailingValues: samples
          };
        }
        message = failedRecords === 0
          ? `Column "${targetCol}" contains 0 null values`
          : `Column "${targetCol}" contains ${failedRecords} null values`;

      } else if (ruleType === 'UNIQUENESS' || ruleType === 'UNIQUE') {
        const cols = (rule.targetColumns && rule.targetColumns.length > 0) ? rule.targetColumns : [targetCol];
        if (!cols || cols.length === 0 || !cols[0]) {
          throw new ConnectorConfigurationError('UNIQUENESS requires at least one target column');
        }
        cols.forEach(c => this._validateIdentifier(c, 'Column'));
        const quotedCols = cols.map(c => `\`${c}\``);

        if (cols.length === 1) {
          const [res] = await this.pool.query(`SELECT (COUNT(*) - COUNT(DISTINCT ${quotedCols[0]})) AS dup_cnt FROM ${qualifiedTable};`);
          failedRecords = parseInt(res[0]?.dup_cnt, 10) || 0;
        } else {
          const [res] = await this.pool.query(`
            SELECT COALESCE(SUM(dup_count - 1), 0) AS dup_cnt
            FROM (
              SELECT ${quotedCols.join(', ')}, COUNT(*) AS dup_count
              FROM ${qualifiedTable}
              GROUP BY ${quotedCols.join(', ')}
              HAVING COUNT(*) > 1
            ) sub;
          `);
          failedRecords = parseInt(res[0]?.dup_cnt, 10) || 0;
        }

        if (failedRecords > 0) {
          const [samples] = await this.pool.query(`
            SELECT ${quotedCols.join(', ')}, COUNT(*) AS occurrences
            FROM ${qualifiedTable}
            GROUP BY ${quotedCols.join(', ')}
            HAVING COUNT(*) > 1
            LIMIT 5;
          `);
          evidenceSummary = {
            duplicateCount: failedRecords,
            sampleDuplicates: samples
          };
        }
        message = failedRecords === 0
          ? `Uniqueness verified for [${cols.join(', ')}] with 0 duplicates`
          : `Found ${failedRecords} duplicate rows for [${cols.join(', ')}]`;

      } else if (ruleType === 'REGEX_PATTERN' || ruleType === 'REGEX') {
        if (!targetCol) throw new ConnectorConfigurationError('REGEX_PATTERN requires targetColumn');
        const pattern = config.pattern;
        const regValidation = validateSafeRegex(pattern);
        if (!regValidation.valid) {
          throw new ConnectorConfigurationError(regValidation.error);
        }

        const [res] = await this.pool.query(
          `SELECT COUNT(CASE WHEN ${safeCol} IS NOT NULL AND NOT (${safeCol} REGEXP ?) THEN 1 END) AS failed_cnt FROM ${qualifiedTable};`,
          [pattern]
        );
        failedRecords = parseInt(res[0]?.failed_cnt, 10) || 0;

        if (failedRecords > 0) {
          const [samples] = await this.pool.query(
            `SELECT ${safeCol} AS failing_value FROM ${qualifiedTable} WHERE ${safeCol} IS NOT NULL AND NOT (${safeCol} REGEXP ?) LIMIT 5;`,
            [pattern]
          );
          evidenceSummary = {
            failingCount: failedRecords,
            pattern,
            sampleFailingValues: samples
          };
        }
        message = failedRecords === 0
          ? `Column "${targetCol}" matches regex pattern "${pattern}"`
          : `Column "${targetCol}" had ${failedRecords} values failing regex pattern "${pattern}"`;

      } else if (ruleType === 'VALUE_RANGE' || ruleType === 'RANGE') {
        if (!targetCol) throw new ConnectorConfigurationError('VALUE_RANGE requires targetColumn');
        const min = config.min;
        const max = config.max;
        if (min === undefined && max === undefined) {
          throw new ConnectorConfigurationError('VALUE_RANGE requires min or max');
        }

        let conditions = [];
        let params = [];
        if (min !== undefined) {
          params.push(min);
          conditions.push(`${safeCol} < ?`);
        }
        if (max !== undefined) {
          params.push(max);
          conditions.push(`${safeCol} > ?`);
        }

        const [res] = await this.pool.query(
          `SELECT COUNT(CASE WHEN ${safeCol} IS NOT NULL AND (${conditions.join(' OR ')}) THEN 1 END) AS failed_cnt FROM ${qualifiedTable};`,
          params
        );
        failedRecords = parseInt(res[0]?.failed_cnt, 10) || 0;

        if (failedRecords > 0) {
          const [samples] = await this.pool.query(
            `SELECT ${safeCol} AS failing_value FROM ${qualifiedTable} WHERE ${safeCol} IS NOT NULL AND (${conditions.join(' OR ')}) LIMIT 5;`,
            params
          );
          evidenceSummary = {
            failingCount: failedRecords,
            min,
            max,
            sampleFailingValues: samples
          };
        }
        message = failedRecords === 0
          ? `Column "${targetCol}" values within range [${min ?? '-∞'}, ${max ?? '+∞'}]`
          : `Column "${targetCol}" had ${failedRecords} values out of range [${min ?? '-∞'}, ${max ?? '+∞'}]`;

      } else if (ruleType === 'ALLOWED_VALUES' || ruleType === 'ENUM') {
        if (!targetCol) throw new ConnectorConfigurationError('ALLOWED_VALUES requires targetColumn');
        const allowedValues = config.allowedValues || config.values || [];
        if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
          throw new ConnectorConfigurationError('ALLOWED_VALUES requires an array of allowed values');
        }

        const [res] = await this.pool.query(
          `SELECT COUNT(CASE WHEN ${safeCol} IS NOT NULL AND ${safeCol} NOT IN (?) THEN 1 END) AS failed_cnt FROM ${qualifiedTable};`,
          [allowedValues]
        );
        failedRecords = parseInt(res[0]?.failed_cnt, 10) || 0;

        if (failedRecords > 0) {
          const [samples] = await this.pool.query(
            `SELECT ${safeCol} AS failing_value FROM ${qualifiedTable} WHERE ${safeCol} IS NOT NULL AND ${safeCol} NOT IN (?) LIMIT 5;`,
            [allowedValues]
          );
          evidenceSummary = {
            failingCount: failedRecords,
            allowedValues,
            sampleFailingValues: samples
          };
        }
        message = failedRecords === 0
          ? `Column "${targetCol}" values match allowed list`
          : `Column "${targetCol}" had ${failedRecords} values outside allowed list`;

      } else if (ruleType === 'FRESHNESS' || ruleType === 'TIMELINESS') {
        if (!targetCol) throw new ConnectorConfigurationError('FRESHNESS requires targetColumn');
        const maxHours = config.maxHours || 24;
        const [res] = await this.pool.query(`SELECT MAX(${safeCol}) AS latest_ts FROM ${qualifiedTable};`);
        const latestTs = res[0]?.latest_ts;
        if (!latestTs) {
          failedRecords = totalRecords;
          message = `Column "${targetCol}" contains no timestamp values for freshness SLA`;
        } else {
          const ageHours = Math.max(0, (Date.now() - new Date(latestTs).getTime()) / (1000 * 60 * 60));
          if (ageHours > maxHours) {
            failedRecords = totalRecords;
            evidenceSummary = {
              latestTimestamp: latestTs,
              ageHours: Math.round(ageHours),
              maxHours
            };
            message = `Data freshness SLA violated: latest record is ${Math.round(ageHours)}h old (target: ${maxHours}h)`;
          } else {
            failedRecords = 0;
            message = `Data is fresh: latest record within ${maxHours}h SLA`;
          }
        }

      } else if (ruleType === 'REFERENCE_INTEGRITY') {
        if (!targetCol) throw new ConnectorConfigurationError('REFERENCE_INTEGRITY requires targetColumn');
        const refTable = config.referenceTable;
        const refCol = config.referenceColumn;
        const refDb = config.referenceSchema || config.referenceDatabase || dbName;
        if (!refTable || !refCol) {
          throw new ConnectorConfigurationError('REFERENCE_INTEGRITY requires referenceTable and referenceColumn');
        }
        this._validateIdentifier(refTable, 'Reference table');
        this._validateIdentifier(refCol, 'Reference column');
        this._validateIdentifier(refDb, 'Reference database');

        const fullRefTable = `\`${refDb}\`.\`${refTable}\``;
        const safeRefCol = `\`${refCol}\``;

        const [res] = await this.pool.query(`
          SELECT COUNT(CASE WHEN ref.${safeRefCol} IS NULL AND src.${safeCol} IS NOT NULL THEN 1 END) AS failed_cnt
          FROM ${qualifiedTable} src
          LEFT JOIN ${fullRefTable} ref ON src.${safeCol} = ref.${safeRefCol};
        `);
        failedRecords = parseInt(res[0]?.failed_cnt, 10) || 0;

        if (failedRecords > 0) {
          const [samples] = await this.pool.query(`
            SELECT src.${safeCol} AS orphan_value
            FROM ${qualifiedTable} src
            LEFT JOIN ${fullRefTable} ref ON src.${safeCol} = ref.${safeRefCol}
            WHERE ref.${safeRefCol} IS NULL AND src.${safeCol} IS NOT NULL
            LIMIT 5;
          `);
          evidenceSummary = {
            failingCount: failedRecords,
            referenceTarget: `${refDb}.${refTable}.${refCol}`,
            sampleOrphanValues: samples
          };
        }
        message = failedRecords === 0
          ? `Reference integrity verified against ${refDb}.${refTable}.${refCol}`
          : `Found ${failedRecords} orphan records not matching ${refDb}.${refTable}.${refCol}`;

      } else if (ruleType === 'CUSTOM_SQL') {
        const query = config.query;
        const sqlValidation = validateCustomSql(query);
        if (!sqlValidation.valid) {
          throw new ConnectorConfigurationError(sqlValidation.error);
        }

        const [customRows] = await this.pool.query(query);
        if (customRows.length > 0 && customRows[0].failed_records !== undefined) {
          failedRecords = parseInt(customRows[0].failed_records, 10) || 0;
          if (customRows[0].total_records !== undefined) {
            totalRecords = parseInt(customRows[0].total_records, 10) || totalRecords;
          }
        } else if (customRows.length > 0 && customRows[0].failed_count !== undefined) {
          failedRecords = parseInt(customRows[0].failed_count, 10) || 0;
        } else {
          failedRecords = customRows.length;
        }

        if (failedRecords > 0) {
          evidenceSummary = {
            failingCount: failedRecords,
            sampleViolations: customRows.slice(0, 5)
          };
        }
        message = failedRecords === 0
          ? 'Custom SQL check passed with 0 violations'
          : `Custom SQL check identified ${failedRecords} violating records`;

      } else {
        throw new ConnectorConfigurationError(`Unsupported quality rule type: ${ruleType}`);
      }

      recordsPassed = Math.max(0, totalRecords - failedRecords);
      const passPercentage = totalRecords > 0 ? Math.round((recordsPassed / totalRecords) * 10000) / 100 : 100;
      const thresholdPct = rule.threshold !== undefined
        ? (rule.threshold <= 1 ? rule.threshold * 100 : rule.threshold)
        : (rule.parameters?.threshold || 95);
      passed = passPercentage >= thresholdPct && failedRecords === 0;

      const endHr = process.hrtime.bigint();
      const executionDurationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      return {
        ruleId: rule._id,
        ruleName: rule.name,
        ruleType,
        severity: rule.severity || 'MEDIUM',
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
   * Statistical column profiling using MySQL aggregation.
   */
  async profileDataset(dataset, options = {}) {
    if (!this.pool || !this.isConnected) {
      await this.connect();
    }

    const startHr = process.hrtime.bigint();
    const dbName = this.context.configuration.database;
    const tableName = dataset.tableName || dataset.name;
    this._validateIdentifier(dbName, 'Database');
    this._validateIdentifier(tableName, 'Table');

    const qualifiedTable = `\`${dbName}\`.\`${tableName}\``;

    try {
      // 1. Discover columns from information_schema if missing
      let columns = dataset.columns || [];
      if (!columns || columns.length === 0) {
        const [colsRes] = await this.pool.query(
          `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION ASC;`,
          [dbName, tableName]
        );
        columns = colsRes.map(r => ({ name: r.COLUMN_NAME, dataType: r.DATA_TYPE }));
      }

      // 2. Total row count
      const [countRows] = await this.pool.query(`SELECT COUNT(*) AS total_rows FROM ${qualifiedTable};`);
      const rowCount = parseInt(countRows[0]?.total_rows, 10) || 0;

      const columnProfiles = [];
      for (const col of columns.slice(0, 50)) {
        const colName = col.name;
        const dataType = String(col.dataType || '').toLowerCase();
        this._validateIdentifier(colName, 'Column');
        const safeCol = `\`${colName}\``;

        if (rowCount === 0) {
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
          const [statsRows] = await this.pool.query(`
            SELECT 
              (COUNT(*) - COUNT(${safeCol})) AS null_cnt,
              COUNT(DISTINCT ${safeCol}) AS distinct_cnt,
              MIN(CAST(${safeCol} AS CHAR)) AS min_val,
              MAX(CAST(${safeCol} AS CHAR)) AS max_val
            FROM ${qualifiedTable};
          `);
          const row = statsRows[0] || {};
          const nullCount = parseInt(row.null_cnt, 10) || 0;
          const distinctCount = parseInt(row.distinct_cnt, 10) || 0;
          const nullPercentage = Math.round((nullCount / rowCount) * 10000) / 100;
          const completenessPercentage = Math.round(((rowCount - nullCount) / rowCount) * 10000) / 100;
          const cardinality = Math.round((distinctCount / rowCount) * 10000) / 10000;

          let meanValue = null;
          let stdDevValue = null;
          const isNumeric = ['int', 'decimal', 'numeric', 'float', 'double', 'real', 'bigint'].some(t => dataType.includes(t));
          if (isNumeric && (rowCount - nullCount) > 0) {
            try {
              const [numRows] = await this.pool.query(`
                SELECT 
                  AVG(${safeCol}) AS mean_val,
                  STDDEV(${safeCol}) AS std_dev
                FROM ${qualifiedTable}
                WHERE ${safeCol} IS NOT NULL;
              `);
              const nRow = numRows[0] || {};
              meanValue = nRow.mean_val !== null ? Math.round(Number(nRow.mean_val) * 100) / 100 : null;
              stdDevValue = nRow.std_dev !== null ? Math.round(Number(nRow.std_dev) * 100) / 100 : null;
            } catch {}
          }

          // Top 5 histogram
          let histogram = [];
          try {
            const [histRows] = await this.pool.query(`
              SELECT CAST(${safeCol} AS CHAR) AS bucket_val, COUNT(*) AS bucket_cnt
              FROM ${qualifiedTable}
              WHERE ${safeCol} IS NOT NULL
              GROUP BY ${safeCol}
              ORDER BY bucket_cnt DESC
              LIMIT 5;
            `);
            histogram = histRows.map(hr => ({
              bucket: hr.bucket_val ?? 'null',
              count: parseInt(hr.bucket_cnt, 10),
              percentage: Math.round((parseInt(hr.bucket_cnt, 10) / rowCount) * 10000) / 100
            }));
          } catch {}

          columnProfiles.push({
            columnName: colName,
            name: colName,
            dataType,
            rowCount,
            totalCount: rowCount,
            nullCount,
            nullPercentage,
            completenessPercentage,
            distinctCount,
            cardinality,
            minValue: row.min_val ?? null,
            maxValue: row.max_val ?? null,
            meanValue,
            medianValue: null,
            stdDevValue,
            histogram,
            profiledAt: new Date().toISOString()
          });
        } catch {
          // Skip columns that cannot be profiled
        }
      }

      const endHr = process.hrtime.bigint();
      const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      return {
        datasetName: tableName,
        datasetId: dataset._id,
        schema: dbName,
        rowCount,
        columnCount: columnProfiles.length,
        columns: columnProfiles,
        columnProfiles, // backwards compat
        profiledAt: new Date().toISOString(),
        durationMs
      };
    } catch (err) {
      throw this._mapError(err);
    }
  }

  async disconnect() {
    this.isConnected = false;
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (err) {
        this.context.logger.warn('Error closing MySQL pool', { error: err.message });
      } finally {
        this.pool = null;
      }
    }
  }

  _validateIdentifier(id, type = 'Identifier') {
    if (!id || typeof id !== 'string') {
      throw new ConnectorConfigurationError(`${type} name must be a non-empty string`);
    }
    if (!/^[a-zA-Z0-9_$]+$/.test(id)) {
      throw new ConnectorConfigurationError(`Unsafe or invalid ${type.toLowerCase()} identifier "${id}"`);
    }
  }

  _mapError(err) {
    if (!err) return new ConnectorQueryError('Unknown MySQL error');
    if (err instanceof ConnectorConfigurationError || err instanceof ConnectorTimeoutError) return err;

    const code = err.code;
    const msg = err.message || '';

    if (code === 'ER_ACCESS_DENIED_ERROR' || msg.includes('Access denied for user')) {
      return new ConnectorAuthenticationError('MySQL authentication failed. Invalid username or password.');
    }
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return new ConnectorUnavailableError(`Unable to connect to MySQL host at ${this.context.configuration.host}:${this.context.configuration.port || 3306}. Connection refused (${code || 'unreachable'}).`);
    }
    if (code === 'ETIMEDOUT' || msg.includes('timeout')) {
      return new ConnectorTimeoutError('MySQL connection timed out.');
    }
    if (code === 'ER_BAD_DB_ERROR') {
      return new ConnectorConfigurationError(`MySQL database "${this.context.configuration.database}" does not exist.`);
    }

    return new ConnectorQueryError(msg.length > 200 ? `${msg.substring(0, 197)}...` : msg, { mysqlCode: code });
  }
}

export default MySQLConnector;
