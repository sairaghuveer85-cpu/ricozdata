export const INITIAL_POLICIES = [
  {
    id: 'pol-1',
    name: 'PII Data Access',
    description: 'Restrict access to personally identifiable information to authorized personnel with approved security justification.',
    appliesTo: 'Customer Data',
    ownerId: 'user-002',
    owner: 'Priya S.',
    status: 'Active',
    updated: '2 days ago',
    scope: 'Production Snowflake & BigQuery Customer Schemas',
    rules: 'Requires role clearance, logged justification, and time-bounded token expiration.',
    datasetIds: ['customer-database', 'marketing-campaigns'],
    affectedDatasets: ['Customer Database', 'Marketing Campaigns'],
    compliance: 'GDPR Article 32, SOC 2 CC6.1',
    frameworks: ['GDPR', 'SOC2'],
    violationsCount: 2,
    lastReview: 'Sep 10, 2026'
  },
  {
    id: 'pol-2',
    name: 'Data Retention',
    description: 'Define minimum/maximum storage retention periods and enforce automated archival routines across all data lakes.',
    appliesTo: 'All Datasets',
    ownerId: 'user-003',
    owner: 'Arjun K.',
    status: 'Active',
    updated: '5 days ago',
    scope: 'Enterprise Data Lake (AWS S3 & Snowflake Warehouses)',
    rules: 'Transactional records kept 7 years; temporary staging partitions dropped after 30 days.',
    datasetIds: ['customer-database', 'finance-transactions', 'sales-analytics'],
    affectedDatasets: ['Customer Database', 'Finance Transactions', 'Sales Analytics'],
    compliance: 'SOX Section 802, ISO 27001 A.18.1.3',
    frameworks: ['SOX', 'ISO27001'],
    violationsCount: 0,
    lastReview: 'Sep 12, 2026'
  },
  {
    id: 'pol-3',
    name: 'Mask Sensitive Data',
    description: 'Mask PII in non-production environments using dynamic format-preserving column hashing and irreversible redaction.',
    appliesTo: 'PII Columns',
    ownerId: 'user-004',
    owner: 'Neha R.',
    status: 'Active',
    updated: '1 week ago',
    scope: 'Dev, Staging & QA Database Clusters',
    rules: 'Phone, email, and SSN must be masked using SHA-256 HMAC tokens.',
    datasetIds: ['customer-database', 'employee-records'],
    affectedDatasets: ['Customer Database', 'Employee Records'],
    compliance: 'HIPAA Security Rule, GDPR Article 25',
    frameworks: ['HIPAA', 'GDPR'],
    violationsCount: 1,
    lastReview: 'Sep 14, 2026'
  },
  {
    id: 'pol-4',
    name: 'Access Review',
    description: 'Quarterly user permission validation and mandatory privilege re-certification by designated dataset business owners.',
    appliesTo: 'All Users',
    ownerId: 'user-005',
    owner: 'Vikram M.',
    status: 'Active',
    updated: '2 weeks ago',
    scope: 'All Enterprise Warehouse Accounts & Service Roles',
    rules: 'Unauthenticated roles older than 90 days are automatically revoked pending review.',
    datasetIds: ['customer-database', 'sales-analytics', 'product-data', 'employee-records', 'finance-transactions', 'marketing-campaigns'],
    affectedDatasets: ['All Production Datasets'],
    compliance: 'SOC 2 CC6.2, ISO 27001 A.9.2.5',
    frameworks: ['SOC2', 'ISO27001'],
    violationsCount: 0,
    lastReview: 'Sep 01, 2026'
  },
  {
    id: 'pol-5',
    name: 'External Sharing',
    description: 'Control external data exports and enforce encrypted egress tunnels with pre-approved corporate IP allowances.',
    appliesTo: 'All Datasets',
    ownerId: 'user-003',
    owner: 'Arjun K.',
    status: 'Inactive',
    updated: '3 weeks ago',
    scope: 'API Gateways & SFTP Egress Points',
    rules: 'Outbound exports > 10,000 rows require secondary Dual-Custodian approval.',
    datasetIds: ['finance-transactions', 'product-data'],
    affectedDatasets: ['Finance Transactions', 'Product Master'],
    compliance: 'SOC 2 CC6.6',
    frameworks: ['SOC2'],
    violationsCount: 0,
    lastReview: 'Aug 28, 2026'
  }
];

export const INITIAL_RULES = [
  {
    id: 'rule-1',
    name: 'Email Format Validation',
    targetColumn: 'email',
    type: 'Regex Pattern Check',
    threshold: '100% Valid',
    frequency: 'Daily on ingestion',
    status: 'Passing'
  },
  {
    id: 'rule-2',
    name: 'Primary Key Uniqueness',
    targetColumn: 'customer_id, order_id',
    type: 'Uniqueness Constraint',
    threshold: '100% Unique',
    frequency: 'Continuous pipeline hook',
    status: 'Passing'
  },
  {
    id: 'rule-3',
    name: 'Null Value Tolerance',
    targetColumn: 'first_name, last_name',
    type: 'Completeness Check',
    threshold: '< 2% Nulls',
    frequency: 'Weekly scan',
    status: 'Warning'
  },
  {
    id: 'rule-4',
    name: 'Numerical Value Range Limit',
    targetColumn: 'age',
    type: 'Range Boundary [18, 120]',
    threshold: '100% in range',
    frequency: 'Daily ingestion',
    status: 'Passing'
  }
];

export const PERMISSION_MATRIX = [
  { roleId: 'role-analyst', role: 'Data Analyst', view: true, create: false, edit: false, delete: false, export: true, managePolicies: false },
  { roleId: 'role-engineer', role: 'Data Engineer', view: true, create: true, edit: true, delete: false, export: true, managePolicies: false },
  { roleId: 'role-owner', role: 'Data Owner', view: true, create: true, edit: true, delete: true, export: true, managePolicies: true },
  { roleId: 'role-owner', role: 'Product Manager', view: true, create: false, edit: false, delete: false, export: true, managePolicies: false },
  { roleId: 'role-admin', role: 'Admin', view: true, create: true, edit: true, delete: true, export: true, managePolicies: true }
];

export const COMPLIANCE_FRAMEWORKS = [
  {
    id: 'fw-gdpr',
    name: 'GDPR (EU General Data Protection)',
    code: 'GDPR',
    status: 'Compliant',
    lastReview: 'Aug 20, 2026',
    coverage: 98,
    description: 'Protection of natural persons regarding processing of personal data and free movement.',
    auditor: 'KPMG External Audit'
  },
  {
    id: 'fw-soc2',
    name: 'SOC 2 Type II Security',
    code: 'SOC2',
    status: 'Certified',
    lastReview: 'Sep 02, 2026',
    coverage: 100,
    description: 'Security, Availability, Processing Integrity, Confidentiality and Privacy trust criteria.',
    auditor: 'Schellman & Co.'
  },
  {
    id: 'fw-iso27001',
    name: 'ISO 27001 (InfoSec Management)',
    code: 'ISO27001',
    status: 'Compliant',
    lastReview: 'Jul 15, 2026',
    coverage: 94,
    description: 'Information security management systems (ISMS) implementation requirements and controls.',
    auditor: 'BSI Assurance'
  }
];

export const getPoliciesForDataset = (datasetId, policies = INITIAL_POLICIES) => {
  return policies.filter(p => p.datasetIds?.includes(datasetId) || p.datasetIds?.includes('all'));
};
