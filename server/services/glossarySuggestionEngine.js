const mongoose = require('mongoose');
const GlossaryTerm = require('../models/GlossaryTerm');
const GlossarySuggestion = require('../models/GlossarySuggestion');
const Dataset = require('../models/Dataset');
const DataSource = require('../models/DataSource');
const Domain = require('../models/Domain');

// Common abbreviations and acronym mapping
const ABBREVIATIONS = {
  id: 'ID',
  dob: 'Date of Birth',
  ssn: 'Social Security Number',
  amt: 'Amount',
  qty: 'Quantity',
  num: 'Number',
  no: 'Number',
  addr: 'Address',
  ph: 'Phone Number',
  tel: 'Phone Number',
  phone: 'Phone',
  email: 'Email',
  mail: 'Email',
  arr: 'Annual Recurring Revenue',
  mrr: 'Monthly Recurring Revenue',
  clv: 'Customer Lifetime Value',
  ltv: 'Customer Lifetime Value',
  cac: 'Customer Acquisition Cost',
  nrr: 'Net Retention Rate',
  aov: 'Average Order Value',
  sku: 'Stock Keeping Unit',
  ts: 'Timestamp',
  dt: 'Date',
  desc: 'Description',
  rev: 'Revenue',
  curr: 'Currency',
  org: 'Organization',
  dept: 'Department',
  pwd: 'Password',
  pass: 'Password',
  url: 'URL',
  uri: 'URI',
  ip: 'IP Address',
};

// Known technical metadata column patterns (low glossary relevance)
const TECHNICAL_METADATA_NAMES = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'created_by',
  'updated_by',
  'sync_timestamp',
  'ingested_at',
  'ingestion_time',
  'version',
  'row_version',
  'etl_timestamp',
  'load_timestamp',
  'is_deleted',
  'sys_created_at',
  'sys_updated_at',
  'batch_id',
]);

// Recognized core business entities mapping (dataset name -> singular Entity Name)
const CORE_ENTITY_DATASETS = {
  customers: 'Customer',
  customer: 'Customer',
  orders: 'Order',
  order: 'Order',
  products: 'Product',
  product: 'Product',
  payments: 'Payment',
  payment: 'Payment',
  invoices: 'Invoice',
  invoice: 'Invoice',
  accounts: 'Account',
  account: 'Account',
  users: 'User',
  user: 'User',
  employees: 'Employee',
  employee: 'Employee',
  vendors: 'Vendor',
  vendor: 'Vendor',
  transactions: 'Transaction',
  transaction: 'Transaction',
  subscriptions: 'Subscription',
  subscription: 'Subscription',
};

const CORE_BUSINESS_ENTITIES = new Set(Object.keys(CORE_ENTITY_DATASETS));

// Recommended priority ranking for governed concepts
const CATEGORY_PRIORITY_RANK = {
  BUSINESS_ENTITY: 1,
  BUSINESS_METRIC: 2,
  BUSINESS_MEASURE: 3,
  BUSINESS_ATTRIBUTE: 4,
  IDENTIFIER: 5,
  STATUS: 6,
  REFERENCE: 7,
  DATE_ATTRIBUTE: 8,
  CLASSIFICATION: 9,
  OTHER: 10,
  TECHNICAL_METADATA: 11,
};

// Business domain mappings based on entity/table semantics
const DOMAIN_INFERENCE_RULES = [
  { match: ['customer', 'user', 'client', 'account', 'subscriber', 'member', 'guest'], domain: 'Customer' },
  { match: ['order', 'sale', 'deal', 'quote', 'cart', 'checkout', 'booking', 'reservation'], domain: 'Sales' },
  { match: ['product', 'item', 'catalog', 'sku', 'inventory', 'merchandise', 'article'], domain: 'Product' },
  { match: ['payment', 'invoice', 'billing', 'finance', 'revenue', 'tax', 'ledger', 'accounting', 'payroll', 'salary'], domain: 'Finance' },
  { match: ['campaign', 'lead', 'market', 'ad', 'newsletter', 'promotion'], domain: 'Marketing' },
  { match: ['employee', 'staff', 'hr', 'attendance', 'department', 'recruitment', 'worker'], domain: 'Human Resources' },
  { match: ['shipment', 'delivery', 'logistic', 'warehouse', 'carrier', 'supply', 'fulfillment'], domain: 'Operations' },
  { match: ['patient', 'doctor', 'physician', 'hospital', 'clinic', 'appointment', 'medical', 'prescription', 'claim', 'treatment'], domain: 'Healthcare' },
  { match: ['loan', 'credit', 'deposit', 'bank', 'branch', 'mortgage', 'interest', 'portfolio'], domain: 'Banking' },
];

/**
 * Split any naming convention (snake_case, camelCase, PascalCase, kebab-case) into lowercase tokens
 */
function splitIdentifier(name) {
  if (!name || typeof name !== 'string') return [];

  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase / PascalCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // XMLReader -> XML Reader
    .replace(/[-_.\s]+/g, ' ') // delimiters
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean);
}

/**
 * Deduplicate repeated or adjacent semantic tokens
 * e.g. ['Phone', 'Number', 'Number'] -> ['Phone', 'Number']
 * e.g. ['Customer', 'Customer', 'ID'] -> ['Customer', 'ID']
 */
function deduplicateTokens(words) {
  const result = [];
  for (let i = 0; i < words.length; i++) {
    const current = words[i].trim();
    if (!current) continue;
    const lower = current.toLowerCase();

    // Skip consecutive exact duplicates
    if (result.length > 0 && result[result.length - 1].toLowerCase() === lower) {
      continue;
    }

    // Skip redundant ID identifier combinations
    if (lower === 'identifier' && result.length > 0 && result[result.length - 1].toLowerCase() === 'id') {
      continue;
    }
    if (lower === 'id' && result.length > 0 && result[result.length - 1].toLowerCase() === 'identifier') {
      continue;
    }

    // Skip redundant Number suffix if previous word already ended with Number (e.g. Phone Number Number)
    if (lower === 'number' && result.length > 0 && result[result.length - 1].toLowerCase().endsWith('number')) {
      continue;
    }

    // Skip redundant Price suffix if previous word already ended with Price (e.g. Product Price Price)
    if (lower === 'price' && result.length > 0 && result[result.length - 1].toLowerCase().endsWith('price')) {
      continue;
    }

    result.push(current);
  }
  return result;
}

/**
 * Convert tokens into a clean, human-readable Title Case term with canonical normalization
 */
