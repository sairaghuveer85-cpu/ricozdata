export const INITIAL_ACTIVITIES = [
  {
    id: 'act-1',
    title: 'Sales Data updated',
    time: '2 minutes ago',
    type: 'update',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    actorId: 'user-003',
    user: 'Arjun K.',
    datasetId: 'sales-analytics',
    target: 'Sales Analytics'
  },
  {
    id: 'act-2',
    title: 'New dataset added',
    time: '15 minutes ago',
    type: 'create',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
    actorId: 'user-007',
    user: 'Rohan P.',
    datasetId: 'marketing-campaigns',
    target: 'Marketing Campaigns'
  },
  {
    id: 'act-3',
    title: 'Policy violation detected',
    time: '1 hour ago',
    type: 'alert',
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-50',
    actorId: 'system-guard',
    user: 'System Guard',
    policyId: 'pol-1',
    datasetId: 'customer-database',
    target: 'PII Data Access'
  },
  {
    id: 'act-4',
    title: 'User access granted',
    time: '2 hours ago',
    type: 'access',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50',
    actorId: 'user-005',
    user: 'Vikram M.',
    datasetId: 'customer-database',
    target: 'Customer Database'
  },
  {
    id: 'act-5',
    title: 'Lineage updated',
    time: '3 hours ago',
    type: 'lineage',
    iconColor: 'text-cyan-500',
    iconBg: 'bg-cyan-50',
    actorId: 'pipeline-worker',
    user: 'Data Pipeline Worker',
    datasetId: 'customer-database',
    target: 'ETL Pipeline'
  },
  {
    id: 'act-6',
    title: 'Quality check passed with 98% score',
    time: '5 hours ago',
    type: 'quality',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    actorId: 'system-guard',
    user: 'Automated Test Runner',
    datasetId: 'customer-database',
    target: 'Customer Database'
  }
];

export const getActivitiesForDataset = (datasetId, activities = INITIAL_ACTIVITIES) => {
  return activities.filter(a => a.datasetId === datasetId);
};
