export const DASHBOARD_METRICS = [
  {
    id: 'total-datasets',
    title: 'TOTAL DATASETS',
    value: '1,248',
    comparison: '+12.4%',
    trend: 'up',
    isPositive: true,
    description: 'Across 8 enterprise domains',
    sparkline: [1080, 1120, 1150, 1180, 1210, 1248]
  },
  {
    id: 'data-quality',
    title: 'DATA QUALITY',
    value: '92.4%',
    comparison: '+3.2%',
    trend: 'up',
    isPositive: true,
    description: 'Calculated from 142 automated validation rules',
    sparkline: [86.2, 88.0, 87.5, 89.1, 91.2, 92.4]
  },
  {
    id: 'policy-violations',
    title: 'POLICY VIOLATIONS',
    value: '36',
    comparison: '-18.6%',
    trend: 'down',
    isPositive: true, // down in violations is positive!
    description: '8 critical, 28 warnings under active triage',
    sparkline: [54, 49, 46, 42, 39, 36]
  },
  {
    id: 'active-users',
    title: 'ACTIVE USERS',
    value: '24',
    comparison: '+9.1%',
    trend: 'up',
    isPositive: true,
    description: '18 data analysts, 6 platform engineers',
    sparkline: [18, 19, 21, 22, 23, 24]
  }
];

export const DATA_HEALTH_SUMMARY = {
  score: 98,
  maxScore: 100,
  status: 'Excellent',
  trend: '+3% from last month',
  dimensions: [
    { name: 'Completeness', score: 99, target: 95 },
    { name: 'Accuracy', score: 96, target: 90 },
    { name: 'Consistency', score: 97, target: 92 },
    { name: 'Uniqueness', score: 100, target: 98 },
    { name: 'Timeliness', score: 98, target: 95 }
  ]
};

export const EXECUTIVE_INSIGHT = {
  headline: 'Executive Insight',
  text: 'Data quality improved 3.2% this month, while unresolved policy violations decreased by 18.6%. All critical ingestion pipelines are meeting SLA guarantees.',
  generatedAt: 'Updated 2 hours ago'
};
