export const INITIAL_GLOSSARY_TERMS = [
  {
    id: 'term-1',
    term: 'Active Customer',
    definition: 'A customer who has made at least one transaction or authenticated session event within the past 90 days.',
    domainId: 'customer',
    domain: 'Marketing',
    ownerId: 'user-002',
    owner: 'Priya S.',
    status: 'Approved',
    usageCount: 14,
    updated: '2 days ago',
    relatedDatasetIds: ['customer-database', 'sales-analytics'],
    relatedDatasets: ['Customer Database', 'Sales Analytics'],
    tags: ['retention', 'kpi', 'marketing'],
    synonyms: ['Active User', 'Engaged Buyer']
  },
  {
    id: 'term-2',
    term: 'Churn Rate',
    definition: 'Percentage of existing recurring customers who cancel subscriptions or terminate contracts in a given measurement window.',
    domainId: 'marketing',
    domain: 'Marketing',
    ownerId: 'user-003',
    owner: 'Arjun K.',
    status: 'Approved',
    usageCount: 28,
    updated: '1 week ago',
    relatedDatasetIds: ['customer-database', 'marketing-campaigns'],
    relatedDatasets: ['Customer Database', 'Marketing Campaigns'],
    tags: ['attrition', 'saas', 'growth'],
    synonyms: ['Attrition Rate', 'Customer Dropoff']
  },
  {
    id: 'term-3',
    term: 'Lifetime Value',
    definition: 'Projected net revenue attributed to the entire prospective relationship with a customer across all transaction channels.',
    domainId: 'finance',
    domain: 'Finance',
    ownerId: 'user-006',
    owner: 'Kavya S.',
    status: 'Approved',
    usageCount: 36,
    updated: '3 days ago',
    relatedDatasetIds: ['finance-transactions', 'customer-database'],
    relatedDatasets: ['Finance Transactions', 'Customer Database'],
    tags: ['clv', 'ltv', 'finance'],
    synonyms: ['Customer Lifetime Value', 'CLV']
  },
  {
    id: 'term-4',
    term: 'Monthly Active Users',
    definition: 'Count of unique authorized users that interact with the application during a contiguous 30-day calendar period.',
    domainId: 'product',
    domain: 'Product',
    ownerId: 'user-004',
    owner: 'Neha R.',
    status: 'Approved',
    usageCount: 42,
    updated: 'Yesterday',
    relatedDatasetIds: ['product-data', 'sales-analytics'],
    relatedDatasets: ['Product Master', 'Sales Analytics'],
    tags: ['mau', 'engagement', 'product'],
    synonyms: ['MAU', 'Monthly Unique Actives']
  },
  {
    id: 'term-5',
    term: 'Revenue',
    definition: 'Total monetary value recognized from goods and services delivered before operational expenditure adjustments.',
    domainId: 'finance',
    domain: 'Finance',
    ownerId: 'user-005',
    owner: 'Vikram M.',
    status: 'Approved',
    usageCount: 65,
    updated: '4 hours ago',
    relatedDatasetIds: ['finance-transactions', 'sales-analytics'],
    relatedDatasets: ['Finance Transactions', 'Sales Analytics'],
    tags: ['gaap', 'arr', 'topline'],
    synonyms: ['Gross Topline', 'Operating Sales']
  }
];

export const getGlossaryTermsForDataset = (datasetId, terms = INITIAL_GLOSSARY_TERMS) => {
  return terms.filter(t => t.relatedDatasetIds?.includes(datasetId));
};
