// Phase 3.2: Semantic Business Model Refinement Test Suite
// Verifies:
// 1. Business Entities discovery (Customer, Order, Product, Payment)
// 2. Entity -> Attribute Hierarchy (Parent-child semantic relationships)
// 3. Refined Semantic Types (BUSINESS_ENTITY, BUSINESS_ATTRIBUTE, BUSINESS_MEASURE, BUSINESS_METRIC, IDENTIFIER, REFERENCE, STATUS, DATE_ATTRIBUTE, TECHNICAL_METADATA)
// 4. Definition Safety (Concise, grounded, conservative definitions; no hallucinated taxes, shipping, compliance, legal/preferred)
// 5. PII Classification Separation (Only true personal data flagged as PII; metrics/measures/identifiers are not PII)
// 6. Context-Aware Business Domain (Customer -> Customer, Order -> Sales, Product -> Product, Payment -> Finance, Payment Status -> Finance)
// 7. Confidence Model (Decoupled semanticConfidence, glossaryRelevanceScore, definitionConfidence)
// 8. Entity Grouping and Source Reference mapping
// 9. Duplicate Prevention across datasets (Customer ID, Payment Status unified)
// 10. Malformed Name Prevention (No duplicated tokens like Customer ID ID, Customer Phone Number Number)
// 11. Suggestion Priority Ordering (Entities and Measures prioritized, Technical Metadata deprioritized)
// 12. Approval Safety & Reviewer Editability (Pending status enforced, reviewer can edit before approval)
// 13. API Filtering by Business Entity, Business Measure, and category queries

const axios = require('axios');
const assert = require('assert');
const {
  splitIdentifier,
  toTitleCase,
  synthesizeTermName,
  classifyConcept,
  resolveParentEntity,
  inferBusinessDomain,
  detectPIIAnomaly,
  generateBusinessDefinition,
  calculateConfidenceAndRelevance,
  assignSuggestionPriority,
} = require('./services/glossarySuggestionEngine');

const BASE_URL = 'http://localhost:5000';

let adminToken = null;
let stewardToken = null;

async function login(email, password) {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  if (!res.data.success) {
    throw new Error(`Login failed for ${email}`);
  }
  return { token: res.data.data.token, user: res.data.data.user };
}

function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

