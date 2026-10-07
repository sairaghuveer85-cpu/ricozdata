// Phase 3.1: Semantic Suggestion Quality Refinement Test Suite
// Verifies:
// 1. Canonical normalization (no duplicated semantic tokens like 'Customer Phone Number Number')
// 2. Concept classification (BUSINESS_ATTRIBUTE, IDENTIFIER, BUSINESS_METRIC, STATUS, DATE_ATTRIBUTE, TECHNICAL_METADATA, REFERENCE)
// 3. Twin scoring (semanticConfidence vs glossaryRelevanceScore)
// 4. Suggestion priority (RECOMMENDED, REVIEW, TECHNICAL_METADATA, LOW_PRIORITY)
// 5. Context-aware naming (products.name -> Product Name, orders.status -> Order Status)
// 6. Cross-dataset concept grouping (Customer ID across customers, orders, payments)
// 7. Business domain inference (Customer, Sales, Product, Finance - not DEVELOPMENT or GENERAL)
// 8. PII awareness and diagnostic anomaly detection
// 9. Business-readable definitions (no "Introspected column..." technical text)
// 10. Stale catalog isolation (ignores orphaned datasets from deleted data sources)
// 11. Existing glossary term matching and deduplication
// 12. API filtering by priority and category with enhanced summary metrics

