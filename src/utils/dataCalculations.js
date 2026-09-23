/**
 * Central Metric Calculation Engine
 * Computes dynamic KPIs, aggregations, and quality indices from primary entities.
 */

import { formatNumber, formatQuality, formatPercentage } from './dataFormatters.js';
import { METRIC_DEFINITIONS } from '../data/metrics.js';
import { DATASET_QUALITY_METRICS } from '../data/quality.js';

/**
 * Total active datasets count
 */
export function calculateTotalDatasets(datasets = []) {
  return datasets.length;
}

/**
 * Average data quality score across all datasets
 */
export function calculateAverageQuality(datasets = []) {
  if (!datasets || datasets.length === 0) return 0;
  const total = datasets.reduce((sum, d) => sum + (Number(d.quality) || 0), 0);
  return Math.round((total / datasets.length) * 10) / 10;
}

/**
 * Total count of policy violations and open high/medium severity issues
 */
export function calculatePolicyViolations(policies = [], issues = []) {
  const policyBreaches = policies.reduce((sum, p) => sum + (Number(p.violationsCount) || 0), 0);
  const openCriticalIssues = issues.filter(
    (i) => i.status !== 'Resolved' && (i.severity === 'High' || i.severity === 'Critical')
  ).length;
  // Total active violations is breaches + unresolved high-severity issues
  return policyBreaches + openCriticalIssues;
}

/**
 * Total active team members
 */
export function calculateActiveUsers(users = []) {
  return users.filter((u) => u.status === 'Active').length;
}

/**
 * Computes the 4 dynamic dashboard metrics cards
 */
export function calculateDashboardMetrics(datasets = [], users = [], policies = [], issues = []) {
  const totalDatasets = calculateTotalDatasets(datasets);
  const avgQuality = calculateAverageQuality(datasets);
  const totalViolations = calculatePolicyViolations(policies, issues);
  const activeUsers = calculateActiveUsers(users);

  // Fallback defaults or dynamic values
  const totalDatasetsDef = METRIC_DEFINITIONS['total-datasets'];
  const dataQualityDef = METRIC_DEFINITIONS['data-quality'];
  const policyViolationsDef = METRIC_DEFINITIONS['policy-violations'];
  const activeUsersDef = METRIC_DEFINITIONS['active-users'];

  return [
    {
      id: 'total-datasets',
      title: 'TOTAL DATASETS',
      value: formatNumber(totalDatasets),
      rawNumber: totalDatasets,
      comparison: '+12.4%',
      trend: 'up',
      isPositive: true,
      description: `Across registered enterprise business domains`,
      sparkline: totalDatasetsDef?.sparkline || [4, 5, 5, 6, 6, totalDatasets]
    },
    {
      id: 'data-quality',
      title: 'DATA QUALITY',
      value: formatQuality(avgQuality),
      rawNumber: avgQuality,
      comparison: '+3.2%',
      trend: 'up',
      isPositive: true,
      description: `Average across ${totalDatasets} monitored datasets`,
      sparkline: dataQualityDef?.sparkline || [88, 89, 90, 91, 92, Math.round(avgQuality)]
    },
    {
      id: 'policy-violations',
      title: 'POLICY VIOLATIONS',
      value: String(totalViolations),
      rawNumber: totalViolations,
      comparison: '-18.6%',
      trend: 'down',
      isPositive: true, // fewer violations is positive
      description: `${issues.filter(i => i.severity === 'High' && i.status !== 'Resolved').length} critical issues under active triage`,
      sparkline: policyViolationsDef?.sparkline || [8, 6, 5, 4, 3, totalViolations]
    },
    {
      id: 'active-users',
      title: 'ACTIVE USERS',
      value: String(activeUsers),
      rawNumber: activeUsers,
      comparison: '+9.1%',
      trend: 'up',
      isPositive: true,
      description: `${users.filter(u => u.role?.toLowerCase().includes('analyst')).length} analysts, ${users.filter(u => u.role?.toLowerCase().includes('engineer')).length} engineers`,
      sparkline: activeUsersDef?.sparkline || [5, 6, 6, 7, 7, activeUsers]
    }
  ];
}

/**
 * Dynamic Data Health Summary dimensions computed from dataset quality
 */
export function calculateDataHealthSummary(datasets = [], qualityMap = DATASET_QUALITY_METRICS) {
  const avgQuality = calculateAverageQuality(datasets);
  
  // Aggregate dimension scores across all registered datasets
  const dimSums = {
    Completeness: { sum: 0, count: 0 },
    Accuracy: { sum: 0, count: 0 },
    Consistency: { sum: 0, count: 0 },
    Uniqueness: { sum: 0, count: 0 },
    Timeliness: { sum: 0, count: 0 }
  };

  Object.values(qualityMap).forEach((record) => {
    record.dimensions?.forEach((dim) => {
      if (dimSums[dim.name]) {
        dimSums[dim.name].sum += dim.score;
        dimSums[dim.name].count += 1;
      }
    });
  });

  const dimensions = [
    { name: 'Completeness', score: Math.round(dimSums.Completeness.sum / (dimSums.Completeness.count || 1)), target: 95 },
    { name: 'Accuracy', score: Math.round(dimSums.Accuracy.sum / (dimSums.Accuracy.count || 1)), target: 90 },
    { name: 'Consistency', score: Math.round(dimSums.Consistency.sum / (dimSums.Consistency.count || 1)), target: 92 },
    { name: 'Uniqueness', score: Math.round(dimSums.Uniqueness.sum / (dimSums.Uniqueness.count || 1)), target: 98 },
    { name: 'Timeliness', score: Math.round(dimSums.Timeliness.sum / (dimSums.Timeliness.count || 1)), target: 95 }
  ];

  let status = 'Excellent';
  if (avgQuality < 80) status = 'Needs Attention';
  else if (avgQuality < 90) status = 'Good';

  return {
    score: Math.round(avgQuality),
    maxScore: 100,
    status,
    trend: '+3% from last month',
    dimensions
  };
}

/**
 * Domain-level statistics aggregator
 */
export function calculateDomainStats(domains = [], datasets = []) {
  return domains.map((domain) => {
    const domainDatasets = datasets.filter((d) => d.domainId === domain.id || d.domain?.toLowerCase() === domain.name?.toLowerCase());
    const count = domainDatasets.length;
    const avgScore = count > 0 ? calculateAverageQuality(domainDatasets) : 0;
    const totalRows = domainDatasets.reduce((sum, d) => sum + (d.statistics?.rowCount || 0), 0);

    return {
      ...domain,
      datasetsCount: count,
      avgQuality: avgScore,
      totalRows
    };
  });
}
