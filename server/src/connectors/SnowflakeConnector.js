import snowflake from 'snowflake-sdk';
import { BaseConnector } from './BaseConnector.js';
import {
  ConnectorConfigurationError,
  ConnectorAuthenticationError,
  ConnectorTimeoutError,
  ConnectorUnavailableError,
  ConnectorQueryError
} from './errors.js';
import { validateCustomSql, validateSafeRegex } from '../utils/securityValidators.js';

/**
 * Enterprise Snowflake Connector for RicozData Data Cloud Governance.
 * Supports metadata discovery with column schemas, bounded sampling,
 * read-only queries, quality rules, and warehouse-side profiling.
 */
export class SnowflakeConnector extends BaseConnector {
  constructor(context) {
    super(context);
    this.connection = null;
    this.schema = this.context.configuration.schema || 'PUBLIC';
  }

  get capabilities() {
    return {
      supportsMetadataDiscovery: true,
      supportsSampling: true,
      supportsSchemaDiscovery: true,
      supportsColumnMetadata: true,
      supportsRelationships: false,
      supportsStreaming: false,
      supportsQualityRules: true,
      supportsProfiling: true,
      supportsReadOnlyQueries: true
    };
  }

  async connect() {
    if (this.connection && this.isConnected) return;

    const config = this.context.configuration;
    const creds = this.context.getCredentials();

    if (!config.account) throw new ConnectorConfigurationError('Snowflake account is required');
    if (!config.database) throw new ConnectorConfigurationError('Snowflake database is required');

    const username = config.username || creds.username || '';
    const password = creds.password || '';

    try {
      this.connection = snowflake.createConnection({
        account: config.account,
        username,
        password: String(password),
        database: config.database,
        schema: config.schema || 'PUBLIC',
        warehouse: config.warehouse,
        role: config.role,
        timeout: this.context.timeouts.connect || 10000
      });

      await this.withTimeout(
        new Promise((resolve, reject) => {
          this.connection.connect((err, conn) => {
            if (err) return reject(this._mapError(err));
            this.isConnected = true;
            resolve(conn);
          });
        }),
        this.context.timeouts.connect || 10000,
        'Snowflake connection'
      );
    } catch (err) {
      this.isConnected = false;
      throw this._mapError(err);
    }
  }

