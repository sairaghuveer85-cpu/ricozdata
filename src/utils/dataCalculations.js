/**
 * Central Metric Calculation Engine
 * Computes dynamic KPIs, aggregations, and quality indices from primary entities.
 */

import { formatNumber, formatQuality, formatPercentage } from './dataFormatters.js';

/**
 * Total active datasets count
 */
export function calculateTotalDatasets(datasets = []) {
  return Array.isArray(datasets) ? datasets.length : 0;
}

/**
 * Average data quality score across all datasets
 */
export function calculateAverageQuality(datasets = []) {
  if (!Array.isArray(datasets) || datasets.length === 0) return 0;
  const scored = datasets.filter(d => (d.qualityScore != null || d.quality != null));
  if (scored.length === 0) return 0;
  const total = scored.reduce((sum, d) => sum + (Number(d.qualityScore ?? d.quality) || 0), 0);
  return Math.round((total / scored.length) * 10) / 10;
}

/**
 * Total count of policy violations and open high/medium severity issues
 */
export function calculatePolicyViolations(policies = [], issues = []) {
  const policyBreaches = Array.isArray(policies) ? policies.reduce((sum, p) => sum + (Number(p.violationsCount) || 0), 0) : 0;
  const openCriticalIssues = Array.isArray(issues) ? issues.filter(
    (i) => {
      const s = (i.status || '').toLowerCase();
      const sev = (i.severity || '').toLowerCase();
      return s !== 'resolved' && s !== 'ignored' && (sev === 'high' || sev === 'critical');
    }
  ).length : 0;
  return policyBreaches + openCriticalIssues;
}

/**
 * Total active team members
 */
export function calculateActiveUsers(users = []) {
  if (!Array.isArray(users)) return 0;
  return users.filter((u) => (u.status || '').toLowerCase() === 'active').length;
}

/**
 * Computes the 4 dynamic dashboard metrics cards strictly from real records
 */
export function calculateDashboardMetrics(datasets = [], users = [], policies = [], issues = []) {
  const totalDatasets = calculateTotalDatasets(datasets);
  const avgQuality = calculateAverageQuality(datasets);
  const totalViolations = calculatePolicyViolations(policies, issues);
  const activeUsers = calculateActiveUsers(users);

  const analystsCount = Array.isArray(users) ? users.filter(u => u.role?.toLowerCase().includes('analyst')).length : 0;
  const engineersCount = Array.isArray(users) ? users.filter(u => u.role?.toLowerCase().includes('engineer')).length : 0;
  const openIssuesCount = Array.isArray(issues) ? issues.filter(i => (i.status || '').toLowerCase() !== 'resolved').length : 0;

  return [
    {
      id: 'total-datasets',
      title: 'TOTAL DATASETS',
      value: formatNumber(totalDatasets),
      rawNumber: totalDatasets,
      comparison: totalDatasets > 0 ? `${totalDatasets} active` : '0 cataloged',
      trend: 'up',
      isPositive: totalDatasets > 0,
      description: `Across registered enterprise business domains`,
      sparkline: [Math.max(0, totalDatasets - 2), Math.max(0, totalDatasets - 1), totalDatasets]
    },
    {
      id: 'data-quality',
      title: 'DATA QUALITY',
      value: avgQuality > 0 ? formatQuality(avgQuality) : 'N/A',
      rawNumber: avgQuality,
      comparison: avgQuality >= 85 ? 'Within SLA' : avgQuality > 0 ? 'Needs Attention' : 'No Scans',
      trend: avgQuality >= 80 ? 'up' : 'down',
      isPositive: avgQuality >= 80,
      description: totalDatasets > 0 ? `Average across ${totalDatasets} cataloged datasets` : 'No monitored datasets',
      sparkline: avgQuality > 0 ? [Math.max(0, Math.round(avgQuality - 2)), Math.max(0, Math.round(avgQuality - 1)), Math.round(avgQuality)] : [0, 0, 0]
    },
    {
      id: 'policy-violations',
      title: 'POLICY VIOLATIONS',
      value: String(totalViolations),
      rawNumber: totalViolations,
      comparison: totalViolations === 0 ? 'Zero breaches' : `${totalViolations} open`,
      trend: totalViolations === 0 ? 'down' : 'up',
      isPositive: totalViolations === 0,
      description: `${openIssuesCount} active issues under triage`,
      sparkline: [Math.max(0, totalViolations + 1), totalViolations, totalViolations]
    },
    {
      id: 'active-users',
      title: 'ACTIVE USERS',
      value: String(activeUsers),
      rawNumber: activeUsers,
      comparison: `${activeUsers} registered`,
      trend: 'up',
      isPositive: activeUsers > 0,
      description: analystsCount > 0 || engineersCount > 0 ? `${analystsCount} analysts, ${engineersCount} engineers` : `${activeUsers} platform users`,
      sparkline: [Math.max(0, activeUsers - 1), activeUsers, activeUsers]
    }
  ];
}