function toTitleCase(tokens) {
  const words = [];

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i].toLowerCase();
    const nextRaw = i + 1 < tokens.length ? tokens[i + 1].toLowerCase() : null;

    if (raw === 'of' || raw === 'and' || raw === 'the') {
      // Lowercase prepositions/articles unless it is the first word
      words.push(i === 0 ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : raw.toLowerCase());
    } else if (raw === 'phone') {
      // If followed by 'number', keep 'Phone' so Phone + Number -> 'Phone Number'
      if (nextRaw === 'number' || nextRaw === 'num' || nextRaw === 'no') {
        words.push('Phone');
      } else {
        words.push('Phone Number');
      }
    } else if (ABBREVIATIONS[raw]) {
      const expanded = ABBREVIATIONS[raw];
      const subWords = expanded.split(' ');
      words.push(...subWords);
    } else {
      words.push(raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
    }
  }

  return deduplicateTokens(words).join(' ');
}

/**
 * Dynamically derive singular Title Case entity name from dataset or table name
 * Handles regular plural inflection (customers -> Customer, orders -> Order, etc.)
 */
function deriveEntityNameFromDataset(name) {
  if (!name || typeof name !== 'string') return null;
  const lower = name.trim().toLowerCase();
  if (CORE_ENTITY_DATASETS[lower]) {
    return CORE_ENTITY_DATASETS[lower];
  }

  const tokens = splitIdentifier(name);
  if (tokens.length === 0) return null;

  // Singularize the last token
  const singularTokens = tokens.map((token, idx) => {
    if (idx === tokens.length - 1) {
      const t = token.toLowerCase();
      if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y';
      if ((t.endsWith('ches') || t.endsWith('shes') || t.endsWith('xes') || t.endsWith('zes')) && t.length > 4) return t.slice(0, -2);
      if (t.endsWith('sses') && t.length > 4) return t.slice(0, -2);
      if (t.endsWith('ses') && t.length > 4) return t.slice(0, -2);
      if (t.endsWith('s') && !t.endsWith('ss') && t.length > 3) return t.slice(0, -1);
    }
    return token;
  });

  return toTitleCase(singularTokens);
}

/**
 * Determine if a catalog dataset represents an authoritative business entity table
 */
function isBusinessEntityCandidate(dataset) {
  if (!dataset || !dataset.name) return false;
  const name = (dataset.tableName || dataset.name).trim().toLowerCase();

  // Exclude technical, system, staging, log, and audit tables
  if (
    name.startsWith('sys_') ||
    name.startsWith('pg_') ||
    name.startsWith('temp_') ||
    name.includes('_log') ||
    name.includes('log_') ||
    name.includes('audit') ||
    name.includes('_history') ||
    name.includes('migration') ||
    name.includes('flyway') ||
    name.includes('snapshot') ||
    name === 'steward_metrics'
  ) {
    return false;
  }

  // Must have columns to be an entity
  const cols = dataset.columns || [];
  if (cols.length < 2) return false;

  return true;
}

/**
 * Synthesize candidate term name from dataset and column with context awareness
 */
function synthesizeTermName(datasetName, columnName) {
  const colNameLower = String(columnName || '').trim().toLowerCase();
  const colTokens = splitIdentifier(columnName);
  const dsTokens = splitIdentifier(datasetName);

  // Derive singular dataset entity name: customers -> customer, orders -> order
  const singularDsTokens = dsTokens.map((t, idx) => {
    if (idx === dsTokens.length - 1) {
      const lower = t.toLowerCase();
      if (lower.endsWith('ies') && lower.length > 4) return lower.slice(0, -3) + 'y';
      if (lower.endsWith('ses') && lower.length > 4) return lower.slice(0, -2);
      if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) return lower.slice(0, -1);
    }
    return t;
  });

  // Technical metadata is normalized uniformly without dataset prefix
  if (TECHNICAL_METADATA_NAMES.has(colNameLower) || (colTokens.length === 2 && colTokens[0] === 'created' && colTokens[1] === 'at')) {
    if (colNameLower.includes('created')) return 'Created At';
    if (colNameLower.includes('updated')) return 'Updated At';
    return toTitleCase(colTokens);
  }

  const colFirstToken = colTokens[0] || '';
  const alreadyMentionsEntity = colTokens.some((t) => singularDsTokens.includes(t));

  // Check if column starts with a recognized business entity (e.g. customer_id in orders, doctor_id in appointments)
  if (CORE_BUSINESS_ENTITIES.has(colFirstToken) || (colTokens.length >= 2 && colTokens[colTokens.length - 1] === 'id')) {
    return toTitleCase(colTokens);
  }

  const genericPropertyNames = new Set([
    'id',
    'name',
    'status',
    'type',
    'state',
    'email',
    'phone',
    'date',
    'code',
    'category',
    'price',
    'amount',
    'method',
    'description',
    'quantity',
    'stock',
    'first_name',
    'last_name',
    'date_of_birth',
    'dob',
  ]);

  if (!alreadyMentionsEntity && (genericPropertyNames.has(colFirstToken) || genericPropertyNames.has(colNameLower) || colTokens.length <= 2)) {
    // Prepend singular dataset entity name
    const combinedTokens = [...singularDsTokens, ...colTokens];
    return toTitleCase(combinedTokens);
  }

  return toTitleCase(colTokens);
}

/**
 * Classify column concept into governed categories (distinguishing Measures from Metrics)
 */
