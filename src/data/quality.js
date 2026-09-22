export const QUALITY_OVERVIEW = {
  score: 98,
  grade: 'Excellent',
  trendText: '+ 3% from last month',
  dimensions: [
    { name: 'Completeness', score: 99, color: '#10b981' },
    { name: 'Accuracy', score: 96, color: '#10b981' },
    { name: 'Consistency', score: 97, color: '#10b981' },
    { name: 'Uniqueness', score: 100, color: '#10b981' },
    { name: 'Timeliness', score: 98, color: '#10b981' }
  ]
};

export const QUALITY_ISSUES = [
  {
    id: 'iss-1',
    issue: 'Missing values',
    column: 'email',
    severity: 'High',
    count: 1234,
    status: 'Open',
    detectedAt: '2 hours ago',
    ruleViolated: 'Mandatory Non-Null Primary Email'
  },
  {
    id: 'iss-2',
    issue: 'Duplicate records',
    column: 'customer_id',
    severity: 'Medium',
    count: 567,
    status: 'In Progress',
    detectedAt: '5 hours ago',
    ruleViolated: 'Primary Key Uniqueness'
  },
  {
    id: 'iss-3',
    issue: 'Invalid format',
    column: 'phone_number',
    severity: 'Medium',
    count: 432,
    status: 'Open',
    detectedAt: '1 day ago',
    ruleViolated: 'E.164 Phone Number Standard'
  },
  {
    id: 'iss-4',
    issue: 'Out of range values',
    column: 'age',
    severity: 'Low',
    count: 210,
    status: 'Resolved',
    detectedAt: '3 days ago',
    ruleViolated: 'Age Range [18, 120]'
  }
];

export const QUALITY_TRENDS = [
  { month: 'Apr', score: 82, target: 90, completeness: 88, accuracy: 80 },
  { month: 'May', score: 80, target: 90, completeness: 87, accuracy: 78 },
  { month: 'Jun', score: 86, target: 90, completeness: 91, accuracy: 84 },
  { month: 'Jul', score: 84, target: 90, completeness: 89, accuracy: 82 },
  { month: 'Aug', score: 89, target: 90, completeness: 94, accuracy: 88 },
  { month: 'Sep', score: 92, target: 90, completeness: 98, accuracy: 96 }
];
