const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from server root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Load Mongoose models
const User = require('../models/User');
const Domain = require('../models/Domain');
const Dataset = require('../models/Dataset');
const Quality = require('../models/Quality');
const QualityIssue = require('../models/QualityIssue');
const Lineage = require('../models/Lineage');
const GlossaryTerm = require('../models/GlossaryTerm');
const Policy = require('../models/Policy');
const Activity = require('../models/Activity');
const Rule = require('../models/Rule');
const DataSource = require('../models/DataSource');

const rawUsers = [
  { id: 'user-000', name: 'Demo Administrator', email: 'test@example.com', role: 'SUPER_ADMIN', department: 'Enterprise Analytics', avatar: 'DA', avatarBg: 'bg-blue-600', password: 'password' },
  { id: 'user-001', name: 'Raghuveer Chandran', email: 'raghuveer.chandran@ricoz-industries.demo', role: 'SUPER_ADMIN', department: 'Enterprise Analytics', avatar: 'RC', avatarBg: 'bg-blue-600' },
  { id: 'user-002', name: 'Priya Shah', email: 'priya.shah@ricoz-industries.demo', role: 'ADMIN', department: 'Data Governance', avatar: 'PS', avatarBg: 'bg-emerald-600' },
  { id: 'user-003', name: 'Arjun Kumar', email: 'arjun.kumar@ricoz-industries.demo', role: 'DATA_STEWARD', department: 'Data Platform', avatar: 'AK', avatarBg: 'bg-indigo-600' },
  { id: 'user-004', name: 'Meera Iyer', email: 'meera.iyer@ricoz-industries.demo', role: 'DATA_ENGINEER', department: 'Product', avatar: 'MI', avatarBg: 'bg-violet-600' },
  { id: 'user-005', name: 'Vikram Mehta', email: 'vikram.mehta@ricoz-industries.demo', role: 'DATA_ANALYST', department: 'Human Resources', avatar: 'VM', avatarBg: 'bg-purple-600' },
  { id: 'user-006', name: 'Kavya Sharma', email: 'kavya.sharma@ricoz-industries.demo', role: 'VIEWER', department: 'Finance', avatar: 'KS', avatarBg: 'bg-amber-600' },
  { id: 'user-007', name: 'Neha Rao', email: 'neha.rao@ricoz-industries.demo', role: 'DATA_ANALYST', department: 'Marketing', avatar: 'NR', avatarBg: 'bg-rose-600' },
  { id: 'user-008', name: 'Sanjay Patel', email: 'sanjay.patel@ricoz-industries.demo', role: 'DATA_ANALYST', department: 'Sales', avatar: 'SP', avatarBg: 'bg-cyan-600' },
  { id: 'user-009', name: 'Aditi Menon', email: 'aditi.menon@ricoz-industries.demo', role: 'ADMIN', department: 'Information Security', avatar: 'AM', avatarBg: 'bg-slate-600' },
  { id: 'user-010', name: 'Daniel Lee', email: 'daniel.lee@ricoz-industries.demo', role: 'SUPER_ADMIN', department: 'Data Platform', avatar: 'DL', avatarBg: 'bg-teal-600' }
];

const rawDomains = [
  { id: 'customer', name: 'Customer', description: 'Customer identity, service, and master-data assets.', leadId: 'user-002', icon: 'Users', color: 'emerald' },
  { id: 'finance', name: 'Finance', description: 'Ledger, revenue, billing, and financial-control assets.', leadId: 'user-006', icon: 'DollarSign', color: 'amber' },
  { id: 'sales', name: 'Sales', description: 'Orders, sales performance, and commercial analytics assets.', leadId: 'user-008', icon: 'BarChart3', color: 'blue' },
  { id: 'product', name: 'Product', description: 'Product catalog, SKU, pricing, and inventory assets.', leadId: 'user-004', icon: 'Package', color: 'indigo' },
  { id: 'marketing', name: 'Marketing', description: 'Campaign, lead, attribution, and audience assets.', leadId: 'user-007', icon: 'TrendingUp', color: 'rose' },
  { id: 'human-resources', name: 'Human Resources', description: 'Workforce, organization, and people-operations assets.', leadId: 'user-005', icon: 'UserCheck', color: 'purple' },
  { id: 'operations', name: 'Operations', description: 'Warehouse, fulfillment, and operational reliability assets.', leadId: 'user-003', icon: 'Cpu', color: 'cyan' }
];

const rawPolicies = [
  { id: 'pol-pii-access', name: 'PII Data Access Policy', description: 'Requires approved business purpose and least-privilege access for datasets containing personal information.', category: 'Access Control', ownerId: 'user-002', reviewFrequency: 'Quarterly', lastReviewed: '2026-08-30', nextReview: '2026-11-30', datasetIds: ['customer-master', 'customer-transactions', 'employee-records', 'marketing-leads'], severity: 'High', complianceFrameworks: ['GDPR', 'SOC 2', 'ISO 27001'] },
  { id: 'pol-retention', name: 'Data Retention Policy', description: 'Sets retention and disposition controls for transaction, customer, and lead records.', category: 'Lifecycle', ownerId: 'user-002', reviewFrequency: 'Annual', lastReviewed: '2026-07-15', nextReview: '2027-07-15', datasetIds: ['customer-master', 'customer-transactions', 'sales-orders', 'finance-transactions', 'marketing-leads'], severity: 'Medium', complianceFrameworks: ['GDPR', 'ISO 27001'] },
  { id: 'pol-masking', name: 'Sensitive Data Masking Policy', description: 'Requires masking of restricted and confidential fields in non-production views.', category: 'Data Protection', ownerId: 'user-009', reviewFrequency: 'Quarterly', lastReviewed: '2026-09-01', nextReview: '2026-12-01', datasetIds: ['customer-master', 'employee-records', 'finance-transactions'], severity: 'High', complianceFrameworks: ['GDPR', 'SOC 2', 'ISO 27001'] },
  { id: 'pol-external-sharing', name: 'External Data Sharing Policy', description: 'Requires governance review before externally sourced or shared marketing data is released.', category: 'Data Sharing', ownerId: 'user-002', reviewFrequency: 'Annual', lastReviewed: '2026-06-01', nextReview: '2027-06-01', datasetIds: ['marketing-campaigns', 'marketing-leads'], severity: 'Medium', complianceFrameworks: ['GDPR', 'SOC 2'] },
  { id: 'pol-quality-threshold', name: 'Data Quality Threshold Policy', description: 'Requires critical datasets to meet documented quality thresholds before certified consumption.', category: 'Data Quality', ownerId: 'user-002', reviewFrequency: 'Semiannual', lastReviewed: '2026-08-15', nextReview: '2027-02-15', datasetIds: ['sales-orders', 'sales-analytics', 'product-master', 'inventory', 'marketing-campaigns'], severity: 'High', complianceFrameworks: ['SOC 2', 'ISO 27001'] },
  { id: 'pol-access-review', name: 'Access Review Policy', description: 'Requires periodic review of access to governance-managed assets.', category: 'Access Control', ownerId: 'user-009', reviewFrequency: 'Quarterly', lastReviewed: '2026-09-10', nextReview: '2026-12-10', datasetIds: ['customer-master', 'sales-orders', 'employee-records', 'finance-transactions'], severity: 'Medium', complianceFrameworks: ['SOC 2', 'ISO 27001'] },
  { id: 'pol-production-usage', name: 'Production Data Usage Policy', description: 'Restricts use of production personal and financial data to approved operational purposes.', category: 'Data Protection', ownerId: 'user-009', reviewFrequency: 'Annual', lastReviewed: '2026-05-20', nextReview: '2027-05-20', datasetIds: ['employee-records', 'finance-transactions'], severity: 'High', complianceFrameworks: ['GDPR', 'SOC 2'] }
];

