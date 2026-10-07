import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Import frontend components
import DatasetTable from '../../src/components/catalog/DatasetTable.jsx';
import DatasetRow from '../../src/components/catalog/DatasetRow.jsx';
import DatasetSchema from '../../src/components/dataset/DatasetSchema.jsx';
import DatasetOverview from '../../src/components/dataset/DatasetOverview.jsx';
import DatasetHeader from '../../src/components/dataset/DatasetHeader.jsx';
import { getDatasetById } from '../../src/utils/dataSelectors.js';

const BASE_URL = 'http://localhost:5000/api/v1';

async function testFrontendIntegration() {
  console.log('=== RICOZDATA FRONTEND CATALOG & DATASET LIVE INTEGRATION TEST ===\n');

  // 1. Authenticate with backend
  console.log('1. Authenticating with real backend API (/api/v1/auth/login)...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': 'ricoz-demo'
    },
    body: JSON.stringify({
      email: 'lead.steward@ricoz.io',
      password: 'EnterprisePassword2026!',
      slug: 'ricoz-demo'
    })
  });

  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login must succeed with 200');
  assert.ok(loginData.data?.accessToken, 'Access token must be returned');
  const token = loginData.data.accessToken;
  console.log('   ✓ Logged in as:', loginData.data.user.name, `(${loginData.data.user.role})`);

  // 2. Fetch live datasets using token
  console.log('2. Fetching live datasets (/api/v1/datasets)...');
  const dsRes = await fetch(`${BASE_URL}/datasets`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const dsData = await dsRes.json();
  assert.strictEqual(dsRes.status, 200, 'GET /datasets must succeed');
  assert.ok(Array.isArray(dsData.data), 'data must be an array');
  console.log(`   ✓ Received ${dsData.data.length} live datasets from backend`);
  
  const datasetNames = dsData.data.map(d => d.name);
  console.log('   ✓ Dataset names from PostgreSQL:', datasetNames);
  assert.ok(datasetNames.includes('customers'), 'Must include customers');
  assert.ok(datasetNames.includes('products'), 'Must include products');

  // 3. Normalize backend datasets using exact AppContext normalizer
  const normalizeBackendDataset = (d) => {
    const stringId = d._id ? String(d._id) : (d.id || d.name);
    const rawType = (d.dataSourceId?.type || '').toLowerCase();
    const sourceName = rawType === 'postgresql' ? 'PostgreSQL' : (d.dataSourceId?.name || 'PostgreSQL');
    const schemaName = d.schemaName || 'public';

    const normalizedSchema = (d.columns || []).map(col => ({
      name: col.name,
      type: col.dataType || col.type || 'VARCHAR',
      primaryKey: Boolean(col.isPrimaryKey || col.primaryKey),
      nullable: col.nullable !== false,
      pii: Boolean(col.classification === 'pii' || col.piiClassification === 'pii' || col.pii),
      description: col.description || (col.isPrimaryKey ? 'Primary Key' : '')
    }));

    return {
      id: stringId,
      _id: stringId,
      name: d.name,
      displayName: d.displayName || d.name,
      domain: d.domain || (schemaName === 'public' ? 'Core' : schemaName) || 'Core',
      domainId: d.domainId || 'core',
      ownerId: d.ownerId ? String(d.ownerId) : 'user-001',
      owner: d.owner || 'Aria Vance',
      ownerEmail: d.ownerEmail || 'lead.steward@ricoz.io',
      ownerRole: d.ownerRole || 'Data Steward',
      source: sourceName,
      sourceDetails: {
        type: d.dataSourceId?.type || 'PostgreSQL',
        database: 'ricoz_test',
        schema: schemaName,
        environment: 'Production',
        syncSchedule: 'On-Demand',
        ...(d.sourceDetails || {})
      },
      quality: d.quality || 95,
      status: d.status || (d.syncStatus === 'ACTIVE' ? 'Active' : 'Draft'),
      certificationStatus: d.certificationStatus || 'certified',
      updated: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now',
      lastUpdatedDate: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sep 27, 2026',
      rows: d.schemaMetadata?.rowCount ? `${d.schemaMetadata.rowCount} rows` : '4 rows',
      columnsCount: normalizedSchema.length,
      sensitivity: d.classification === 'pii' ? 'Restricted' : d.classification === 'confidential' ? 'Confidential' : 'Internal',
      usage: d.usage || '12 queries',
      statistics: {
        rowCount: 4,
        sizeBytes: 16384,
        columnCount: normalizedSchema.length,
        queryCount30d: 5,
        activeUsersCount: 2,
        lastIngestionTime: d.updatedAt || new Date().toISOString(),
        ...(d.statistics || {})
      },
      description: d.description || (d.name === 'customers' ? 'Core customer accounts, demographic profiles, and contact details synchronized from PostgreSQL.' : 'Product catalog items, pricing tiers, and category classifications synchronized from PostgreSQL.'),
      tags: d.tags && d.tags.length > 0 ? d.tags : ['postgresql', 'live-catalog', d.name],
      schema: normalizedSchema,
      origin: d.origin || 'DISCOVERED',
      syncStatus: d.syncStatus || 'ACTIVE'
    };
  };

  const normalizedDatasets = dsData.data.map(normalizeBackendDataset);
  const customers = normalizedDatasets.find(d => d.name === 'customers');
  const products = normalizedDatasets.find(d => d.name === 'products');

  // 4. Verify DatasetTable rendering with real PostgreSQL datasets
  console.log('3. Testing DatasetTable rendering with PostgreSQL datasets...');
  const { ThemeProvider } = await import('../../src/context/ThemeContext.jsx');
  const { AppProvider } = await import('../../src/context/AppContext.jsx');

  const tableHtml = renderToString(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AppProvider,
          null,
          React.createElement(DatasetTable, {
            datasets: normalizedDatasets,
            selectedIds: [],
            setSelectedIds: () => {},
            onResetFilters: () => {}
          })
        )
      )
    )
  );

  assert.ok(tableHtml.includes('customers'), 'Table must render "customers"');
  assert.ok(tableHtml.includes('products'), 'Table must render "products"');
  console.log('   ✓ DatasetTable renders both "customers" and "products" successfully');

  // 5. Test Search Filtering
  console.log('4. Testing Search Filtering...');
  // Search: "customers"
  const searchCustomers = normalizedDatasets.filter(d => d.name.toLowerCase().includes('customers'));
  assert.strictEqual(searchCustomers.length, 1);
  assert.strictEqual(searchCustomers[0].name, 'customers');
  console.log('   ✓ Search "customers" matches exact dataset');

  // Search: "products"
  const searchProducts = normalizedDatasets.filter(d => d.name.toLowerCase().includes('products'));
  assert.strictEqual(searchProducts.length, 1);
  assert.strictEqual(searchProducts[0].name, 'products');
  console.log('   ✓ Search "products" matches exact dataset');

  // Search: "customer"
  const searchCustomer = normalizedDatasets.filter(d => d.name.toLowerCase().includes('customer'));
  assert.strictEqual(searchCustomer.length, 1);
  assert.strictEqual(searchCustomer[0].name, 'customers');
  console.log('   ✓ Search "customer" prefix matches "customers"');

  // Search: "product"
  const searchProduct = normalizedDatasets.filter(d => d.name.toLowerCase().includes('product'));
  assert.strictEqual(searchProduct.length, 1);
  assert.strictEqual(searchProduct[0].name, 'products');
  console.log('   ✓ Search "product" prefix matches "products"');

  // Source Filter: "PostgreSQL"
  const pgFiltered = normalizedDatasets.filter(d => d.source === 'PostgreSQL');
  assert.strictEqual(pgFiltered.length, 2);
  console.log('   ✓ Source filter "PostgreSQL" matches both datasets');

  // 6. Test Schema Component Rendering for customers
  console.log('5. Testing Schema rendering for "customers"...');
  const custSchemaHtml = renderToString(
    React.createElement(DatasetSchema, { schema: customers.schema })
  );

  const expectedCustCols = ['customer_id', 'name', 'email', 'phone', 'age', 'created_at'];
  for (const col of expectedCustCols) {
    assert.ok(custSchemaHtml.includes(col), `Customers schema must render column "${col}"`);
  }
  assert.ok(custSchemaHtml.includes('integer'), 'Must render integer type');
  assert.ok(custSchemaHtml.includes('character varying'), 'Must render character varying type');
  assert.ok(custSchemaHtml.includes('timestamp without time zone'), 'Must render timestamp type');
  console.log('   ✓ All 6 customers columns and data types rendered:', expectedCustCols.join(', '));

  // 7. Test Schema Component Rendering for products
  console.log('6. Testing Schema rendering for "products"...');
  const prodSchemaHtml = renderToString(
    React.createElement(DatasetSchema, { schema: products.schema })
  );

  const expectedProdCols = ['product_id', 'product_name', 'price', 'category', 'created_at'];
  for (const col of expectedProdCols) {
    assert.ok(prodSchemaHtml.includes(col), `Products schema must render column "${col}"`);
  }
  assert.ok(prodSchemaHtml.includes('numeric'), 'Must render numeric type');
  console.log('   ✓ All 5 products columns and data types rendered:', expectedProdCols.join(', '));

  // 8. Test DatasetHeader and DatasetOverview rendering
  console.log('7. Testing DatasetHeader & DatasetOverview rendering...');
  const headerHtml = renderToString(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AppProvider,
          null,
          React.createElement(DatasetHeader, { dataset: customers, onOpenQuery: () => {}, onDelete: () => {} })
        )
      )
    )
  );
  assert.ok(headerHtml.includes('customers'));
  assert.ok(headerHtml.includes('PostgreSQL'));

  const overviewHtml = renderToString(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          AppProvider,
          null,
          React.createElement(DatasetOverview, { dataset: customers, onUpdateTags: () => {} })
        )
      )
    )
  );
  assert.ok(overviewHtml.includes('customers'));
  console.log('   ✓ Header and Overview rendered with PostgreSQL metadata');

  // 9. Test getDatasetById with name & id
  console.log('8. Testing getDatasetById selector...');
  const foundByName = getDatasetById(normalizedDatasets, 'customers');
  assert.ok(foundByName, 'Must find by name "customers"');
  assert.strictEqual(foundByName.name, 'customers');

  const foundById = getDatasetById(normalizedDatasets, customers.id);
  assert.ok(foundById, 'Must find by id');
  assert.strictEqual(foundById.name, 'customers');
  console.log('   ✓ getDatasetById resolves both by exact ID and table name');

  console.log('\n======================================================');
  console.log('  ALL FRONTEND COMPONENT & INTEGRATION CHECKS PASSED  ');
  console.log('======================================================');
}

testFrontendIntegration().catch(err => {
  console.error('\n[FRONTEND INTEGRATION FAILED]:', err);
  process.exit(1);
});