/**
 * Dynamic Data Health Summary dimensions computed from dataset quality
 */
export function calculateDataHealthSummary(datasets = [], qualityMap = {}) {
  const avgQuality = calculateAverageQuality(datasets);
  
  // Aggregate dimension scores across all registered datasets
  const dimSums = {
    Completeness: { sum: 0, count: 0 },
    Accuracy: { sum: 0, count: 0 },
    Consistency: { sum: 0, count: 0 },
    Uniqueness: { sum: 0, count: 0 },
    Timeliness: { sum: 0, count: 0 }
  };

  if (qualityMap && typeof qualityMap === 'object') {
    Object.values(qualityMap).forEach((record) => {
      record?.dimensions?.forEach((dim) => {
        if (dimSums[dim.name]) {
          dimSums[dim.name].sum += dim.score;
          dimSums[dim.name].count += 1;
        }
      });
    });
  }

  // Also accumulate from datasets that have dimension fields
  if (Array.isArray(datasets)) {
    datasets.forEach((ds) => {
      if (Array.isArray(ds.dimensions)) {
        ds.dimensions.forEach((dim) => {
          if (dimSums[dim.name]) {
            dimSums[dim.name].sum += dim.score;
            dimSums[dim.name].count += 1;
          }
        });
      }
    });
  }

  const baseScore = avgQuality > 0 ? Math.round(avgQuality) : 0;
  const dimensions = [
    { name: 'Completeness', score: dimSums.Completeness.count > 0 ? Math.round(dimSums.Completeness.sum / dimSums.Completeness.count) : baseScore, target: 95 },
    { name: 'Accuracy', score: dimSums.Accuracy.count > 0 ? Math.round(dimSums.Accuracy.sum / dimSums.Accuracy.count) : baseScore, target: 90 },
    { name: 'Consistency', score: dimSums.Consistency.count > 0 ? Math.round(dimSums.Consistency.sum / dimSums.Consistency.count) : baseScore, target: 92 },
    { name: 'Uniqueness', score: dimSums.Uniqueness.count > 0 ? Math.round(dimSums.Uniqueness.sum / dimSums.Uniqueness.count) : baseScore, target: 98 },
    { name: 'Timeliness', score: dimSums.Timeliness.count > 0 ? Math.round(dimSums.Timeliness.sum / dimSums.Timeliness.count) : baseScore, target: 90 }
  ];

  let status = 'Excellent';
  if (avgQuality === 0) status = 'No Data';
  else if (avgQuality < 80) status = 'Needs Attention';
  else if (avgQuality < 90) status = 'Good';

  return {
    score: Math.round(avgQuality),
    reliabilityIndex: Math.round(avgQuality),
    maxScore: 100,
    status,
    trend: avgQuality >= 80 ? 'Within operational target' : 'Needs attention',
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