const rawGlossary = [
  { id: 'term-active-customer', term: 'Active Customer', definition: 'A customer with at least one completed transaction or authenticated engagement in the past 90 days.', domainId: 'customer', ownerId: 'user-002', relatedDatasetIds: ['customer-master', 'customer-transactions', 'sales-analytics'], tags: ['customer', 'retention'] },
  { id: 'term-churn-rate', term: 'Churn Rate', definition: 'Percentage of active customers that became inactive during the measurement period.', domainId: 'customer', ownerId: 'user-002', relatedDatasetIds: ['customer-master', 'customer-transactions'], tags: ['customer', 'retention'] },
  { id: 'term-clv', term: 'Customer Lifetime Value', definition: 'Projected net revenue from a customer relationship over its expected lifetime.', domainId: 'customer', ownerId: 'user-002', relatedDatasetIds: ['customer-master', 'customer-transactions', 'sales-analytics'], tags: ['customer', 'revenue'] },
  { id: 'term-net-revenue', term: 'Net Revenue', definition: 'Revenue recognized after approved discounts, returns, and allowances.', domainId: 'finance', ownerId: 'user-006', relatedDatasetIds: ['sales-orders', 'finance-transactions', 'sales-analytics'], tags: ['finance', 'revenue'] },
  { id: 'term-gross-revenue', term: 'Gross Revenue', definition: 'Total value of confirmed sales before discounts, returns, and allowances.', domainId: 'finance', ownerId: 'user-006', relatedDatasetIds: ['sales-orders', 'finance-transactions'], tags: ['finance', 'revenue'] },
  { id: 'term-fulfillment', term: 'Order Fulfillment Rate', definition: 'Percentage of confirmed orders fulfilled within the committed service window.', domainId: 'operations', ownerId: 'user-003', relatedDatasetIds: ['sales-orders', 'inventory'], tags: ['operations', 'orders'] },
  { id: 'term-aov', term: 'Average Order Value', definition: 'Net revenue divided by the number of completed orders in a reporting period.', domainId: 'sales', ownerId: 'user-008', relatedDatasetIds: ['sales-orders', 'sales-analytics'], tags: ['sales', 'kpi'] },
  { id: 'term-cac', term: 'Customer Acquisition Cost', definition: 'Sales and marketing spend divided by newly acquired customers for the period.', domainId: 'marketing', ownerId: 'user-007', relatedDatasetIds: ['marketing-campaigns', 'marketing-leads'], tags: ['marketing', 'kpi'] },
  { id: 'term-mau', term: 'Monthly Active Users', definition: 'Count of unique users engaging with a product or service during a calendar month.', domainId: 'product', ownerId: 'user-004', relatedDatasetIds: ['product-master', 'sales-analytics'], tags: ['product', 'engagement'] },
  { id: 'term-inventory-turnover', term: 'Inventory Turnover', definition: 'Cost of goods sold divided by average inventory for the measurement period.', domainId: 'operations', ownerId: 'user-003', relatedDatasetIds: ['product-master', 'inventory', 'sales-orders'], tags: ['operations', 'inventory'] },
  { id: 'term-data-owner', term: 'Data Owner', definition: 'Business role accountable for the intended use, quality, and governance of a data asset.', domainId: 'customer', ownerId: 'user-002', relatedDatasetIds: ['customer-master', 'employee-records'], tags: ['governance'] },
  { id: 'term-data-steward', term: 'Data Steward', definition: 'Role responsible for day-to-day metadata quality and issue coordination for a data asset.', domainId: 'customer', ownerId: 'user-005', relatedDatasetIds: ['customer-master', 'employee-records'], tags: ['governance'] },
  { id: 'term-pii', term: 'Personally Identifiable Information', definition: 'Information that can directly or indirectly identify an individual.', domainId: 'customer', ownerId: 'user-009', relatedDatasetIds: ['customer-master', 'employee-records', 'marketing-leads'], tags: ['privacy', 'governance'] },
  { id: 'term-cde', term: 'Critical Data Element', definition: 'A field whose quality materially affects a business, regulatory, or reporting outcome.', domainId: 'finance', ownerId: 'user-002', relatedDatasetIds: ['finance-transactions', 'sales-orders', 'customer-master'], tags: ['governance', 'quality'] }
];