  async test() {
    return await this.withTimeout(
      (async () => {
        if (!this.connection || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        return await new Promise((resolve, reject) => {
          this.connection.execute({
            sqlText: 'SELECT 1 AS ALIVE, CURRENT_VERSION() AS VERSION, CURRENT_DATABASE() AS DB',
            complete: (err, stmt, rows) => {
              if (err) return reject(this._mapError(err));
              const endHr = process.hrtime.bigint();
              const latencyMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

              const row = rows[0] || {};
              resolve({
                success: true,
                connectorType: 'snowflake',
                status: 'HEALTHY',
                latencyMs,
                checkedAt: new Date().toISOString(),
                details: {
                  database: row.DB || this.context.configuration.database,
                  serverVersion: row.VERSION || 'Snowflake',
                  warehouse: this.context.configuration.warehouse || null
                }
              });
            }
          });
        });
      })(),
      this.context.timeouts.connect || 10000,
      'Snowflake test connection'
    );
  }

  async fetchMetadata(options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.connection || !this.isConnected) {
          await this.connect();
        }

        const targetSchema = options.schema || this.schema || 'PUBLIC';
        const targetDb = this.context.configuration.database;

        // 1. Fetch tables
        const tablesRows = await new Promise((resolve, reject) => {
          const sql = `
            SELECT TABLE_NAME, TABLE_TYPE 
            FROM "${targetDb}".INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = :1
            ORDER BY TABLE_NAME ASC
          `;

          this.connection.execute({
            sqlText: sql,
            binds: [targetSchema],
            complete: (err, stmt, rows) => {
              if (err) return reject(this._mapError(err));
              resolve(rows || []);
            }
          });
        });

        // 2. Fetch columns
        const colsRows = await new Promise((resolve, reject) => {
          const sql = `
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION, COLUMN_DEFAULT
            FROM "${targetDb}".INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = :1
            ORDER BY TABLE_NAME, ORDINAL_POSITION ASC
          `;

          this.connection.execute({
            sqlText: sql,
            binds: [targetSchema],
            complete: (err, stmt, rows) => {
              if (err) return reject(this._mapError(err));
              resolve(rows || []);
            }
          });
        });

        const tablesMap = new Map();
        for (const row of tablesRows) {
          tablesMap.set(row.TABLE_NAME, {
            externalId: `${targetSchema}.${row.TABLE_NAME}`,
            name: row.TABLE_NAME,
            schema: targetSchema,
            type: row.TABLE_TYPE === 'VIEW' ? 'view' : 'table',
            columns: [],
            primaryKey: [],
            foreignKeys: [],
            indexes: []
          });
        }

        for (const col of colsRows) {
          const table = tablesMap.get(col.TABLE_NAME);
          if (table) {
            table.columns.push({
              name: col.COLUMN_NAME,
              dataType: col.DATA_TYPE,
              nullable: col.IS_NULLABLE === 'YES',
              ordinalPosition: col.ORDINAL_POSITION,
              defaultValue: col.COLUMN_DEFAULT,
              isPrimaryKey: false,
              isForeignKey: false,
              description: ''
            });
          }
        }

        return {
          sourceType: 'snowflake',
          database: targetDb,
          schema: targetSchema,
          schemas: [targetSchema],
          tables: Array.from(tablesMap.values())
        };
      })(),
      this.context.timeouts.metadata || 45000,
      'Snowflake metadata discovery'
    );
  }

  async sampleData(params = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.connection || !this.isConnected) {
          await this.connect();
        }

        const tableName = params.tableName;
        const schema = params.schema || this.schema || 'PUBLIC';
        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 100);

        return await new Promise((resolve, reject) => {
          const sql = `SELECT * FROM "${this.context.configuration.database}"."${schema}"."${tableName}" LIMIT ${limit}`;
          this.connection.execute({
            sqlText: sql,
            complete: (err, stmt, rows) => {
              if (err) return reject(this._mapError(err));
              const columns = stmt.getColumns().map((col) => col.getName());
              resolve({
                datasetName: tableName,
                schema,
                rowCount: rows.length,
                columns,
                rows: rows || [],
                sampledAt: new Date().toISOString(),
                truncated: rows.length === limit
              });
            }
          });
        });
      })(),
      this.context.timeouts.sample || 15000,
      'Snowflake data sampling'
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
        if (!this.connection || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        return await new Promise((resolve, reject) => {
          let finalSql = sqlQuery.trim();
          if (!/LIMIT\s+\d+/i.test(finalSql)) {
            finalSql = `SELECT * FROM (${finalSql.replace(/;$/, '')}) LIMIT ${maxRows};`;
          }

          this.connection.execute({
            sqlText: finalSql,
            complete: (err, stmt, rows) => {
              if (err) return reject(this._mapError(err));
              const endHr = process.hrtime.bigint();
              const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;
              const fields = stmt.getColumns().map(c => c.getName());

              resolve({
                rowCount: (rows || []).length,
                fields,
                rows: rows || [],
                durationMs,
                truncated: (rows || []).length === maxRows
              });
            }
          });
        });
      })(),
      timeoutMs,
      'Snowflake query execution'
    );
  }

  async _executeSql(sqlText, binds = []) {
    return await new Promise((resolve, reject) => {
      this.connection.execute({
        sqlText,
        binds,
        complete: (err, stmt, rows) => {
          if (err) return reject(this._mapError(err));
          resolve(rows || []);
        }
      });
    });
  }

  _validateIdentifier(id, type = 'Identifier') {
    if (!id || typeof id !== 'string') {
      throw new ConnectorConfigurationError(`${type} name must be a non-empty string`);
    }
    if (!/^[a-zA-Z0-9_$]+$/.test(id)) {
      throw new ConnectorConfigurationError(`Unsafe or invalid ${type.toLowerCase()} identifier "${id}"`);
    }
  }

  /**
   * Evaluates quality rule against a target dataset using Snowflake SQL pushdown.
   */
  async executeQualityRule(rule, dataset, options = {}) {
    if (!this.connection || !this.isConnected) {
      await this.connect();
    }

    const database = this.context.configuration.database;
    const schema = dataset.schemaName || this.schema || 'PUBLIC';
    const tableName = dataset.tableName || dataset.name;
    this._validateIdentifier(database, 'Database');
    this._validateIdentifier(schema, 'Schema');
    this._validateIdentifier(tableName, 'Table');

    const qualifiedTable = `"${database}"."${schema}"."${tableName}"`;
    const ruleType = String(rule.ruleType || '').toUpperCase().trim();
    const config = rule.configuration || rule.parameters || {};
    const targetCol = rule.targetColumn || config.column;
    if (targetCol) this._validateIdentifier(targetCol, 'Column');

    const startHr = process.hrtime.bigint();

    try {
      const countRows = await this._executeSql(`SELECT COUNT(*) AS TOTAL FROM ${qualifiedTable};`);
      const totalRecords = parseInt(countRows[0]?.TOTAL ?? countRows[0]?.total ?? 0, 10);

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
            ? `"${targetCol}" IS NULL`
            : `("${targetCol}" IS NULL OR "${targetCol}"::STRING = '')`;

          const checkRows = await this._executeSql(`
            SELECT COUNT(IFF(${condition}, 1, NULL)) AS FAILED_CNT
            FROM ${qualifiedTable};
          `);
          failedRecords = parseInt(checkRows[0]?.FAILED_CNT ?? checkRows[0]?.failed_cnt ?? 0, 10);

          if (failedRecords > 0) {
            const sampleRows = await this._executeSql(`
              SELECT "${targetCol}"::STRING AS FAILING_VALUE
              FROM ${qualifiedTable}
              WHERE ${condition}
              LIMIT 5;
            `);
            evidenceSummary = {
              failingCount: failedRecords,
              sampleFailingValues: sampleRows
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
          const quotedCols = cols.map(c => `"${c}"`);

          if (cols.length === 1) {
            const checkRows = await this._executeSql(`
              SELECT (COUNT(*) - COUNT(DISTINCT ${quotedCols[0]})) AS DUP_CNT
              FROM ${qualifiedTable};
            `);
            failedRecords = parseInt(checkRows[0]?.DUP_CNT ?? checkRows[0]?.dup_cnt ?? 0, 10);
          } else {
            const checkRows = await this._executeSql(`
              SELECT COALESCE(SUM(DUP_COUNT - 1), 0) AS DUP_CNT
              FROM (
                SELECT ${quotedCols.join(', ')}, COUNT(*) AS DUP_COUNT
                FROM ${qualifiedTable}
                GROUP BY ${quotedCols.join(', ')}
                HAVING COUNT(*) > 1
              );
            `);
            failedRecords = parseInt(checkRows[0]?.DUP_CNT ?? checkRows[0]?.dup_cnt ?? 0, 10);
          }

          if (failedRecords > 0) {
            const sampleRows = await this._executeSql(`
              SELECT ${quotedCols.join(', ')}, COUNT(*) AS OCCURRENCES
              FROM ${qualifiedTable}
              GROUP BY ${quotedCols.join(', ')}
              HAVING COUNT(*) > 1
              LIMIT 5;
            `);
            evidenceSummary = {
              duplicateCount: failedRecords,
              sampleDuplicates: sampleRows
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

          const checkRows = await this._executeSql(`
            SELECT COUNT(IFF("${targetCol}" IS NOT NULL AND NOT REGEXP_LIKE("${targetCol}"::STRING, :1), 1, NULL)) AS FAILED_CNT
            FROM ${qualifiedTable};
          `, [pattern]);
          failedRecords = parseInt(checkRows[0]?.FAILED_CNT ?? checkRows[0]?.failed_cnt ?? 0, 10);

          if (failedRecords > 0) {
            const sampleRows = await this._executeSql(`
              SELECT "${targetCol}"::STRING AS FAILING_VALUE
              FROM ${qualifiedTable}
              WHERE "${targetCol}" IS NOT NULL AND NOT REGEXP_LIKE("${targetCol}"::STRING, :1)
              LIMIT 5;
            `, [pattern]);
            evidenceSummary = {
              failingCount: failedRecords,
              pattern,
              sampleFailingValues: sampleRows
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
          if (min !== undefined) conditions.push(`"${targetCol}" < ${Number(min)}`);
          if (max !== undefined) conditions.push(`"${targetCol}" > ${Number(max)}`);
          const rangeClause = conditions.join(' OR ');

          const checkRows = await this._executeSql(`
            SELECT COUNT(IFF("${targetCol}" IS NOT NULL AND (${rangeClause}), 1, NULL)) AS FAILED_CNT
            FROM ${qualifiedTable};
          `);
          failedRecords = parseInt(checkRows[0]?.FAILED_CNT ?? checkRows[0]?.failed_cnt ?? 0, 10);

          if (failedRecords > 0) {
            const sampleRows = await this._executeSql(`
              SELECT "${targetCol}"::STRING AS FAILING_VALUE
              FROM ${qualifiedTable}
              WHERE "${targetCol}" IS NOT NULL AND (${rangeClause})
              LIMIT 5;
            `);
            evidenceSummary = {
              failingCount: failedRecords,
              range: { min, max },
              sampleFailingValues: sampleRows
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
          const checkRows = await this._executeSql(`
            SELECT COUNT(IFF("${targetCol}" IS NOT NULL AND "${targetCol}"::STRING NOT IN (${escapedValues}), 1, NULL)) AS FAILED_CNT
            FROM ${qualifiedTable};
          `);
          failedRecords = parseInt(checkRows[0]?.FAILED_CNT ?? checkRows[0]?.failed_cnt ?? 0, 10);

          if (failedRecords > 0) {
            const sampleRows = await this._executeSql(`
              SELECT "${targetCol}"::STRING AS FAILING_VALUE
              FROM ${qualifiedTable}
              WHERE "${targetCol}" IS NOT NULL AND "${targetCol}"::STRING NOT IN (${escapedValues})
              LIMIT 5;
            `);
            evidenceSummary = {
              failingCount: failedRecords,
              allowedValues: allowed,
              sampleFailingValues: sampleRows
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

          const checkRows = await this._executeSql(`
            SELECT 
              MAX("${targetCol}")::STRING AS LATEST_TIMESTAMP,
              DATEDIFF('day', MAX("${targetCol}"), CURRENT_TIMESTAMP()) AS AGE_DAYS
            FROM ${qualifiedTable};
          `);
          const row = checkRows[0] || {};
          const ageDays = parseInt(row.AGE_DAYS ?? row.age_days ?? 0, 10);
          const latestTs = row.LATEST_TIMESTAMP ?? row.latest_timestamp;

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
   * Statistical column profiling using Snowflake warehouse pushdown queries.
   */
  async profileDataset(dataset, options = {}) {
    if (!this.connection || !this.isConnected) {
      await this.connect();
    }

    const startHr = process.hrtime.bigint();
    const database = this.context.configuration.database;
    const schema = dataset.schemaName || this.schema || 'PUBLIC';
    const tableName = dataset.tableName || dataset.name;
    this._validateIdentifier(database, 'Database');
    this._validateIdentifier(schema, 'Schema');
    this._validateIdentifier(tableName, 'Table');

    const qualifiedTable = `"${database}"."${schema}"."${tableName}"`;

    try {
      // Discover columns if not passed
      let columns = dataset.columns || [];
      if (!columns || columns.length === 0) {
        const colsRows = await this._executeSql(`
          SELECT COLUMN_NAME AS COLUMN_NAME, DATA_TYPE AS DATA_TYPE
          FROM "${database}".INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = :1 AND TABLE_NAME = :2
          ORDER BY ORDINAL_POSITION ASC;
        `, [schema, tableName]);
        columns = colsRows.map(r => ({
          name: r.COLUMN_NAME ?? r.column_name,
          dataType: r.DATA_TYPE ?? r.data_type
        }));
      }

      const countRows = await this._executeSql(`SELECT COUNT(*) AS TOTAL_ROWS FROM ${qualifiedTable};`);
      const totalRows = parseInt(countRows[0]?.TOTAL_ROWS ?? countRows[0]?.total_rows ?? 0, 10);

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
          const statsRows = await this._executeSql(`
            SELECT 
              (COUNT(*) - COUNT("${colName}")) AS NULL_CNT,
              COUNT(DISTINCT "${colName}") AS DISTINCT_CNT,
              MIN("${colName}"::STRING) AS MIN_VAL,
              MAX("${colName}"::STRING) AS MAX_VAL
            FROM ${qualifiedTable};
          `);
          const row = statsRows[0] || {};
          const nullCount = parseInt(row.NULL_CNT ?? row.null_cnt ?? 0, 10);
          const distinctCount = parseInt(row.DISTINCT_CNT ?? row.distinct_cnt ?? 0, 10);
          const nullPercentage = Math.round((nullCount / totalRows) * 10000) / 100;
          const completenessPercentage = Math.round(((totalRows - nullCount) / totalRows) * 10000) / 100;
          const cardinality = Math.round((distinctCount / totalRows) * 10000) / 10000;

          let meanValue = null;
          let medianValue = null;
          let stdDevValue = null;
          const isNumeric = ['number', 'decimal', 'numeric', 'int', 'integer', 'float', 'real', 'double'].some(t => dataType.includes(t));

          if (isNumeric && (totalRows - nullCount) > 0) {
            try {
              const numRows = await this._executeSql(`
                SELECT 
                  AVG("${colName}")::FLOAT AS MEAN_VAL,
                  MEDIAN("${colName}")::FLOAT AS MEDIAN_VAL,
                  STDDEV("${colName}")::FLOAT AS STD_DEV
                FROM ${qualifiedTable}
                WHERE "${colName}" IS NOT NULL;
              `);
              const numRow = numRows[0] || {};
              meanValue = numRow.MEAN_VAL !== null && numRow.MEAN_VAL !== undefined ? Math.round(Number(numRow.MEAN_VAL) * 100) / 100 : null;
              medianValue = numRow.MEDIAN_VAL !== null && numRow.MEDIAN_VAL !== undefined ? Math.round(Number(numRow.MEDIAN_VAL) * 100) / 100 : null;
              stdDevValue = numRow.STD_DEV !== null && numRow.STD_DEV !== undefined ? Math.round(Number(numRow.STD_DEV) * 100) / 100 : null;
            } catch {}
          }

          let histogram = [];
          try {
            const histRows = await this._executeSql(`
              SELECT "${colName}"::STRING AS BUCKET_VAL, COUNT(*) AS BUCKET_CNT
              FROM ${qualifiedTable}
              WHERE "${colName}" IS NOT NULL
              GROUP BY "${colName}"::STRING
              ORDER BY BUCKET_CNT DESC
              LIMIT 5;
            `);
            histogram = histRows.map(r => {
              const cnt = parseInt(r.BUCKET_CNT ?? r.bucket_cnt ?? 0, 10);
              return {
                bucket: r.BUCKET_VAL ?? r.bucket_val ?? 'null',
                count: cnt,
                percentage: Math.round((cnt / totalRows) * 10000) / 100
              };
            });
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
            minValue: row.MIN_VAL ?? row.min_val ?? null,
            maxValue: row.MAX_VAL ?? row.max_val ?? null,
            meanValue,
            medianValue,
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

  async disconnect() {
    this.isConnected = false;
    if (this.connection) {
      try {
        await new Promise((resolve) => {
          this.connection.destroy((err) => resolve());
        });
      } catch (err) {
        this.context.logger.warn('Error closing Snowflake connection', { error: err.message });
      } finally {
        this.connection = null;
      }
    }
  }

  _mapError(err) {
    if (!err) return new ConnectorQueryError('Unknown Snowflake error');
    if (err instanceof ConnectorConfigurationError || err instanceof ConnectorTimeoutError) return err;

    const msg = err.message || '';
    if (msg.includes('Incorrect username or password') || err.code === '407001') {
      return new ConnectorAuthenticationError('Snowflake authentication failed. Invalid username or password.');
    }
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      return new ConnectorUnavailableError(`Unable to connect to Snowflake account "${this.context.configuration.account}".`);
    }
    if (msg.includes('timeout')) {
      return new ConnectorTimeoutError('Snowflake connection timed out.');
    }

    return new ConnectorQueryError(msg.length > 200 ? `${msg.substring(0, 197)}...` : msg);
  }
}

export default SnowflakeConnector;