function classifyConcept(columnName, datasetName, columnMeta = {}) {
  const colNameLower = String(columnName || '').trim().toLowerCase();
  const colTokens = splitIdentifier(columnName);

  // 1. Technical Metadata
  if (
    TECHNICAL_METADATA_NAMES.has(colNameLower) ||
    colNameLower.startsWith('sys_') ||
    colNameLower.includes('sync_') ||
    colNameLower.includes('etl_') ||
    (colTokens.includes('created') && colTokens.includes('at')) ||
    (colTokens.includes('updated') && colTokens.includes('at')) ||
    (colTokens.includes('deleted') && colTokens.includes('at')) ||
    (colTokens.includes('ingestion') && colTokens.includes('time'))
  ) {
    return 'TECHNICAL_METADATA';
  }

  // 2. Identifier
  if (
    columnMeta.primaryKey ||
    columnMeta.foreignKey ||
    colNameLower === 'id' ||
    colNameLower.endsWith('_id') ||
    colTokens.includes('id') ||
    colTokens.includes('uuid') ||
    colTokens.includes('guid') ||
    colTokens.includes('ssn') ||
    colTokens.includes('sku')
  ) {
    return 'IDENTIFIER';
  }

  // 3. Status / Lifecycle
  if (
    colNameLower.includes('status') ||
    colNameLower.includes('state') ||
    colTokens.includes('status') ||
    colTokens.includes('state') ||
    colNameLower.startsWith('is_')
  ) {
    return 'STATUS';
  }

  // 4. Date Attribute (excluding technical metadata timestamps)
  if (
    colTokens.includes('date') ||
    colTokens.includes('dob') ||
    colTokens.includes('birth') ||
    colTokens.includes('registration') ||
    colTokens.includes('expiry') ||
    colTokens.includes('due') ||
    colNameLower.endsWith('_date') ||
    colNameLower.endsWith('_time')
  ) {
    return 'DATE_ATTRIBUTE';
  }

  // 5. Business Metric vs Business Measure
  // High-level aggregated KPIs, strategic performance indicators, rates, multi-period ratios
  const isHighLevelMetric =
    colTokens.includes('revenue') ||
    colTokens.includes('arr') ||
    colTokens.includes('mrr') ||
    colTokens.includes('clv') ||
    colTokens.includes('ltv') ||
    colTokens.includes('cac') ||
    colTokens.includes('nrr') ||
    colTokens.includes('aov') ||
    colTokens.includes('roi') ||
    colTokens.includes('rate') ||
    colTokens.includes('ratio') ||
    colNameLower.includes('lifetime_value') ||
    colNameLower.includes('churn_rate') ||
    colNameLower.includes('growth_rate') ||
    colNameLower.endsWith('_rate');

  if (isHighLevelMetric) {
    return 'BUSINESS_METRIC';
  }

  // Row-level direct transactional quantities, numerical amounts, unit prices: BUSINESS_MEASURE
  const isMeasure =
    colTokens.includes('amount') ||
    colTokens.includes('price') ||
    colTokens.includes('quantity') ||
    colTokens.includes('qty') ||
    colTokens.includes('stock') ||
    colTokens.includes('cost') ||
    colTokens.includes('balance') ||
    colTokens.includes('fee') ||
    colTokens.includes('salary') ||
    colTokens.includes('wage') ||
    colTokens.includes('charge') ||
    colTokens.includes('charges') ||
    colTokens.includes('days') ||
    colTokens.includes('hours') ||
    colTokens.includes('units') ||
    colTokens.includes('items') ||
    colTokens.includes('count') ||
    colNameLower.includes('total_amount') ||
    colNameLower.includes('payment_amount');

  if (isMeasure) {
    return 'BUSINESS_MEASURE';
  }

  // 6. Reference / Lookup
  if (
    colTokens.includes('category') ||
    colTokens.includes('type') ||
    colTokens.includes('currency') ||
    colTokens.includes('country') ||
    colTokens.includes('code') ||
    colTokens.includes('tier')
  ) {
    return 'REFERENCE';
  }

  // 7. Business Attribute (core descriptive entity attributes)
  if (
    colTokens.includes('email') ||
    colTokens.includes('phone') ||
    colTokens.includes('name') ||
    colTokens.includes('first') ||
    colTokens.includes('last') ||
    colTokens.includes('address') ||
    colTokens.includes('method') ||
    colTokens.includes('city') ||
    colTokens.includes('country') ||
    colTokens.includes('description')
  ) {
    return 'BUSINESS_ATTRIBUTE';
  }

  return 'BUSINESS_ATTRIBUTE';
}

/**
 * Resolve the parent business entity for any candidate term or column
 * Fully dynamic: resolves from entity names, dataset name, or cross-dataset foreign keys
 */
function resolveParentEntity(termName, datasetName, columnName) {
  const termLower = String(termName || '').trim().toLowerCase();
  const dsEntity = deriveEntityNameFromDataset(datasetName);
  const colTokens = splitIdentifier(columnName);

  // If column references another entity's identifier (foreign key pattern, e.g. customer_id in orders)
  if (colTokens.length >= 2 && (colTokens[colTokens.length - 1] === 'id' || colTokens.includes('id'))) {
    const fkEntityTokens = colTokens.slice(0, colTokens.length - 1);
    const fkEntity = toTitleCase(fkEntityTokens);
    if (fkEntity && termLower.startsWith(fkEntity.toLowerCase())) {
      return fkEntity;
    }
  }

  // If term explicitly starts with dataset entity name
  if (dsEntity && termLower.startsWith(dsEntity.toLowerCase())) {
    return dsEntity;
  }

  // Check recognized entity words
  const termTokens = splitIdentifier(termName);
  if (termTokens.length >= 2) {
    const firstWord = termTokens[0].toLowerCase();
    if (CORE_BUSINESS_ENTITIES.has(firstWord) || CORE_ENTITY_DATASETS[firstWord]) {
      return CORE_ENTITY_DATASETS[firstWord] || toTitleCase([firstWord]);
    }
  }

  return dsEntity || null;
}

/**
 * Infer business domain distinguishing business domains from technical environments
 */
function inferBusinessDomain(datasetName, tableName, existingDomain, columnName, domainMap = {}) {
  const validBusinessDomains = new Set([
    'Customer',
    'Sales',
    'Product',
    'Finance',
    'Marketing',
    'Human Resources',
    'Operations',
    'Healthcare',
    'Banking',
  ]);

  // Concept-specific domain resolution (e.g. Payment Status belongs to Finance even if found in orders table)
  const colLower = String(columnName || '').toLowerCase();
  if (colLower.includes('payment') || colLower.includes('invoice') || colLower.includes('billing')) {
    return {
      domainName: 'Finance',
      domainId: domainMap['Finance'] || null,
    };
  }

  // If catalog already provides a recognized business domain, preserve it
  if (existingDomain && validBusinessDomains.has(existingDomain)) {
    return {
      domainName: existingDomain,
      domainId: domainMap[existingDomain] || null,
    };
  }

  // Otherwise infer domain from dataset/table name and column context
  const searchCorpus = `${datasetName || ''} ${tableName || ''} ${columnName || ''}`.toLowerCase();

  for (const rule of DOMAIN_INFERENCE_RULES) {
    if (rule.match.some((m) => searchCorpus.includes(m))) {
      return {
        domainName: rule.domain,
        domainId: domainMap[rule.domain] || null,
      };
    }
  }

  // Dynamic contextual fallback: use derived entity name if available, else General
  const entityCandidate = deriveEntityNameFromDataset(datasetName || tableName);
  const fallback = entityCandidate || 'General';
  return {
    domainName: fallback,
    domainId: domainMap[fallback] || null,
  };
}

/**
 * Detect PII classification anomaly without mutating catalog data
 */
function detectPIIAnomaly(column, colNameLower) {
  const isMarkedPii = Boolean(column.pii || (column.sensitivity && column.sensitivity === 'Restricted'));
  const isLikelyNonPiiCommercial =
    colNameLower.includes('price') ||
    colNameLower.includes('amount') ||
    colNameLower.includes('stock_quantity') ||
    colNameLower.includes('category') ||
    colNameLower === 'order_id' ||
    colNameLower === 'product_id';

  if (isMarkedPii && isLikelyNonPiiCommercial) {
    return 'Potential classification anomaly: Catalog flags column as PII despite commercial/metric semantics.';
  }

  const isLikelyPiiAttribute =
    colNameLower.includes('email') ||
    colNameLower.includes('phone') ||
    colNameLower.includes('ssn') ||
    colNameLower.includes('date_of_birth') ||
    colNameLower === 'dob';

  if (!isMarkedPii && isLikelyPiiAttribute) {
    return '⚠ PII classification review: Potential classification anomaly — Semantic analysis indicates personal data, but the catalog classification does not currently identify this field as PII.';
  }

  return null;
}