const axios = require('axios');
const assert = require('assert');
const {
  splitIdentifier,
  toTitleCase,
  deduplicateTokens,
  synthesizeTermName,
  classifyConcept,
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

async function runQualityTestSuite() {
  console.log('===============================================================');
  console.log('STARTING RICOZDATA PHASE 3.1 SUGGESTION QUALITY TEST SUITE');
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

  // 2. CANONICAL NORMALIZATION & TOKEN DEDUPLICATION
  await testStep('Normalization: splitIdentifier handles snake_case, camelCase, PascalCase, kebab-case', async () => {
    assert.deepStrictEqual(splitIdentifier('customer_phone_number'), ['customer', 'phone', 'number']);
    assert.deepStrictEqual(splitIdentifier('customerPhoneNumber'), ['customer', 'phone', 'number']);
    assert.deepStrictEqual(splitIdentifier('CustomerPhoneNumber'), ['customer', 'phone', 'number']);
    assert.deepStrictEqual(splitIdentifier('customer-phone-number'), ['customer', 'phone', 'number']);
    assert.deepStrictEqual(splitIdentifier('order_id'), ['order', 'id']);
  });

  await testStep('Normalization: No duplicated semantic tokens (Customer Phone Number Number NEVER appears)', async () => {
    const normPhone1 = toTitleCase(['customer', 'phone', 'number']);
    assert.strictEqual(normPhone1, 'Customer Phone Number');

    const normPhone2 = toTitleCase(['customer', 'phone']);
    assert.strictEqual(normPhone2, 'Customer Phone Number');

    const normPhone3 = toTitleCase(['phone', 'number']);
    assert.strictEqual(normPhone3, 'Phone Number');

    // Edge case: input explicitly containing redundant words
    const deduped1 = toTitleCase(['customer', 'phone', 'number', 'number']);
    assert.strictEqual(deduped1, 'Customer Phone Number');

    const deduped2 = toTitleCase(['customer', 'id', 'id']);
    assert.strictEqual(deduped2, 'Customer ID');

    const deduped3 = toTitleCase(['order', 'id', 'identifier']);
    assert.strictEqual(deduped3, 'Order ID');
  });

  // 3. CONTEXT-AWARE SYNTHESIS
  await testStep('Context-Aware Naming: Contextualizes generic columns and entity references', async () => {
    assert.strictEqual(synthesizeTermName('products', 'name'), 'Product Name');
    assert.strictEqual(synthesizeTermName('products', 'price'), 'Product Price');
    assert.strictEqual(synthesizeTermName('products', 'category'), 'Product Category');
    assert.strictEqual(synthesizeTermName('products', 'product_status'), 'Product Status');
    assert.strictEqual(synthesizeTermName('orders', 'order_status'), 'Order Status');
    assert.strictEqual(synthesizeTermName('orders', 'order_date'), 'Order Date');
    assert.strictEqual(synthesizeTermName('payments', 'payment_amount'), 'Payment Amount');
    assert.strictEqual(synthesizeTermName('payments', 'payment_method'), 'Payment Method');
    assert.strictEqual(synthesizeTermName('customers', 'phone'), 'Customer Phone Number');
    assert.strictEqual(synthesizeTermName('customers', 'email'), 'Customer Email');
    assert.strictEqual(synthesizeTermName('created_at', 'created_at'), 'Created At');

    // Foreign key reference in orders references Customer entity, not "Order Customer ID"
    assert.strictEqual(synthesizeTermName('orders', 'customer_id'), 'Customer ID');
    assert.strictEqual(synthesizeTermName('payments', 'customer_id'), 'Customer ID');
  });

  // 4. CONCEPT CLASSIFICATION
  await testStep('Classification: Classifies columns into 10 governed categories', async () => {
    assert.strictEqual(classifyConcept('created_at', 'customers'), 'TECHNICAL_METADATA');
    assert.strictEqual(classifyConcept('updated_at', 'orders'), 'TECHNICAL_METADATA');
    assert.strictEqual(classifyConcept('sync_timestamp', 'orders'), 'TECHNICAL_METADATA');
    assert.strictEqual(classifyConcept('customer_id', 'customers'), 'IDENTIFIER');
    assert.strictEqual(classifyConcept('order_id', 'orders'), 'IDENTIFIER');
    assert.strictEqual(classifyConcept('email', 'customers'), 'BUSINESS_ATTRIBUTE');
    assert.strictEqual(classifyConcept('first_name', 'customers'), 'BUSINESS_ATTRIBUTE');
    assert.strictEqual(classifyConcept('order_status', 'orders'), 'STATUS');
    assert.strictEqual(classifyConcept('order_date', 'orders'), 'DATE_ATTRIBUTE');
    assert.strictEqual(classifyConcept('date_of_birth', 'customers'), 'DATE_ATTRIBUTE');
    assert(['BUSINESS_MEASURE', 'BUSINESS_METRIC'].includes(classifyConcept('price', 'products')));
    assert(['BUSINESS_MEASURE', 'BUSINESS_METRIC'].includes(classifyConcept('payment_amount', 'payments')));
    assert.strictEqual(classifyConcept('category', 'products'), 'REFERENCE');
  });

  // 5. TWIN SCORING (Semantic Confidence vs Glossary Relevance)
  await testStep('Twin Scoring: Distinguishes understanding (confidence) from glossary value (relevance)', async () => {
    // Technical metadata has high confidence but low glossary relevance
    const techScores = calculateConfidenceAndRelevance({
      category: 'TECHNICAL_METADATA',
      column: { name: 'created_at', type: 'timestamp' },
      colNameLower: 'created_at',
      datasetName: 'customers',
      isExistingMatch: false,
    });
    assert(techScores.semanticConfidence >= 95, 'created_at should have high semantic confidence');
    assert(techScores.glossaryRelevanceScore <= 35, 'created_at should have low glossary relevance score');

    // Business attribute (e.g. Email) has high confidence AND high glossary relevance
    const emailScores = calculateConfidenceAndRelevance({
      category: 'BUSINESS_ATTRIBUTE',
      column: { name: 'email', type: 'varchar' },
      colNameLower: 'email',
      datasetName: 'customers',
      isExistingMatch: false,
    });
    assert(emailScores.semanticConfidence >= 95, 'email should have high semantic confidence');
    assert(emailScores.glossaryRelevanceScore >= 90, 'email should have high glossary relevance score');

    // Suggestion priority mapping
    assert.strictEqual(
      assignSuggestionPriority({
        category: 'TECHNICAL_METADATA',
        glossaryRelevanceScore: techScores.glossaryRelevanceScore,
        semanticConfidence: techScores.semanticConfidence,
        isExistingMatch: false,
      }),
      'TECHNICAL_METADATA'
    );

    assert.strictEqual(
      assignSuggestionPriority({
        category: 'BUSINESS_ATTRIBUTE',
        glossaryRelevanceScore: emailScores.glossaryRelevanceScore,
        semanticConfidence: emailScores.semanticConfidence,
        isExistingMatch: false,
      }),
      'RECOMMENDED'
    );
  });

  // 6. DOMAIN INFERENCE
  await testStep('Domain Inference: Infers business domains without defaulting to DEVELOPMENT or GENERAL', async () => {
    const domainMap = {
      Customer: '6ac258b335ae36221abe22e0',
      Sales: '6ac258b335ae36221abe22e2',
      Product: '6ac258b335ae36221abe22e3',
      Finance: '6ac258b335ae36221abe22e1',
    };

    const dCust = inferBusinessDomain('customers', 'customers', 'DEVELOPMENT', 'email', domainMap);
    assert.strictEqual(dCust.domainName, 'Customer');
    assert.strictEqual(dCust.domainId, domainMap.Customer);

    const dSales = inferBusinessDomain('orders', 'orders', 'DEVELOPMENT', 'order_status', domainMap);
    assert.strictEqual(dSales.domainName, 'Sales');
    assert.strictEqual(dSales.domainId, domainMap.Sales);

    const dProd = inferBusinessDomain('products', 'products', 'DEVELOPMENT', 'price', domainMap);
    assert.strictEqual(dProd.domainName, 'Product');
    assert.strictEqual(dProd.domainId, domainMap.Product);

    const dFin = inferBusinessDomain('payments', 'payments', 'DEVELOPMENT', 'payment_amount', domainMap);
    assert.strictEqual(dFin.domainName, 'Finance');
    assert.strictEqual(dFin.domainId, domainMap.Finance);
  });

  // 7. PII AWARENESS & ANOMALY DETECTION
  await testStep('PII Awareness: Detects classification anomalies without mutating catalog data', async () => {
    // Anomaly: catalog flags price as PII
    const anomaly1 = detectPIIAnomaly({ name: 'price', pii: true }, 'price');
    assert(anomaly1 && anomaly1.includes('anomaly'), 'Should flag price marked as PII as an anomaly');

    // Anomaly: email is not flagged as PII
    const anomaly2 = detectPIIAnomaly({ name: 'email', pii: false }, 'email');
    assert(anomaly2 && anomaly2.includes('anomaly'), 'Should flag email missing PII tag as an anomaly');

    // Normal: order_id not PII
    const normal = detectPIIAnomaly({ name: 'order_id', pii: false }, 'order_id');
    assert.strictEqual(normal, null);
  });

  // 8. DEFINITIONS QUALITY
  await testStep('Definitions Quality: Generates business-oriented definitions (no introspection templates)', async () => {
    const custIdDef = generateBusinessDefinition('Customer ID', 'IDENTIFIER', 'customers', { name: 'customer_id' });
    assert(!custIdDef.toLowerCase().includes('introspected column'), 'Must not contain technical introspection text');
    assert(custIdDef.includes('Unique identifier assigned to a customer record'));

    const emailDef = generateBusinessDefinition('Customer Email', 'BUSINESS_ATTRIBUTE', 'customers', { name: 'email' });
    assert(!emailDef.toLowerCase().includes('introspected column'));
    assert(emailDef.includes('Electronic mail address associated with a customer account'));

    const orderStatusDef = generateBusinessDefinition('Order Status', 'STATUS', 'orders', { name: 'order_status' });
    assert(orderStatusDef.includes('Current lifecycle state of a customer order'));
  });

  // 9. LIVE CATALOG SCAN WITH ACTIVE POSTGRESQL DATASETS
  let liveGenerated = [];
  await testStep('Live Catalog Scan: Generate suggestions for active PostgreSQL test database', async () => {
    const res = await axios.post(`${BASE_URL}/api/glossary/suggestions/generate`, { scope: 'all' }, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    liveGenerated = res.data.data.suggestions;
    assert(liveGenerated.length > 0, 'Should generate candidates from active database');
  });

  await testStep('Acceptance Test: Customer ID is grouped across relevant datasets (3 source columns)', async () => {
    const custId = liveGenerated.find((s) => s.suggestedTerm === 'Customer ID');
    assert(custId, 'Customer ID candidate must be generated');
    assert.strictEqual(custId.conceptCategory, 'IDENTIFIER');
    assert.strictEqual(custId.suggestionPriority, 'RECOMMENDED');
    assert(
      custId.sourceColumnRefs.length >= 3,
      `Customer ID should link 3 source columns, found ${custId.sourceColumnRefs.length}`
    );
    const datasetsReferenced = custId.sourceColumnRefs.map((c) => c.datasetName.toLowerCase());
    assert(datasetsReferenced.includes('customers'));
    assert(datasetsReferenced.includes('orders'));
    assert(datasetsReferenced.includes('payments'));
  });

  await testStep('Acceptance Test: Order ID is grouped across orders and payments (not duplicated)', async () => {
    const orderId = liveGenerated.find((s) => s.suggestedTerm === 'Order ID');
    assert(orderId, 'Order ID candidate must be generated');
    assert.strictEqual(orderId.conceptCategory, 'IDENTIFIER');
    assert(orderId.sourceColumnRefs.length >= 2, 'Order ID should link orders and payments');
    const datasetsReferenced = orderId.sourceColumnRefs.map((c) => c.datasetName.toLowerCase());
    assert(datasetsReferenced.includes('orders'));
    assert(datasetsReferenced.includes('payments'));
  });

  await testStep('Acceptance Test: Product ID and Payment ID are detected as Identifiers', async () => {
    const prodId = liveGenerated.find((s) => s.suggestedTerm === 'Product ID');
    assert(prodId && prodId.conceptCategory === 'IDENTIFIER');
    const payId = liveGenerated.find((s) => s.suggestedTerm === 'Payment ID');
    assert(payId && payId.conceptCategory === 'IDENTIFIER');
  });

  await testStep('Acceptance Test: Customer Phone Number is normalized without Number Number duplication', async () => {
    const phoneCandidate = liveGenerated.find((s) => s.suggestedTerm.toLowerCase().includes('phone'));
    assert(phoneCandidate, 'Phone candidate must be generated');
    assert.strictEqual(phoneCandidate.suggestedTerm, 'Customer Phone Number');
    assert(!liveGenerated.some((s) => s.suggestedTerm.includes('Number Number')));
  });

  await testStep('Acceptance Test: Created At is classified as TECHNICAL_METADATA with low relevance', async () => {
    const createdAt = liveGenerated.find((s) => s.suggestedTerm === 'Created At');
    assert(createdAt, 'Created At candidate should be generated');
    assert.strictEqual(createdAt.conceptCategory, 'TECHNICAL_METADATA');
    assert.strictEqual(createdAt.suggestionPriority, 'TECHNICAL_METADATA');
    assert(createdAt.semanticConfidence >= 90, 'Semantic confidence should be high for created_at');
    assert(createdAt.glossaryRelevanceScore <= 35, 'Glossary relevance score should be low for created_at');
  });

  await testStep('Acceptance Test: Context-aware statuses (Order Status, Payment Status, Product Status)', async () => {
    const orderStatus = liveGenerated.find((s) => s.suggestedTerm === 'Order Status');
    assert(orderStatus && orderStatus.conceptCategory === 'STATUS');

    const paymentStatus = liveGenerated.find((s) => s.suggestedTerm === 'Payment Status');
    assert(paymentStatus && paymentStatus.conceptCategory === 'STATUS');
    assert(paymentStatus.sourceColumnRefs.length >= 2, 'Payment Status should link orders and payments');

    const prodStatus = liveGenerated.find((s) => s.suggestedTerm === 'Product Status');
    assert(prodStatus && prodStatus.conceptCategory === 'STATUS');
  });

  await testStep('Acceptance Test: Product Name and Product Price detected with business domains', async () => {
    const prodName = liveGenerated.find((s) => s.suggestedTerm === 'Product Name');
    assert(prodName && prodName.conceptCategory === 'BUSINESS_ATTRIBUTE');
    assert.strictEqual(prodName.suggestedDomain, 'Product');

    const prodPrice = liveGenerated.find((s) => s.suggestedTerm === 'Product Price');
    assert(prodPrice && (prodPrice.conceptCategory === 'BUSINESS_MEASURE' || prodPrice.conceptCategory === 'BUSINESS_METRIC'));
    assert.strictEqual(prodPrice.suggestedDomain, 'Product');
  });

  await testStep('Acceptance Test: Stale catalog records from deleted data sources are isolated', async () => {
    const staleTerms = liveGenerated.filter(
      (s) =>
        s.suggestedTerm.includes('Inventory Snapshot') ||
        s.suggestedTerm.includes('Order Daily') ||
        s.suggestedTerm.includes('Orders Daily')
    );
    assert.strictEqual(
      staleTerms.length,
      0,
      `Stale datasets from deleted data sources should be excluded; found: ${staleTerms.map((s) => s.suggestedTerm).join(', ')}`
    );
  });

  // 10. API FILTERING BY PRIORITY & CATEGORY
  await testStep('API Filtering: Filter by priority=recommended returns only recommended candidates', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions?priority=recommended`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.every((i) => i.suggestionPriority === 'RECOMMENDED'));
    assert(!items.some((i) => i.conceptCategory === 'TECHNICAL_METADATA'));
  });

  await testStep('API Filtering: Filter by priority=technical_metadata isolates technical timestamps', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions?priority=technical_metadata`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.every((i) => i.suggestionPriority === 'TECHNICAL_METADATA'));
  });

  await testStep('API Filtering: Filter by category=IDENTIFIER returns only identifier concepts', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions?category=IDENTIFIER`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    const items = res.data.data.items;
    assert(items.every((i) => i.conceptCategory === 'IDENTIFIER'));
  });

  await testStep('API Summary: Returns enhanced category and priority counts', async () => {
    const res = await axios.get(`${BASE_URL}/api/glossary/suggestions`, auth(stewardToken));
    assert.strictEqual(res.status, 200);
    const summary = res.data.data.summary;
    assert(typeof summary.recommendedCount === 'number');
    assert(typeof summary.technicalCount === 'number');
    assert(typeof summary.identifiersCount === 'number');
    assert(typeof summary.attributesCount === 'number');
    assert(typeof summary.metricsCount === 'number');
    assert(summary.recommendedCount > 0, 'Must have recommended candidates');
  });

  console.log('===============================================================');
  console.log(
    `PHASE 3.1 TEST RESULTS: ${passed}/${passed + failed} PASS (${(((passed / (passed + failed)) * 100).toFixed(1))}%)`
  );
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runQualityTestSuite().catch((err) => {
  console.error('Fatal error in Phase 3.1 test suite:', err);
  process.exit(1);
});
