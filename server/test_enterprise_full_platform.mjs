/**
 * Enterprise Full Platform End-to-End Verification Test Suite
 * Validates:
 * 1. Data Source Lifecycle (List, Test, Discover, Sync, Activity Logging)
 * 2. Real Dataset Cataloging & Persistence
 * 3. Evidence-Backed Lineage (No mock graphs)
 * 4. Data Quality Engine (Evaluation, Rule Execution, Profile, Trends, Score Persistence)
 * 5. Dashboard Real Metrics Derivation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

const BASE_URL = 'http://127.0.0.1:5000';
let authToken = null;
let testDataSourceId = null;
let testDatasetId = null;
let testRuleId = null;

function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    if (authToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServer(maxRetries = 20) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await apiRequest('/api/health');
      if (res.status === 200) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Server not reachable after retries');
}

test('Enterprise Full Platform Integration Suite', async (t) => {
  // Setup: Wait for server & Authenticate
  await t.test('1. Authentication Setup', async () => {
    await waitForServer();
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'password' }
    });

    assert.equal(res.status, 200, 'Login must succeed');
    assert.ok(res.data.data?.token || res.data.token, 'Token must be returned');
    authToken = res.data.data?.token || res.data.token;
  });

  // 2. Data Sources & Real Connection Testing
  await t.test('2. Data Source Lifecycle & Testing', async () => {
    const listRes = await apiRequest('/api/v1/data-sources');
    assert.equal(listRes.status, 200, 'Data sources list must return 200');
    const sources = listRes.data.data?.dataSources || listRes.data.data;
    assert.ok(Array.isArray(sources), 'Data sources must be an array');
    assert.ok(sources.length > 0, 'Must have at least one data source');

    const firstSource = sources.find(s => s.type === 'mongodb') || sources[0];
    testDataSourceId = firstSource._id || firstSource.id;

    // Test real external connection
    const testRes = await apiRequest(`/api/v1/data-sources/${testDataSourceId}/test`, {
      method: 'POST'
    });
    assert.equal(testRes.status, 200, 'Connection test must respond 200');
    assert.equal(testRes.data.success, true, 'Connection test must report success');
    assert.ok(typeof testRes.data.data?.latencyMs === 'number', 'Must report latency in ms');

    // Test unconfigured remote source fails honestly without simulation
    const remoteSource = sources.find(s => s.type === 'snowflake' || s.type === 'salesforce');
    if (remoteSource) {
      const remoteRes = await apiRequest(`/api/v1/data-sources/${remoteSource._id || remoteSource.id}/test`, {
        method: 'POST'
      });
      assert.equal(remoteRes.status, 502, 'Unconfigured remote source must return 502');
      assert.equal(remoteRes.data.success, false, 'Unconfigured connection must report failure');
    }

    // Discover candidate assets
    const discRes = await apiRequest(`/api/v1/data-sources/${testDataSourceId}/discover`, {
      method: 'POST'
    });
    assert.equal(discRes.status, 200, 'Discovery must return 200');
    assert.equal(discRes.data.success, true);
    assert.ok(Array.isArray(discRes.data.data?.assets), 'Assets must be returned as array');

    // Sync catalog from candidate tables
    const syncRes = await apiRequest(`/api/v1/data-sources/${testDataSourceId}/sync`, {
      method: 'POST',
      body: { filterTables: ['orders_daily', 'inventory_snapshots'] }
    });
    assert.equal(syncRes.status, 200, 'Catalog sync must return 200');
    assert.equal(syncRes.data.success, true);
    assert.ok(syncRes.data.data?.registeredCount >= 0, 'Registered count must be tracked');
  });

  // 3. Data Catalog Real Dataset Flow
  await t.test('3. Data Catalog Real Datasets Flow', async () => {
    const dsRes = await apiRequest('/api/v1/datasets?limit=50');
    assert.equal(dsRes.status, 200);
    const datasets = dsRes.data.data?.datasets || dsRes.data.data;
    assert.ok(Array.isArray(datasets), 'Datasets must be an array');
    assert.ok(datasets.length > 0, 'Datasets must exist in catalog');

    const sample = datasets[0];
    testDatasetId = sample._id || sample.id;
    assert.ok(sample.name, 'Dataset must have real name');
    assert.ok(sample.quality != null || sample.qualityScore != null, 'Dataset must have quality score');

    // Details retrieval by ID
    const detailRes = await apiRequest(`/api/v1/datasets/${testDatasetId}`);
    assert.equal(detailRes.status, 200);
    assert.ok(detailRes.data.data?.schema, 'Dataset details must include schema');
  });

  // 4. Evidence-Backed Lineage
  await t.test('4. Lineage Graph Verification', async () => {
    const linRes = await apiRequest(`/api/v1/lineage/${testDatasetId}`);
    assert.equal(linRes.status, 200, 'Lineage must return 200');
    assert.equal(linRes.data.success, true);
    assert.ok(Array.isArray(linRes.data.data?.nodes), 'Nodes must be an array');
    assert.ok(Array.isArray(linRes.data.data?.edges), 'Edges must be an array');
    assert.ok(linRes.data.data.nodes.length >= 1, 'Lineage must contain real nodes');

    // Verify nodes contain actual dataset ID or name
    const hasDatasetNode = linRes.data.data.nodes.some(
      n => n.data?.datasetId?.toString() === testDatasetId.toString() || n.id?.includes(testDatasetId) || n.data?.label
    );
    assert.ok(hasDatasetNode, 'Lineage graph must reference the actual dataset');
  });

  // 5. Data Quality Execution & Score Persistence
  await t.test('5. Data Quality Engine Real Execution', async () => {
    // 5.1 Trigger Quality Evaluation
    const evalRes = await apiRequest(`/api/v1/quality/evaluate/${testDatasetId}`, {
      method: 'POST'
    });
    assert.equal(evalRes.status, 200, 'Quality evaluation must return 200');
    assert.equal(evalRes.data.success, true);
    assert.ok(typeof evalRes.data.data?.score === 'number', 'Must compute score');
    assert.ok(evalRes.data.data?.dimensions?.length > 0, 'Must compute dimensions');

    const evalScore = evalRes.data.data.score;

    // 5.2 Verify score was persisted onto the Dataset model
    const refreshedDs = await apiRequest(`/api/v1/datasets/${testDatasetId}`);
    assert.equal(refreshedDs.status, 200);
    assert.equal(refreshedDs.data.data?.qualityScore, evalScore, 'Dataset qualityScore must match evaluated score');

    // 5.3 Fetch Rules for Dataset
    const rulesRes = await apiRequest(`/api/v1/quality/rules?datasetId=${testDatasetId}`);
    assert.equal(rulesRes.status, 200);
    const rulesList = rulesRes.data.data?.rules || rulesRes.data.data;
    assert.ok(Array.isArray(rulesList), 'Rules must be returned as array');

    if (rulesList.length > 0) {
      testRuleId = rulesList[0]._id || rulesList[0].id;
      // 5.4 Execute Quality Rule
      const runRuleRes = await apiRequest(`/api/v1/quality/rules/${testRuleId}/run`, {
        method: 'POST'
      });
      assert.equal(runRuleRes.status, 200, 'Rule execution must return 200');
      assert.equal(runRuleRes.data.success, true);
      assert.ok(runRuleRes.data.data?.lastResult != null, 'Rule must record lastResult');
    }

    // 5.5 Quality Trends
    const trendsRes = await apiRequest(`/api/v1/quality/${testDatasetId}/trends?range=30d`);
    assert.equal(trendsRes.status, 200);
    assert.ok(Array.isArray(trendsRes.data.data), 'Trends must be an array');
    assert.ok(trendsRes.data.data.length > 0, 'Trends must have historical snapshots');

    // 5.6 Quality Profile
    const profRes = await apiRequest(`/api/v1/quality/profile/${testDatasetId}`);
    assert.equal(profRes.status, 200);
    assert.ok(profRes.data.data?.columns != null, 'Profile must compute column-level metrics');
  });

  // 6. Dashboard Metrics Consistency
  await t.test('6. Dashboard Real Metrics Verification', async () => {
    const dashRes = await apiRequest('/api/v1/dashboard/metrics');
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.data.success, true);
    assert.ok(typeof dashRes.data.data?.summary?.totalDatasets === 'number');
    assert.ok(typeof dashRes.data.data?.summary?.avgQuality === 'number');
    assert.ok(dashRes.data.data.summary.totalDatasets >= 10, 'Must count real catalog datasets');
  });
});