/**
 * Context-aware general reasoning for measures (distinguishes monetary vs quantity vs percentage)
 */
function getMeasureReasoning(column, colNameLower) {
  const colTokens = splitIdentifier(column.name || colNameLower);
  const isPrice = colTokens.includes('price') || colTokens.includes('prices');
  const isAmount = colTokens.includes('amount') || colTokens.includes('amounts') || colTokens.includes('total_amount') || colTokens.includes('payment_amount');
  const isCostOrFee =
    colTokens.includes('cost') ||
    colTokens.includes('costs') ||
    colTokens.includes('fee') ||
    colTokens.includes('fees') ||
    colTokens.includes('charge') ||
    colTokens.includes('charges') ||
    colTokens.includes('rate') ||
    colTokens.includes('salary') ||
    colTokens.includes('wage');
  const isStockOrInv = colTokens.includes('stock') || colTokens.includes('inventory') || colTokens.includes('stocks');
  const isQuantityOrCount = colTokens.includes('quantity') || colTokens.includes('qty') || colTokens.includes('count') || colTokens.includes('units') || colTokens.includes('items');

  if (isPrice) {
    return 'Monetary measure identified from numeric data type and product pricing terminology.';
  }
  if (isAmount) {
    return 'Monetary measure identified from numeric data type and commercial amount terminology.';
  }
  if (isCostOrFee) {
    return 'Monetary measure identified from numeric data type and financial cost terminology.';
  }
  if (isStockOrInv) {
    return 'Quantity measure identified from numeric type and inventory terminology.';
  }
  if (isQuantityOrCount) {
    return 'Quantity measure identified from numeric data type and volume count terminology.';
  }
  return 'Quantitative business measure identified from numeric data type and transactional terminology.';
}

/**
 * Generate human-readable, grounded, conservative business definitions (no unsupported business claims)
 * Fully dynamic: derives conservative phrasing from concept category, entity name, and semantic tokens.
 */
function generateBusinessDefinition(termName, conceptCategory, datasetName, column = {}) {
  // If column has an explicit human business meaning in catalog that is not an introspection template, use it
  if (column.businessMeaning && !column.businessMeaning.toLowerCase().startsWith('introspected column')) {
    return column.businessMeaning;
  }
  if (column.description && column.description.length >= 15 && !column.description.toLowerCase().startsWith('introspected column')) {
    return column.description;
  }

  const norm = String(termName || '').trim();
  const normLower = norm.toLowerCase();
  const entityName = deriveEntityNameFromDataset(datasetName) || 'Business Entity';
  const entityLower = entityName.toLowerCase();

  // 1. BUSINESS_ENTITY
  if (conceptCategory === 'BUSINESS_ENTITY') {
    if (norm === 'Customer') return 'Business entity representing a customer account maintained by the business.';
    if (norm === 'Order') return 'Core business entity representing a commercial sales transaction placed by a customer.';
    if (norm === 'Product') return 'Core business entity representing a marketable good or item offered in the catalog.';
    if (norm === 'Payment') return 'Core business entity representing a financial settlement or monetary transaction for an order.';
    return `Business entity representing ${norm.toLowerCase()} records maintained by the business.`;
  }

  // 2. IDENTIFIER
  if (conceptCategory === 'IDENTIFIER' || normLower.endsWith(' id')) {
    if (norm === 'Customer ID') return 'Unique identifier assigned to a customer record to maintain referential uniqueness.';
    if (norm === 'Order ID') return 'Unique identifier assigned to a customer sales order transaction.';
    if (norm === 'Product ID') return 'Unique identifier assigned to a product catalog item.';
    if (norm === 'Payment ID') return 'Unique identifier assigned to a payment transaction record.';
    const entityPrefix = norm.replace(/\s+ID$/i, '');
    return `Unique identifier assigned to a ${entityPrefix.toLowerCase()} record to maintain referential uniqueness.`;
  }

  // 3. STATUS
  if (conceptCategory === 'STATUS' || normLower.endsWith(' status')) {
    if (norm === 'Customer Status') return 'Current operational lifecycle state of a customer record.';
    if (norm === 'Order Status') return 'Current lifecycle state of a customer order.';
    if (norm === 'Product Status') return 'Current commercial availability and lifecycle state of a product.';
    if (norm === 'Payment Status') return 'Current transaction settlement status of a payment record.';
    const entityPrefix = norm.replace(/\s+Status$/i, '');
    return `Current lifecycle state of a ${entityPrefix.toLowerCase()} record.`;
  }

  // 4. BUSINESS_MEASURE & METRIC
  if (conceptCategory === 'BUSINESS_MEASURE' || conceptCategory === 'BUSINESS_METRIC') {
    if (norm === 'Order Total Amount' || norm === 'Total Amount') return 'Total monetary amount recorded for a customer sales order.';
    if (norm === 'Payment Amount') return 'Total monetary amount processed for a payment transaction.';
    if (norm === 'Product Price' || norm === 'Price') return 'Monetary selling price assigned to a product item.';
    if (norm === 'Product Stock Quantity' || norm === 'Stock Quantity') return 'Physical quantity of units recorded in inventory for a product item.';

    if (normLower.includes('price')) return `Monetary selling price assigned to a ${entityLower} item.`;
    if (normLower.includes('amount') || normLower.includes('salary') || normLower.includes('cost') || normLower.includes('fee')) {
      return `Total monetary amount recorded for a ${entityLower} record.`;
    }
    if (normLower.includes('quantity') || normLower.includes('stock') || normLower.includes('count')) {
      return `Physical quantity of units recorded for a ${entityLower} record.`;
    }
    return `Numerical measure recorded for a ${entityLower} record.`;
  }

  // 5. DATE_ATTRIBUTE
  if (conceptCategory === 'DATE_ATTRIBUTE' || normLower.includes('date')) {
    if (norm === 'Customer Date of Birth' || norm === 'Customer Date Of Birth' || normLower.includes('birth')) {
      return 'Calendar date representing the date of birth associated with an individual customer.';
    }
    if (norm === 'Customer Registration Date' || norm === 'Registration Date') {
      return 'Calendar date recorded when a customer account was created.';
    }
    if (norm === 'Order Date') return 'Calendar date recorded when a customer sales order was placed.';
    if (norm === 'Payment Date') return 'Calendar date recorded when a payment transaction was processed.';
    return `Calendar date recorded for a ${entityLower} record.`;
  }

  // 6. BUSINESS_ATTRIBUTE
  if (norm === 'Customer Email' || normLower.endsWith('email')) {
    const subject = norm.replace(/\s+Email$/i, '') || 'account';
    return `Electronic mail address associated with a ${subject.toLowerCase()} account.`;
  }
  if (norm === 'Customer Phone Number' || normLower.includes('phone')) {
    const subject = norm.replace(/\s+Phone(\s+Number)?$/i, '') || 'individual';
    return `Telephone contact number associated with an individual ${subject.toLowerCase()}.`;
  }
  if (normLower.includes('first name')) {
    const subject = norm.replace(/\s+First\s+Name$/i, '') || entityName;
    return `Given name associated with an individual ${subject.toLowerCase()} record.`;
  }
  if (normLower.includes('last name')) {
    const subject = norm.replace(/\s+Last\s+Name$/i, '') || entityName;
    return `Surname or family name associated with an individual ${subject.toLowerCase()} record.`;
  }
  if (norm === 'Product Name' || normLower.endsWith('name')) {
    const subject = norm.replace(/\s+Name$/i, '') || entityName;
    return `Descriptive commercial name designating a ${subject.toLowerCase()}.`;
  }
  if (norm === 'Payment Method' || normLower.endsWith('method')) {
    return 'Payment instrument or channel utilized for a payment transaction.';
  }

  // 7. Reference & Technical
  if (norm === 'Product Category' || normLower.includes('category')) {
    return `Classification category used to organize ${entityLower} catalog items.`;
  }
  if (norm === 'Created At') {
    return 'System audit timestamp recording when the entity record was initially persisted.';
  }
  if (norm === 'Updated At') {
    return 'System audit timestamp recording the most recent modification of the entity record.';
  }

  // Fallback when insufficient evidence exists to prevent hallucination
  return 'Definition requires business review.';
}

