/**
 * RicozData Quality Profiler Service
 *
 * Connects the Quality Engine to the existing Data Source connector architecture.
 * Evaluates real source-data rows using database-side pushdown queries via:
 * - PostgreSQLConnector
 * - MySQLConnector
 * - SQLServerConnector
 * - SnowflakeConnector
 * - MongoDBConnector
 *
 * NO synthetic mock data in production evaluation paths.
 * If source cannot be reached, throws a SOURCE_UNAVAILABLE error.
 */

const mongoose = require('mongoose');
const DataSource = require('../models/DataSource');

// Normalized weights for assessed dimensions
const DIMENSION_WEIGHTS = {
  completeness: 0.25,
  accuracy: 0.20,
  consistency: 0.20,
  validity: 0.15,
  uniqueness: 0.10,
  timeliness: 0.10,
};

const DIM_COLORS = {
  completeness: '#10b981',
  accuracy: '#3b82f6',
  consistency: '#8b5cf6',
  validity: '#f59e0b',
  uniqueness: '#06b6d4',
  timeliness: '#ec4899',
};

/**
 * Dynamically resolves and instantiates the appropriate connector
 * for a dataset using the existing DataSource record and credentials.
 *
 * @param {Object} dataset - Mongoose Dataset document
 * @returns {Promise<{ connector: Object, dataSource: Object }>}
 */
async function resolveConnector(dataset) {
  let dataSourceId = dataset.dataSourceId || dataset.dataSource;

  // If dataSourceId is an object with _id, extract it
  if (dataSourceId && typeof dataSourceId === 'object' && dataSourceId._id) {
    dataSourceId = dataSourceId._id;
  }

  let dataSource = null;
  if (dataSourceId) {
    dataSource = await DataSource.findById(dataSourceId).select('+credentials');
  }

  if (!dataSource) {
    // Attempt lookup by name if dataset.source exists
    if (dataset.source || dataset.sourceSystem) {
      dataSource = await DataSource.findOne({
        $or: [
          { name: dataset.source },
          { name: dataset.sourceSystem }
        ]
      }).select('+credentials');
    }
  }

  if (!dataSource) {
    const err = new Error(
      `Unable to evaluate dataset "${dataset.name}" because the connected data source could not be resolved in catalog.`
    );
    err.code = 'SOURCE_UNAVAILABLE';
    err.status = 503;
    throw err;
  }

  const sourceType = String(dataSource.type || '').toLowerCase().trim();

  // Dynamic import of the appropriate enterprise connector
  let ConnectorClass = null;
  const { ConnectorContext } = await import('../src/connectors/ConnectorContext.js');

  switch (sourceType) {
    case 'postgresql':
    case 'postgres': {
      const { PostgreSQLConnector } = await import('../src/connectors/PostgreSQLConnector.js');
      ConnectorClass = PostgreSQLConnector;
      break;
    }
    case 'mysql': {
      const { MySQLConnector } = await import('../src/connectors/MySQLConnector.js');
      ConnectorClass = MySQLConnector;
      break;
    }
    case 'sqlserver':
    case 'mssql': {
      const { SQLServerConnector } = await import('../src/connectors/SQLServerConnector.js');
      ConnectorClass = SQLServerConnector;
      break;
    }
    case 'snowflake': {
      const { SnowflakeConnector } = await import('../src/connectors/SnowflakeConnector.js');
      ConnectorClass = SnowflakeConnector;
      break;
    }
    case 'mongodb': {
      const { MongoDBConnector } = await import('../src/connectors/MongoDBConnector.js');
      ConnectorClass = MongoDBConnector;
      break;
    }
    default: {
      const err = new Error(
        `Quality profiling is not yet supported for connector type "${sourceType}". Supported types: PostgreSQL, MySQL, SQL Server, Snowflake, MongoDB.`
      );
      err.code = 'CONNECTOR_UNSUPPORTED';
      err.status = 501;
      throw err;
    }
  }

  const configuration = {
    ...(dataSource.configuration || {}),
    ...(dataSource.connectionConfig || {})
  };

  let decryptedCredentials = {};
  if (typeof dataSource.getDecryptedCredentials === 'function') {
    decryptedCredentials = dataSource.getDecryptedCredentials() || {};
  } else if (dataSource.credentials) {
    decryptedCredentials = dataSource.credentials;
  }

  const context = new ConnectorContext({
    dataSourceId: dataSource._id,
    organizationId: dataSource.organizationId,
    sourceType,
    configuration,
    credentials: decryptedCredentials
  });

  const connector = new ConnectorClass(context);
  return { connector, dataSource };
}