async function runBusinessModelTestSuite() {
  console.log('===============================================================');
  console.log('STARTING RICOZDATA PHASE 3.2 SEMANTIC BUSINESS MODEL TEST SUITE');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  async function testStep(name, fn) {
    try {
      await fn();
      console.log(`[✅ PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[❌ FAIL] ${name}`);
      console.error(`         Error: ${err.response?.data?.message || err.message}`);
      if (err.stack) {
        console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      }
      failed++;
    }
  }

  // 1. SETUP
  await testStep('Setup: Authenticate data steward and admin', async () => {
    const admin = await login('raghuveer.chandran@ricoz-industries.demo', 'Password123!');
    adminToken = admin.token;
    const steward = await login('arjun.kumar@ricoz-industries.demo', 'Password123!');
    stewardToken = steward.token;
    assert(adminToken && stewardToken);
  });

  // 2. UNIT TESTS: REFINED SEMANTIC TYPES & MEASURES VS METRICS
  await testStep('Semantic Types: Differentiates BUSINESS_MEASURE from BUSINESS_METRIC', async () => {
    // Measures: row-level direct transactional quantities, amounts, unit prices
    assert.strictEqual(classifyConcept('total_amount', 'orders'), 'BUSINESS_MEASURE');
    assert.strictEqual(classifyConcept('payment_amount', 'payments'), 'BUSINESS_MEASURE');
    assert.strictEqual(classifyConcept('price', 'products'), 'BUSINESS_MEASURE');
    assert.strictEqual(classifyConcept('stock_quantity', 'products'), 'BUSINESS_MEASURE');
    assert.strictEqual(classifyConcept('cost', 'orders'), 'BUSINESS_MEASURE');

    // Metrics: high-level calculated performance indicators
    assert.strictEqual(classifyConcept('revenue', 'orders'), 'BUSINESS_METRIC');
    assert.strictEqual(classifyConcept('arr', 'orders'), 'BUSINESS_METRIC');
    assert.strictEqual(classifyConcept('mrr', 'orders'), 'BUSINESS_METRIC');
    assert.strictEqual(classifyConcept('clv', 'customers'), 'BUSINESS_METRIC');
    assert.strictEqual(classifyConcept('customer_lifetime_value', 'customers'), 'BUSINESS_METRIC');

    // Identifiers
    assert.strictEqual(classifyConcept('customer_id', 'customers'), 'IDENTIFIER');
    assert.strictEqual(classifyConcept('order_id', 'orders'), 'IDENTIFIER');
    assert.strictEqual(classifyConcept('product_id', 'products'), 'IDENTIFIER');
    assert.strictEqual(classifyConcept('payment_id', 'payments'), 'IDENTIFIER');

    // Attributes
    assert.strictEqual(classifyConcept('email', 'customers'), 'BUSINESS_ATTRIBUTE');
    assert.strictEqual(classifyConcept('first_name', 'customers'), 'BUSINESS_ATTRIBUTE');
    assert.strictEqual(classifyConcept('last_name', 'customers'), 'BUSINESS_ATTRIBUTE');

    // Statuses
    assert.strictEqual(classifyConcept('order_status', 'orders'), 'STATUS');
    assert.strictEqual(classifyConcept('payment_status', 'payments'), 'STATUS');

    // Dates
    assert.strictEqual(classifyConcept('order_date', 'orders'), 'DATE_ATTRIBUTE');
    assert.strictEqual(classifyConcept('payment_date', 'payments'), 'DATE_ATTRIBUTE');

    // Reference
    assert.strictEqual(classifyConcept('category', 'products'), 'REFERENCE');

    // Technical Metadata
    assert.strictEqual(classifyConcept('created_at', 'customers'), 'TECHNICAL_METADATA');
    assert.strictEqual(classifyConcept('updated_at', 'orders'), 'TECHNICAL_METADATA');
  });

  // 3. UNIT TESTS: DEFINITION SAFETY (NO HALLUCINATIONS)
  await testStep('Definition Safety: Conservative, grounded definitions without unsupported claims', async () => {
    // Order Total Amount: must NOT claim taxes or shipping
    const totalAmountDef = generateBusinessDefinition('Order Total Amount', 'BUSINESS_MEASURE', 'orders', { name: 'total_amount' });
    assert.strictEqual(totalAmountDef, 'Total monetary amount recorded for a customer sales order.');
    assert(!totalAmountDef.toLowerCase().includes('taxes'), 'Must not claim taxes without metadata');
    assert(!totalAmountDef.toLowerCase().includes('shipping'), 'Must not claim shipping without metadata');

    // Customer Date of Birth: must NOT claim compliance / age verification
    const dobDef = generateBusinessDefinition('Customer Date of Birth', 'DATE_ATTRIBUTE', 'customers', { name: 'date_of_birth' });
    assert.strictEqual(dobDef, 'Calendar date representing the date of birth associated with an individual customer.');
    assert(!dobDef.toLowerCase().includes('compliance'), 'Must not claim compliance without metadata');
    assert(!dobDef.toLowerCase().includes('verification'), 'Must not claim verification without metadata');

    // Customer First Name: must NOT claim legal or preferred
    const firstNameDef = generateBusinessDefinition('Customer First Name', 'BUSINESS_ATTRIBUTE', 'customers', { name: 'first_name' });
    assert.strictEqual(firstNameDef, 'Given name associated with an individual customer record.');
    assert(!firstNameDef.toLowerCase().includes('legal'), 'Must not claim legal without metadata');
    assert(!firstNameDef.toLowerCase().includes('preferred'), 'Must not claim preferred without metadata');

    // Fallback for unknown concept with insufficient metadata
    const unknownDef = generateBusinessDefinition('Custom Mystery Column', 'BUSINESS_ATTRIBUTE', 'orders', { name: 'mystery_col' });
    assert.strictEqual(unknownDef, 'Definition requires business review.');
  });

  // 4. UNIT TESTS: PARENT ENTITY RESOLUTION & HIERARCHY
  await testStep('Entity Hierarchy: Resolves parent business entity correctly', async () => {
    assert.strictEqual(resolveParentEntity('Customer ID', 'customers', 'customer_id'), 'Customer');
    assert.strictEqual(resolveParentEntity('Customer Email', 'customers', 'email'), 'Customer');
    assert.strictEqual(resolveParentEntity('Order ID', 'orders', 'order_id'), 'Order');
    assert.strictEqual(resolveParentEntity('Order Total Amount', 'orders', 'total_amount'), 'Order');
    assert.strictEqual(resolveParentEntity('Product Price', 'products', 'price'), 'Product');
    assert.strictEqual(resolveParentEntity('Payment Status', 'payments', 'payment_status'), 'Payment');
  });

  // 5. UNIT TESTS: CONFIDENCE MODEL & TRIPLE CONFIDENCE SEPARATION
  await testStep('Confidence Model: Decoupled semanticConfidence, relevance, and definitionConfidence', async () => {
    const measureScores = calculateConfidenceAndRelevance({
      category: 'BUSINESS_MEASURE',
      column: { name: 'total_amount', type: 'numeric' },
      colNameLower: 'total_amount',
      datasetName: 'orders',
      isExistingMatch: false,
    });

    assert(measureScores.semanticConfidence >= 95, 'High semantic understanding of numeric total_amount');
    assert(measureScores.glossaryRelevanceScore >= 95, 'High glossary relevance for revenue-bearing measure');
    assert.strictEqual(measureScores.definitionConfidence, 75, 'Conservative definition confidence communicates lack of deep operational context');

    const entityScores = calculateConfidenceAndRelevance({
      category: 'BUSINESS_ENTITY',
      column: { name: 'id' },
      colNameLower: 'id',
      datasetName: 'customers',
      isExistingMatch: false,
    });
    assert.strictEqual(entityScores.definitionConfidence, 95, 'Core entity definitions have high definition confidence');
  });

  // 6. UNIT TESTS: CONTEXT-AWARE BUSINESS DOMAINS
  await testStep('Business Domain: Infers context-aware domains (Payment Status -> Finance)', async () => {
    const domainMap = {
      Customer: '6ac258b335ae36221abe22e0',
      Sales: '6ac258b335ae36221abe22e2',
      Product: '6ac258b335ae36221abe22e3',
      Finance: '6ac258b335ae36221abe22e1',
    };

    // Payment Status in orders table must resolve to Finance domain, not Sales
    const dPaymentStatusInOrders = inferBusinessDomain('orders', 'orders', 'DEVELOPMENT', 'payment_status', domainMap);
    assert.strictEqual(dPaymentStatusInOrders.domainName, 'Finance');

    const dCust = inferBusinessDomain('customers', 'customers', 'DEVELOPMENT', 'customer_id', domainMap);
    assert.strictEqual(dCust.domainName, 'Customer');

    const dOrder = inferBusinessDomain('orders', 'orders', 'DEVELOPMENT', 'order_id', domainMap);
    assert.strictEqual(dOrder.domainName, 'Sales');

    const dProd = inferBusinessDomain('products', 'products', 'DEVELOPMENT', 'product_id', domainMap);
    assert.strictEqual(dProd.domainName, 'Product');
  });

  // 7. UNIT TESTS: NO MALFORMED NAMES
  await testStep('Normalization: Never produces malformed names like Customer ID ID or Customer Phone Number Number', async () => {
    assert.notStrictEqual(synthesizeTermName('customers', 'customer_id'), 'Customer ID ID');
    assert.strictEqual(synthesizeTermName('customers', 'customer_id'), 'Customer ID');

    assert.notStrictEqual(synthesizeTermName('customers', 'phone'), 'Customer Phone Number Number');
    assert.strictEqual(synthesizeTermName('customers', 'phone'), 'Customer Phone Number');

    assert.notStrictEqual(synthesizeTermName('orders', 'order_id'), 'Order ID ID');
    assert.strictEqual(synthesizeTermName('orders', 'order_id'), 'Order ID');

    assert.notStrictEqual(synthesizeTermName('products', 'price'), 'Product Price Price');
    assert.strictEqual(synthesizeTermName('products', 'price'), 'Product Price');
  });

  // 8. LIVE CATALOG SCAN WITH ACTIVE DATASETS (customers, orders, products, payments)
  let liveGenerated = [];
  await testStep('Live Catalog Scan: Generate suggestions against customers, orders, products, payments', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/generate`, { scope: 'all' }, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    liveGenerated = res.data.data.suggestions;
    assert(liveGenerated.length > 0, 'Must generate candidates');
  });

  // 9. ACCEPTANCE TEST: DISCOVER 4 CORE BUSINESS ENTITIES
  let customerEntity = null;
  let orderEntity = null;
  let productEntity = null;
  let paymentEntity = null;

  await testStep('Acceptance Test: Discovers Customer, Order, Product, Payment as BUSINESS_ENTITY', async () => {
    customerEntity = liveGenerated.find((s) => s.suggestedTerm === 'Customer');
    assert(customerEntity, 'Customer entity must be discovered');
    assert.strictEqual(customerEntity.conceptCategory, 'BUSINESS_ENTITY');
    assert.strictEqual(customerEntity.isEntity, true);
    assert.strictEqual(customerEntity.suggestedDomain, 'Customer');

    orderEntity = liveGenerated.find((s) => s.suggestedTerm === 'Order');
    assert(orderEntity, 'Order entity must be discovered');
    assert.strictEqual(orderEntity.conceptCategory, 'BUSINESS_ENTITY');
    assert.strictEqual(orderEntity.isEntity, true);
    assert.strictEqual(orderEntity.suggestedDomain, 'Sales');

    productEntity = liveGenerated.find((s) => s.suggestedTerm === 'Product');
    assert(productEntity, 'Product entity must be discovered');
    assert.strictEqual(productEntity.conceptCategory, 'BUSINESS_ENTITY');
    assert.strictEqual(productEntity.isEntity, true);
    assert.strictEqual(productEntity.suggestedDomain, 'Product');

    paymentEntity = liveGenerated.find((s) => s.suggestedTerm === 'Payment');
    assert(paymentEntity, 'Payment entity must be discovered');
    assert.strictEqual(paymentEntity.conceptCategory, 'BUSINESS_ENTITY');
    assert.strictEqual(paymentEntity.isEntity, true);
    assert.strictEqual(paymentEntity.suggestedDomain, 'Finance');
  });

  // 10. ACCEPTANCE TEST: ENTITY -> ATTRIBUTE HIERARCHY
  await testStep('Acceptance Test: Parent entities maintain childAttributeTerms relationships', async () => {
    // Customer hierarchy
    assert(customerEntity.childAttributeTerms.length >= 6, `Customer should have governed child attributes; got ${customerEntity.childAttributeTerms.length}`);
    assert(customerEntity.childAttributeTerms.includes('Customer ID'));
    assert(customerEntity.childAttributeTerms.includes('Customer Email'));
    assert(customerEntity.childAttributeTerms.includes('Customer Phone Number'));

    // Order hierarchy
    assert(orderEntity.childAttributeTerms.length >= 4, `Order should have governed child attributes; got ${orderEntity.childAttributeTerms.length}`);
    assert(orderEntity.childAttributeTerms.includes('Order ID'));
    assert(orderEntity.childAttributeTerms.includes('Order Total Amount'));
    assert(orderEntity.childAttributeTerms.includes('Order Status'));

    // Product hierarchy
    assert(productEntity.childAttributeTerms.length >= 4, `Product should have governed child attributes; got ${productEntity.childAttributeTerms.length}`);
    assert(productEntity.childAttributeTerms.includes('Product ID'));
    assert(productEntity.childAttributeTerms.includes('Product Price'));
    assert(productEntity.childAttributeTerms.includes('Product Stock Quantity'));

    // Payment hierarchy
    assert(paymentEntity.childAttributeTerms.length >= 4, `Payment should have governed child attributes; got ${paymentEntity.childAttributeTerms.length}`);
    assert(paymentEntity.childAttributeTerms.includes('Payment ID'));
    assert(paymentEntity.childAttributeTerms.includes('Payment Amount'));
    assert(paymentEntity.childAttributeTerms.includes('Payment Status'));

    // Verify child terms point back to their parent entity
    const custEmail = liveGenerated.find((s) => s.suggestedTerm === 'Customer Email');
    assert(custEmail && custEmail.parentEntityTerm === 'Customer', 'Customer Email must point to Customer as parentEntityTerm');

    const ordTotal = liveGenerated.find((s) => s.suggestedTerm === 'Order Total Amount');
    assert(ordTotal && ordTotal.parentEntityTerm === 'Order', 'Order Total Amount must point to Order as parentEntityTerm');
  });

  // 11. ACCEPTANCE TEST: BUSINESS_MEASURE CLASSIFICATION FOR AMOUNTS & QUANTITIES
  await testStep('Acceptance Test: Transactional quantities and prices are BUSINESS_MEASURE (not METRIC)', async () => {
    const orderTotal = liveGenerated.find((s) => s.suggestedTerm === 'Order Total Amount');
    assert(orderTotal, 'Order Total Amount must be discovered');
    assert.strictEqual(orderTotal.conceptCategory, 'BUSINESS_MEASURE');

    const paymentAmount = liveGenerated.find((s) => s.suggestedTerm === 'Payment Amount');
    assert(paymentAmount, 'Payment Amount must be discovered');
    assert.strictEqual(paymentAmount.conceptCategory, 'BUSINESS_MEASURE');

    const productPrice = liveGenerated.find((s) => s.suggestedTerm === 'Product Price');
    assert(productPrice, 'Product Price must be discovered');
    assert.strictEqual(productPrice.conceptCategory, 'BUSINESS_MEASURE');

    const stockQty = liveGenerated.find((s) => s.suggestedTerm === 'Product Stock Quantity');
    assert(stockQty, 'Product Stock Quantity must be discovered');
    assert.strictEqual(stockQty.conceptCategory, 'BUSINESS_MEASURE');
  });

  // 12. ACCEPTANCE TEST: DEFINITION SAFETY IN LIVE GENERATED TERMS
  await testStep('Acceptance Test: Live generated definitions are conservative and grounded', async () => {
    const orderTotal = liveGenerated.find((s) => s.suggestedTerm === 'Order Total Amount');
    assert.strictEqual(orderTotal.suggestedDefinition, 'Total monetary amount recorded for a customer sales order.');

    const custDob = liveGenerated.find((s) => s.suggestedTerm === 'Customer Date of Birth' || s.suggestedTerm === 'Customer Date Of Birth');
    assert.strictEqual(custDob.suggestedDefinition, 'Calendar date representing the date of birth associated with an individual customer.');

    const custFirstName = liveGenerated.find((s) => s.suggestedTerm === 'Customer First Name');
    assert.strictEqual(custFirstName.suggestedDefinition, 'Given name associated with an individual customer record.');
  });

  // 13. ACCEPTANCE TEST: PII IS NOT OVER-CLASSIFIED
  await testStep('Acceptance Test: PII tag is limited to genuine personal attributes', async () => {
    const piiTerms = liveGenerated.filter((s) => s.suggestedTags && s.suggestedTags.includes('PII')).map((s) => s.suggestedTerm);

    // Personal fields should have PII tag
    assert(piiTerms.includes('Customer Email'), 'Customer Email should have PII tag');
    assert(piiTerms.includes('Customer Phone Number'), 'Customer Phone Number should have PII tag');
    assert(piiTerms.some((t) => t.includes('Date of Birth') || t.includes('Date Of Birth')), 'Customer Date of Birth should have PII tag');

    // Transactional & structural identifiers and measures should NOT have PII tag
    assert(!piiTerms.includes('Order ID'), 'Order ID must not be PII');
    assert(!piiTerms.includes('Payment ID'), 'Payment ID must not be PII');
    assert(!piiTerms.includes('Product ID'), 'Product ID must not be PII');
    assert(!piiTerms.includes('Product Price'), 'Product Price must not be PII');
    assert(!piiTerms.includes('Product Stock Quantity'), 'Stock Quantity must not be PII');
    assert(!piiTerms.includes('Order Total Amount'), 'Order Total Amount must not be PII');
    assert(!piiTerms.includes('Order Status'), 'Order Status must not be PII');
  });

  // 14. ACCEPTANCE TEST: CROSS-DATASET GROUPING & NO DUPLICATE TERMS
  await testStep('Acceptance Test: Customer ID and Payment Status are unified across datasets', async () => {
    const customerIds = liveGenerated.filter((s) => s.suggestedTerm === 'Customer ID');
    assert.strictEqual(customerIds.length, 1, 'Only one Customer ID concept should exist');
    assert(customerIds[0].sourceColumnRefs.length >= 3, 'Customer ID should link customers, orders, and payments');

    const paymentStatuses = liveGenerated.filter((s) => s.suggestedTerm === 'Payment Status');
    assert.strictEqual(paymentStatuses.length, 1, 'Only one Payment Status concept should exist');
    assert(paymentStatuses[0].sourceColumnRefs.length >= 2, 'Payment Status should link orders and payments');
    assert.strictEqual(paymentStatuses[0].suggestedDomain, 'Finance', 'Payment Status domain must be Finance');
  });

  // 15. ACCEPTANCE TEST: SUGGESTION PRIORITY ORDERING
  await testStep('Acceptance Test: Priority assigns BUSINESS_ENTITY and measures as RECOMMENDED, deprioritizes technical metadata', async () => {
    assert.strictEqual(customerEntity.suggestionPriority, 'RECOMMENDED');
    assert.strictEqual(orderEntity.suggestionPriority, 'RECOMMENDED');

    const orderTotal = liveGenerated.find((s) => s.suggestedTerm === 'Order Total Amount');
    assert.strictEqual(orderTotal.suggestionPriority, 'RECOMMENDED');

    const createdAt = liveGenerated.find((s) => s.suggestedTerm === 'Created At');
    assert(createdAt, 'Created At should exist');
    assert.strictEqual(createdAt.suggestionPriority, 'TECHNICAL_METADATA');
    assert(createdAt.glossaryRelevanceScore <= 35, 'Technical metadata has low relevance score');
  });

  // 16. ACCEPTANCE TEST: API CATEGORY FILTERING & SUMMARY METRICS
  await testStep('API Filtering: Query by category=BUSINESS_ENTITY and category=BUSINESS_MEASURE', async () => {
    // Entities filter
    const resEntities = await axios.get(`${BASE_URL}/api/glossary/suggestions?category=BUSINESS_ENTITY`, auth(stewardToken));
    assert.strictEqual(resEntities.status, 200);
    assert(resEntities.data.data.items.length >= 4, 'Should return at least 4 business entities');
    assert(resEntities.data.data.items.every((i) => i.conceptCategory === 'BUSINESS_ENTITY'));

    // Measures filter
    const resMeasures = await axios.get(`${BASE_URL}/api/glossary/suggestions?category=BUSINESS_MEASURE`, auth(stewardToken));
    assert.strictEqual(resMeasures.status, 200);
    assert(resMeasures.data.data.items.length >= 4, 'Should return at least 4 business measures');
    assert(resMeasures.data.data.items.every((i) => i.conceptCategory === 'BUSINESS_MEASURE'));

    // Enhanced Summary Metrics
    const resSummary = await axios.get(`${BASE_URL}/api/glossary/suggestions`, auth(stewardToken));
    const summary = resSummary.data.data.summary;
    assert(typeof summary.entitiesCount === 'number');
    assert(typeof summary.measuresCount === 'number');
    assert(typeof summary.recommendedCount === 'number');
    assert(summary.entitiesCount >= 4, 'Summary must record at least 4 entities');
    assert(summary.measuresCount >= 4, 'Summary must record at least 4 measures');
  });

  // 17. ACCEPTANCE TEST: HUMAN APPROVAL SAFETY & REVIEWER EDITABILITY
  await testStep('Approval Safety: Suggestions remain pending until explicit approval, reviewer can edit fields', async () => {
    const pendingEntity = liveGenerated.find((s) => s.suggestedTerm === 'Customer' && s.status === 'pending');
    assert(pendingEntity, 'Customer entity suggestion must be in pending status');

    // Reviewer approves with tailored definition, tags, and domain
    const approveRes = await axios.post(
      `${BASE_URL}/api/glossary/suggestions/${pendingEntity._id}/approve`,
      {
        term: 'Customer',
        definition: 'Governed enterprise definition for an individual or organization customer.',
        domain: 'Customer',
        tags: ['Enterprise Entity', 'Core Domain', 'Customer'],
        synonyms: ['Client', 'Account Holder'],
      },
      auth(stewardToken)
    );

    assert(approveRes.status === 201 || approveRes.status === 200);
    const createdTerm = approveRes.data.data.term;
    assert.strictEqual(createdTerm.term, 'Customer');
    assert.strictEqual(createdTerm.definition, 'Governed enterprise definition for an individual or organization customer.');
    assert.strictEqual(createdTerm.status, 'approved');
    assert(createdTerm.synonyms.includes('Client'));

    // Suggestion record updated to approved
    const sugCheck = await axios.get(`${BASE_URL}/api/glossary/suggestions/${pendingEntity._id}`, auth(stewardToken));
    assert.strictEqual(sugCheck.data.data.status, 'approved');
  });

  console.log('===============================================================');
  console.log(`PHASE 3.2 TEST RESULTS: ${passed}/${passed + failed} PASS (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBusinessModelTestSuite().catch((err) => {
  console.error('Fatal error running Phase 3.2 test suite:', err);
  process.exit(1);
});
