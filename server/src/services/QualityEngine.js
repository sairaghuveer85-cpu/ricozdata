import { Dataset } from '../models/Dataset.js';
import { DataSource } from '../models/DataSource.js';
import { QualityRule } from '../models/QualityRule.js';
import { QualityRun, QUALITY_RUN_STATUSES } from '../models/QualityRun.js';
import { QualityMetricSnapshot } from '../models/QualityMetricSnapshot.js';
import { QualityIssue } from '../models/QualityIssue.js';
import { ConnectorService } from '../connectors/index.js';
import { qualityAlertDispatcher } from './QualityAlertDispatcher.js';
import { Activity } from '../models/Activity.js';
import { logger } from '../utils/logger.js';
import CacheService from './CacheService.js';

// Weight map for deterministic quality scoring
const SEVERITY_WEIGHTS = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

// Concurrency control: Active runs per dataset
const activeDatasetRuns = new Set();

/**
 * Enterprise Data Quality Engine.
 * Executes quality checks via connector layer, calculates deterministic quality scores,
 * creates metric snapshots, dispatches alerts, and manages quality issues.
 */
export class QualityEngine {
  /**
   * Run all active quality rules for a specific dataset.
   * 
   * @param {string} datasetId - Dataset ID
   * @param {string} organizationId - Tenant organization ID
   * @param {Object} [options]
   * @param {Object} [options.actor] - User identity triggering check
   * @returns {Promise<Object>} Completed QualityRun document
   */
  static async runQualityCheck(datasetId, organizationId, options = {}) {
    const lockKey = `${organizationId}:${datasetId}`;
    if (activeDatasetRuns.has(lockKey)) {
      const err = new Error('A quality check is already in progress for this dataset. Please wait a moment.');
      err.statusCode = 429;
      err.code = 'QUALITY_CHECK_IN_PROGRESS';
      throw err;
    }

    // 1. Load tenant-scoped dataset
    const dataset = await Dataset.findOne({
      _id: datasetId,
      organizationId,
      isDeleted: { $ne: true }
    });

    if (!dataset) {
      const err = new Error('Dataset not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    // 2. Validate data source ownership
    const dataSource = await DataSource.findOne({
      _id: dataset.dataSourceId,
      organizationId,
      isDeleted: { $ne: true }
    });

    if (!dataSource) {
      const err = new Error('Underlying data source not found or inaccessible');
      err.statusCode = 404;
      err.code = 'DATA_SOURCE_NOT_FOUND';
      throw err;
    }

    // 3. Load active rules
    const rules = await QualityRule.find({
      datasetId,
      organizationId,
      status: 'ACTIVE',
      enabled: true
    }).sort({ createdAt: 1 });

    if (rules.length === 0) {
      const err = new Error('No active quality rules defined for this dataset. Please create at least one quality rule to evaluate data quality.');
      err.statusCode = 400;
      err.code = 'NO_RULES_CONFIGURED';
      throw err;
    }

    const actorId = options.actor?._id || options.actor?.userId || null;
    const startHr = process.hrtime.bigint();
    const startedAt = new Date();

    // 4. Initialize QualityRun record
    const qualityRun = await QualityRun.create({
      organizationId,
      datasetId,
      dataSourceId: dataSource._id,
      status: QUALITY_RUN_STATUSES.RUNNING,
      startedAt,
      triggeredBy: actorId
    });

    activeDatasetRuns.add(lockKey);

    try {
      const results = [];
      let totalPassedRules = 0;
      let totalFailedRules = 0;
      let maxRecordsEvaluated = 0;

      // Groupings for dimension metrics
      const dimensionScores = {
        completeness: [],
        uniqueness: [],
        validity: [],
        consistency: [],
        integrity: []
      };

      let totalWeightedScore = 0;
      let totalWeight = 0;

      // 5. Execute each rule through the connector
      for (const rule of rules) {
        let ruleResult;
        try {
          ruleResult = await ConnectorService.executeQualityRule(
            dataSource._id,
            organizationId,
            rule,
            dataset,
            { timeoutMs: 25000 }
          );
        } catch (ruleErr) {
          logger.warn(`[QualityEngine] Rule evaluation error on rule "${rule.name}":`, ruleErr.message);
          ruleResult = {
            ruleId: rule._id,
            ruleName: rule.name,
            ruleType: rule.ruleType,
            severity: rule.severity,
            targetColumn: rule.targetColumn,
            targetColumns: rule.targetColumns,
            passed: false,
            recordsEvaluated: 0,
            recordsPassed: 0,
            recordsFailed: 0,
            passPercentage: 0,
            message: `Execution failed: ${ruleErr.message}`,
            evidenceSummary: null,
            executionDurationMs: 0
          };
        }

        results.push(ruleResult);

        if (ruleResult.passed) {
          totalPassedRules++;
        } else {
          totalFailedRules++;

          // Step 25: Auto-create or track QualityIssue
          try {
            const existingIssue = await QualityIssue.findOne({
              organizationId,
              datasetId,
              ruleId: rule._id,
              status: { $in: ['OPEN', 'IN_REVIEW'] }
            });

            if (!existingIssue) {
              const newIssue = await QualityIssue.create({
                organizationId,
                datasetId,
                ruleId: rule._id,
                qualityRunId: qualityRun._id,
                severity: rule.severity,
                status: 'OPEN',
                title: `Quality violation: ${rule.name}`,
                description: ruleResult.message || `Rule ${rule.name} failed quality evaluation`,
                affectedColumn: ruleResult.targetColumn,
                affectedRowsCount: ruleResult.recordsFailed,
                evidenceSummary: ruleResult.evidenceSummary
              });

              await qualityAlertDispatcher.dispatch({
                event: 'quality.issue.created',
                organizationId,
                actorId,
                datasetId,
                issueId: newIssue._id,
                metadata: {
                  ruleName: rule.name,
                  severity: rule.severity,
                  affectedColumn: ruleResult.targetColumn,
                  affectedRowsCount: ruleResult.recordsFailed
                }
              });
            } else {
              // Update existing issue with latest evidence
              existingIssue.affectedRowsCount = ruleResult.recordsFailed;
              existingIssue.evidenceSummary = ruleResult.evidenceSummary;
              existingIssue.qualityRunId = qualityRun._id;
              await existingIssue.save();
            }
          } catch (issueErr) {
            logger.warn('[QualityEngine] Failed to manage QualityIssue:', issueErr.message);
          }
        }

        if (ruleResult.recordsEvaluated > maxRecordsEvaluated) {
          maxRecordsEvaluated = ruleResult.recordsEvaluated;
        }

        // Deterministic scoring calculation
        const weight = SEVERITY_WEIGHTS[rule.severity] || 2;
        const rulePassRate = ruleResult.passPercentage !== undefined
          ? ruleResult.passPercentage
          : (ruleResult.passed ? 100 : 0);

        totalWeightedScore += rulePassRate * weight;
        totalWeight += weight;

        // Group into quality dimensions
        switch (rule.ruleType) {
          case 'NULL_CHECK':
            dimensionScores.completeness.push(rulePassRate);
            break;
          case 'UNIQUENESS':
            dimensionScores.uniqueness.push(rulePassRate);
            break;
          case 'REGEX_PATTERN':
          case 'VALUE_RANGE':
            dimensionScores.validity.push(rulePassRate);
            break;
          case 'CUSTOM_SQL':
            dimensionScores.consistency.push(rulePassRate);
            break;
          case 'REFERENCE_INTEGRITY':
            dimensionScores.integrity.push(rulePassRate);
            break;
          default:
            break;
        }
      }

      // Calculate final deterministic quality score (0 - 100)
      let overallScore = 100;
      if (rules.length > 0 && totalWeight > 0) {
        overallScore = Math.round((totalWeightedScore / totalWeight) * 100) / 100;
      }

      // Calculate normalized dimension metrics (only for evaluated dimensions)
      const avg = (arr) => arr.length > 0
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
        : null;

      const metrics = {
        completeness: avg(dimensionScores.completeness),
        uniqueness: avg(dimensionScores.uniqueness),
        validity: avg(dimensionScores.validity),
        consistency: avg(dimensionScores.consistency),
        integrity: avg(dimensionScores.integrity)
      };

      const endHr = process.hrtime.bigint();
      const executionDurationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;
      const completedAt = new Date();

      // 6. Persist metric snapshot for historical tracking
      await QualityMetricSnapshot.create({
        organizationId,
        datasetId,
        qualityRunId: qualityRun._id,
        score: overallScore,
        metrics,
        rulesSummary: {
          total: rules.length,
          passed: totalPassedRules,
          failed: totalFailedRules
        },
        recordsEvaluated: maxRecordsEvaluated,
        timestamp: completedAt
      });

      // 7. Check for score degradation alert
      const previousScore = dataset.qualityScore?.score;
      if (previousScore !== null && previousScore !== undefined && overallScore < previousScore) {
        await qualityAlertDispatcher.dispatch({
          event: 'quality.score.degraded',
          organizationId,
          actorId,
          datasetId,
          metadata: {
            previousScore,
            newScore: overallScore,
            degradation: Math.round((previousScore - overallScore) * 100) / 100
          }
        });
      }

      // 8. Update Dataset qualityScore metadata
      dataset.qualityScore = {
        score: overallScore,
        lastEvaluatedAt: completedAt
      };
      await dataset.save();

      // 9. Update QualityRun
      qualityRun.status = QUALITY_RUN_STATUSES.SUCCESS;
      qualityRun.completedAt = completedAt;
      qualityRun.executionDurationMs = executionDurationMs;
      qualityRun.rulesEvaluated = rules.length;
      qualityRun.passedRules = totalPassedRules;
      qualityRun.failedRules = totalFailedRules;
      qualityRun.recordsEvaluated = maxRecordsEvaluated;
      qualityRun.score = overallScore;
      qualityRun.metrics = metrics;
      qualityRun.results = results;
      await qualityRun.save();

      // 10. Audit log activity
      try {
        await Activity.create({
          organizationId,
          actorId: actorId || organizationId,
          action: 'quality_check.completed',
          entityType: 'dataset',
          entityId: dataset._id,
          metadata: {
            datasetName: dataset.name,
            score: overallScore,
            rulesEvaluated: rules.length,
            passedRules: totalPassedRules,
            failedRules: totalFailedRules,
            durationMs: executionDurationMs
          }
        });
      } catch (actErr) {
        logger.warn('[QualityEngine] Failed to record quality_check.completed audit:', actErr.message);
      }

      await CacheService.invalidateDashboard(organizationId);

      return qualityRun;
    } catch (runErr) {
      const endHr = process.hrtime.bigint();
      const executionDurationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      qualityRun.status = QUALITY_RUN_STATUSES.FAILED;
      qualityRun.completedAt = new Date();
      qualityRun.executionDurationMs = executionDurationMs;
      qualityRun.error = {
        code: runErr.code || 'QUALITY_RUN_FAILED',
        message: runErr.message || 'Execution error'
      };
      await qualityRun.save();

      throw runErr;
    } finally {
      activeDatasetRuns.delete(lockKey);
    }
  }
}

export default QualityEngine;
