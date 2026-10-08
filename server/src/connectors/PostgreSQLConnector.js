import pg from 'pg';
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

const { Pool } = pg;

// Internal system schemas to exclude from discovery
const SYSTEM_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1'];

/**
 * Enterprise PostgreSQL Connector for RicozData.
 * Implements real connection pooling, SSL policies, system catalog introspection,
 * parameterized queries, and bounded sampling with SQL injection protection.
 */
export class PostgreSQLConnector extends BaseConnector {
  constructor(context) {
    super(context);
    this.pool = null;
    this.schema = this.context.configuration.schema || 'public';
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
   * Initializes a scoped connection pool.
   */
  async connect() {
    if (this.pool && this.isConnected) {
      return;
    }

    const config = this.context.configuration;
    const credentials = this.context.getCredentials();

    if (!config.host) {
      throw new ConnectorConfigurationError('PostgreSQL host is required in configuration');
    }
    if (!config.database) {
      throw new ConnectorConfigurationError('PostgreSQL database name is required in configuration');
    }

    const username = credentials.username || config.username || config.user || '';
    const rawPassword = credentials.password !== undefined ? credentials.password : config.password;

    if (rawPassword === undefined || rawPassword === null || (typeof rawPassword === 'string' && rawPassword === '')) {
      throw new ConnectorAuthenticationError('PostgreSQL connection requires a password. Please configure valid credentials.');
    }

    let passwordString;
    if (typeof rawPassword === 'string') {
      passwordString = rawPassword;
    } else if (typeof rawPassword === 'number' || typeof rawPassword === 'boolean') {
      passwordString = String(rawPassword);
    } else if (typeof rawPassword === 'object' && rawPassword !== null && typeof rawPassword.password === 'string') {
      passwordString = rawPassword.password;
    } else {
      throw new ConnectorAuthenticationError('Invalid password format. Password must be a valid string.');
    }

    // SSL Configuration Policy
    let ssl = false;
    if (config.ssl === true || config.ssl === 'true' || config.ssl === 'require') {
      ssl = {
        rejectUnauthorized: config.sslRejectUnauthorized !== false // Fail secure by default
      };
      if (credentials.caCert) {
        ssl.ca = credentials.caCert;
      }
    }

    const maxPoolSize = Math.min(Math.max(parseInt(config.poolSize, 10) || 5, 1), 20);

    const poolConfig = {
      host: config.host,
      port: parseInt(config.port, 10) || 5432,
      database: config.database,
      user: username,
      password: passwordString,
      ssl,
      max: maxPoolSize,
      min: 0,
      connectionTimeoutMillis: this.context.timeouts.connect || 10000,
      idleTimeoutMillis: 10000,
      statement_timeout: this.context.timeouts.query || 15000
    };

    try {
      this.pool = new Pool(poolConfig);
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      throw this._mapError(err);
    }
  }

  /**
   * Executes a lightweight diagnostic query (SELECT 1).
   */
  async test() {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        let client;
        try {
          client = await this.pool.connect();
          const res = await client.query('SELECT 1 AS alive, version() AS server_version, current_database() AS current_db');
          const endHr = process.hrtime.bigint();
          const latencyMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          const row = res.rows[0] || {};
          return {
            success: true,
            connectorType: 'postgresql',
            status: 'HEALTHY',
            latencyMs,
            checkedAt: new Date().toISOString(),
            details: {
              database: row.current_db || this.context.configuration.database,
              serverVersion: (row.server_version || '').split(' ')[0] + ' ' + ((row.server_version || '').split(' ')[1] || ''),
              schema: this.schema
            }
          };
        } catch (err) {
          throw this._mapError(err);
        } finally {
          if (client) {
            client.release();
          }
        }
      })(),
      this.context.timeouts.connect || 10000,
      'PostgreSQL test connection'
    );
  }

  /**
   * Introspect PostgreSQL catalogs for schemas, tables, views, columns, keys, and indexes.
   */
  async fetchMetadata(options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const targetSchema = options.schema || this.schema || 'public';
        this._validateIdentifier(targetSchema, 'Schema');

        let client;
        try {
          client = await this.pool.connect();

          // 1. Discover tables and views
          const tablesQuery = `
            SELECT 
              table_schema, 
              table_name, 
              table_type
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_schema NOT IN (${SYSTEM_SCHEMAS.map((_, i) => `$${i + 2}`).join(',')})
            ORDER BY table_name ASC
          `;
          const tablesRes = await client.query(tablesQuery, [targetSchema, ...SYSTEM_SCHEMAS]);

          // 2. Discover columns
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
            ORDER BY table_name, ordinal_position ASC
          `;
          const columnsRes = await client.query(columnsQuery, [targetSchema]);

          // 3. Discover primary keys
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
            ORDER BY kcu.ordinal_position ASC
          `;
          const pkRes = await client.query(pkQuery, [targetSchema]);

          // 4. Discover foreign keys
          const fkQuery = `
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
          `;
          const fkRes = await client.query(fkQuery, [targetSchema]);

          // 5. Discover indexes
          const indexQuery = `
            SELECT
              tablename,
              indexname,
              indexdef
            FROM pg_indexes
            WHERE schemaname = $1
          `;
          const indexRes = await client.query(indexQuery, [targetSchema]);

          // Assemble normalized metadata
          const tablesMap = new Map();

          for (const row of tablesRes.rows) {
            const externalId = `${targetSchema}.${row.table_name}`;
            tablesMap.set(row.table_name, {
              externalId,
              name: row.table_name,
              schema: targetSchema,
              type: row.table_type === 'VIEW' ? 'view' : 'table',
              columns: [],
              primaryKey: [],
              foreignKeys: [],
              indexes: []
            });
          }

          // Attach columns
          for (const col of columnsRes.rows) {
            const table = tablesMap.get(col.table_name);
            if (table) {
              table.columns.push({
                name: col.column_name,
                dataType: col.data_type,
                nullable: col.is_nullable === 'YES',
                ordinalPosition: col.ordinal_position,
                defaultValue: col.column_default,
                isPrimaryKey: false,
                isForeignKey: false,
                description: ''
              });
            }
          }

          // Attach primary keys
          for (const pk of pkRes.rows) {
            const table = tablesMap.get(pk.table_name);
            if (table) {
              table.primaryKey.push(pk.column_name);
              const col = table.columns.find((c) => c.name === pk.column_name);
              if (col) {
                col.isPrimaryKey = true;
              }
            }
          }

          // Attach foreign keys
          for (const fk of fkRes.rows) {
            const table = tablesMap.get(fk.table_name);
            if (table) {
              table.foreignKeys.push({
                name: fk.constraint_name,
                column: fk.column_name,
                referencedSchema: fk.foreign_table_schema,
                referencedTable: fk.foreign_table_name,
                referencedColumn: fk.foreign_column_name
              });
              const col = table.columns.find((c) => c.name === fk.column_name);
              if (col) {
                col.isForeignKey = true;
              }
            }
          }

          // Attach indexes
          for (const idx of indexRes.rows) {
            const table = tablesMap.get(idx.tablename);
            if (table) {
              const isUnique = idx.indexdef.toUpperCase().includes('UNIQUE');
              table.indexes.push({
                name: idx.indexname,
                unique: isUnique,
                definition: idx.indexdef
              });
            }
          }

          // Attach real table row counts
          for (const table of tablesMap.values()) {
            if (table.type === 'table') {
              try {
                this._validateIdentifier(table.name, 'Table');
                const countRes = await client.query(`SELECT COUNT(*)::bigint AS count FROM "${targetSchema}"."${table.name}"`);
                table.rowCount = parseInt(countRes.rows[0]?.count || 0, 10);
              } catch {
                table.rowCount = 0;
              }
            } else {
              table.rowCount = 0;
            }
          }

          return {
            sourceType: 'postgresql',
            database: this.context.configuration.database,
            schema: targetSchema,
            schemas: [targetSchema],
            tables: Array.from(tablesMap.values())
          };
        } catch (err) {
          throw this._mapError(err);
        } finally {
          if (client) {
            client.release();
          }
        }
      })(),
      this.context.timeouts.metadata || 30000,
      'PostgreSQL metadata discovery'
    );
  }

  /**
   * Bounded sample data from a specific table.
   * Parameterized and enforced against SQL injection.
   */
  async sampleData(params = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const tableName = params.tableName || params.table;
        const schema = params.schema || this.schema || 'public';
        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 100);

        this._validateIdentifier(schema, 'Schema');
        this._validateIdentifier(tableName, 'Table');

        const safeSchema = this._quoteIdentifier(schema);
        const safeTable = this._quoteIdentifier(tableName);

        let client;
        try {
          client = await this.pool.connect();
          // Strictly parameterized bounded SELECT with statement timeout
          const query = `SELECT * FROM ${safeSchema}.${safeTable} LIMIT $1`;
          const res = await client.query(query, [limit]);

          const columns = res.fields ? res.fields.map((f) => f.name) : [];

          return {
            datasetName: tableName,
            schema,
            rowCount: res.rowCount,
            columns,
            rows: res.rows || [],
            sampledAt: new Date().toISOString(),
            truncated: res.rowCount === limit
          };
        } catch (err) {
          throw this._mapError(err);
        } finally {
          if (client) {
            client.release();
          }
        }
      })(),
      this.context.timeouts.sample || 15000,
      'PostgreSQL data sampling'
    );
  }

  /**
   * Execute a read-only query under strict database-level constraints.
   */
  async executeQueryReadOnly(sqlQuery, params = [], options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const validation = validateCustomSql(sqlQuery);
        if (!validation.valid) {
          throw new ConnectorConfigurationError(validation.error);
        }

        const maxRows = Math.min(Math.max(parseInt(options.maxRows, 10) || 100, 1), 500);
        const timeoutMs = Math.min(Math.max(parseInt(options.timeoutMs, 10) || 10000, 1000), 30000);

        let client;
        try {
          client = await this.pool.connect();
          await client.query('BEGIN READ ONLY');
          await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
          const res = await client.query(sqlQuery, params);
          await client.query('COMMIT');

          return {
            rowCount: res.rowCount,
            rows: (res.rows || []).slice(0, maxRows),
            fields: res.fields ? res.fields.map(f => f.name) : [],
            truncated: res.rowCount > maxRows
          };
        } catch (err) {
          if (client) {
            await client.query('ROLLBACK').catch(() => {});
          }
          throw this._mapError(err);
        } finally {
          if (client) {
            client.release();
          }
        }
      })(),
      options.timeoutMs || 15000,
      'PostgreSQL read-only query execution'
    );
  }

  /**
   * Evaluates a single quality rule against target table using database-side aggregations.
   */
  async executeQualityRule(rule, dataset, options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        const tableName = dataset.name || dataset.externalId?.split('.').pop() || dataset.tableName;
        const schema = dataset.schemaName || this.schema || 'public';

        this._validateIdentifier(schema, 'Schema');
        this._validateIdentifier(tableName, 'Table');

        const safeSchema = this._quoteIdentifier(schema);
        const safeTable = this._quoteIdentifier(tableName);
        const fullTableName = `${safeSchema}.${safeTable}`;

        const ruleType = String(rule.ruleType || '').toUpperCase().trim();
        const config = rule.configuration || {};
        const targetCol = rule.targetColumn || config.column;

        let totalRecords;
        let failedRecords;
        let passed;
        let evidenceSummary = null;
        let message;

        let client;
        try {
          client = await this.pool.connect();
          await client.query('BEGIN READ ONLY');
          await client.query('SET LOCAL statement_timeout = 10000');

          // Get total row count
          const countRes = await client.query(`SELECT COUNT(*) AS total FROM ${fullTableName}`);
          totalRecords = parseInt(countRes.rows[0]?.total || 0, 10);

          if (totalRecords === 0) {
            await client.query('COMMIT');
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

          if (ruleType === 'NULL_CHECK') {
            if (!targetCol) throw new ConnectorConfigurationError('NULL_CHECK rule requires targetColumn');
            this._validateIdentifier(targetCol, 'Column');
            const safeCol = this._quoteIdentifier(targetCol);
            const allowEmpty = config.allowEmptyString === true;

            const checkQuery = `
              SELECT 
                COUNT(CASE WHEN ${safeCol} IS NULL ${allowEmpty ? '' : `OR ${safeCol}::text = ''`} THEN 1 END) AS failed_cnt
              FROM ${fullTableName}
            `;
            const checkRes = await client.query(checkQuery);
            failedRecords = parseInt(checkRes.rows[0]?.failed_cnt || 0, 10);

            if (failedRecords > 0) {
              const sampleQuery = `
                SELECT ctid::text AS row_id, ${safeCol} AS failing_value
                FROM ${fullTableName}
                WHERE ${safeCol} IS NULL ${allowEmpty ? '' : `OR ${safeCol}::text = ''`}
                LIMIT 5
              `;
              const sampleRes = await client.query(sampleQuery);
              evidenceSummary = {
                failingCount: failedRecords,
                sampleFailingValues: sampleRes.rows
              };
            }
            message = failedRecords === 0
              ? `Column "${targetCol}" contains 0 null values`
              : `Column "${targetCol}" contains ${failedRecords} null values`;
          } else if (ruleType === 'UNIQUENESS') {
            const cols = (rule.targetColumns && rule.targetColumns.length > 0)
              ? rule.targetColumns
              : [targetCol];
            if (!cols || cols.length === 0 || !cols[0]) {
              throw new ConnectorConfigurationError('UNIQUENESS rule requires at least one target column');
            }
            cols.forEach(c => this._validateIdentifier(c, 'Column'));
            const quotedCols = cols.map(c => this._quoteIdentifier(c));

            if (cols.length === 1) {
              const checkQuery = `
                SELECT (COUNT(*) - COUNT(DISTINCT ${quotedCols[0]})) AS dup_cnt
                FROM ${fullTableName}
              `;
              const checkRes = await client.query(checkQuery);
              failedRecords = parseInt(checkRes.rows[0]?.dup_cnt || 0, 10);
            } else {
              const checkQuery = `
                SELECT COALESCE(SUM(dup_count - 1), 0) AS dup_cnt
                FROM (
                  SELECT ${quotedCols.join(', ')}, COUNT(*) AS dup_count
                  FROM ${fullTableName}
                  GROUP BY ${quotedCols.join(', ')}
                  HAVING COUNT(*) > 1
                ) sub
              `;
              const checkRes = await client.query(checkQuery);
              failedRecords = parseInt(checkRes.rows[0]?.dup_cnt || 0, 10);
            }

            if (failedRecords > 0) {
              const sampleQuery = `
                SELECT ${quotedCols.join(', ')}, COUNT(*) AS occurrences
                FROM ${fullTableName}
                GROUP BY ${quotedCols.join(', ')}
                HAVING COUNT(*) > 1
                LIMIT 5
              `;
              const sampleRes = await client.query(sampleQuery);
              evidenceSummary = {
                duplicateCount: failedRecords,
                sampleDuplicates: sampleRes.rows
              };
            }
            message = failedRecords === 0
              ? `Uniqueness verified for [${cols.join(', ')}] with 0 duplicates`
              : `Found ${failedRecords} duplicate rows for [${cols.join(', ')}]`;
          } else if (ruleType === 'REGEX_PATTERN') {
            if (!targetCol) throw new ConnectorConfigurationError('REGEX_PATTERN rule requires targetColumn');
            this._validateIdentifier(targetCol, 'Column');
            const safeCol = this._quoteIdentifier(targetCol);

            const pattern = config.pattern;
            const regValidation = validateSafeRegex(pattern);
            if (!regValidation.valid) {
              throw new ConnectorConfigurationError(regValidation.error);
            }

            const checkQuery = `
              SELECT COUNT(CASE WHEN ${safeCol} IS NOT NULL AND ${safeCol}::text !~ $1 THEN 1 END) AS failed_cnt
              FROM ${fullTableName}
            `;
            const checkRes = await client.query(checkQuery, [pattern]);
            failedRecords = parseInt(checkRes.rows[0]?.failed_cnt || 0, 10);

            if (failedRecords > 0) {
              const sampleQuery = `
                SELECT ctid::text AS row_id, ${safeCol} AS failing_value
                FROM ${fullTableName}
                WHERE ${safeCol} IS NOT NULL AND ${safeCol}::text !~ $1
                LIMIT 5
              `;
              const sampleRes = await client.query(sampleQuery, [pattern]);
              evidenceSummary = {
                failingCount: failedRecords,
                pattern,
                sampleFailingValues: sampleRes.rows
              };
            }
            message = failedRecords === 0
              ? `Column "${targetCol}" matches regex pattern "${pattern}"`
              : `Column "${targetCol}" had ${failedRecords} values failing regex pattern "${pattern}"`;
          } else if (ruleType === 'VALUE_RANGE') {
            if (!targetCol) throw new ConnectorConfigurationError('VALUE_RANGE rule requires targetColumn');
            this._validateIdentifier(targetCol, 'Column');
            const safeCol = this._quoteIdentifier(targetCol);

            const min = config.min;
            const max = config.max;
            if (min === undefined && max === undefined) {
              throw new ConnectorConfigurationError('VALUE_RANGE rule requires at least min or max');
            }

            let conditions = [];
            let params = [];
            if (min !== undefined) {
              params.push(min);
              conditions.push(`${safeCol} < $${params.length}`);
            }
            if (max !== undefined) {
              params.push(max);
              conditions.push(`${safeCol} > $${params.length}`);
            }

            const checkQuery = `
              SELECT COUNT(CASE WHEN ${safeCol} IS NOT NULL AND (${conditions.join(' OR ')}) THEN 1 END) AS failed_cnt
              FROM ${fullTableName}
            `;
            const checkRes = await client.query(checkQuery, params);
            failedRecords = parseInt(checkRes.rows[0]?.failed_cnt || 0, 10);

            if (failedRecords > 0) {
              const sampleQuery = `
                SELECT ctid::text AS row_id, ${safeCol} AS failing_value
                FROM ${fullTableName}
                WHERE ${safeCol} IS NOT NULL AND (${conditions.join(' OR ')})
                LIMIT 5
              `;
              const sampleRes = await client.query(sampleQuery, params);
              evidenceSummary = {
                failingCount: failedRecords,
                min,
                max,
                sampleFailingValues: sampleRes.rows
              };
            }
            message = failedRecords === 0
              ? `Column "${targetCol}" values within range [${min ?? '-∞'}, ${max ?? '+∞'}]`
              : `Column "${targetCol}" had ${failedRecords} values out of range [${min ?? '-∞'}, ${max ?? '+∞'}]`;
          } else if (ruleType === 'REFERENCE_INTEGRITY') {
            if (!targetCol) throw new ConnectorConfigurationError('REFERENCE_INTEGRITY rule requires targetColumn');
            this._validateIdentifier(targetCol, 'Column');
            const safeCol = this._quoteIdentifier(targetCol);

            const refTable = config.referenceTable;
            const refCol = config.referenceColumn;
            const refSchema = config.referenceSchema || schema || 'public';
            if (!refTable || !refCol) {
              throw new ConnectorConfigurationError('REFERENCE_INTEGRITY rule requires referenceTable and referenceColumn');
            }
            this._validateIdentifier(refTable, 'Reference table');
            this._validateIdentifier(refCol, 'Reference column');
            this._validateIdentifier(refSchema, 'Reference schema');

            const fullRefTable = `${this._quoteIdentifier(refSchema)}.${this._quoteIdentifier(refTable)}`;
            const safeRefCol = this._quoteIdentifier(refCol);

            const checkQuery = `
              SELECT COUNT(CASE WHEN ref.${safeRefCol} IS NULL AND src.${safeCol} IS NOT NULL THEN 1 END) AS failed_cnt
              FROM ${fullTableName} src
              LEFT JOIN ${fullRefTable} ref ON src.${safeCol}::text = ref.${safeRefCol}::text
            `;
            const checkRes = await client.query(checkQuery);
            failedRecords = parseInt(checkRes.rows[0]?.failed_cnt || 0, 10);

            if (failedRecords > 0) {
              const sampleQuery = `
                SELECT src.ctid::text AS row_id, src.${safeCol} AS orphan_value
                FROM ${fullTableName} src
                LEFT JOIN ${fullRefTable} ref ON src.${safeCol}::text = ref.${safeRefCol}::text
                WHERE ref.${safeRefCol} IS NULL AND src.${safeCol} IS NOT NULL
                LIMIT 5
              `;
              const sampleRes = await client.query(sampleQuery);
              evidenceSummary = {
                failingCount: failedRecords,
                referenceTarget: `${refSchema}.${refTable}.${refCol}`,
                sampleOrphanValues: sampleRes.rows
              };
            }
            message = failedRecords === 0
              ? `Reference integrity verified against ${refSchema}.${refTable}.${refCol}`
              : `Found ${failedRecords} orphan records not matching ${refSchema}.${refTable}.${refCol}`;
          } else if (ruleType === 'CUSTOM_SQL') {
            const query = config.query;
            const sqlValidation = validateCustomSql(query);
            if (!sqlValidation.valid) {
              throw new ConnectorConfigurationError(sqlValidation.error);
            }

            const customRes = await client.query(query);
            if (customRes.rows.length > 0 && customRes.rows[0].failed_records !== undefined) {
              failedRecords = parseInt(customRes.rows[0].failed_records, 10) || 0;
              if (customRes.rows[0].total_records !== undefined) {
                totalRecords = parseInt(customRes.rows[0].total_records, 10) || totalRecords;
              }
            } else if (customRes.rows.length > 0 && customRes.rows[0].failed_count !== undefined) {
              failedRecords = parseInt(customRes.rows[0].failed_count, 10) || 0;
            } else {
              failedRecords = customRes.rowCount;
            }

            if (failedRecords > 0) {
              evidenceSummary = {
                failingCount: failedRecords,
                sampleViolations: customRes.rows.slice(0, 5)
              };
            }
            message = failedRecords === 0
              ? 'Custom SQL check passed with 0 violations'
              : `Custom SQL check identified ${failedRecords} violating records`;
          } else {
            throw new ConnectorConfigurationError(`Unsupported quality rule type: ${ruleType}`);
          }

          await client.query('COMMIT');

          passed = failedRecords === 0;
          const recordsPassed = Math.max(totalRecords - failedRecords, 0);
          const passPercentage = totalRecords > 0
            ? Math.round((recordsPassed / totalRecords) * 10000) / 100
            : 100;

          const endHr = process.hrtime.bigint();
          const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

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
            executionDurationMs: durationMs
          };
        } catch (err) {
          if (client) {
            await client.query('ROLLBACK').catch(() => {});
          }
          throw this._mapError(err);
        } finally {
          if (client) {
            client.release();
          }
        }
      })(),
      options.timeoutMs || 25000,
      'PostgreSQL quality rule execution'
    );
  }

  /**
   * Computes statistical column profiling for target table using database-side queries.
   */
  async profileDataset(dataset, options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.pool || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        const tableName = dataset.name || dataset.externalId?.split('.').pop() || dataset.tableName;
        const schema = dataset.schemaName || this.schema || 'public';

        this._validateIdentifier(schema, 'Schema');
        this._validateIdentifier(tableName, 'Table');

        const safeSchema = this._quoteIdentifier(schema);
        const safeTable = this._quoteIdentifier(tableName);
        const fullTableName = `${safeSchema}.${safeTable}`;

        let client;
        try {
          client = await this.pool.connect();
          await client.query('BEGIN READ ONLY');
          await client.query('SET LOCAL statement_timeout = 20000');

          // Discover table columns if not passed
          let columns = dataset.columns || [];
          if (!columns || columns.length === 0) {
            const colsRes = await client.query(
              `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position ASC`,
              [schema, tableName]
            );
            columns = colsRes.rows.map(r => ({ name: r.column_name, dataType: r.data_type }));
          }

          // Total row count
          const countRes = await client.query(`SELECT COUNT(*) AS total FROM ${fullTableName}`);
          const totalRows = parseInt(countRes.rows[0]?.total || 0, 10);

          const columnProfiles = [];

          for (const col of columns) {
            const colName = col.name;
            const dataType = String(col.dataType || '').toLowerCase();
            this._validateIdentifier(colName, 'Column');
            const safeCol = this._quoteIdentifier(colName);

            if (totalRows === 0) {
              columnProfiles.push({
                columnName: colName,
                dataType,
                rowCount: 0,
                nullCount: 0,
                nullPercentage: 0,
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

            // Stats aggregation
            const statsQuery = `
              SELECT 
                (COUNT(*) - COUNT(${safeCol})) AS null_cnt,
                COUNT(DISTINCT ${safeCol}) AS distinct_cnt,
                MIN(${safeCol}::text) AS min_val,
                MAX(${safeCol}::text) AS max_val
              FROM ${fullTableName}
            `;
            const statsRes = await client.query(statsQuery);
            const statsRow = statsRes.rows[0] || {};
            const nullCount = parseInt(statsRow.null_cnt || 0, 10);
            const distinctCount = parseInt(statsRow.distinct_cnt || 0, 10);
            const nullPercentage = Math.round((nullCount / totalRows) * 10000) / 100;
            const cardinality = Math.round((distinctCount / totalRows) * 10000) / 10000;

            let meanValue = null;
            let medianValue = null;
            let stdDevValue = null;

            const isNumeric = ['integer', 'int', 'smallint', 'bigint', 'numeric', 'decimal', 'real', 'double precision'].some(t => dataType.includes(t));

            if (isNumeric && (totalRows - nullCount) > 0) {
              try {
                const numQuery = `
                  SELECT 
                    AVG(${safeCol})::float AS mean_val,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${safeCol})::float AS median_val,
                    STDDEV(${safeCol})::float AS std_dev
                  FROM ${fullTableName}
                  WHERE ${safeCol} IS NOT NULL
                `;
                const numRes = await client.query(numQuery);
                const numRow = numRes.rows[0] || {};
                meanValue = numRow.mean_val !== null ? Math.round(numRow.mean_val * 100) / 100 : null;
                medianValue = numRow.median_val !== null ? Math.round(numRow.median_val * 100) / 100 : null;
                stdDevValue = numRow.std_dev !== null ? Math.round(numRow.std_dev * 100) / 100 : null;
              } catch (numErr) {
                this.context.logger?.warn(`Numeric profiling error on column ${colName}: ${numErr.message}`);
              }
            }

            // Top frequent values distribution / histogram
            let histogram = [];
            try {
              const histQuery = `
                SELECT ${safeCol}::text AS bucket_val, COUNT(*) AS bucket_cnt
                FROM ${fullTableName}
                WHERE ${safeCol} IS NOT NULL
                GROUP BY ${safeCol}
                ORDER BY bucket_cnt DESC
                LIMIT 5
              `;
              const histRes = await client.query(histQuery);
              histogram = histRes.rows.map(r => ({
                bucket: r.bucket_val ?? 'null',
                count: parseInt(r.bucket_cnt, 10),
                percentage: Math.round((parseInt(r.bucket_cnt, 10) / totalRows) * 10000) / 100
              }));
            } catch (histErr) {
              this.context.logger?.warn(`Histogram query error on column ${colName}: ${histErr.message}`);
            }

            columnProfiles.push({
              columnName: colName,
              dataType,
              rowCount: totalRows,
              nullCount,
              nullPercentage,
              distinctCount,
              cardinality,
              minValue: statsRow.min_val ?? null,
              maxValue: statsRow.max_val ?? null,
              meanValue,
              medianValue,
              stdDevValue,
              histogram,
              profiledAt: new Date().toISOString()
            });
          }

          await client.query('COMMIT');

          const endHr = process.hrtime.bigint();
          const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          return {
            datasetName: tableName,
            schema,
            rowCount: totalRows,
            columnCount: columnProfiles.length,
            columns: columnProfiles,
            profiledAt: new Date().toISOString(),
            durationMs
          };
        } catch (err) {
          if (client) {
            await client.query('ROLLBACK').catch(() => {});
          }
          throw this._mapError(err);
        } finally {
          if (client) {
            client.release();
          }
        }
      })(),
      options.timeoutMs || 30000,
      'PostgreSQL dataset profiling'
    );
  }

  /**
   * Gracefully drains the connection pool and cleans up state.
   */
  async disconnect() {
    this.isConnected = false;
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (err) {
        this.context.logger.warn('Error closing PostgreSQL pool', { error: err.message });
      } finally {
        this.pool = null;
      }
    }
  }

  /**
   * Validates identifier strings to strictly prevent SQL injection.
   * @private
   */
  _validateIdentifier(identifier, type = 'Identifier') {
    if (!identifier || typeof identifier !== 'string') {
      throw new ConnectorConfigurationError(`${type} name must be a non-empty string`);
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(identifier)) {
      throw new ConnectorConfigurationError(
        `Invalid or unsafe ${type.toLowerCase()} identifier "${identifier}". Only alphanumeric characters and underscores are allowed.`
      );
    }
  }

  /**
   * Safely quotes a validated SQL identifier.
   * @private
   */
  _quoteIdentifier(identifier) {
    this._validateIdentifier(identifier);
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Normalizes driver exceptions into standardized ConnectorError instances.
   * @private
   */
  _mapError(err) {
    if (!err) return new ConnectorQueryError('Unknown PostgreSQL error');
    if (err instanceof ConnectorConfigurationError || err instanceof ConnectorTimeoutError) {
      return err;
    }

    const code = err.code;
    const msg = err.message || '';

    // Authentication failure
    if (code === '28P01' || msg.includes('password authentication failed')) {
      return new ConnectorAuthenticationError('PostgreSQL authentication failed. Invalid username or password.');
    }

    // Host unreachable / refused
    if (code === 'ECONNREFUSED' || code === 'EHOSTUNREACH') {
      return new ConnectorUnavailableError(`Unable to connect to PostgreSQL server at ${this.context.configuration.host}:${this.context.configuration.port || 5432}. Connection refused.`);
    }

    // Hostname resolution failure
    if (code === 'ENOTFOUND') {
      return new ConnectorUnavailableError(`PostgreSQL host "${this.context.configuration.host}" could not be resolved.`);
    }

    // Connection timeout
    if (code === 'ETIMEDOUT' || code === '57014' || msg.includes('timeout')) {
      return new ConnectorTimeoutError('PostgreSQL connection or query timed out.');
    }

    // Permission denied
    if (code === '42501') {
      return new ConnectorPermissionError('Insufficient privileges to access the requested PostgreSQL catalog or table.');
    }

    // Non-existent database
    if (code === '3D000') {
      return new ConnectorConfigurationError(`PostgreSQL database "${this.context.configuration.database}" does not exist.`);
    }

    // Non-existent table or relation
    if (code === '42P01' || msg.includes('does not exist')) {
      return new ConnectorQueryError(msg, { pgCode: '42P01', originalMessage: msg });
    }

    return new ConnectorQueryError(msg.length > 200 ? `${msg.substring(0, 197)}...` : msg, { pgCode: code });
  }
}

export default PostgreSQLConnector;
