export const INITIAL_GLOSSARY_TERMS = [
  {
    id: 'term-1',
    term: 'Active Customer',
    definition: 'A customer who has made at least one transaction or authenticated session event within the past 90 days.',
    domain: 'Marketing',
    owner: 'Priya S.',
    status: 'Approved',
    usageCount: 14,
    updated: '2 days ago',
    relatedDatasets: ['Customer Database', 'Sales Analytics'],
    tags: ['retention', 'kpi', 'marketing'],
    synonyms: ['Active User', 'Engaged Buyer']
  },
  {
    id: 'term-2',
    term: 'Churn Rate',
    definition: 'Percentage of existing recurring customers who cancel subscriptions or terminate contracts in a given measurement window.',
    domain: 'Marketing',
    owner: 'Arjun K.',
    status: 'Approved',
    usageCount: 28,
    updated: '1 week ago',
    relatedDatasets: ['Customer Database', 'Marketing Campaigns'],
    tags: ['attrition', 'saas', 'growth'],
    synonyms: ['Attrition Rate', 'Customer Dropoff']
  },
  {
    id: 'term-3',
    term: 'Lifetime Value',
    definition: 'Projected net revenue attributed to the entire prospective relationship with a customer across all transaction channels.',
    domain: 'Finance',
    owner: 'Kavya S.',
    status: 'Approved',
    usageCount: 36,
    updated: '3 days ago',
    relatedDatasets: ['Finance Transactions', 'Customer Database'],
    tags: ['clv', 'ltv', 'finance'],
    synonyms: ['Customer Lifetime Value', 'CLV']
  },
  {
    id: 'term-4',
    term: 'Monthly Active Users',
    definition: 'Count of unique authorized users that interact with the application during a contiguous 30-day calendar period.',
    domain: 'Product',
    owner: 'Neha R.',
    status: 'Approved',
    usageCount: 42,
    updated: 'Yesterday',
    relatedDatasets: ['Product Master', 'Sales Analytics'],
    tags: ['mau', 'engagement', 'product'],
    synonyms: ['MAU', 'Monthly Unique Actives']
  },
  {
    id: 'term-5',
    term: 'Revenue',
    definition: 'Total monetary value recognized from goods and services delivered before operational expenditure adjustments.',
    domain: 'Finance',
    owner: 'Vikram M.',
    status: 'Approved',
    usageCount: 65,
    updated: '4 hours ago',
    relatedDatasets: ['Finance Transactions', 'Sales Analytics'],
    tags: ['gaap', 'arr', 'topline'],
    synonyms: ['Gross Topline', 'Operating Sales']
  }
];
