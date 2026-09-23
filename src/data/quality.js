export const DATASET_QUALITY_METRICS = {
  'customer-database': {
    datasetId: 'customer-database',
    score: 98,
    grade: 'Excellent',
    trendText: '+3% from last month',
    trendDirection: 'up',
    passedRulesCount: 42,
    totalRulesCount: 44,
    dimensions: [
      { name: 'Completeness', score: 99, color: '#10b981' },
      { name: 'Accuracy', score: 96, color: '#10b981' },
      { name: 'Consistency', score: 97, color: '#10b981' },
      { name: 'Uniqueness', score: 100, color: '#10b981' },
      { name: 'Timeliness', score: 98, color: '#10b981' }
    ],
    lastScanned: '2026-09-16T14:30:00Z'
  },
  'sales-analytics': {
    datasetId: 'sales-analytics',
    score: 91,
    grade: 'Good',
    trendText: '+1.5% from last month',
    trendDirection: 'up',
    passedRulesCount: 38,
    totalRulesCount: 40,
    dimensions: [
      { name: 'Completeness', score: 93, color: '#10b981' },
      { name: 'Accuracy', score: 90, color: '#3b82f6' },
      { name: 'Consistency', score: 92, color: '#10b981' },
      { name: 'Uniqueness', score: 95, color: '#10b981' },
      { name: 'Timeliness', score: 86, color: '#f59e0b' }
    ],
    lastScanned: '2026-09-13T02:15:00Z'
  },
  'product-data': {
    datasetId: 'product-data',
    score: 88,
    grade: 'Fair',
    trendText: '-2% from last month',
    trendDirection: 'down',
    passedRulesCount: 26,
    totalRulesCount: 30,
    dimensions: [
      { name: 'Completeness', score: 89, color: '#3b82f6' },
      { name: 'Accuracy', score: 86, color: '#f59e0b' },
      { name: 'Consistency', score: 87, color: '#f59e0b' },
      { name: 'Uniqueness', score: 92, color: '#10b981' },
      { name: 'Timeliness', score: 85, color: '#f59e0b' }
    ],
    lastScanned: '2026-09-09T18:05:00Z'
  },
  'employee-records': {
    datasetId: 'employee-records',
    score: 95,
    grade: 'Excellent',
    trendText: 'Stable',
    trendDirection: 'neutral',
    passedRulesCount: 28,
    totalRulesCount: 29,
    dimensions: [
      { name: 'Completeness', score: 97, color: '#10b981' },
      { name: 'Accuracy', score: 96, color: '#10b981' },
      { name: 'Consistency', score: 94, color: '#10b981' },
      { name: 'Uniqueness', score: 98, color: '#10b981' },
      { name: 'Timeliness', score: 92, color: '#10b981' }
    ],
    lastScanned: '2026-09-15T00:10:00Z'
  },
  'finance-transactions': {
    datasetId: 'finance-transactions',
    score: 89,
    grade: 'Fair',
    trendText: '+4% from last month',
    trendDirection: 'up',
    passedRulesCount: 46,
    totalRulesCount: 52,
    dimensions: [
      { name: 'Completeness', score: 91, color: '#3b82f6' },
      { name: 'Accuracy', score: 88, color: '#f59e0b' },
      { name: 'Consistency', score: 90, color: '#3b82f6' },
      { name: 'Uniqueness', score: 92, color: '#10b981' },
      { name: 'Timeliness', score: 84, color: '#f59e0b' }
    ],
    lastScanned: '2026-09-12T06:20:00Z'
  },
  'marketing-campaigns': {
    datasetId: 'marketing-campaigns',
    score: 92,
    grade: 'Good',
    trendText: '+2% from last month',
    trendDirection: 'up',
    passedRulesCount: 31,
    totalRulesCount: 33,
    dimensions: [
      { name: 'Completeness', score: 94, color: '#10b981' },
      { name: 'Accuracy', score: 91, color: '#3b82f6' },
      { name: 'Consistency', score: 93, color: '#10b981' },
      { name: 'Uniqueness', score: 95, color: '#10b981' },
      { name: 'Timeliness', score: 89, color: '#3b82f6' }
    ],
    lastScanned: '2026-09-14T11:50:00Z'
  }
};