/**
 * Calculate confidence scores: semanticConfidence, glossaryRelevanceScore, definitionConfidence
 */
function calculateConfidenceAndRelevance({ category, column, colNameLower, datasetName, isExistingMatch }) {
  const reasons = [];

  // 1. Semantic Confidence (how certain are we in understanding what this concept is)
  let semanticConfidence = 85;

  if (category === 'BUSINESS_ENTITY') {
    semanticConfidence = 99;
    reasons.push('High semantic match with core business entity catalog model');
  } else if (category === 'TECHNICAL_METADATA') {
    semanticConfidence = 98;
    reasons.push('High semantic match with standard system audit / temporal tracking pattern');
  } else if (category === 'IDENTIFIER') {
    semanticConfidence = 96;
    reasons.push('High semantic match with relational key / primary identifier pattern');
  } else if (colNameLower.includes('email') || colNameLower.includes('phone')) {
    semanticConfidence = 98;
    reasons.push('High semantic match with validated contact attribute pattern');
  } else if (category === 'BUSINESS_MEASURE' || category === 'BUSINESS_METRIC') {
    semanticConfidence = 95;
    reasons.push(getMeasureReasoning(column, colNameLower));
  } else if (category === 'STATUS') {
    semanticConfidence = 92;
    reasons.push('High semantic match with operational lifecycle status pattern');
  } else if (category === 'DATE_ATTRIBUTE') {
    semanticConfidence = 92;
    reasons.push('High semantic match with business calendar date pattern');
  } else {
    semanticConfidence = 80;
    reasons.push(`Extracted normalized terminology from column "${column.name}"`);
  }

  // Data type alignment bonus
  const colType = (column.type || '').toLowerCase();
  if (
    (colNameLower.includes('email') && (colType.includes('char') || colType.includes('string') || colType.includes('text'))) ||
    (category === 'IDENTIFIER' && (colType.includes('int') || colType.includes('uuid') || colType.includes('string'))) ||
    ((category === 'BUSINESS_MEASURE' || category === 'BUSINESS_METRIC') &&
      (colType.includes('numeric') || colType.includes('decimal') || colType.includes('float') || colType.includes('int'))) ||
    (category === 'DATE_ATTRIBUTE' && (colType.includes('date') || colType.includes('time')))
  ) {
    semanticConfidence = Math.min(99, semanticConfidence + 3);
    reasons.push(`Physical data type "${column.type}" aligns with semantic concept`);
  }

  // 2. Glossary Relevance Score (how valuable is this as an authoritative Business Glossary term)
  let glossaryRelevanceScore = 80;

  if (category === 'BUSINESS_ENTITY') {
    glossaryRelevanceScore = 99;
    reasons.push('Primary glossary candidate: Authoritative parent business entity');
  } else if (category === 'TECHNICAL_METADATA') {
    glossaryRelevanceScore = 25;
    reasons.push('Low glossary relevance: Technical audit timestamp; isolated in technical metadata view');
  } else if (category === 'BUSINESS_METRIC') {
    glossaryRelevanceScore = 98;
    reasons.push('Primary glossary candidate: Governed enterprise metric / KPI');
  } else if (category === 'BUSINESS_MEASURE') {
    glossaryRelevanceScore = 96;
    const isQty = colNameLower.includes('quantity') || colNameLower.includes('qty') || colNameLower.includes('stock') || colNameLower.includes('count');
    if (isQty) {
      reasons.push('Strong glossary candidate: Governed inventory/quantity measure');
    } else {
      reasons.push('Strong glossary candidate: Commercial business measure');
    }
  } else if (category === 'BUSINESS_ATTRIBUTE') {
    glossaryRelevanceScore = 95;
    reasons.push('Strong glossary candidate: Core enterprise business attribute');
  } else if (category === 'IDENTIFIER') {
    glossaryRelevanceScore = 88;
    reasons.push('Governed business identifier candidate');
  } else if (category === 'STATUS') {
    glossaryRelevanceScore = 88;
    reasons.push('Strong glossary candidate: Governed lifecycle enumeration');
  } else if (category === 'DATE_ATTRIBUTE') {
    glossaryRelevanceScore = 82;
    reasons.push('Governed business milestone date candidate');
  } else if (category === 'REFERENCE') {
    glossaryRelevanceScore = 80;
    reasons.push('Governed reference classification candidate');
  } else {
    glossaryRelevanceScore = 65;
  }

  // 3. Definition Confidence: communicates certainty of business definition grounded in evidence
  let definitionConfidence = 75;
  if (category === 'BUSINESS_ENTITY') {
    definitionConfidence = 95;
    reasons.push('High definition confidence: Core enterprise business entity concept');
  } else if (column.businessMeaning && column.businessMeaning.length >= 15) {
    definitionConfidence = 95;
    reasons.push('High definition confidence: Direct human-curated business meaning in metadata');
  } else if (column.description && column.description.length >= 15 && !column.description.toLowerCase().startsWith('introspected')) {
    definitionConfidence = 92;
    reasons.push('High definition confidence: Grounded in catalog column description');
  } else if (category === 'TECHNICAL_METADATA') {
    definitionConfidence = 95;
    reasons.push('High definition confidence: Universal audit timestamp semantics');
  } else if (colNameLower.includes('email')) {
    definitionConfidence = 92; // Customer Email: 90+
    reasons.push('High definition confidence: Verified standard contact electronic mail structure');
  } else if (colNameLower.includes('phone')) {
    definitionConfidence = 90;
    reasons.push('High definition confidence: Verified standard telephone contact structure');
  } else if (category === 'IDENTIFIER') {
    definitionConfidence = 85;
    reasons.push('High definition confidence: Relational key identifier structure');
  } else if (category === 'BUSINESS_MEASURE' || colNameLower.includes('total_amount') || colNameLower.includes('amount') || colNameLower.includes('price')) {
    definitionConfidence = 75; // Order Total Amount: 75-85
    const isQty = colNameLower.includes('quantity') || colNameLower.includes('qty') || colNameLower.includes('stock') || colNameLower.includes('count');
    if (isQty) {
      reasons.push('Conservative definition confidence: Physical unit quantity recorded in inventory/catalog');
    } else {
      reasons.push('Conservative definition confidence: Monetary measure without operational breakdown');
    }
  } else if (category === 'STATUS') {
    definitionConfidence = 82;
    reasons.push('Definition confidence: Governed lifecycle enumeration');
  } else if (category === 'DATE_ATTRIBUTE') {
    definitionConfidence = 82;
    reasons.push('Definition confidence: Business calendar date attribute');
  } else {
    definitionConfidence = 65;
    reasons.push('Reduced definition confidence: Limited metadata signals available');
  }

  // Strict PII classification separation: Only genuine personal attributes get sensitivity boost
  const isGenuinePii =
    colNameLower.includes('email') ||
    colNameLower.includes('phone') ||
    colNameLower.includes('date_of_birth') ||
    colNameLower === 'dob';

  if (isGenuinePii) {
    glossaryRelevanceScore = Math.min(99, glossaryRelevanceScore + 3);
    reasons.push('Sensitive / PII governance priority');
  }

  // Clamp scores
  semanticConfidence = Math.min(99, Math.max(30, semanticConfidence));
  glossaryRelevanceScore = Math.min(99, Math.max(15, glossaryRelevanceScore));
  definitionConfidence = Math.min(99, Math.max(40, definitionConfidence));

  const confidenceScore = semanticConfidence;
  const confidenceLevel = confidenceScore >= 90 ? 'high' : confidenceScore >= 70 ? 'medium' : 'low';

  return {
    semanticConfidence,
    glossaryRelevanceScore,
    definitionConfidence,
    confidenceScore,
    confidenceLevel,
    reasons,
  };
}

