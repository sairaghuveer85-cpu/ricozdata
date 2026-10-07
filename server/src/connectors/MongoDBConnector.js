import { MongoClient } from 'mongodb';
import { BaseConnector } from './BaseConnector.js';
import {
  ConnectorConfigurationError,
  ConnectorAuthenticationError,
  ConnectorTimeoutError,
  ConnectorUnavailableError,
  ConnectorQueryError
} from './errors.js';
import { validateSafeRegex } from '../utils/securityValidators.js';

/**
 * Enterprise MongoDB Connector for external customer data sources.
 * Strictly separate from RicozData's internal application database.
 */
export class MongoDBConnector extends BaseConnector {
  constructor(context) {
    super(context);
    this.client = null;
    this.dbName = this.context.configuration.database;
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
    if (this.client && this.isConnected) return;

    const config = this.context.configuration;
    const creds = this.context.getCredentials();

    let uri = config.uri || config.connectionString || config.connectionUrl;

    if (!uri) {
      if (!config.host) throw new ConnectorConfigurationError('MongoDB host is required');
      if (!config.database) throw new ConnectorConfigurationError('MongoDB database is required');

      const username = config.username || creds.username || '';
      const password = creds.password || '';

      if (username && password) {
        const encodedUser = encodeURIComponent(username);
        const encodedPass = encodeURIComponent(password);
        uri = `mongodb://${encodedUser}:${encodedPass}@${config.host}:${config.port || 27017}/${config.database}`;
      } else if (username) {
        const encodedUser = encodeURIComponent(username);
        uri = `mongodb://${encodedUser}@${config.host}:${config.port || 27017}/${config.database}`;
      } else {
        uri = `mongodb://${config.host}:${config.port || 27017}/${config.database}`;
      }

      const params = [];
      if (config.authSource) {
        params.push(`authSource=${encodeURIComponent(config.authSource)}`);
      }
      if (config.replicaSet) {
        params.push(`replicaSet=${encodeURIComponent(config.replicaSet)}`);
      }
      if (params.length > 0) {
        uri += `?${params.join('&')}`;
      }
    }

    const clientOpts = {
      connectTimeoutMS: this.context.timeouts.connect || 10000,
      serverSelectionTimeoutMS: this.context.timeouts.connect || 10000,
      maxPoolSize: Math.min(Math.max(parseInt(config.poolSize, 10) || 5, 1), 20)
    };

    if (config.ssl === true || config.ssl === 'true' || config.tls === true || config.tls === 'true') {
      clientOpts.tls = true;
      clientOpts.tlsAllowInvalidCertificates = true;
    }
    if (config.replicaSet) {
      clientOpts.replicaSet = config.replicaSet;
    }
    if (config.authMechanism) {
      clientOpts.authMechanism = config.authMechanism;
    }

    try {
      this.client = new MongoClient(uri, clientOpts);
      await this.client.connect();
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      throw this._mapError(err);
    }
  }