export const QUALITY_ISSUES = [
  {
    id: 'iss-1',
    datasetId: 'customer-database',
    datasetName: 'Customer Database',
    issue: 'Missing values',
    column: 'email',
    severity: 'High',
    count: 1234,
    status: 'Open',
    detectedAt: '2 hours ago',
    ruleViolated: 'Mandatory Non-Null Primary Email',
    assignedToId: 'user-002',
    assignedTo: 'Priya S.'
  },
  {
    id: 'iss-2',
    datasetId: 'customer-database',
    datasetName: 'Customer Database',
    issue: 'Duplicate records',
    column: 'customer_id',
    severity: 'Medium',
    count: 567,
    status: 'In Progress',
    detectedAt: '5 hours ago',
    ruleViolated: 'Primary Key Uniqueness',
    assignedToId: 'user-002',
    assignedTo: 'Priya S.'
  },
  {
    id: 'iss-3',
    datasetId: 'customer-database',
    datasetName: 'Customer Database',
    issue: 'Invalid format',
    column: 'phone_number',
    severity: 'Medium',
    count: 432,
    status: 'Open',
    detectedAt: '1 day ago',
    ruleViolated: 'E.164 Phone Number Standard',
    assignedToId: 'user-001',
    assignedTo: 'Raghuveer C.'
  },
  {
    id: 'iss-4',
    datasetId: 'customer-database',
    datasetName: 'Customer Database',
    issue: 'Out of range values',
    column: 'age',
    severity: 'Low',
    count: 210,
    status: 'Resolved',
    detectedAt: '3 days ago',
    ruleViolated: 'Age Range [18, 120]',
    assignedToId: 'user-001',
    assignedTo: 'Raghuveer C.'
  },
  {
    id: 'iss-5',
    datasetId: 'sales-analytics',
    datasetName: 'Sales Analytics',
    issue: 'Unmapped territory codes',
    column: 'region',
    severity: 'Medium',
    count: 840,
    status: 'Open',
    detectedAt: '1 day ago',
    ruleViolated: 'ISO Territory Code Standard',
    assignedToId: 'user-003',
    assignedTo: 'Arjun K.'
  },
  {
    id: 'iss-6',
    datasetId: 'product-data',
    datasetName: 'Product Data',
    issue: 'Negative stock balance',
    column: 'inventory_count',
    severity: 'High',
    count: 125,
    status: 'In Progress',
    detectedAt: '4 hours ago',
    ruleViolated: 'Non-Negative Inventory Constraint',
    assignedToId: 'user-004',
    assignedTo: 'Neha R.'
  },
  {
    id: 'iss-7',
    datasetId: 'finance-transactions',
    datasetName: 'Finance Transactions',
    issue: 'Unreconciled ledger discrepancy',
    column: 'amount',
    severity: 'High',
    count: 42,
    status: 'Open',
    detectedAt: '6 hours ago',
    ruleViolated: 'Double-Entry Zero Balance Check',
    assignedToId: 'user-006',
    assignedTo: 'Kavya S.'
  },
  {
    id: 'iss-8',
    datasetId: 'marketing-campaigns',
    datasetName: 'Marketing Campaigns',
    issue: 'Zero conversion tracking anomaly',
    column: 'conversions',
    severity: 'Low',
    count: 18,
    status: 'Resolved',
    detectedAt: '2 days ago',
    ruleViolated: 'Pixel Event Hearthbeat Rule',
    assignedToId: 'user-007',
    assignedTo: 'Rohan P.'
  }
];

export const QUALITY_RULES = [
  {
    id: 'rule-01',
    datasetId: 'customer-database',
    name: 'Mandatory Non-Null Primary Email',
    dimension: 'Completeness',
    threshold: 99.5,
    severity: 'High',
    enabled: true,
    lastStatus: 'Failed'
  },
  {
    id: 'rule-02',
    datasetId: 'customer-database',
    name: 'Primary Key Uniqueness',
    dimension: 'Uniqueness',
    threshold: 100.0,
    severity: 'Critical',
    enabled: true,
    lastStatus: 'Failed'
  },
  {
    id: 'rule-03',
    datasetId: 'customer-database',
    name: 'E.164 Phone Number Standard',
    dimension: 'Accuracy',
    threshold: 98.0,
    severity: 'Medium',
    enabled: true,
    lastStatus: 'Failed'
  },
  {
    id: 'rule-04',
    datasetId: 'customer-database',
    name: 'Age Range [18, 120]',
    dimension: 'Consistency',
    threshold: 99.0,
    severity: 'Low',
    enabled: true,
    lastStatus: 'Passed'
  },
  {
    id: 'rule-05',
    datasetId: 'sales-analytics',
    name: 'ISO Territory Code Standard',
    dimension: 'Consistency',
    threshold: 99.0,
    severity: 'Medium',
    enabled: true,
    lastStatus: 'Failed'
  },
  {
    id: 'rule-06',
    datasetId: 'product-data',
    name: 'Non-Negative Inventory Constraint',
    dimension: 'Accuracy',
    threshold: 100.0,
    severity: 'High',
    enabled: true,
    lastStatus: 'Failed'
  },
  {
    id: 'rule-07',
    datasetId: 'finance-transactions',
    name: 'Double-Entry Zero Balance Check',
    dimension: 'Accuracy',
    threshold: 100.0,
    severity: 'Critical',
    enabled: true,
    lastStatus: 'Failed'
  }
];

// Fallback/aggregated overview for global catalog views
export const QUALITY_OVERVIEW = {
  score: 93,
  grade: 'Excellent',
  trendText: '+2.8% from last month',
  dimensions: [
    { name: 'Completeness', score: 96, color: '#10b981' },
    { name: 'Accuracy', score: 92, color: '#10b981' },
    { name: 'Consistency', score: 94, color: '#10b981' },
    { name: 'Uniqueness', score: 97, color: '#10b981' },
    { name: 'Timeliness', score: 90, color: '#10b981' }
  ]
};

export const QUALITY_TRENDS = [
  { month: 'Apr', score: 82, target: 90, completeness: 88, accuracy: 80 },
  { month: 'May', score: 80, target: 90, completeness: 87, accuracy: 78 },
  { month: 'Jun', score: 86, target: 90, completeness: 91, accuracy: 84 },
  { month: 'Jul', score: 84, target: 90, completeness: 89, accuracy: 82 },
  { month: 'Aug', score: 89, target: 90, completeness: 94, accuracy: 88 },
  { month: 'Sep', score: 93, target: 90, completeness: 96, accuracy: 92 }
];