/**
 * Assign suggestion priority
 */
function assignSuggestionPriority({ category, glossaryRelevanceScore, semanticConfidence, isExistingMatch }) {
  if (isExistingMatch) {
    return 'EXISTING_TERM';
  }
  if (category === 'TECHNICAL_METADATA') {
    return 'TECHNICAL_METADATA';
  }
  if (category === 'BUSINESS_ENTITY') {
    return 'RECOMMENDED';
  }
  if (glossaryRelevanceScore >= 80 && semanticConfidence >= 75) {
    return 'RECOMMENDED';
  }
  if (glossaryRelevanceScore >= 60) {
    return 'REVIEW';
  }
  return 'LOW_PRIORITY';
}

/**
 * Abstract Provider interface
 */
class SemanticProvider {
  async analyzeColumn(context) {
    throw new Error('analyzeColumn must be implemented');
  }
}

/**
 * Rule-Based Deterministic Provider (Offline, zero-cost, high precision, context-aware)
 */
class RuleBasedProvider extends SemanticProvider {
  analyzeColumn({ dataset, column, existingTerms, domainMap }) {
    const colNameLower = (column.name || '').toLowerCase();
    const suggestedTerm = synthesizeTermName(dataset.name, column.name);
    const conceptCategory = classifyConcept(column.name, dataset.name, column);
    const parentEntityTerm = resolveParentEntity(suggestedTerm, dataset.name, column.name);

    // Business domain inference
    const { domainName, domainId } = inferBusinessDomain(
      dataset.name,
      dataset.tableName,
      dataset.domain,
      suggestedTerm,
      domainMap
    );

    // Existing GlossaryTerm matching & deduplication
    const existingMatch = existingTerms.find((t) => {
      const existingNorm = t.term.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
      const candidateNorm = suggestedTerm.toLowerCase().replace(/[-_\s]+/g, ' ').trim();
      if (existingNorm === candidateNorm) return true;
      if (t.synonyms && t.synonyms.some((s) => s.toLowerCase().replace(/[-_\s]+/g, ' ').trim() === candidateNorm)) return true;
      if (existingNorm === `${candidateNorm} address` || candidateNorm === `${existingNorm} address`) return true;
      return false;
    });

    // Scoring & transparent reasoning
    const { semanticConfidence, glossaryRelevanceScore, definitionConfidence, confidenceScore, confidenceLevel, reasons } =
      calculateConfidenceAndRelevance({
        category: conceptCategory,
        column,
        colNameLower,
        datasetName: dataset.name,
        isExistingMatch: Boolean(existingMatch),
      });

    let matchType = 'new_term';
    let matchedExistingTermId = null;

    if (existingMatch) {
      matchType = 'existing_term_link';
      matchedExistingTermId = existingMatch._id;
      reasons.push(`Existing authoritative term "${existingMatch.term}" discovered. Recommend linking instead of duplicating.`);
    }

    // PII diagnostic anomaly check
    const classificationAnomaly = detectPIIAnomaly(column, colNameLower);
    if (classificationAnomaly) {
      reasons.push(classificationAnomaly);
    }

    // Assign suggestion priority
    const suggestionPriority = assignSuggestionPriority({
      category: conceptCategory,
      glossaryRelevanceScore,
      semanticConfidence,
      isExistingMatch: Boolean(existingMatch),
    });

    // Business-oriented conservative definition
    const suggestedDefinition = existingMatch
      ? existingMatch.definition
      : generateBusinessDefinition(suggestedTerm, conceptCategory, dataset.name, column);

    // Tags synthesis: PII is strictly limited to true personal attributes
    const tagsSet = new Set();
    if (conceptCategory !== 'TECHNICAL_METADATA') {
      tagsSet.add(domainName);
    }

    const isTruePii =
      colNameLower.includes('email') ||
      colNameLower.includes('phone') ||
      colNameLower.includes('date_of_birth') ||
      colNameLower === 'dob';

    if (isTruePii) {
      tagsSet.add('PII');
    }
    if (column.primaryKey) tagsSet.add('Primary Key');
    if (column.foreignKey) tagsSet.add('Foreign Key');
    if (conceptCategory === 'TECHNICAL_METADATA') tagsSet.add('Technical Metadata');
    if (conceptCategory === 'BUSINESS_MEASURE') tagsSet.add('Measure');
    if (conceptCategory === 'BUSINESS_METRIC') tagsSet.add('Metric');
    if (conceptCategory === 'STATUS') tagsSet.add('Lifecycle');

    // Canonical Synonyms & Business Rules
    const synonyms = [];
    const businessRules = [];
    if (conceptCategory === 'IDENTIFIER') {
      synonyms.push('Identifier', 'Reference Key');
      businessRules.push('Immutable unique identifier; must never be re-used after record deletion');
    } else if (colNameLower.includes('email')) {
      synonyms.push('Email Address', 'Electronic Mail');
      businessRules.push('Must adhere to valid RFC 5322 format');
    } else if (colNameLower.includes('phone')) {
      synonyms.push('Telephone', 'Contact Number');
    } else if (conceptCategory === 'STATUS') {
      synonyms.push('State', 'Lifecycle Status');
      businessRules.push('Must belong to governed lifecycle enumeration');
    }

    return {
      suggestedTerm: existingMatch ? existingMatch.term : suggestedTerm,
      suggestedDefinition,
      suggestedDomainId: domainId,
      suggestedDomain: domainName,
      suggestedTags: Array.from(tagsSet),
      suggestedSynonyms: synonyms,
      suggestedExamples: [],
      suggestedBusinessRules: businessRules,
      semanticConfidence,
      glossaryRelevanceScore,
      definitionConfidence,
      conceptCategory,
      isEntity: false,
      parentEntityTerm,
      childAttributeTerms: [],
      suggestionPriority,
      classificationAnomaly,
      confidenceScore,
      confidenceLevel,
      reasoning: reasons.join('. ') + '.',
      detectionMethod: 'Rule Engine + Catalog Metadata Analysis',
      sourceDatasetIds: [dataset._id],
      sourceColumnRefs: [
        {
          datasetId: dataset._id,
          columnId: column._id,
          columnName: column.name,
          datasetName: dataset.name,
          dataType: column.type || 'string',
          isPII: isTruePii,
        },
      ],
      matchType,
      matchedExistingTermId,
    };
  }
}

