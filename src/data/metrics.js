/**
 * Metric definitions, target thresholds, and historical sparkline points.
 * Serves as the central registry for KPI calculation semantics.
 */

export const METRIC_DEFINITIONS = {
  'total-datasets': {
    id: 'total-datasets',
    title: 'TOTAL DATASETS',
    description: 'Across registered enterprise business domains',
    unit: 'count',
    target: 10,
    calculation: 'count(datasets)',
    sparkline: [4, 5, 5, 6, 6, 6]
  },
  'data-quality': {
    id: 'data-quality',
    title: 'DATA QUALITY',
    description: 'Weighted average across automated test dimensions',
    unit: 'percentage',
    target: 95.0,
    calculation: 'avg(datasets.quality)',
    sparkline: [88.4, 89.2, 90.1, 91.5, 92.1, 92.7]
  },
  'policy-violations': {
    id: 'policy-violations',
    title: 'POLICY VIOLATIONS',
    description: 'Active compliance breaches and high-severity data issues',
    unit: 'count',
    target: 0,
    calculation: 'sum(policies.violationsCount) + count(issues.severity == "High")',
    sparkline: [8, 7, 6, 5, 4, 3]
  },
  'active-users': {
    id: 'active-users',
    title: 'ACTIVE USERS',
    description: 'Authenticated team members active within 24h',
    unit: 'count',
    target: 15,
    calculation: 'count(users.status == "Active")',
    sparkline: [5, 6, 6, 7, 7, 7]
  }
};

export const METRIC_BENCHMARKS = {
  qualityThresholds: {
    excellent: 95,
    good: 90,
    fair: 80,
    poor: 0
  },
  slaTargetPercentage: 99.5
};