  async test() {
    return await this.withTimeout(
      (async () => {
        if (!this.client || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        try {
          const db = this.client.db(this.dbName);
          const pingResult = await db.command({ ping: 1 });
          const endHr = process.hrtime.bigint();
          const latencyMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          return {
            success: true,
            connectorType: 'mongodb',
            status: 'HEALTHY',
            latencyMs,
            checkedAt: new Date().toISOString(),
            details: {
              database: this.dbName,
              ping: pingResult.ok === 1 ? 'ok' : 'failed'
            }
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.connect || 10000,
      'MongoDB test connection'
    );
  }

  async fetchMetadata(options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.client || !this.isConnected) {
          await this.connect();
        }

        try {
          const db = this.client.db(this.dbName);
          const collections = await db.listCollections().toArray();

          const tables = [];
          for (const col of collections) {
            // Skip system collections
            if (col.name.startsWith('system.')) continue;

            const externalId = `${this.dbName}.${col.name}`;
            const fieldsMap = new Map();

            // Bounded sampling: inspect up to 50 documents to infer document structure
            try {
              const sampleDocs = await db.collection(col.name).find({}).limit(50).toArray();
              for (const doc of sampleDocs) {
                for (const [key, val] of Object.entries(doc)) {
                  let inferredType = typeof val;
                  if (val === null) inferredType = 'null';
                  else if (Array.isArray(val)) inferredType = 'array';
                  else if (val instanceof Date) inferredType = 'date';
                  else if (typeof val === 'boolean') inferredType = 'bool';
                  else if (typeof val === 'number') inferredType = Number.isInteger(val) ? 'int32' : 'double';
                  else if (typeof val === 'object' && val !== null) {
                    if (val._bsontype) inferredType = val._bsontype.toLowerCase();
                    else inferredType = 'object';
                  }

                  if (!fieldsMap.has(key)) {
                    fieldsMap.set(key, {
                      name: key,
                      types: new Set([inferredType]),
                      nullable: val === null,
                      sampleCount: 1
                    });
                  } else {
                    const existing = fieldsMap.get(key);
                    existing.types.add(inferredType);
                    if (val === null) existing.nullable = true;
                    existing.sampleCount++;
                  }
                }
              }
            } catch {
              // Bounded sampling optional
            }

            const columns = [];
            let pos = 1;
            // Always ensure _id is present as primary key
            if (!fieldsMap.has('_id')) {
              columns.push({
                name: '_id',
                dataType: 'objectId',
                nullable: false,
                ordinalPosition: pos++,
                defaultValue: null,
                isPrimaryKey: true,
                isForeignKey: false,
                description: 'Unique document identifier'
              });
            }

            for (const [key, fieldInfo] of fieldsMap.entries()) {
              const typesArr = Array.from(fieldInfo.types).filter(t => t !== 'null');
              const finalType = typesArr.length === 1 ? typesArr[0] : (typesArr.length > 1 ? typesArr.join('|') : 'string');

              columns.push({
                name: key,
                dataType: finalType,
                nullable: fieldInfo.nullable,
                ordinalPosition: pos++,
                defaultValue: null,
                isPrimaryKey: key === '_id',
                isForeignKey: false,
                description: key === '_id' ? 'Unique document identifier' : ''
              });
            }

            // Discover indexes on collection
            let indexes = [];
            try {
              indexes = await db.collection(col.name).indexes();
            } catch {
              // Index discovery optional
            }

            // Estimate document count
            let rowCount = 0;
            try {
              rowCount = await db.collection(col.name).estimatedDocumentCount();
            } catch {
              // Count optional
            }

            tables.push({
              externalId,
              name: col.name,
              schema: this.dbName,
              type: 'collection',
              columns,
              primaryKey: ['_id'],
              foreignKeys: [],
              indexes: indexes.map(idx => ({ name: idx.name, key: idx.key, unique: Boolean(idx.unique) })),
              rowCount
            });
          }

          return {
            sourceType: 'mongodb',
            database: this.dbName,
            schema: this.dbName,
            schemas: [this.dbName],
            tables
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.metadata || 30000,
      'MongoDB metadata discovery'
    );
  }

  async sampleData(params = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.client || !this.isConnected) {
          await this.connect();
        }

        const collectionName = params.tableName || params.collectionName;
        const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), 100);

        try {
          const db = this.client.db(this.dbName);
          const docs = await db.collection(collectionName).find({}).limit(limit).toArray();

          const columnsSet = new Set();
          for (const d of docs) {
            for (const k of Object.keys(d)) columnsSet.add(k);
          }

          return {
            datasetName: collectionName,
            schema: this.dbName,
            rowCount: docs.length,
            columns: Array.from(columnsSet),
            rows: docs,
            sampledAt: new Date().toISOString(),
            truncated: docs.length === limit
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.sample || 15000,
      'MongoDB data sampling'
    );
  }

  /**
   * Execute read-only document query against target MongoDB collection.
   * Accepts JSON filter { collection, filter, projection, sort, limit } or simple JSON filter string.
   */
  async executeQueryReadOnly(queryInput, params = [], options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.client || !this.isConnected) {
          await this.connect();
        }

        const maxRows = Math.min(Math.max(parseInt(options.maxRows, 10) || 50, 1), 100);
        let targetCollection = options.collection || options.tableName;
        let filter = {};
        let projection = {};
        let sort = {};

        // Parse queryInput if provided
        if (typeof queryInput === 'string' && queryInput.trim()) {
          const trimmed = queryInput.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.collection) targetCollection = parsed.collection;
              filter = parsed.filter || (parsed.collection ? {} : parsed);
              projection = parsed.projection || {};
              sort = parsed.sort || {};
            } catch {
              // Keep default empty filter
            }
          } else if (/^SELECT\s+/i.test(trimmed)) {
            // Friendly SQL compatibility: extract collection from FROM clause
            const match = trimmed.match(/FROM\s+["`]?([a-zA-Z0-9_]+)["`]?/i);
            if (match) targetCollection = match[1];
          }
        } else if (typeof queryInput === 'object' && queryInput !== null) {
          if (queryInput.collection) targetCollection = queryInput.collection;
          filter = queryInput.filter || {};
          projection = queryInput.projection || {};
          sort = queryInput.sort || {};
        }

        if (!targetCollection) {
          throw new ConnectorConfigurationError('Target MongoDB collection name must be specified');
        }

        const startHr = process.hrtime.bigint();
        try {
          const db = this.client.db(this.dbName);
          const docs = await db.collection(targetCollection)
            .find(filter, { projection })
            .sort(sort)
            .limit(maxRows)
            .toArray();

          const endHr = process.hrtime.bigint();
          const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          const fieldsSet = new Set();
          for (const d of docs) {
            for (const k of Object.keys(d)) fieldsSet.add(k);
          }

          return {
            rowCount: docs.length,
            fields: Array.from(fieldsSet),
            rows: docs,
            durationMs,
            truncated: docs.length === maxRows
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      options.timeoutMs || this.context.timeouts.query || 15000,
      'MongoDB query execution'
    );
  }

  /**
   * Evaluates quality rule against a MongoDB collection using aggregation pipelines.
   */
  async executeQualityRule(rule, dataset, options = {}) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    const collectionName = dataset.tableName || dataset.name;
    const ruleType = String(rule.ruleType || '').toUpperCase().trim();
    const config = rule.configuration || rule.parameters || {};
    const targetCol = rule.targetColumn || config.column;

    const startHr = process.hrtime.bigint();

    try {
      const db = this.client.db(this.dbName);
      const col = db.collection(collectionName);

      const totalCount = await col.countDocuments({});

      if (totalCount === 0) {
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

          const missingCount = await col.countDocuments({ [targetCol]: { $exists: false } });
          const explicitNullCount = await col.countDocuments({ [targetCol]: null, $and: [{ [targetCol]: { $exists: true } }] });
          const emptyStringCount = allowEmpty ? 0 : await col.countDocuments({ [targetCol]: '' });

          failedRecords = missingCount + explicitNullCount + emptyStringCount;

          if (failedRecords > 0) {
            const failingDocs = await col.find(
              {
                $or: [
                  { [targetCol]: { $exists: false } },
                  { [targetCol]: null },
                  ...(allowEmpty ? [] : [{ [targetCol]: '' }])
                ]
              },
              { projection: { [targetCol]: 1, _id: 1 } }
            ).limit(5).toArray();

            evidenceSummary = {
              missingCount,
              explicitNullCount,
              emptyStringCount,
              failingCount: failedRecords,
              sampleFailingValues: failingDocs.map(d => ({
                row_id: String(d._id),
                failing_value: d[targetCol] !== undefined ? d[targetCol] : '<missing>'
              }))
            };
          }

          message = failedRecords === 0
            ? `Field "${targetCol}" contains 0 null or missing values`
            : `Field "${targetCol}" contains ${failedRecords} null/missing values (${missingCount} missing, ${explicitNullCount} explicit nulls)`;
          break;
        }

        case 'UNIQUENESS': {
          const cols = (rule.targetColumns && rule.targetColumns.length > 0)
            ? rule.targetColumns
            : [targetCol];
          if (!cols || cols.length === 0 || !cols[0]) {
            throw new ConnectorConfigurationError('UNIQUENESS rule requires at least one target column');
          }

          const groupKey = {};
          const matchCriteria = {};
          for (const c of cols) {
            groupKey[c] = `$${c}`;
            matchCriteria[c] = { $exists: true, $ne: null };
          }

          const dupPipeline = [
            { $match: matchCriteria },
            { $group: { _id: groupKey, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $sort: { count: -1 } }
          ];

          const dupGroups = await col.aggregate(dupPipeline).toArray();
          failedRecords = dupGroups.reduce((acc, g) => acc + (g.count - 1), 0);

          if (failedRecords > 0) {
            evidenceSummary = {
              duplicateCount: failedRecords,
              sampleDuplicates: dupGroups.slice(0, 5).map(g => ({
                ...g._id,
                occurrences: g.count
              }))
            };
          }

          message = failedRecords === 0
            ? `Uniqueness verified for [${cols.join(', ')}] with 0 duplicates`
            : `Found ${failedRecords} duplicate documents for [${cols.join(', ')}]`;
          break;
        }

        case 'REGEX_PATTERN': {
          if (!targetCol) throw new ConnectorConfigurationError('REGEX_PATTERN rule requires targetColumn');
          const pattern = config.pattern;
          const regValidation = validateSafeRegex(pattern);
          if (!regValidation.valid) {
            throw new ConnectorConfigurationError(regValidation.error);
          }

          const rx = new RegExp(pattern);
          failedRecords = await col.countDocuments({
            [targetCol]: { $exists: true, $ne: null, $not: rx }
          });

          if (failedRecords > 0) {
            const sampleDocs = await col.find(
              { [targetCol]: { $exists: true, $ne: null, $not: rx } },
              { projection: { [targetCol]: 1, _id: 1 } }
            ).limit(5).toArray();

            evidenceSummary = {
              failingCount: failedRecords,
              pattern,
              sampleFailingValues: sampleDocs.map(d => ({
                row_id: String(d._id),
                failing_value: d[targetCol]
              }))
            };
          }

          message = failedRecords === 0
            ? `Field "${targetCol}" matches regex pattern "${pattern}"`
            : `Field "${targetCol}" had ${failedRecords} values failing regex pattern "${pattern}"`;
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
          if (min !== undefined) conditions.push({ [targetCol]: { $lt: Number(min) } });
          if (max !== undefined) conditions.push({ [targetCol]: { $gt: Number(max) } });

          const rangeFilter = {
            [targetCol]: { $exists: true, $ne: null },
            $or: conditions
          };

          failedRecords = await col.countDocuments(rangeFilter);

          if (failedRecords > 0) {
            const sampleDocs = await col.find(
              rangeFilter,
              { projection: { [targetCol]: 1, _id: 1 } }
            ).limit(5).toArray();

            evidenceSummary = {
              failingCount: failedRecords,
              range: { min, max },
              sampleFailingValues: sampleDocs.map(d => ({
                row_id: String(d._id),
                failing_value: d[targetCol]
              }))
            };
          }

          message = failedRecords === 0
            ? `All values in "${targetCol}" are within acceptable range [${min ?? '-∞'}, ${max ?? '+∞'}]`
            : `Field "${targetCol}" had ${failedRecords} values outside range [${min ?? '-∞'}, ${max ?? '+∞'}]`;
          break;
        }

        case 'ALLOWED_VALUES':
        case 'ENUM': {
          if (!targetCol) throw new ConnectorConfigurationError('ALLOWED_VALUES rule requires targetColumn');
          const allowed = Array.isArray(config.values) ? config.values : [];
          if (allowed.length === 0) {
            throw new ConnectorConfigurationError('ALLOWED_VALUES rule requires non-empty values list');
          }

          const enumFilter = {
            [targetCol]: { $exists: true, $ne: null, $nin: allowed }
          };

          failedRecords = await col.countDocuments(enumFilter);

          if (failedRecords > 0) {
            const sampleDocs = await col.find(
              enumFilter,
              { projection: { [targetCol]: 1, _id: 1 } }
            ).limit(5).toArray();

            evidenceSummary = {
              failingCount: failedRecords,
              allowedValues: allowed,
              sampleFailingValues: sampleDocs.map(d => ({
                row_id: String(d._id),
                failing_value: d[targetCol]
              }))
            };
          }

          message = failedRecords === 0
            ? `All values in "${targetCol}" match allowed set`
            : `Field "${targetCol}" had ${failedRecords} values not in allowed set`;
          break;
        }

        case 'FRESHNESS':
        case 'TIMELINESS': {
          if (!targetCol) throw new ConnectorConfigurationError('FRESHNESS rule requires targetColumn');
          const maxAgeDays = Number(config.maxAgeDays || 1);

          const latestDocs = await col.find({ [targetCol]: { $exists: true, $ne: null } })
            .sort({ [targetCol]: -1 })
            .limit(1)
            .toArray();

          if (latestDocs.length > 0 && latestDocs[0][targetCol]) {
            const rawDate = latestDocs[0][targetCol];
            const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
            if (!isNaN(dateObj.getTime())) {
              const ageDays = Math.round((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
              if (ageDays > maxAgeDays) {
                failedRecords = totalCount;
                evidenceSummary = {
                  latestTimestamp: dateObj.toISOString(),
                  ageDays,
                  maxAgeDays,
                  slaViolated: true
                };
                message = `Data freshness SLA violated: latest record in "${targetCol}" is ${ageDays} days old (max SLA: ${maxAgeDays} days)`;
              } else {
                failedRecords = 0;
                message = `Data is fresh: latest record in "${targetCol}" is ${ageDays} days old`;
              }
            }
          }
          break;
        }

        default: {
          failedRecords = 0;
          message = `Evaluated rule ${ruleType} on collection ${collectionName}`;
          break;
        }
      }

      const endHr = process.hrtime.bigint();
      const executionDurationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;
      const recordsPassed = Math.max(0, totalCount - failedRecords);
      const passPercentage = totalCount > 0 ? Math.round((recordsPassed / totalCount) * 10000) / 100 : 100;
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
        recordsEvaluated: totalCount,
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
   * Computes statistical field profiling for a MongoDB collection using aggregation pipelines.
   */
  async profileDataset(dataset, options = {}) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    const startHr = process.hrtime.bigint();
    const collectionName = dataset.tableName || dataset.name;

    try {
      const db = this.client.db(this.dbName);
      const col = db.collection(collectionName);
      const totalRows = await col.countDocuments({});

      // Discover fields if not passed
      let columns = dataset.columns || [];
      if (!columns || columns.length === 0) {
        const sampleDocs = await col.find({}).limit(50).toArray();
        const discovered = new Map();
        for (const doc of sampleDocs) {
          for (const [k, v] of Object.entries(doc)) {
            if (!discovered.has(k)) {
              const dt = v instanceof Date ? 'date' : Array.isArray(v) ? 'array' : typeof v;
              discovered.set(k, dt);
            }
          }
        }
        columns = Array.from(discovered.entries()).map(([k, dt]) => ({ name: k, dataType: dt }));
      }

      const columnProfiles = [];
      for (const c of columns.slice(0, 100)) {
        const colName = c.name;
        const dataType = String(c.dataType || '').toLowerCase();

        if (totalRows === 0) {
          columnProfiles.push({
            columnName: colName,
            name: colName,
            dataType,
            rowCount: 0,
            totalCount: 0,
            nullCount: 0,
            missingCount: 0,
            explicitNullCount: 0,
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
          const missingCount = await col.countDocuments({ [colName]: { $exists: false } });
          const explicitNullCount = await col.countDocuments({ [colName]: null, $and: [{ [colName]: { $exists: true } }] });
          const nullCount = missingCount + explicitNullCount;
          const nonNullCount = Math.max(0, totalRows - nullCount);

          const distinctValues = await col.distinct(colName);
          const distinctCount = Array.isArray(distinctValues) ? distinctValues.length : 0;
          const nullPercentage = Math.round((nullCount / totalRows) * 10000) / 100;
          const completenessPercentage = Math.round((nonNullCount / totalRows) * 10000) / 100;
          const cardinality = Math.round((distinctCount / totalRows) * 10000) / 10000;

          let minValue = null;
          let maxValue = null;
          if (nonNullCount > 0) {
            try {
              const minDocs = await col.find({ [colName]: { $exists: true, $ne: null } }).sort({ [colName]: 1 }).limit(1).toArray();
              const maxDocs = await col.find({ [colName]: { $exists: true, $ne: null } }).sort({ [colName]: -1 }).limit(1).toArray();
              if (minDocs[0] && minDocs[0][colName] !== undefined) {
                const val = minDocs[0][colName];
                minValue = val instanceof Date ? val.toISOString() : String(val);
              }
              if (maxDocs[0] && maxDocs[0][colName] !== undefined) {
                const val = maxDocs[0][colName];
                maxValue = val instanceof Date ? val.toISOString() : String(val);
              }
            } catch {}
          }

          let meanValue = null;
          let stdDevValue = null;
          const isNumeric = ['number', 'double', 'int', 'long', 'decimal'].some(t => dataType.includes(t));
          if (isNumeric && nonNullCount > 0) {
            try {
              const numAgg = await col.aggregate([
                { $match: { [colName]: { $type: 'number' } } },
                { $group: { _id: null, meanVal: { $avg: `$${colName}` }, stdDev: { $stdDevPop: `$${colName}` } } }
              ]).toArray();
              if (numAgg.length > 0) {
                meanValue = numAgg[0].meanVal !== null ? Math.round(Number(numAgg[0].meanVal) * 100) / 100 : null;
                stdDevValue = numAgg[0].stdDev !== null ? Math.round(Number(numAgg[0].stdDev) * 100) / 100 : null;
              }
            } catch {}
          }

          let histogram = [];
          try {
            const histAgg = await col.aggregate([
              { $match: { [colName]: { $exists: true, $ne: null } } },
              { $group: { _id: `$${colName}`, count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 }
            ]).toArray();
            histogram = histAgg.map(h => ({
              bucket: String(h._id ?? 'null'),
              count: h.count,
              percentage: Math.round((h.count / totalRows) * 10000) / 100
            }));
          } catch {}

          columnProfiles.push({
            columnName: colName,
            name: colName,
            dataType,
            rowCount: totalRows,
            totalCount: totalRows,
            nullCount,
            missingCount,
            explicitNullCount,
            nullPercentage,
            completenessPercentage,
            distinctCount,
            cardinality,
            minValue,
            maxValue,
            meanValue,
            medianValue: meanValue,
            stdDevValue,
            histogram,
            profiledAt: new Date().toISOString()
          });
        } catch {
          // Skip field if error
        }
      }

      const endHr = process.hrtime.bigint();
      const durationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      return {
        datasetId: dataset._id,
        datasetName: collectionName,
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
    if (this.client) {
      try {
        await this.client.close();
      } catch (err) {
        this.context.logger.warn('Error closing MongoDB client', { error: err.message });
      } finally {
        this.client = null;
      }
    }
  }

  _mapError(err) {
    if (!err) return new ConnectorQueryError('Unknown MongoDB error');
    if (err instanceof ConnectorConfigurationError || err instanceof ConnectorTimeoutError) return err;

    const msg = err.message || '';
    if (msg.includes('Authentication failed') || err.code === 18) {
      return new ConnectorAuthenticationError('MongoDB authentication failed. Invalid credentials.');
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('getaddrinfo ENOTFOUND')) {
      return new ConnectorUnavailableError(`Unable to connect to MongoDB server at ${this.context.configuration.host}:${this.context.configuration.port || 27017}`);
    }
    if (msg.includes('timed out') || err.name === 'MongoServerSelectionError') {
      return new ConnectorTimeoutError('MongoDB connection or server selection timed out.');
    }

    return new ConnectorQueryError(msg.length > 200 ? `${msg.substring(0, 197)}...` : msg);
  }
}

export default MongoDBConnector;