/**
 * Main Suggestion Engine
 */
class GlossarySuggestionEngine {
  constructor(provider = new RuleBasedProvider()) {
    this.provider = provider;
  }

  /**
   * Analyze datasets and generate non-duplicate suggestions with entity-attribute hierarchy
   */
  async generateSuggestions({ datasetId, dataSourceId, scope = 'dataset', user }) {
    // 1. Identify active data sources to avoid stale/orphaned datasets
    const activeDataSources = await DataSource.find({}).select('_id').lean();
    const activeDataSourceIds = activeDataSources.map((d) => d._id);

    // 2. Fetch target datasets with projection
    const query = {};
    if (datasetId) {
      query._id = datasetId;
    } else if (dataSourceId) {
      query.dataSourceId = dataSourceId;
    } else {
      if (activeDataSourceIds.length > 0) {
        query.dataSourceId = { $in: activeDataSourceIds };
      }
      query.status = 'active';
    }

    const datasets = await Dataset.find(query).select('name displayName description domain domainId tableName columns dataSourceId');
    if (!datasets || datasets.length === 0) {
      return { generatedCount: 0, suggestions: [] };
    }

    // 3. Fetch existing GlossaryTerms and Domains for semantic matching
    const [existingTerms, domains] = await Promise.all([
      GlossaryTerm.find().select('term definition domain synonyms relatedDatasetIds relatedColumnRefs'),
      Domain.find().select('name _id'),
    ]);

    const domainMap = {};
    for (const d of domains) {
      domainMap[d.name] = d._id;
    }

    const rawCandidates = [];
    const discoveredEntities = new Map();

    // 4. Process datasets: discover parent BUSINESS_ENTITY candidates & column attributes
    for (const dataset of datasets) {
      const isEntity = isBusinessEntityCandidate(dataset);
      const matchedEntityName = isEntity ? deriveEntityNameFromDataset(dataset.tableName || dataset.name) : null;

      // Discovered parent business entity candidate
      if (matchedEntityName && !discoveredEntities.has(matchedEntityName.toLowerCase())) {
        const { domainName, domainId } = inferBusinessDomain(dataset.name, dataset.tableName, dataset.domain, matchedEntityName, domainMap);

        const existingEntityMatch = existingTerms.find(
          (t) => t.term.toLowerCase() === matchedEntityName.toLowerCase()
        );

        const idCol =
          (dataset.columns || []).find((c) => c.primaryKey || (c.name && c.name.toLowerCase().endsWith('_id')) || (c.name && c.name.toLowerCase() === 'id')) ||
          (dataset.columns && dataset.columns[0]);
        const entityColRefs = [];
        if (idCol) {
          entityColRefs.push({
            datasetId: dataset._id,
            columnId: idCol._id,
            columnName: idCol.name,
            datasetName: dataset.name,
            dataType: idCol.type || 'string',
            isPII: false,
          });
        }

        const entityCandidate = {
          suggestedTerm: matchedEntityName,
          suggestedDefinition: generateBusinessDefinition(matchedEntityName, 'BUSINESS_ENTITY', dataset.name, {}),
          suggestedDomainId: domainId,
          suggestedDomain: domainName,
          suggestedTags: [domainName, 'Business Entity'],
          suggestedSynonyms: [],
          suggestedExamples: [],
          suggestedBusinessRules: [],
          semanticConfidence: 99,
          glossaryRelevanceScore: 99,
          definitionConfidence: 95,
          conceptCategory: 'BUSINESS_ENTITY',
          isEntity: true,
          parentEntityTerm: null,
          childAttributeTerms: [],
          suggestionPriority: 'RECOMMENDED',
          classificationAnomaly: null,
          confidenceScore: 99,
          confidenceLevel: 'high',
          reasoning: `Core business entity discovered from governed catalog dataset "${dataset.name}".`,
          detectionMethod: 'Catalog Entity Discovery',
          sourceDatasetIds: [dataset._id],
          sourceColumnRefs: entityColRefs,
          matchType: existingEntityMatch ? 'existing_term_link' : 'new_term',
          matchedExistingTermId: existingEntityMatch ? existingEntityMatch._id : null,
        };

        discoveredEntities.set(matchedEntityName.toLowerCase(), entityCandidate);
        rawCandidates.push(entityCandidate);
      }

      // Analyze dataset columns
      if (Array.isArray(dataset.columns)) {
        for (const column of dataset.columns) {
          const candidate = this.provider.analyzeColumn({
            dataset,
            column,
            existingTerms,
            domainMap,
          });

          rawCandidates.push(candidate);
        }
      }
    }

    // 5. Cross-Dataset Grouping: Group multi-dataset occurrences of the same concept
    const grouped = new Map();

    for (const cand of rawCandidates) {
      const key = cand.suggestedTerm.toLowerCase();

      if (!grouped.has(key)) {
        grouped.set(key, cand);
      } else {
        const existing = grouped.get(key);

        // Merge dataset references
        for (const dId of cand.sourceDatasetIds) {
          if (!existing.sourceDatasetIds.some((id) => id.toString() === dId.toString())) {
            existing.sourceDatasetIds.push(dId);
          }
        }
        // Merge column references
        for (const colRef of cand.sourceColumnRefs) {
          if (
            !existing.sourceColumnRefs.some(
              (c) => c.datasetId.toString() === colRef.datasetId.toString() && c.columnId.toString() === colRef.columnId.toString()
            )
          ) {
            existing.sourceColumnRefs.push(colRef);
          }
        }

        // Boost confidence and relevance score when a concept appears across multiple catalog assets
        existing.semanticConfidence = Math.min(99, existing.semanticConfidence + 2);
        if (existing.conceptCategory !== 'TECHNICAL_METADATA') {
          existing.glossaryRelevanceScore = Math.min(99, existing.glossaryRelevanceScore + 5);
        }
        existing.confidenceScore = existing.semanticConfidence;
        existing.confidenceLevel = existing.confidenceScore >= 90 ? 'high' : existing.confidenceScore >= 70 ? 'medium' : 'low';

        // Re-evaluate suggestion priority
        existing.suggestionPriority = assignSuggestionPriority({
          category: existing.conceptCategory,
          glossaryRelevanceScore: existing.glossaryRelevanceScore,
          semanticConfidence: existing.semanticConfidence,
          isExistingMatch: existing.matchType === 'existing_term_link',
        });

        existing.reasoning += ` Confirmed across multiple datasets (${existing.sourceDatasetIds.length} assets).`;
      }
    }

    // 6. Build Entity -> Attribute semantic hierarchy relationships
    for (const candidate of grouped.values()) {
      if (candidate.isEntity) {
        // Collect all grouped attribute terms that belong to this entity
        const children = [];
        const entityPrefix = candidate.suggestedTerm.toLowerCase().slice(0, 4);

        for (const other of grouped.values()) {
          if (other.isEntity || other.conceptCategory === 'TECHNICAL_METADATA') continue;

          const isDirectChild = other.parentEntityTerm === candidate.suggestedTerm;
          const isRelatedSourceColumn =
            other.sourceColumnRefs &&
            other.sourceColumnRefs.some((c) => (c.datasetName || '').toLowerCase().startsWith(entityPrefix));

          if (isDirectChild || isRelatedSourceColumn) {
            if (!children.includes(other.suggestedTerm)) {
              children.push(other.suggestedTerm);
            }
          }
        }
        candidate.childAttributeTerms = children;
        if (children.length > 0) {
          candidate.reasoning += ` Parent entity for ${children.length} governed attributes.`;
        }
      }
    }

    // 7. Persist suggestions in database (avoid creating duplicate pending suggestions)
    const savedSuggestions = [];

    for (const candidate of grouped.values()) {
      let suggestion = await GlossarySuggestion.findOne({
        suggestedTerm: { $regex: `^${candidate.suggestedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        status: 'pending',
      });

      if (!suggestion) {
        suggestion = await GlossarySuggestion.create({
          suggestedTerm: candidate.suggestedTerm,
          suggestedDefinition: candidate.suggestedDefinition,
          suggestedDomainId: candidate.suggestedDomainId,
          suggestedDomain: candidate.suggestedDomain,
          suggestedTags: candidate.suggestedTags,
          suggestedSynonyms: candidate.suggestedSynonyms,
          suggestedExamples: candidate.suggestedExamples,
          suggestedBusinessRules: candidate.suggestedBusinessRules,
          semanticConfidence: candidate.semanticConfidence,
          glossaryRelevanceScore: candidate.glossaryRelevanceScore,
          definitionConfidence: candidate.definitionConfidence,
          conceptCategory: candidate.conceptCategory,
          isEntity: candidate.isEntity,
          parentEntityTerm: candidate.parentEntityTerm,
          childAttributeTerms: candidate.childAttributeTerms,
          suggestionPriority: candidate.suggestionPriority,
          classificationAnomaly: candidate.classificationAnomaly,
          confidenceScore: candidate.confidenceScore,
          confidenceLevel: candidate.confidenceLevel,
          sourceDatasetIds: candidate.sourceDatasetIds,
          sourceColumnRefs: candidate.sourceColumnRefs,
          matchType: candidate.matchType,
          matchedExistingTermId: candidate.matchedExistingTermId,
          reasoning: candidate.reasoning,
          detectionMethod: candidate.detectionMethod,
          status: 'pending',
        });
      } else {
        // Update references if new columns/datasets discovered
        for (const dId of candidate.sourceDatasetIds) {
          if (!suggestion.sourceDatasetIds.some((id) => id.toString() === dId.toString())) {
            suggestion.sourceDatasetIds.push(dId);
          }
        }
        for (const colRef of candidate.sourceColumnRefs) {
          if (
            !suggestion.sourceColumnRefs.some(
              (c) => c.datasetId.toString() === colRef.datasetId.toString() && c.columnId.toString() === colRef.columnId.toString()
            )
          ) {
            suggestion.sourceColumnRefs.push(colRef);
          }
        }

        suggestion.semanticConfidence = candidate.semanticConfidence;
        suggestion.glossaryRelevanceScore = candidate.glossaryRelevanceScore;
        suggestion.definitionConfidence = candidate.definitionConfidence;
        suggestion.conceptCategory = candidate.conceptCategory;
        suggestion.isEntity = candidate.isEntity;
        suggestion.parentEntityTerm = candidate.parentEntityTerm;
        suggestion.childAttributeTerms = candidate.childAttributeTerms;
        suggestion.suggestionPriority = candidate.suggestionPriority;
        suggestion.classificationAnomaly = candidate.classificationAnomaly;
        suggestion.confidenceScore = candidate.confidenceScore;
        suggestion.confidenceLevel = candidate.confidenceLevel;
        suggestion.suggestedDefinition = candidate.suggestedDefinition;
        suggestion.suggestedDomain = candidate.suggestedDomain;
        suggestion.suggestedTags = candidate.suggestedTags;
        suggestion.suggestedSynonyms = candidate.suggestedSynonyms;
        suggestion.suggestedBusinessRules = candidate.suggestedBusinessRules;
        suggestion.reasoning = candidate.reasoning;
        suggestion.updatedAt = new Date();
        await suggestion.save();
      }

      savedSuggestions.push(suggestion);
    }

    return {
      generatedCount: savedSuggestions.length,
      suggestions: savedSuggestions,
    };
  }
}

const defaultEngine = new GlossarySuggestionEngine();

module.exports = {
  GlossarySuggestionEngine,
  SemanticProvider,
  RuleBasedProvider,
  splitIdentifier,
  toTitleCase,
  deduplicateTokens,
  deriveEntityNameFromDataset,
  isBusinessEntityCandidate,
  synthesizeTermName,
  classifyConcept,
  resolveParentEntity,
  inferBusinessDomain,
  detectPIIAnomaly,
  generateBusinessDefinition,
  getMeasureReasoning,
  calculateConfidenceAndRelevance,
  assignSuggestionPriority,
  CATEGORY_PRIORITY_RANK,
  defaultEngine,
};