const rawRules = [
  { id: 'rule-customer-id-unique', name: 'Customer ID must be unique', datasetId: 'customer-master', targetDatasetId: 'customer-master', field: 'customer_id', targetColumn: 'customer_id', expression: 'unique(customer_id)', dimension: 'uniqueness', ruleType: 'UNIQUE', condition: '{}', threshold: 0.02, severity: 'critical', enabled: true, owner: 'user-002', createdBy: 'user-002', status: 'active', metadata: {} },
  { id: 'rule-email-not-null', name: 'Email must not be null', datasetId: 'customer-master', targetDatasetId: 'customer-master', field: 'email', targetColumn: 'email', expression: 'not_null(email)', dimension: 'completeness', ruleType: 'NOT_NULL', condition: '{}', threshold: 0.05, severity: 'high', enabled: true, owner: 'user-005', createdBy: 'user-003', status: 'active', metadata: {} },
  { id: 'rule-email-format', name: 'Email format validation', datasetId: 'customer-master', targetDatasetId: 'customer-master', field: 'email', targetColumn: 'email', expression: 'regex', dimension: 'validity', ruleType: 'REGEX', condition: { pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' }, threshold: 0.98, severity: 'medium', enabled: true, owner: 'user-005', createdBy: 'user-003', status: 'active', metadata: {} },
  { id: 'rule-lead-email-not-null', name: 'Lead email must not be null', datasetId: 'marketing-leads', targetDatasetId: 'marketing-leads', field: 'email', targetColumn: 'email', expression: 'not_null(email)', dimension: 'completeness', ruleType: 'NOT_NULL', condition: '{}', threshold: 0.05, severity: 'high', enabled: true, owner: 'user-007', createdBy: 'user-007', status: 'active', metadata: {} },
  { id: 'rule-lead-email-format', name: 'Lead email format validation', datasetId: 'marketing-leads', targetDatasetId: 'marketing-leads', field: 'email', targetColumn: 'email', expression: 'regex', dimension: 'validity', ruleType: 'REGEX', condition: { pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' }, threshold: 0.98, severity: 'medium', enabled: true, owner: 'user-007', createdBy: 'user-007', status: 'active', metadata: {} },
  { id: 'rule-customer-reference', name: 'Customer ID must reference Customer Master', datasetId: 'customer-transactions', targetDatasetId: 'customer-transactions', field: 'customer_id', targetColumn: 'customer_id', expression: 'foreign_key(customer_id, customer-master.customer_id)', dimension: 'consistency', ruleType: 'REFERENTIAL_INTEGRITY', condition: { targetDatasetId: 'customer-master', targetField: 'customer_id' }, threshold: 1, severity: 'critical', enabled: true, owner: 'user-003', createdBy: 'user-004', status: 'active', metadata: {} },
  { id: 'rule-transactions-age-range', name: 'Transaction date must be within valid range', datasetId: 'customer-transactions', targetDatasetId: 'customer-transactions', field: 'transaction_date', targetColumn: 'transaction_date', expression: 'age >= 18 && age <= 65', dimension: 'validity', ruleType: 'RANGE', condition: { min: '2020-01-01', max: '2026-12-31' }, threshold: 0.99, severity: 'medium', enabled: true, owner: 'user-003', createdBy: 'user-004', status: 'active', metadata: {} },
  { id: 'rule-inventory-nonnegative', name: 'Quantity must be greater than or equal to zero', datasetId: 'inventory', targetDatasetId: 'inventory', field: 'quantity_on_hand', targetColumn: 'quantity_on_hand', expression: 'quantity_on_hand >= 0', dimension: 'validity', ruleType: 'RANGE', condition: { min: 0, max: null }, threshold: 1, severity: 'high', enabled: true, owner: 'user-003', createdBy: 'user-003', status: 'active', metadata: {} },
  { id: 'rule-currency-valid', name: 'Currency must be valid', datasetId: 'finance-transactions', targetDatasetId: 'finance-transactions', field: 'currency', targetColumn: 'currency', expression: 'currency in ISO_4217', dimension: 'validity', ruleType: 'ENUM', condition: { values: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY'] }, threshold: 1, severity: 'critical', enabled: true, owner: 'user-006', createdBy: 'user-006', status: 'active', metadata: {} },
  { id: 'rule-orders-status', name: 'Order status must be recognized', datasetId: 'sales-orders', targetDatasetId: 'sales-orders', field: 'status', targetColumn: 'status', expression: 'status in configured_order_statuses', dimension: 'validity', ruleType: 'ENUM', condition: { values: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'] }, threshold: 1, severity: 'high', enabled: true, owner: 'user-008', createdBy: 'user-008', status: 'active', metadata: {} },
  { id: 'rule-product-sku-unique', name: 'Active product SKU must be unique', datasetId: 'product-master', targetDatasetId: 'product-master', field: 'sku', targetColumn: 'sku', expression: 'unique(sku) where status = active', dimension: 'uniqueness', ruleType: 'UNIQUE', condition: '{}', threshold: 0.02, severity: 'medium', enabled: true, owner: 'user-004', createdBy: 'user-004', status: 'active', metadata: {} },
  { id: 'rule-discount-threshold', name: 'Discount must not exceed threshold', datasetId: 'sales-orders', targetDatasetId: 'sales-orders', field: 'discount', targetColumn: 'discount', expression: 'discount <= 35', dimension: 'validity', ruleType: 'RANGE', condition: { min: null, max: 35 }, threshold: 0.95, severity: 'medium', enabled: true, owner: 'user-008', createdBy: 'user-008', status: 'active', metadata: {} },
  { id: 'rule-campaign-date-order', name: 'Campaign dates must be chronological', datasetId: 'marketing-campaigns', targetDatasetId: 'marketing-campaigns', field: 'end_date', targetColumn: 'end_date', expression: 'end_date >= start_date', dimension: 'consistency', ruleType: 'CUSTOM', condition: { checkFunction: 'datesChronological' }, threshold: 1, severity: 'low', enabled: true, owner: 'user-007', createdBy: 'user-007', status: 'active', metadata: {} },
  { id: 'rule-customer-master-name-length', name: 'Customer name must meet minimum length', datasetId: 'customer-master', targetDatasetId: 'customer-master', field: 'name', targetColumn: 'name', expression: 'name.length >= 2', dimension: 'validity', ruleType: 'MIN_LENGTH', condition: { length: 2 }, threshold: 1, severity: 'low', enabled: true, owner: 'user-005', createdBy: 'user-003', status: 'active', metadata: {} },
  { id: 'rule-employee-email-format', name: 'Employee email must be valid', datasetId: 'employee-records', targetDatasetId: 'employee-records', field: 'email', targetColumn: 'email', expression: 'regex', dimension: 'validity', ruleType: 'REGEX', condition: { pattern: '^[^@]+@ricoz\\.com$' }, threshold: 0.99, severity: 'high', enabled: true, owner: 'user-005', createdBy: 'user-002', status: 'active', metadata: {} },
  { id: 'rule-employee-dept-enum', name: 'Employee department must be valid enum', datasetId: 'employee-records', targetDatasetId: 'employee-records', field: 'department', targetColumn: 'department', expression: 'department in valid_departments', dimension: 'validity', ruleType: 'ENUM', condition: { values: ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Analytics', 'Security'] }, threshold: 1, severity: 'medium', enabled: true, owner: 'user-005', createdBy: 'user-002', status: 'active', metadata: {} },
  { id: 'rule-finance-transactions-unique', name: 'Transaction ID must be unique', datasetId: 'finance-transactions', targetDatasetId: 'finance-transactions', field: 'transaction_id', targetColumn: 'transaction_id', expression: 'unique(transaction_id)', dimension: 'uniqueness', ruleType: 'UNIQUE', condition: '{}', threshold: 0, severity: 'critical', enabled: true, owner: 'user-006', createdBy: 'user-006', status: 'active', metadata: {} },
  { id: 'rule-orders-created-freshness', name: 'Order created date freshness check', datasetId: 'sales-orders', targetDatasetId: 'sales-orders', field: 'created_at', targetColumn: 'created_at', expression: 'freshness', dimension: 'timeliness', ruleType: 'FRESHNESS', condition: { maxHours: 168 }, threshold: 0.95, severity: 'medium', enabled: true, owner: 'user-008', createdBy: 'user-008', status: 'active', metadata: {} },
  { id: 'rule-product-sku-length', name: 'Product SKU must not exceed max length', datasetId: 'product-master', targetDatasetId: 'product-master', field: 'sku', targetColumn: 'sku', expression: 'sku.length <= 30', dimension: 'validity', ruleType: 'MAX_LENGTH', condition: { length: 30 }, threshold: 1, severity: 'low', enabled: true, owner: 'user-004', createdBy: 'user-002', status: 'active', metadata: {} },
  { id: 'rule-inventory-duplicates', name: 'Inventory location must not have duplicates', datasetId: 'inventory', targetDatasetId: 'inventory', field: 'location_id', targetColumn: 'location_id', expression: 'no duplicates on location', dimension: 'uniqueness', ruleType: 'DUPLICATE', condition: '{}', threshold: 0, severity: 'medium', enabled: true, owner: 'user-003', createdBy: 'user-003', status: 'active', metadata: {} }
];

const rawIssues = [
  { id: 'issue-leads-email', datasetId: 'marketing-leads', field: 'email', column: 'email', ruleId: 'rule-lead-email-not-null', issue: 'Missing email addresses', count: 1284, severity: 'Medium', status: 'open', assignedToId: 'user-007' },
  { id: 'issue-transactions-orphan', datasetId: 'customer-transactions', field: 'customer_id', column: 'customer_id', ruleId: 'rule-customer-reference', issue: 'Orphaned customer references', count: 342, severity: 'High', status: 'investigating', assignedToId: 'user-003' },
  { id: 'issue-inventory-negative', datasetId: 'inventory', field: 'quantity_on_hand', column: 'quantity_on_hand', ruleId: 'rule-inventory-nonnegative', issue: 'Negative inventory values', count: 76, severity: 'Critical', status: 'open', assignedToId: 'user-003' },
  { id: 'issue-orders-discount', datasetId: 'sales-orders', field: 'discount', column: 'discount', ruleId: 'rule-discount-threshold', issue: 'Discount exceeds configured threshold', count: 128, severity: 'Medium', status: 'resolved', assignedToId: 'user-008' },
  { id: 'issue-customer-email', datasetId: 'customer-master', field: 'email', column: 'email', ruleId: 'rule-email-not-null', issue: 'Primary email format exceptions', count: 214, severity: 'Medium', status: 'investigating', assignedToId: 'user-005' },
  { id: 'issue-finance-currency', datasetId: 'finance-transactions', field: 'currency', column: 'currency', ruleId: 'rule-currency-valid', issue: 'Unsupported currency codes', count: 19, severity: 'High', status: 'open', assignedToId: 'user-006' },
  { id: 'issue-campaign-dates', datasetId: 'marketing-campaigns', field: 'end_date', column: 'end_date', ruleId: 'rule-campaign-date-order', issue: 'Campaign end date precedes start date', count: 24, severity: 'Low', status: 'resolved', assignedToId: 'user-007' },
  { id: 'issue-product-sku', datasetId: 'product-master', field: 'sku', column: 'sku', ruleId: 'rule-product-sku-unique', issue: 'Duplicate active SKU values', count: 31, severity: 'Medium', status: 'investigating', assignedToId: 'user-004' }
];

async function seedData() {
  console.log('Seeding RicozData database models...');

  // 1. Users
  const userMap = {};
  for (const u of rawUsers) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      user = await User.create({
        name: u.name,
        email: u.email,
        password: u.password || 'Password123!',
        role: u.role,
        department: u.department,
        avatar: u.avatar,
        avatarBg: u.avatarBg,
        status: 'active',
        lastActive: new Date('2026-09-22T09:30:00Z')
      });
    }
    userMap[u.id] = user._id;
  }
  console.log(`[Seed] ${Object.keys(userMap).length} users ready.`);

  // 2. Domains
  const domainMap = {};
  for (const d of rawDomains) {
    let domain = await Domain.findOne({ name: d.name });
    if (!domain) {
      domain = await Domain.create({
        name: d.name,
        description: d.description,
        leadId: userMap[d.leadId],
        icon: d.icon,
        color: d.color
      });
    }
    domainMap[d.id] = domain._id;
  }
  console.log(`[Seed] ${Object.keys(domainMap).length} domains ready.`);

  // 3. Policies
  const policyMap = {};
  for (const p of rawPolicies) {
    let policy = await Policy.findOne({ name: p.name });
    if (!policy) {
      policy = await Policy.create({
        name: p.name,
        description: p.description,
        category: p.category,
        ownerId: userMap[p.ownerId],
        owner: rawUsers.find(u => u.id === p.ownerId)?.name || 'Priya Shah',
        status: 'active',
        reviewFrequency: p.reviewFrequency,
        lastReviewed: new Date(p.lastReviewed),
        nextReview: new Date(p.nextReview),
        severity: p.severity,
        complianceFrameworks: p.complianceFrameworks,
        compliance: p.complianceFrameworks.join(', '),
        appliesTo: `${p.datasetIds.length} governed datasets`,
        scope: 'Demo metadata only; no live system enforcement.'
      });
    }
    policyMap[p.id] = policy._id;
  }
  console.log(`[Seed] ${Object.keys(policyMap).length} policies ready.`);

  // 4. Glossary
  const glossaryMap = {};
  for (const g of rawGlossary) {
    let term = await GlossaryTerm.findOne({ term: g.term });
    if (!term) {
      term = await GlossaryTerm.create({
        term: g.term,
        definition: g.definition,
        domainId: domainMap[g.domainId],
        domain: rawDomains.find(d => d.id === g.domainId)?.name || 'Customer',
        ownerId: userMap[g.ownerId],
        owner: rawUsers.find(u => u.id === g.ownerId)?.name || 'Priya Shah',
        status: 'active',
        tags: g.tags,
        usageCount: g.relatedDatasetIds.length * 8
      });
    }
    glossaryMap[g.id] = term._id;
  }
  console.log(`[Seed] ${Object.keys(glossaryMap).length} glossary terms ready.`);

  // 5. Datasets
  const datasetConfigs = [
    { id: 'customer-master', name: 'Customer Master', description: 'Conformed customer identity and account profile records used across commercial operations.', longDescription: 'The governed golden record for customer identity, lifecycle status, and segmentation across Ricoz Industries.', domainId: 'customer', ownerId: 'user-002', stewardId: 'user-005', source: 'Salesforce', sourceType: 'CRM', environment: 'Production', sensitivity: 'Confidential', certificationStatus: 'Certified', rowCount: '12.4M', size: '14.4 GB', sizeBytes: 15435038720, refreshFrequency: 'Hourly', tags: ['customer', 'master-data', 'pii'], policyIds: ['pol-pii-access', 'pol-masking', 'pol-retention'], glossaryTermIds: ['term-active-customer', 'term-clv', 'term-pii'], views: 1420, activeUsersCount: 18, quality: 98 },
    { id: 'customer-transactions', name: 'Customer Transactions', description: 'Atomic customer purchase and payment events for revenue and retention analysis.', longDescription: 'Conformed transaction history joined to Customer Master for downstream sales and finance reporting.', domainId: 'customer', ownerId: 'user-008', stewardId: 'user-003', source: 'Snowflake', sourceType: 'Cloud Data Warehouse', environment: 'Production', sensitivity: 'Confidential', certificationStatus: 'Certified', rowCount: '38.6M', size: '31.8 GB', sizeBytes: 34144990003, refreshFrequency: 'Every 15 minutes', tags: ['customer', 'transactions', 'revenue'], policyIds: ['pol-pii-access', 'pol-retention'], glossaryTermIds: ['term-active-customer', 'term-net-revenue'], views: 1108, activeUsersCount: 16, quality: 93 },
    { id: 'sales-orders', name: 'Sales Orders', description: 'Order-level commercial records used for fulfillment, revenue, and sales operations.', longDescription: 'Production order facts with customer, product, sales region, and commercial discount measures.', domainId: 'sales', ownerId: 'user-008', stewardId: 'user-003', source: 'SAP S/4HANA', sourceType: 'ERP', environment: 'Production', sensitivity: 'Confidential', certificationStatus: 'Certified', rowCount: '18.6M', size: '19.6 GB', sizeBytes: 21045339750, refreshFrequency: 'Every 30 minutes', tags: ['sales', 'orders', 'revenue'], policyIds: ['pol-retention', 'pol-quality-threshold'], glossaryTermIds: ['term-net-revenue', 'term-aov', 'term-fulfillment'], views: 1296, activeUsersCount: 21, quality: 94 },
    { id: 'sales-analytics', name: 'Sales Analytics', description: 'Curated sales performance mart for commercial leadership and forecasting.', longDescription: 'Daily and monthly sales metrics derived from orders, transactions, products, and customer dimensions.', domainId: 'sales', ownerId: 'user-008', stewardId: 'user-003', source: 'Snowflake', sourceType: 'Cloud Data Warehouse', environment: 'Production', sensitivity: 'Internal', certificationStatus: 'Certified', rowCount: '8.2M', size: '9.2 GB', sizeBytes: 9878424781, refreshFrequency: 'Daily at 06:00 UTC', tags: ['sales', 'analytics', 'forecast'], policyIds: ['pol-quality-threshold'], glossaryTermIds: ['term-active-customer', 'term-net-revenue', 'term-aov'], views: 980, activeUsersCount: 14, quality: 92 },
    { id: 'product-master', name: 'Product Master', description: 'Governed product, SKU, brand, category, and commercial pricing master data.', longDescription: 'Authoritative product master shared by inventory, sales order, and product analytics workloads.', domainId: 'product', ownerId: 'user-004', stewardId: 'user-005', source: 'SAP S/4HANA', sourceType: 'ERP', environment: 'Production', sensitivity: 'Internal', certificationStatus: 'Certified', rowCount: '2.1M', size: '2.4 GB', sizeBytes: 2576980378, refreshFrequency: 'Every 6 hours', tags: ['product', 'sku', 'master-data'], policyIds: ['pol-quality-threshold'], glossaryTermIds: ['term-inventory-turnover'], views: 760, activeUsersCount: 11, quality: 95 },
    { id: 'inventory', name: 'Inventory', description: 'Warehouse-level inventory positions and replenishment controls.', longDescription: 'Operational inventory snapshot used by fulfillment teams and sales availability services.', domainId: 'operations', ownerId: 'user-003', stewardId: 'user-005', source: 'Microsoft SQL Server', sourceType: 'Operational Database', environment: 'Production', sensitivity: 'Internal', certificationStatus: 'In Review', rowCount: '4.8M', size: '5.1 GB', sizeBytes: 5476083302, refreshFrequency: 'Every 15 minutes', tags: ['inventory', 'warehouse', 'operations'], policyIds: ['pol-quality-threshold'], glossaryTermIds: ['term-inventory-turnover', 'term-fulfillment'], views: 684, activeUsersCount: 12, quality: 91 },
    { id: 'employee-records', name: 'Employee Records', description: 'Workforce profile and organization records for people operations.', longDescription: 'Restricted employee directory and employment metadata; compensation detail is intentionally not included in this demo.', domainId: 'human-resources', ownerId: 'user-005', stewardId: 'user-009', source: 'Workday', sourceType: 'HCM', environment: 'Production', sensitivity: 'Restricted', certificationStatus: 'Certified', rowCount: '45.2K', size: '86 MB', sizeBytes: 90177536, refreshFrequency: 'Daily at 23:30 UTC', tags: ['hr', 'employees', 'restricted'], policyIds: ['pol-pii-access', 'pol-masking', 'pol-production-usage'], glossaryTermIds: ['term-data-owner', 'term-data-steward', 'term-pii'], views: 520, activeUsersCount: 6, quality: 96 },
    { id: 'finance-transactions', name: 'Finance Transactions', description: 'General ledger and financial transaction records for controllership.', longDescription: 'Financial postings, account activity, cost-center attribution, and reconciliation statuses.', domainId: 'finance', ownerId: 'user-006', stewardId: 'user-009', source: 'SAP S/4HANA', sourceType: 'ERP', environment: 'Production', sensitivity: 'Restricted', certificationStatus: 'Certified', rowCount: '24.8M', size: '29.1 GB', sizeBytes: 31245824000, refreshFrequency: 'Every 15 minutes', tags: ['finance', 'ledger', 'sox'], policyIds: ['pol-masking', 'pol-retention', 'pol-production-usage'], glossaryTermIds: ['term-net-revenue', 'term-gross-revenue'], views: 890, activeUsersCount: 16, quality: 96 },
    { id: 'marketing-campaigns', name: 'Marketing Campaigns', description: 'Campaign planning, spend, delivery, and outcome records.', longDescription: 'Cross-channel campaign metadata and performance measures used by Marketing and Sales Operations.', domainId: 'marketing', ownerId: 'user-007', stewardId: 'user-002', source: 'HubSpot', sourceType: 'Marketing Automation', environment: 'Production', sensitivity: 'Internal', certificationStatus: 'Certified', rowCount: '5.6M', size: '6.3 GB', sizeBytes: 6764573491, refreshFrequency: 'Every 4 hours', tags: ['marketing', 'campaigns', 'attribution'], policyIds: ['pol-external-sharing', 'pol-quality-threshold'], glossaryTermIds: ['term-cac', 'term-active-customer'], views: 640, activeUsersCount: 9, quality: 90 },
    { id: 'marketing-leads', name: 'Marketing Leads', description: 'Prospective customer lead and qualification events linked to campaigns.', longDescription: 'Marketing and sales lead records with attribution and qualification details; sourced as demo metadata only.', domainId: 'marketing', ownerId: 'user-007', stewardId: 'user-002', source: 'HubSpot', sourceType: 'Marketing Automation', environment: 'Production', sensitivity: 'Confidential', certificationStatus: 'In Review', rowCount: '9.6M', size: '8.8 GB', sizeBytes: 9448928051, refreshFrequency: 'Every 4 hours', tags: ['marketing', 'leads', 'pii'], policyIds: ['pol-pii-access', 'pol-retention', 'pol-external-sharing'], glossaryTermIds: ['term-cac', 'term-pii', 'term-active-customer'], views: 742, activeUsersCount: 10, quality: 87 }
  ];

  const datasetMap = {};
  for (const d of datasetConfigs) {
    let dataset = await Dataset.findOne({ name: d.name });
    if (!dataset) {
      dataset = await Dataset.create({
        name: d.name,
        description: d.description,
        longDescription: d.longDescription,
        domainId: domainMap[d.domainId],
        domain: rawDomains.find(dom => dom.id === d.domainId)?.name || 'Customer',
        ownerId: userMap[d.ownerId],
        owner: rawUsers.find(u => u.id === d.ownerId)?.name || 'Priya Shah',
        stewardId: userMap[d.stewardId],
        steward: rawUsers.find(u => u.id === d.stewardId)?.name || 'Vikram Mehta',
        source: d.source,
        sourceSystem: d.sourceSystem || d.source,
        sourceType: d.sourceType,
        environment: d.environment,
        sourceDetails: `${d.sourceType} • ${d.source} (${d.environment})`,
        sensitivity: d.sensitivity,
        certificationStatus: d.certificationStatus,
        rowCount: d.rowCount,
        size: d.size,
        sizeBytes: d.sizeBytes,
        refreshFrequency: d.refreshFrequency,
        tags: d.tags,
        policyIds: d.policyIds.map(pid => policyMap[pid]).filter(Boolean),
        glossaryTermIds: d.glossaryTermIds.map(gid => glossaryMap[gid]).filter(Boolean),
        views: d.views,
        activeUsersCount: d.activeUsersCount,
        quality: d.quality,
        usage: `${d.views.toLocaleString()} views`,
        lastRefresh: new Date('2026-09-22T09:00:00Z'),
        lastUpdatedDate: new Date('2026-09-22T09:00:00Z'),
        columns: [
          { name: 'id', type: 'UUID', primaryKey: true, nullable: false, pii: false, description: 'Surrogate primary key' },
          { name: 'name', type: 'VARCHAR(255)', primaryKey: false, nullable: false, pii: false, description: 'Display name entity attribute' },
          { name: 'email', type: 'VARCHAR(255)', primaryKey: false, nullable: true, pii: true, description: 'Contact email record' },
          { name: 'created_at', type: 'TIMESTAMP', primaryKey: false, nullable: false, pii: false, description: 'Row insertion timestamp' }
        ]
      });
    }
    datasetMap[d.id] = dataset._id;
  }
  console.log(`[Seed] ${Object.keys(datasetMap).length} datasets ready.`);

  // 6. Quality Metrics
  const qualityScores = {
    'customer-master': { score: 98, values: [99, 97, 98, 100, 98, 97], trend: '+1% from last month', dir: 'up' },
    'customer-transactions': { score: 93, values: [95, 92, 94, 96, 93, 89], trend: '+0.5% from last month', dir: 'up' },
    'sales-orders': { score: 94, values: [96, 94, 93, 97, 95, 90], trend: '+1.2% from last month', dir: 'up' },
    'sales-analytics': { score: 92, values: [94, 91, 93, 96, 92, 88], trend: '+0.8% from last month', dir: 'up' },
    'product-master': { score: 95, values: [97, 95, 94, 99, 96, 91], trend: 'Stable', dir: 'neutral' },
    'inventory': { score: 91, values: [93, 90, 92, 97, 88, 86], trend: '-1% from last month', dir: 'down' },
    'employee-records': { score: 96, values: [98, 96, 95, 99, 97, 92], trend: 'Stable', dir: 'neutral' },
    'finance-transactions': { score: 96, values: [97, 96, 95, 99, 97, 93], trend: '+0.4% from last month', dir: 'up' },
    'marketing-campaigns': { score: 90, values: [92, 90, 91, 95, 89, 85], trend: '+1% from last month', dir: 'up' },
    'marketing-leads': { score: 87, values: [82, 91, 88, 85, 90, 84], trend: '-2% from last month', dir: 'down' }
  };

  const dimNames = ['Completeness', 'Accuracy', 'Consistency', 'Uniqueness', 'Validity', 'Timeliness'];
  for (const [dsId, qData] of Object.entries(qualityScores)) {
    if (!datasetMap[dsId]) continue;
    let q = await Quality.findOne({ datasetId: datasetMap[dsId] });
    if (!q) {
      const dims = dimNames.map((name, i) => {
        const val = qData.values[i];
        return {
          name,
          score: val,
          color: val >= 95 ? '#10b981' : val >= 90 ? '#3b82f6' : val >= 85 ? '#f59e0b' : '#ef4444'
        };
      });

      await Quality.create({
        datasetId: datasetMap[dsId],
        score: qData.score,
        grade: qData.score >= 95 ? 'Excellent' : qData.score >= 90 ? 'Good' : qData.score >= 85 ? 'Fair' : 'At Risk',
        trendText: qData.trend,
        trendDirection: qData.dir,
        passedRulesCount: Math.round(qData.score / 2),
        totalRulesCount: 50,
        dimensions: dims,
        lastScanned: new Date('2026-09-22T09:15:00Z')
      });
    }
  }

  // 7. Quality Issues — multi-status lifecycle
  const enrichedIssues = [
    ...rawIssues,
    { id: 'issue-dup-sku', datasetId: 'product-master', field: 'sku', column: 'sku', ruleId: 'rule-product-sku-unique', issue: 'Duplicate active SKU values found in staging', count: 12, severity: 'Medium', status: 'acknowledged', assignedToId: 'user-004' },
    { id: 'issue-currency-fresh', datasetId: 'finance-transactions', field: 'currency', column: 'currency', ruleId: 'rule-currency-valid', issue: 'Stale currency codes in recent batch', count: 8, severity: 'High', status: 'in_progress', assignedToId: 'user-006' },
    { id: 'issue-orders-discount-resolved', datasetId: 'sales-orders', field: 'discount', column: 'discount', ruleId: 'rule-discount-threshold', issue: 'Discount exceeds threshold — resolved', count: 0, severity: 'Medium', status: 'resolved', assignedToId: 'user-008' },
    { id: 'issue-campaign-dates-ignored', datasetId: 'marketing-campaigns', field: 'end_date', column: 'end_date', ruleId: 'rule-campaign-date-order', issue: 'Chronological date mismatch — ignored', count: 3, severity: 'Low', status: 'ignored', assignedToId: 'user-007' },
    { id: 'issue-leads-reopen', datasetId: 'marketing-leads', field: 'email', column: 'email', ruleId: 'rule-lead-email-not-null', issue: 'Reopened: missing emails after refresh', count: 340, severity: 'Medium', status: 'open', assignedToId: 'user-007' },
    { id: 'issue-inventory-critical', datasetId: 'inventory', field: 'quantity_on_hand', column: 'quantity_on_hand', ruleId: 'rule-inventory-nonnegative', issue: 'Critical negative inventory alert', count: 15, severity: 'Critical', status: 'open', assignedToId: 'user-003' }
  ];

  for (const iss of enrichedIssues) {
    if (!datasetMap[iss.datasetId]) continue;
    let existingIssue = await QualityIssue.findOne({ ruleId: iss.ruleId, datasetId: datasetMap[iss.datasetId] });
    if (!existingIssue) {
      const issueDoc = {
        datasetId: datasetMap[iss.datasetId],
        field: iss.field,
        column: iss.column,
        ruleId: iss.ruleId,
        issue: iss.issue,
        count: iss.count,
        severity: iss.severity,
        status: iss.status,
        detectedAt: new Date('2026-09-22T08:30:00Z'),
        assignedToId: userMap[iss.assignedToId] || null
      };
      if (iss.status === 'acknowledged') issueDoc.acknowledgedAt = new Date('2026-09-22T09:00:00Z');
      if (iss.status === 'resolved') { issueDoc.resolvedAt = new Date('2026-09-23T10:00:00Z'); issueDoc.resolvedById = userMap[iss.assignedToId] || null; }
      await QualityIssue.create(issueDoc);
    }
  }

  // 8. Rules
  for (const r of rawRules) {
    if (!datasetMap[r.datasetId]) continue;
    let existingRule = await Rule.findOne({ name: r.name });
    if (!existingRule) {
      await Rule.create({
        ...r,
        datasetId: datasetMap[r.datasetId],
        targetDatasetId: datasetMap[r.targetDatasetId] || datasetMap[r.datasetId],
        owner: userMap[r.owner] || null,
        createdBy: userMap[r.createdBy] || null,
      });
    }
  }

  // 9. Evidence-Backed Lineage Graphs
  const verifiedDependencies = [
    { from: 'customer-master', to: 'customer-transactions', type: 'references', evidence: 'Foreign key customer_id constraint' },
    { from: 'customer-transactions', to: 'sales-orders', type: 'derives', evidence: 'Order payment transaction linkage' },
    { from: 'sales-orders', to: 'sales-analytics', type: 'aggregates', evidence: 'Daily revenue analytics rollup' },
    { from: 'product-master', to: 'inventory', type: 'references', evidence: 'Product SKU inventory position dependency' },
    { from: 'finance-transactions', to: 'sales-analytics', type: 'reconciles', evidence: 'General ledger reconciliation mart' }
  ];

  for (const d of datasetConfigs) {
    if (!datasetMap[d.id]) continue;
    let lin = await Lineage.findOne({ datasetId: datasetMap[d.id] });
    if (!lin) {
      const downstreamDeps = verifiedDependencies.filter(dep => dep.from === d.id);
      const upstreamDeps = verifiedDependencies.filter(dep => dep.to === d.id);

      const nodes = [
        {
          id: `source-${d.id}`,
          type: 'customLineageNode',
          position: { x: 50, y: 170 },
          data: {
            category: 'Source',
            categoryType: 'source',
            label: d.source,
            typeLabel: d.sourceType,
            system: d.source,
            ownerId: d.ownerId,
            source: `${d.source} Ingestion`,
            rows: d.rowCount,
            quality: `${d.quality}%`,
            dependencies: [],
            consumers: [d.name],
            updated: '2026-09-22T09:00:00Z',
            status: 'active'
          }
        },
        {
          id: `dataset-${d.id}`,
          type: 'customLineageNode',
          position: { x: 400, y: 170 },
          data: {
            category: 'Dataset',
            categoryType: 'dataset',
            label: d.name,
            typeLabel: d.sourceType,
            system: d.source,
            datasetId: datasetMap[d.id],
            ownerId: d.ownerId,
            source: d.source,
            rows: d.rowCount,
            quality: `${d.quality}%`,
            domainId: d.domainId,
            lastUpdated: '2026-09-22T09:00:00Z',
            dependencies: [d.source],
            consumers: downstreamDeps.map(dep => dep.to),
            isPrimary: true,
            updated: '2026-09-22T09:00:00Z',
            status: 'active'
          }
        }
      ];

      const edges = [
        {
          id: `edge-${d.id}-source`,
          source: `source-${d.id}`,
          target: `dataset-${d.id}`,
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2.5 },
          data: { relationshipType: 'ingests', evidence: `Direct ingestion from ${d.source}`, status: 'healthy' }
        }
      ];

      // Add verified downstream consumer nodes if genuine relationships exist
      downstreamDeps.forEach((dep, idx) => {
        const targetConf = datasetConfigs.find(c => c.id === dep.to);
        if (targetConf && datasetMap[dep.to]) {
          const targetNodeId = `dataset-${dep.to}`;
          nodes.push({
            id: targetNodeId,
            type: 'customLineageNode',
            position: { x: 750, y: 100 + (idx * 140) },
            data: {
              category: 'Dataset',
              categoryType: 'dataset',
              label: targetConf.name,
              typeLabel: targetConf.sourceType,
              system: targetConf.source,
              datasetId: datasetMap[dep.to],
              ownerId: targetConf.ownerId,
              source: targetConf.source,
              rows: targetConf.rowCount,
              quality: `${targetConf.quality}%`,
              domainId: targetConf.domainId,
              dependencies: [d.name],
              consumers: [],
              status: 'active'
            }
          });

          edges.push({
            id: `edge-${d.id}-to-${dep.to}`,
            source: `dataset-${d.id}`,
            target: targetNodeId,
            animated: true,
            style: { stroke: '#2563eb', strokeWidth: 2.5 },
            data: { relationshipType: dep.type, evidence: dep.evidence, status: 'healthy' }
          });
        }
      });

      await Lineage.create({
        datasetId: datasetMap[d.id],
        nodes,
        edges,
        sourceDatasets: [d.source],
        destinationDatasets: downstreamDeps.map(dep => dep.to),
        transformationInfo: `Governed data flow with ${downstreamDeps.length} verified downstream consumers`
      });
    }
  }

  // 10. Activities
  const rawActivities = [
    { title: 'Customer Master quality score updated', type: 'quality', actorId: 'user-005', datasetId: 'customer-master', timestamp: '2026-09-22T09:15:00Z' },
    { title: 'Sales Orders schema changed', type: 'update', actorId: 'user-003', datasetId: 'sales-orders', timestamp: '2026-09-22T08:40:00Z' },
    { title: 'Marketing Leads quality issue detected', type: 'alert', actorId: 'user-007', datasetId: 'marketing-leads', timestamp: '2026-09-22T08:30:00Z' },
    { title: 'PII Data Access Policy reviewed', type: 'governance', actorId: 'user-002', datasetId: 'customer-master', timestamp: '2026-09-21T15:00:00Z' },
    { title: 'Inventory pipeline completed successfully', type: 'lineage', actorId: 'user-003', datasetId: 'inventory', timestamp: '2026-09-22T09:15:00Z' },
    { title: 'Finance Transactions refreshed', type: 'update', actorId: 'user-006', datasetId: 'finance-transactions', timestamp: '2026-09-22T09:10:00Z' },
    { title: 'Net Revenue glossary term published', type: 'create', actorId: 'user-006', datasetId: 'sales-analytics', timestamp: '2026-09-21T12:00:00Z' },
    { title: 'Access granted to Customer Transactions', type: 'access', actorId: 'user-009', datasetId: 'customer-transactions', timestamp: '2026-09-21T10:30:00Z' },
    { title: 'Product Master SKU issue assigned', type: 'alert', actorId: 'user-004', datasetId: 'product-master', timestamp: '2026-09-21T12:40:00Z' },
    { title: 'Marketing Campaigns quality threshold reviewed', type: 'governance', actorId: 'user-002', datasetId: 'marketing-campaigns', timestamp: '2026-09-20T14:10:00Z' }
  ];

  for (const a of rawActivities) {
    let existingActivity = await Activity.findOne({ title: a.title });
    if (!existingActivity) {
      await Activity.create({
        title: a.title,
        type: a.type,
        actorId: userMap[a.actorId],
        datasetId: datasetMap[a.datasetId],
        timestamp: new Date(a.timestamp),
        time: 'Recently'
      });
    }
  }

  // 10. Data Sources
  const rawDataSources = [
    {
      name: 'MongoDB Primary Cluster',
      type: 'mongodb',
      description: 'Internal production database cluster hosting enterprise collections and catalog metadata.',
      status: 'CONNECTED',
      healthStatus: 'HEALTHY',
      tags: ['primary-db', 'operational', 'mongodb'],
      configuration: { host: '127.0.0.1', port: 27017, database: 'ricozdata' }
    },
    { name: 'Snowflake Enterprise Warehouse', type: 'snowflake', description: 'Central enterprise analytical warehouse hosting transactions, metrics, and curated data marts.', status: 'CONNECTED', healthStatus: 'HEALTHY', tags: ['cloud-dw', 'production', 'analytics'] },
    { name: 'Salesforce Production CRM', type: 'salesforce', description: 'Core customer relationship management platform containing golden customer identity accounts.', status: 'CONNECTED', healthStatus: 'HEALTHY', tags: ['crm', 'customer', 'pii'] },
    { name: 'SAP S/4HANA ERP', type: 'sap', description: 'Global enterprise resource planning system managing commercial orders, product master catalog, and billing.', status: 'CONNECTED', healthStatus: 'HEALTHY', tags: ['erp', 'orders', 'finance'] },
    { name: 'Microsoft SQL Server Operations', type: 'sqlserver', description: 'Operational warehouse management database tracking real-time inventory and fulfillment positions.', status: 'CONNECTED', healthStatus: 'HEALTHY', tags: ['operational-db', 'inventory', 'warehouse'] },
    { name: 'Workday HCM', type: 'workday', description: 'Human capital management system storing workforce profiles and organization hierarchies.', status: 'CONNECTED', healthStatus: 'HEALTHY', tags: ['hcm', 'workforce', 'restricted'] },
    { name: 'HubSpot Marketing Automation', type: 'hubspot', description: 'Marketing operations database capturing inbound leads, engagement signals, and campaign attributions.', status: 'CONNECTED', healthStatus: 'HEALTHY', tags: ['marketing', 'leads'] }
  ];

  for (const ds of rawDataSources) {
    let existing = await DataSource.findOne({ name: ds.name });
    if (!existing) {
      await DataSource.create({
        name: ds.name,
        type: ds.type,
        description: ds.description,
        status: ds.status,
        healthStatus: ds.healthStatus,
        connectionState: 'CONNECTED',
        tags: ds.tags,
        configuration: ds.configuration || {},
        connectionConfig: ds.configuration || {},
        createdBy: userMap['user-001'],
        ownerId: userMap['user-001'],
        tablesCount: ds.type === 'mongodb' ? 10 : 8
      });
    }
  }
  console.log(`[Seed] ${rawDataSources.length} data sources ready.`);

  // 11. Seed Real Underlying Database Collections
  if (mongoose.connection && mongoose.connection.db) {
    const db = mongoose.connection.db;

    // Customer Master
    const customerCol = db.collection('customer_master');
    if ((await customerCol.countDocuments()) === 0) {
      const customers = [];
      for (let i = 1; i <= 20; i++) {
        customers.push({
          customer_id: `CUST-${1000 + i}`,
          name: `Enterprise Client ${i}`,
          email: i === 8 ? null : `contact${i}@enterprise${i}.com`,
          status: 'active',
          country: i % 2 === 0 ? 'US' : 'GB',
          created_at: new Date('2026-01-15T10:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await customerCol.insertMany(customers);
    }

    // Customer Transactions
    const txnCol = db.collection('customer_transactions');
    if ((await txnCol.countDocuments()) === 0) {
      const txns = [];
      for (let i = 1; i <= 25; i++) {
        txns.push({
          transaction_id: `TXN-${5000 + i}`,
          customer_id: i === 12 ? 'CUST-9999' : `CUST-${1000 + ((i % 18) + 1)}`,
          amount: Math.round((100 + i * 45.5) * 100) / 100,
          transaction_date: '2026-05-12',
          created_at: new Date('2026-05-12T12:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await txnCol.insertMany(txns);
    }

    // Sales Orders
    const ordersCol = db.collection('sales_orders');
    if ((await ordersCol.countDocuments()) === 0) {
      const orders = [];
      const statuses = ['confirmed', 'shipped', 'delivered', 'pending'];
      for (let i = 1; i <= 25; i++) {
        orders.push({
          order_id: `ORD-${8000 + i}`,
          customer_id: `CUST-${1000 + ((i % 15) + 1)}`,
          status: statuses[i % statuses.length],
          discount: i === 15 ? 45 : (i % 25),
          total: Math.round((500 + i * 85) * 100) / 100,
          created_at: new Date('2026-06-01T09:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await ordersCol.insertMany(orders);
    }

    // Sales Analytics
    const analyticsCol = db.collection('sales_analytics');
    if ((await analyticsCol.countDocuments()) === 0) {
      const analytics = [];
      for (let i = 1; i <= 20; i++) {
        analytics.push({
          metric_id: `MTR-${4000 + i}`,
          period: `2026-M0${(i % 9) + 1}`,
          revenue: 1250000 + i * 25000,
          aov: 420.5,
          created_at: new Date('2026-07-01T00:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await analyticsCol.insertMany(analytics);
    }

    // Product Master
    const prodCol = db.collection('product_master');
    if ((await prodCol.countDocuments()) === 0) {
      const products = [];
      for (let i = 1; i <= 20; i++) {
        products.push({
          sku: i === 10 ? 'PROD-SKU-001' : `PROD-SKU-${String(i).padStart(3, '0')}`,
          name: `Enterprise Product ${i}`,
          price: 199.99 + i * 15,
          status: 'active',
          created_at: new Date('2026-01-01T00:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await prodCol.insertMany(products);
    }

    // Inventory
    const invCol = db.collection('inventory');
    if ((await invCol.countDocuments()) === 0) {
      const inv = [];
      for (let i = 1; i <= 20; i++) {
        inv.push({
          location_id: `LOC-${(i % 5) + 1}`,
          sku: `PROD-SKU-${String((i % 15) + 1).padStart(3, '0')}`,
          quantity_on_hand: i === 7 ? -5 : 50 + i * 12,
          created_at: new Date('2026-02-01T00:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await invCol.insertMany(inv);
    }

    // Employee Records
    const empCol = db.collection('employee_records');
    if ((await empCol.countDocuments()) === 0) {
      const emps = [];
      const depts = ['Engineering', 'Product', 'Sales', 'Marketing', 'Finance', 'HR'];
      for (let i = 1; i <= 15; i++) {
        emps.push({
          employee_id: `EMP-${100 + i}`,
          name: `Employee Name ${i}`,
          email: `employee${i}@ricoz.com`,
          department: depts[i % depts.length],
          created_at: new Date('2026-01-01T00:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await empCol.insertMany(emps);
    }

    // Finance Transactions
    const finCol = db.collection('finance_transactions');
    if ((await finCol.countDocuments()) === 0) {
      const fin = [];
      const currencies = ['USD', 'EUR', 'GBP', 'CAD'];
      for (let i = 1; i <= 25; i++) {
        fin.push({
          transaction_id: `FIN-${1000 + i}`,
          currency: i === 14 ? 'XYZ' : currencies[i % currencies.length],
          amount: 25000 + i * 1500,
          created_at: new Date('2026-04-01T00:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await finCol.insertMany(fin);
    }

    // Marketing Campaigns
    const campCol = db.collection('marketing_campaigns');
    if ((await campCol.countDocuments()) === 0) {
      const camps = [];
      for (let i = 1; i <= 15; i++) {
        camps.push({
          campaign_id: `CMP-${2000 + i}`,
          name: `Growth Campaign ${i}`,
          start_date: new Date('2026-01-01T00:00:00Z'),
          end_date: i === 9 ? new Date('2025-12-01T00:00:00Z') : new Date('2026-06-30T00:00:00Z'),
          created_at: new Date('2026-01-01T00:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await campCol.insertMany(camps);
    }

    // Marketing Leads
    const leadsCol = db.collection('marketing_leads');
    if ((await leadsCol.countDocuments()) === 0) {
      const leads = [];
      for (let i = 1; i <= 25; i++) {
        leads.push({
          lead_id: `LEAD-${3000 + i}`,
          email: i === 11 ? null : `lead${i}@growthclient${i}.org`,
          source: 'HubSpot Inbound',
          created_at: new Date('2026-03-01T00:00:00Z'),
          _updatedAt: new Date('2026-09-22T08:00:00Z')
        });
      }
      await leadsCol.insertMany(leads);
    }

    console.log('[Seed] 10 real underlying MongoDB data collections seeded.');
  }

  try {
    const { seedGovernance } = require('./governanceSeed');
    await seedGovernance();
  } catch (govSeedErr) {
    console.warn('[Seed] Governance seed error:', govSeedErr.message);
  }

  console.log('✅ Database Seed Complete');
}

// If run directly via node seed/seed.js
if (require.main === module) {
  const connectDB = require('../config/db');
  connectDB().then(async () => {
    await seedData();
    process.exit(0);
  }).catch(err => {
    console.error('Seed execution error:', err);
    process.exit(1);
  });
}

module.exports = { seedData };