/**
 * Standardizes rule types between MongoDB Rule documents and Connector expectations.
 */
function normalizeRuleType(rawType) {
  const type = String(rawType || '').toUpperCase().trim();
  switch (type) {
    case 'NOT_NULL':
      return 'NULL_CHECK';
    case 'UNIQUE':
    case 'DUPLICATE':
      return 'UNIQUENESS';
    case 'REGEX':
      return 'REGEX_PATTERN';
    case 'RANGE':
      return 'VALUE_RANGE';
    case 'REFERENTIAL_INTEGRITY':
      return 'REFERENCE_INTEGRITY';
    case 'CUSTOM':
      return 'CUSTOM_SQL';
    default:
      return type;
  }
}

/**
 * Profiles the source dataset and executes quality rules using database-side pushdown queries.
 *
 * @param {Object} dataset - Mongoose Dataset document
 * @param {Array} configuredRules - List of configured Rule documents
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Profiling and evaluation results
 */
async function profileAndEvaluate(dataset, configuredRules = [], options = {}) {
  const { connector, dataSource } = await resolveConnector(dataset);

  try {
    await connector.connect();

    const tableName = dataset.tableName || dataset.name;
    const schemaName = dataset.schemaName || 'public';
    const rawColumns = (dataset.columns && dataset.columns.length > 0)
      ? dataset.columns
      : (dataset.schema && dataset.schema.length > 0 ? dataset.schema : []);
    const columns = rawColumns.map(c => ({
      name: c.name,
      dataType: c.dataType || c.type || 'string'
    }));

    // 1. Execute Statistical Profile via Connector
    const profile = await connector.profileDataset({
      name: tableName,
      tableName,
      schemaName,
      columns
    }, options);

    const totalRows = profile.rowCount !== undefined ? profile.rowCount : (profile.totalRows || 0);
    const rawCols = profile.columns || profile.columnProfiles || [];
    const profiledCols = rawCols.map(c => ({
      columnName: c.columnName || c.name,
      dataType: c.dataType || 'string',
      rowCount: c.rowCount !== undefined ? c.rowCount : totalRows,
      nullCount: c.nullCount !== undefined ? c.nullCount : 0,
      missingCount: c.missingCount !== undefined ? c.missingCount : 0,
      explicitNullCount: c.explicitNullCount !== undefined ? c.explicitNullCount : 0,
      nullPercentage: c.nullPercentage !== undefined
        ? c.nullPercentage
        : (totalRows > 0 ? Math.round(((c.nullCount || 0) / totalRows) * 10000) / 100 : 0),
      distinctCount: c.distinctCount !== undefined ? c.distinctCount : 0,
      cardinality: c.cardinality !== undefined ? c.cardinality : (totalRows > 0 ? Math.round(((c.distinctCount || 0) / totalRows) * 10000) / 10000 : 0),
      minValue: c.minValue ?? null,
      maxValue: c.maxValue ?? null,
      meanValue: c.meanValue ?? null,
      medianValue: c.medianValue ?? null,
      stdDevValue: c.stdDevValue ?? null,
      histogram: c.histogram || []
    }));

    // 2. Discover Rules to Execute
    const rulesToExecute = [];
    const existingRuleKeys = new Set();

    // Attach configured rules from MongoDB
    for (const r of configuredRules) {
      const normType = normalizeRuleType(r.ruleType);
      const targetCol = r.targetColumn || r.field;
      rulesToExecute.push({
        _id: r._id,
        name: r.name,
        ruleType: normType,
        originalType: r.ruleType,
        targetColumn: targetCol,
        dimension: (r.dimension || 'validity').toLowerCase(),
        severity: (r.severity || 'medium').toLowerCase(),
        configuration: r.condition || r.configuration || {},
        threshold: r.threshold || 0.95
      });
      existingRuleKeys.add(`${normType}_${targetCol}`);
    }

    // Auto-discover sensible rules if configured rules are scarce
    for (const col of profiledCols) {
      const colName = col.columnName;
      const colLower = colName.toLowerCase();
      const dataType = String(col.dataType || '').toLowerCase();

      // Identifier / PK checks
      const isPk = colLower === 'id' || colLower.endsWith('_id') || (dataset.columns && dataset.columns.some(c => c.name === colName && c.primaryKey));
      if (isPk) {
        if (!existingRuleKeys.has(`NULL_CHECK_${colName}`)) {
          rulesToExecute.push({
            name: `${colName} Identifier Not Null`,
            ruleType: 'NULL_CHECK',
            originalType: 'NOT_NULL',
            targetColumn: colName,
            dimension: 'completeness',
            severity: 'critical',
            configuration: {},
            threshold: 1.0,
            isAutoGenerated: true
          });
          existingRuleKeys.add(`NULL_CHECK_${colName}`);
        }
        if (!existingRuleKeys.has(`UNIQUENESS_${colName}`)) {
          rulesToExecute.push({
            name: `${colName} Identifier Uniqueness`,
            ruleType: 'UNIQUENESS',
            originalType: 'UNIQUE',
            targetColumn: colName,
            dimension: 'uniqueness',
            severity: 'critical',
            configuration: {},
            threshold: 1.0,
            isAutoGenerated: true
          });
          existingRuleKeys.add(`UNIQUENESS_${colName}`);
        }
      }

      // Email Format Check
      if (colLower.includes('email') && !existingRuleKeys.has(`REGEX_PATTERN_${colName}`)) {
        rulesToExecute.push({
          name: `${colName} Email Valid Format`,
          ruleType: 'REGEX_PATTERN',
          originalType: 'REGEX',
          targetColumn: colName,
          dimension: 'validity',
          severity: 'high',
          configuration: { pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' },
          threshold: 0.95,
          isAutoGenerated: true
        });
        existingRuleKeys.add(`REGEX_PATTERN_${colName}`);
      }

      // Non-negative check on amounts, prices, quantities
      const isAmount = ['amount', 'price', 'quantity', 'balance', 'fee', 'cost'].some(term => colLower.includes(term));
      const isNumeric = ['int', 'numeric', 'decimal', 'float', 'double'].some(t => dataType.includes(t));
      if (isAmount && isNumeric && !existingRuleKeys.has(`VALUE_RANGE_${colName}`)) {
        rulesToExecute.push({
          name: `${colName} Non-Negative Value`,
          ruleType: 'VALUE_RANGE',
          originalType: 'RANGE',
          targetColumn: colName,
          dimension: 'validity',
          severity: 'medium',
          configuration: { min: 0 },
          threshold: 0.95,
          isAutoGenerated: true
        });
        existingRuleKeys.add(`VALUE_RANGE_${colName}`);
      }
    }

    // 3. Execute Rules on the Source Database
    const ruleResults = [];
    const failures = [];

    for (const rule of rulesToExecute) {
      try {
        const ruleRes = await connector.executeQualityRule(rule, {
          name: tableName,
          tableName,
          schemaName
        }, options);

        const passPct = ruleRes.passPercentage !== undefined ? ruleRes.passPercentage : (ruleRes.passed ? 100 : 0);
        const passed = ruleRes.passed && passPct >= ((rule.threshold || 0.95) <= 1 ? (rule.threshold || 0.95) * 100 : (rule.threshold || 95));

        const item = {
          ruleId: rule._id ? rule._id.toString() : null,
          ruleName: rule.name,
          ruleType: rule.originalType,
          field: rule.targetColumn,
          dimension: rule.dimension,
          severity: rule.severity,
          passed,
          compliance: Math.round(passPct * 10) / 10,
          failedCount: ruleRes.recordsFailed || 0,
          totalRecords: ruleRes.recordsEvaluated || totalRows,
          message: ruleRes.message,
          evidence: ruleRes.evidenceSummary,
          isAutoGenerated: rule.isAutoGenerated || false
        };

        ruleResults.push(item);

        if (!passed || item.failedCount > 0) {
          failures.push({
            ruleId: rule._id ? rule._id.toString() : null,
            ruleType: rule.originalType,
            field: rule.targetColumn,
            dimension: rule.dimension,
            severity: rule.severity,
            failedCount: item.failedCount,
            totalRecords: item.totalRecords,
            message: item.message || `Rule "${rule.name}" failed: ${item.failedCount}/${item.totalRecords} records violated constraint`,
            evidence: item.evidence
          });
        }
      } catch (ruleErr) {
        ruleResults.push({
          ruleId: rule._id ? rule._id.toString() : null,
          ruleName: rule.name,
          ruleType: rule.originalType,
          field: rule.targetColumn,
          dimension: rule.dimension,
          severity: rule.severity,
          passed: false,
          compliance: 0,
          failedCount: totalRows,
          totalRecords: totalRows,
          message: `Evaluation error: ${ruleErr.message}`,
          error: true
        });
      }
    }

    // 4. Calculate Individual Dimensions

    // Dimension: COMPLETENESS
    // Real calculation: (totalCells - totalNulls) / totalCells
    const totalCells = totalRows * Math.max(profiledCols.length, 1);
    const totalNulls = profiledCols.reduce((acc, col) => acc + (col.nullCount || 0), 0);
    let completenessScore = totalCells > 0
      ? Math.max(0, Math.min(100, Math.round(((totalCells - totalNulls) / totalCells) * 1000) / 10))
      : null;
    let completenessStatus = totalCells > 0 ? 'ASSESSED' : 'NOT_ASSESSED';

    const nullFailingCols = [];
    // Check for column-level null failures
    for (const col of profiledCols) {
      if (col.nullCount > 0 && totalRows > 0) {
        if (col.nullPercentage > 5) {
          const isCritical = col.nullPercentage >= 80;
          const sev = isCritical ? 'critical' : col.nullPercentage >= 30 ? 'high' : 'medium';
          nullFailingCols.push(`${col.columnName} (${col.nullCount}/${totalRows} NULL, ${col.nullPercentage}%)`);
          failures.push({
            ruleId: null,
            ruleType: 'NOT_NULL',
            field: col.columnName,
            column: col.columnName,
            dimension: 'completeness',
            severity: sev,
            failedCount: col.nullCount,
            totalRecords: totalRows,
            score: Math.round(((totalRows - col.nullCount) / totalRows) * 100),
            issue: `Column "${col.columnName}" contains ${col.nullCount}/${totalRows} missing or null values (${col.nullPercentage}%)`,
            message: `Column "${col.columnName}" contains ${col.nullCount}/${totalRows} missing or null values (${col.nullPercentage}%)`,
            evidence: { nullCount: col.nullCount, nonNullCount: totalRows - col.nullCount, totalRows, nullPercentage: col.nullPercentage },
            failureDetails: `High null density detected in column "${col.columnName}": ${col.nullCount} of ${totalRows} rows are NULL (${col.nullPercentage}% missing).`
          });
        }
      }
    }

    const completenessExplanation = nullFailingCols.length > 0
      ? `${totalNulls} of ${totalCells} cells are NULL (${completenessScore}% completeness). Degraded by ${nullFailingCols.join(', ')}.`
      : `All ${profiledCols.length} columns are 100% complete with 0 NULL values across ${totalRows} rows.`;

    // Dimension: UNIQUENESS
    // Real calculation: distinct / total on primary key or identifier columns
    const pkCols = profiledCols.filter(c => {
      const lower = c.columnName.toLowerCase();
      return lower === 'id' || lower.endsWith('_id') || (dataset.columns && dataset.columns.some(dc => dc.name === c.columnName && dc.primaryKey));
    });

    // Also include any columns with explicit UNIQUE rules
    const explicitUniqueRules = ruleResults.filter(r => r.dimension === 'uniqueness');

    let uniquenessScore = null;
    let uniquenessStatus = 'NOT_ASSESSED';
    let uniquenessExplanation = 'Not assessed: No primary key or unique business rules configured.';
    let uniqueFailedCount = 0;
    let uniqueTotalCount = totalRows;

    if (pkCols.length > 0 && totalRows > 0) {
      const uniquenessPercentages = pkCols.map(c => Math.min(100, Math.round(((c.distinctCount || 0) / totalRows) * 1000) / 10));
      uniquenessScore = Math.round(uniquenessPercentages.reduce((a, b) => a + b, 0) / uniquenessPercentages.length);
      uniquenessStatus = 'ASSESSED';

      // Check for duplicate issues on identifier columns
      for (const pkCol of pkCols) {
        const dups = totalRows - (pkCol.distinctCount || 0);
        if (dups > 0) {
          uniqueFailedCount += dups;
          failures.push({
            ruleId: null,
            ruleType: 'UNIQUE',
            field: pkCol.columnName,
            column: pkCol.columnName,
            dimension: 'uniqueness',
            severity: 'critical',
            failedCount: dups,
            totalRecords: totalRows,
            score: uniquenessScore,
            issue: `Identifier column "${pkCol.columnName}" contains ${dups} duplicate records`,
            message: `Identifier column "${pkCol.columnName}" contains ${dups} duplicate records`,
            evidence: { duplicateCount: dups, distinctCount: pkCol.distinctCount, totalRows },
            failureDetails: `Primary key constraint violation on "${pkCol.columnName}": ${dups} duplicate occurrences detected in ${totalRows} records.`
          });
        }
      }

      uniquenessExplanation = uniqueFailedCount > 0
        ? `Primary Key constraint (${pkCols.map(c => c.columnName).join(', ')}) violated: ${uniqueFailedCount} duplicates found.`
        : `Primary Key constraint (${pkCols.map(c => c.columnName).join(', ')}) is 100% unique (${totalRows}/${totalRows} distinct rows). No duplicate primary keys found.`;
    } else if (explicitUniqueRules.length > 0) {
      const avgU = explicitUniqueRules.reduce((sum, r) => sum + r.compliance, 0) / explicitUniqueRules.length;
      uniquenessScore = Math.round(avgU);
      uniquenessStatus = 'ASSESSED';
      uniqueFailedCount = explicitUniqueRules.reduce((sum, r) => sum + (r.failedCount || 0), 0);
      uniquenessExplanation = `Evaluated ${explicitUniqueRules.length} uniqueness rule(s): ${uniquenessScore}% compliance.`;
    }

    // Dimension: VALIDITY
    // Real calculation: average compliance of validity rules (regex, range, enum)
    const validityRules = ruleResults.filter(r => r.dimension === 'validity');
    let validityScore = null;
    let validityStatus = 'NOT_ASSESSED';
    let validityExplanation = 'Not assessed: No data validity rules configured.';
    let validityFailedCount = 0;
    let validityTotalCount = 0;

    if (validityRules.length > 0) {
      const avgVal = validityRules.reduce((sum, r) => sum + r.compliance, 0) / validityRules.length;
      validityScore = Math.round(avgVal);
      validityStatus = 'ASSESSED';
      validityFailedCount = validityRules.reduce((sum, r) => sum + (r.failedCount || 0), 0);
      validityTotalCount = validityRules.reduce((sum, r) => sum + (r.totalRecords || totalRows), 0);
      const failingRules = validityRules.filter(r => !r.passed);
      validityExplanation = failingRules.length > 0
        ? `${validityFailedCount} invalid values detected across ${validityRules.length} rule(s) (${validityScore}% validity). Violations: ${failingRules.map(r => r.ruleName || r.field).join(', ')}.`
        : `All ${validityRules.length} validity rules passed at 100% compliance across tested columns.`;
    }

    // Dimension: TIMELINESS
    // Real calculation: Freshness of timestamp columns against current time
    let timelinessScore = null;
    let timelinessStatus = 'NOT_ASSESSED';
    let timelinessExplanation = 'Not assessed: No timestamp or date columns found for freshness evaluation.';
    let timelinessEvaluatedCols = [];

    const timestampCol = profiledCols.find(c => {
      const lower = c.columnName.toLowerCase();
      return ['updated_at', 'created_at', 'modified_at', 'timestamp', 'event_time'].some(t => lower.includes(t)) ||
        ['timestamp', 'date', 'datetime'].some(t => String(c.dataType).toLowerCase().includes(t));
    });

    if (timestampCol && timestampCol.maxValue) {
      try {
        const latestTime = new Date(timestampCol.maxValue);
        if (!isNaN(latestTime.getTime())) {
          const now = Date.now();
          const ageHours = Math.max(0, (now - latestTime.getTime()) / (1000 * 60 * 60));
          const ageDays = Math.round(ageHours / 24);

          if (ageHours <= 24) timelinessScore = 100;
          else if (ageHours <= 24 * 7) timelinessScore = 85;
          else if (ageHours <= 24 * 30) timelinessScore = 60;
          else if (ageHours <= 24 * 90) timelinessScore = 40;
          else if (ageHours <= 24 * 365) timelinessScore = 20;
          else timelinessScore = 10;

          timelinessStatus = 'ASSESSED';
          timelinessEvaluatedCols = [timestampCol.columnName];

          if (timelinessScore < 70) {
            failures.push({
              ruleId: null,
              ruleType: 'FRESHNESS',
              field: timestampCol.columnName,
              column: timestampCol.columnName,
              dimension: 'timeliness',
              severity: timelinessScore <= 20 ? 'high' : 'medium',
              failedCount: totalRows,
              totalRecords: totalRows,
              score: timelinessScore,
              issue: `Column "${timestampCol.columnName}" data freshness SLA violated (latest record is ${ageDays} days old)`,
              message: `Column "${timestampCol.columnName}" data freshness SLA violated (latest record is ${ageDays} days old)`,
              evidence: { latestTimestamp: timestampCol.maxValue, ageHours: Math.round(ageHours), ageDays, freshnessThreshold: '24 hours', timelinessScore },
              failureDetails: `Data freshness SLA violated on "${timestampCol.columnName}": latest source timestamp is ${timestampCol.maxValue} (${ageDays} days ago). Target SLA is 24 hours.`
            });
          }

          timelinessExplanation = timelinessScore >= 95
            ? `Data is fresh. Latest record in "${timestampCol.columnName}" is within 24-hour SLA (${timestampCol.maxValue}).`
            : `Data freshness SLA violated. Latest record in "${timestampCol.columnName}" is ${ageDays} days old (${timestampCol.maxValue}). Score: ${timelinessScore}%.`;
        }
      } catch {}
    }

    // Dimension: ACCURACY
    // Honest: Only assessed if an explicit truth reference rule exists
    const accuracyRules = ruleResults.filter(r => r.dimension === 'accuracy');
    let accuracyScore = null;
    let accuracyStatus = 'NOT_ASSESSED';
    let accuracyExplanation = 'Not assessed: Requires ground-truth reference dataset or configured reconciliation rule.';
    if (accuracyRules.length > 0) {
      accuracyScore = Math.round(accuracyRules.reduce((sum, r) => sum + r.compliance, 0) / accuracyRules.length);
      accuracyStatus = 'ASSESSED';
      accuracyExplanation = `Evaluated against ${accuracyRules.length} reference accuracy rule(s): ${accuracyScore}% compliance.`;
    }

    // Dimension: CONSISTENCY
    // Honest: Only assessed if foreign key / cross-table rules exist
    const consistencyRules = ruleResults.filter(r => r.dimension === 'consistency');
    let consistencyScore = null;
    let consistencyStatus = 'NOT_ASSESSED';
    let consistencyExplanation = 'Not assessed: No cross-table or foreign-key referential integrity rules configured.';
    if (consistencyRules.length > 0) {
      consistencyScore = Math.round(consistencyRules.reduce((sum, r) => sum + r.compliance, 0) / consistencyRules.length);
      consistencyStatus = 'ASSESSED';
      consistencyExplanation = `Evaluated against ${consistencyRules.length} consistency rule(s): ${consistencyScore}% compliance.`;
    }

    // 5. Overall Quality Score Rollup (Transparent Normalized Policy)
    // Only assessed dimensions contribute to the composite score!
    const dimensionObjects = [
      {
        name: 'Completeness',
        key: 'completeness',
        score: completenessScore,
        status: completenessStatus,
        color: DIM_COLORS.completeness,
        evaluatedColumns: profiledCols.map(c => c.columnName),
        failedCount: totalNulls,
        totalCount: totalCells,
        ruleCount: profiledCols.length,
        rule: 'Column NOT_NULL constraints & completeness threshold (≥ 95%)',
        explanation: completenessExplanation
      },
      {
        name: 'Accuracy',
        key: 'accuracy',
        score: accuracyScore,
        status: accuracyStatus,
        color: DIM_COLORS.accuracy,
        evaluatedColumns: accuracyRules.map(r => r.field),
        failedCount: accuracyRules.filter(r => !r.passed).length,
        totalCount: accuracyRules.length,
        ruleCount: accuracyRules.length,
        rule: 'Ground-truth reference comparison rule',
        explanation: accuracyExplanation
      },
      {
        name: 'Consistency',
        key: 'consistency',
        score: consistencyScore,
        status: consistencyStatus,
        color: DIM_COLORS.consistency,
        evaluatedColumns: consistencyRules.map(r => r.field),
        failedCount: consistencyRules.filter(r => !r.passed).length,
        totalCount: consistencyRules.length,
        ruleCount: consistencyRules.length,
        rule: 'Cross-table referential integrity / foreign key constraints',
        explanation: consistencyExplanation
      },
      {
        name: 'Validity',
        key: 'validity',
        score: validityScore,
        status: validityStatus,
        color: DIM_COLORS.validity,
        evaluatedColumns: validityRules.map(r => r.field),
        failedCount: validityFailedCount,
        totalCount: validityTotalCount || totalRows,
        ruleCount: validityRules.length,
        rule: 'Schema conformance, regex patterns, and numeric ranges',
        explanation: validityExplanation
      },
      {
        name: 'Uniqueness',
        key: 'uniqueness',
        score: uniquenessScore,
        status: uniquenessStatus,
        color: DIM_COLORS.uniqueness,
        evaluatedColumns: pkCols.map(c => c.columnName),
        failedCount: uniqueFailedCount,
        totalCount: uniqueTotalCount,
        ruleCount: pkCols.length + explicitUniqueRules.length,
        rule: 'Primary Key & unique business key constraints (0 duplicates)',
        explanation: uniquenessExplanation
      },
      {
        name: 'Timeliness',
        key: 'timeliness',
        score: timelinessScore,
        status: timelinessStatus,
        color: DIM_COLORS.timeliness,
        evaluatedColumns: timelinessEvaluatedCols,
        failedCount: timelinessScore < 70 ? totalRows : 0,
        totalCount: totalRows,
        ruleCount: timelinessEvaluatedCols.length,
        rule: 'Pipeline freshness SLA (≤ 24 hours)',
        explanation: timelinessExplanation
      },
    ];

    let totalWeightedScore = 0;
    let totalEligibleWeight = 0;

    for (const dim of dimensionObjects) {
      if (dim.status === 'ASSESSED' && dim.score !== null) {
        const weight = DIMENSION_WEIGHTS[dim.key] || 0.1;
        totalWeightedScore += dim.score * weight;
        totalEligibleWeight += weight;
      }
    }

    const compositeScore = totalEligibleWeight > 0
      ? Math.min(100, Math.max(0, Math.round(totalWeightedScore / totalEligibleWeight)))
      : 0;

    const passedRulesCount = ruleResults.filter(r => r.passed).length;

    return {
      success: true,
      score: compositeScore,
      totalRows,
      dimensions: dimensionObjects,
      profile,
      ruleResults,
      failures,
      passedRulesCount,
      totalRulesCount: ruleResults.length,
      evaluatedAt: new Date(),
      sourceSystem: dataSource.name,
      sourceType: dataSource.type
    };
  } finally {
    if (connector) {
      await connector.disconnect().catch(() => {});
    }
  }
}

module.exports = {
  resolveConnector,
  profileAndEvaluate,
  DIMENSION_WEIGHTS,
  DIM_COLORS
};
