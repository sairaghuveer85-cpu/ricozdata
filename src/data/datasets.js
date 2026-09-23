export const INITIAL_DATASETS = [
  {
    id: 'customer-database',
    name: 'Customer Database',
    domainId: 'customer',
    domain: 'Customer 360',
    ownerId: 'user-002',
    owner: 'Priya S.',
    ownerEmail: 'priya@ricozdata.com',
    ownerRole: 'Data Owner',
    source: 'Snowflake',
    sourceDetails: {
      type: 'Snowflake',
      host: 'rcz-snowflake.us-east-1.privatelink.snowflakecomputing.com',
      database: 'PROD_CUSTOMER_DB',
      schema: 'ANALYTICS',
      environment: 'Production',
      syncSchedule: 'Hourly'
    },
    quality: 98,
    status: 'Certified',
    updated: '2 days ago',
    lastUpdatedDate: 'Sep 16, 2026',
    rows: '12.4M',
    columnsCount: 48,
    sensitivity: 'PII',
    usage: '1.4k views',
    statistics: {
      rowCount: 12400000,
      sizeBytes: 15435038720,
      columnCount: 48,
      queryCount30d: 1420,
      activeUsersCount: 18,
      lastIngestionTime: '2026-09-16T14:32:00Z'
    },
    complianceFrameworks: ['GDPR', 'CCPA', 'SOC2'],
    description: 'Contains customer information including demographics, purchase history, and support tickets.',
    longDescription: 'This dataset contains detailed customer information used for marketing, sales, and support operations. It consolidates demographic records, behavioral signals, transaction totals, and multichannel identity mappings.',
    tags: ['customer', 'marketing', 'pii', 'sales', 'production'],
    documentation: [
      { name: 'Customer Data Guide.pdf', size: '2.4 MB', url: '#' },
      { name: 'PII Compliance Guidelines.pdf', size: '1.1 MB', url: '#' }
    ],
    schema: [
      { name: 'customer_id', type: 'VARCHAR(64)', primaryKey: true, nullable: false, pii: true, description: 'Unique surrogate customer identifier' },
      { name: 'email', type: 'VARCHAR(255)', primaryKey: false, nullable: false, pii: true, description: 'Primary contact email address' },
      { name: 'first_name', type: 'VARCHAR(100)', primaryKey: false, nullable: true, pii: true, description: 'Customer first legal name' },
      { name: 'last_name', type: 'VARCHAR(100)', primaryKey: false, nullable: true, pii: true, description: 'Customer last legal name' },
      { name: 'phone_number', type: 'VARCHAR(20)', primaryKey: false, nullable: true, pii: true, description: 'E.164 formatted phone number' },
      { name: 'age', type: 'INTEGER', primaryKey: false, nullable: true, pii: false, description: 'Customer verified age in years' },
      { name: 'signup_date', type: 'TIMESTAMP_TZ', primaryKey: false, nullable: false, pii: false, description: 'Account creation timestamp' },
      { name: 'tier', type: 'VARCHAR(32)', primaryKey: false, nullable: false, pii: false, description: 'Loyalty tier (Standard, Silver, Gold, Platinum)' },
      { name: 'total_lifetime_spend', type: 'DECIMAL(12,2)', primaryKey: false, nullable: false, pii: false, description: 'Gross revenue attributed to customer' },
      { name: 'churn_risk_score', type: 'FLOAT', primaryKey: false, nullable: true, pii: false, description: 'Propensity model output [0.0 - 1.0]' }
    ]
  },
  {
    id: 'sales-analytics',
    name: 'Sales Analytics',
    domainId: 'finance',
    domain: 'Finance',
    ownerId: 'user-003',
    owner: 'Arjun K.',
    ownerEmail: 'arjun@ricozdata.com',
    ownerRole: 'Data Engineer',
    source: 'Snowflake',
    sourceDetails: {
      type: 'Snowflake',
      host: 'rcz-snowflake.us-east-1.privatelink.snowflakecomputing.com',
      database: 'PROD_SALES_DB',
      schema: 'REPORTING',
      environment: 'Production',
      syncSchedule: 'Daily at 02:00 UTC'
    },
    quality: 91,
    status: 'Certified',
    updated: '5 days ago',
    lastUpdatedDate: 'Sep 13, 2026',
    rows: '8.2M',
    columnsCount: 32,
    sensitivity: 'Confidential',
    usage: '980 views',
    statistics: {
      rowCount: 8200000,
      sizeBytes: 9856614400,
      columnCount: 32,
      queryCount30d: 980,
      activeUsersCount: 14,
      lastIngestionTime: '2026-09-13T02:00:00Z'
    },
    complianceFrameworks: ['SOC2', 'SOX'],
    description: 'Sales data for reports and forecasting across all regions.',
    longDescription: 'Aggregated regional sales transaction pipelines, quarterly booking metrics, discount analyses, and financial projection tables.',
    tags: ['sales', 'finance', 'forecast', 'revenue', 'quarterly'],
    documentation: [
      { name: 'Sales Data Dictionary.pdf', size: '3.1 MB', url: '#' }
    ],
    schema: [
      { name: 'order_id', type: 'VARCHAR(64)', primaryKey: true, nullable: false, pii: false, description: 'Global order tracking ID' },
      { name: 'customer_id', type: 'VARCHAR(64)', primaryKey: false, nullable: false, pii: true, description: 'Foreign key to customer profile' },
      { name: 'product_id', type: 'VARCHAR(64)', primaryKey: false, nullable: false, pii: false, description: 'SKU purchased' },
      { name: 'order_date', type: 'TIMESTAMP', primaryKey: false, nullable: false, pii: false, description: 'Checkout confirmation time' },
      { name: 'amount', type: 'DECIMAL(10,2)', primaryKey: false, nullable: false, pii: false, description: 'Final order total after discounts' },
      { name: 'region', type: 'VARCHAR(50)', primaryKey: false, nullable: false, pii: false, description: 'Operating sales territory' }
    ]
  },
  {
    id: 'product-data',
    name: 'Product Data',
    domainId: 'product',
    domain: 'Product',
    ownerId: 'user-004',
    owner: 'Neha R.',
    ownerEmail: 'neha@ricozdata.com',
    ownerRole: 'Product Manager',
    source: 'BigQuery',
    sourceDetails: {
      type: 'BigQuery',
      host: 'bigquery.googleapis.com',
      database: 'ricoz-prod-warehouse',
      schema: 'product_catalog',
      environment: 'Production',
      syncSchedule: 'Every 6 hours'
    },
    quality: 88,
    status: 'In Review',
    updated: '1 week ago',
    lastUpdatedDate: 'Sep 09, 2026',
    rows: '2.1M',
    columnsCount: 24,
    sensitivity: 'Internal',
    usage: '760 views',
    statistics: {
      rowCount: 2100000,
      sizeBytes: 2579496960,
      columnCount: 24,
      queryCount30d: 760,
      activeUsersCount: 11,
      lastIngestionTime: '2026-09-09T18:00:00Z'
    },
    complianceFrameworks: ['SOC2'],
    description: 'Product master data including SKUs, pricing, inventory, and categories.',
    longDescription: 'Comprehensive catalog of physical and digital SKUs, inventory availability by warehouse, pricing ladders, and hierarchical category taxonomy.',
    tags: ['product', 'catalog', 'inventory', 'pricing'],
    documentation: [
      { name: 'Product Catalog Taxonomy.pdf', size: '1.8 MB', url: '#' }
    ],
    schema: [
      { name: 'sku_id', type: 'VARCHAR(32)', primaryKey: true, nullable: false, pii: false, description: 'Standard SKU barcode code' },
      { name: 'title', type: 'VARCHAR(200)', primaryKey: false, nullable: false, pii: false, description: 'Public facing product title' },
      { name: 'category', type: 'VARCHAR(100)', primaryKey: false, nullable: false, pii: false, description: 'Primary taxonomy category' },
      { name: 'base_price', type: 'DECIMAL(10,2)', primaryKey: false, nullable: false, pii: false, description: 'MSRP in USD' },
      { name: 'inventory_count', type: 'INTEGER', primaryKey: false, nullable: false, pii: false, description: 'Available stock on hand' }
    ]
  },
  {
    id: 'employee-records',
    name: 'Employee Records',
    domainId: 'hr',
    domain: 'HR',
    ownerId: 'user-005',
    owner: 'Vikram M.',
    ownerEmail: 'vikram@ricozdata.com',
    ownerRole: 'Admin',
    source: 'PostgreSQL',
    sourceDetails: {
      type: 'PostgreSQL',
      host: 'pg-hr-cluster.internal.ricozdata.com',
      database: 'hr_management',
      schema: 'public',
      environment: 'Production',
      syncSchedule: 'Daily at 00:00 UTC'
    },
    quality: 95,
    status: 'Certified',
    updated: '3 days ago',
    lastUpdatedDate: 'Sep 15, 2026',
    rows: '45.2K',
    columnsCount: 18,
    sensitivity: 'Restricted',
    usage: '520 views',
    statistics: {
      rowCount: 45200,
      sizeBytes: 85983232,
      columnCount: 18,
      queryCount30d: 520,
      activeUsersCount: 6,
      lastIngestionTime: '2026-09-15T00:00:00Z'
    },
    complianceFrameworks: ['GDPR', 'HIPAA', 'SOC2'],
    description: 'HR and employee information including departments, payroll, and benefits.',
    longDescription: 'Internal corporate directory containing role assignments, reporting hierarchies, compensation bands, tenure metrics, and compliance certificates.',
    tags: ['hr', 'employees', 'confidential', 'internal'],
    documentation: [
      { name: 'HR Data Retention Policy.pdf', size: '890 KB', url: '#' }
    ],
    schema: [
      { name: 'employee_id', type: 'VARCHAR(32)', primaryKey: true, nullable: false, pii: false, description: 'Staff badge ID' },
      { name: 'full_name', type: 'VARCHAR(150)', primaryKey: false, nullable: false, pii: true, description: 'Full legal employee name' },
      { name: 'department', type: 'VARCHAR(100)', primaryKey: false, nullable: false, pii: false, description: 'Business unit / functional department' },
      { name: 'job_title', type: 'VARCHAR(100)', primaryKey: false, nullable: false, pii: false, description: 'Official corporate position' },
      { name: 'hire_date', type: 'DATE', primaryKey: false, nullable: false, pii: false, description: 'First date of active employment' }
    ]
  },
  {
    id: 'finance-transactions',
    name: 'Finance Transactions',
    domainId: 'finance',
    domain: 'Finance',
    ownerId: 'user-006',
    owner: 'Kavya S.',
    ownerEmail: 'kavya@ricozdata.com',
    ownerRole: 'Data Analyst',
    source: 'MySQL',
    sourceDetails: {
      type: 'MySQL',
      host: 'mysql-ledger.finance.internal.ricozdata.com',
      database: 'general_ledger',
      schema: 'gl_2026',
      environment: 'Production',
      syncSchedule: 'Every 15 minutes'
    },
    quality: 89,
    status: 'In Review',
    updated: '6 days ago',
    lastUpdatedDate: 'Sep 12, 2026',
    rows: '24.8M',
    columnsCount: 56,
    sensitivity: 'Restricted',
    usage: '890 views',
    statistics: {
      rowCount: 24800000,
      sizeBytes: 31238430720,
      columnCount: 56,
      queryCount30d: 890,
      activeUsersCount: 16,
      lastIngestionTime: '2026-09-12T06:15:00Z'
    },
    complianceFrameworks: ['SOX', 'SOC2', 'PCI-DSS'],
    description: 'All financial transactions, ledger entries, invoices, and billing history.',
    longDescription: 'Ledger reconciliations, accounts payable and receivable entries, payment gateway audit logs, and currency exchange records.',
    tags: ['finance', 'transactions', 'ledger', 'billing', 'audit'],
    documentation: [
      { name: 'Financial Audit Standard.pdf', size: '4.2 MB', url: '#' }
    ],
    schema: [
      { name: 'txn_id', type: 'VARCHAR(64)', primaryKey: true, nullable: false, pii: false, description: 'Unique transaction reference' },
      { name: 'account_id', type: 'VARCHAR(64)', primaryKey: false, nullable: false, pii: true, description: 'Target ledger account identifier' },
      { name: 'type', type: 'VARCHAR(32)', primaryKey: false, nullable: false, pii: false, description: 'Credit or Debit' },
      { name: 'amount', type: 'DECIMAL(14,2)', primaryKey: false, nullable: false, pii: false, description: 'Settlement amount' },
      { name: 'currency', type: 'VARCHAR(3)', primaryKey: false, nullable: false, pii: false, description: 'ISO 4217 Currency Code' }
    ]
  },
  {
    id: 'marketing-campaigns',
    name: 'Marketing Campaigns',
    domainId: 'marketing',
    domain: 'Marketing',
    ownerId: 'user-007',
    owner: 'Rohan P.',
    ownerEmail: 'rohan@ricozdata.com',
    ownerRole: 'Marketing Lead',
    source: 'BigQuery',
    sourceDetails: {
      type: 'BigQuery',
      host: 'bigquery.googleapis.com',
      database: 'ricoz-prod-warehouse',
      schema: 'marketing_attribution',
      environment: 'Production',
      syncSchedule: 'Every 4 hours'
    },
    quality: 92,
    status: 'Certified',
    updated: '4 days ago',
    lastUpdatedDate: 'Sep 14, 2026',
    rows: '5.6M',
    columnsCount: 28,
    sensitivity: 'Public',
    usage: '640 views',
    statistics: {
      rowCount: 5600000,
      sizeBytes: 6710886400,
      columnCount: 28,
      queryCount30d: 640,
      activeUsersCount: 9,
      lastIngestionTime: '2026-09-14T11:45:00Z'
    },
    complianceFrameworks: ['CCPA', 'SOC2'],
    description: 'Campaign performance data, ad spend, conversion metrics, and attribution.',
    longDescription: 'Cross-channel advertising performance datasets capturing click-throughs, impression delivery, CPA calculations, and conversion funnels.',
    tags: ['marketing', 'campaigns', 'adtech', 'analytics', 'growth'],
    documentation: [
      { name: 'Attribution Model Spec.pdf', size: '1.4 MB', url: '#' }
    ],
    schema: [
      { name: 'campaign_id', type: 'VARCHAR(64)', primaryKey: true, nullable: false, pii: false, description: 'Campaign tracking tag' },
      { name: 'channel', type: 'VARCHAR(64)', primaryKey: false, nullable: false, pii: false, description: 'Ad network or channel' },
      { name: 'spend', type: 'DECIMAL(10,2)', primaryKey: false, nullable: false, pii: false, description: 'Total ad spend allocated' },
      { name: 'impressions', type: 'BIGINT', primaryKey: false, nullable: false, pii: false, description: 'Count of served impressions' },
      { name: 'conversions', type: 'INTEGER', primaryKey: false, nullable: false, pii: false, description: 'Direct goal conversions' }
    ]
  }
];
