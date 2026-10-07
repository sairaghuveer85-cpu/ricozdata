import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

const BASE_URL = 'http://127.0.0.1:5000';

function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { ...(options.headers || {}) };
    let body = options.body;

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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('RicozData Recovery & Integration Test Suite', () => {
  let authToken = null;
  let testUser = null;

  before(async () => {
    // Authenticate with seeded super admin user
    const res = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'raghuveer.chandran@ricoz-industries.demo',
        password: 'Password123!'
      }
    });

    assert.strictEqual(res.status, 200, 'Login must succeed');
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.token, 'Token must be returned');
    authToken = res.data.data.token;
    testUser = res.data.data.user;
  });

  // =========================================================================
  // 1. ENDPOINT COMPATIBILITY & ROUTING
  // =========================================================================
  describe('Phase B: API Route Compatibility (/api and /api/v1)', () => {
    test('1.1 Health endpoint responds on both /api/health and /api/v1/health', async () => {
      const res1 = await apiRequest('/api/health');
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.data.status, 'operational');

      const res2 = await apiRequest('/api/v1/health');
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.data.status, 'operational');
    });

    test('1.2 Auth login responds on both /api/auth/login and /api/v1/auth/login', async () => {
      const resV1 = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'password' }
      });
      assert.strictEqual(resV1.status, 200);
      assert.strictEqual(resV1.data.success, true);

      const resLegacy = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'password' }
      });
      assert.strictEqual(resLegacy.status, 200);
      assert.strictEqual(resLegacy.data.success, true);
    });

    test('1.3 GET /api/v1/datasets returns 200 with authorized persisted datasets', async () => {
      const res = await apiRequest('/api/v1/datasets?limit=100', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.datasets.length >= 10);
      assert.ok(res.data.data.total >= 10);
    });

    test('1.4 GET /api/datasets also returns 200 for legacy clients', async () => {
      const res = await apiRequest('/api/datasets?limit=100', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.datasets.length >= 10);
    });

    test('1.5 GET /api/v1/users returns 200', async () => {
      const res = await apiRequest('/api/v1/users', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data?.users || res.data.data));
    });

    test('1.6 GET /api/v1/activities returns 200', async () => {
      const res = await apiRequest('/api/v1/activities?limit=30', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
    });

    test('1.7 GET /api/v1/policies returns 200', async () => {
      const res = await apiRequest('/api/v1/policies?limit=100', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data?.policies || res.data.data));
    });

    test('1.8 GET /api/v1/glossary returns 200', async () => {
      const res = await apiRequest('/api/v1/glossary?limit=100', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data?.terms || res.data.data));
    });

    test('1.9 GET /api/v1/data-sources returns 200 with persisted sources', async () => {
      const res = await apiRequest('/api/v1/data-sources', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data.dataSources));
      assert.ok(res.data.data.dataSources.length >= 6);
    });

    test('1.10 Unregistered routes return standard 404 without leaking internal traces', async () => {
      const res = await apiRequest('/api/v1/non-existent-route');
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.success, false);
      assert.ok(res.data.message.includes('API endpoint not found'));
    });
  });

  // =========================================================================
  // 2. AUTHENTICATION & SECURITY
  // =========================================================================
  describe('Phase C: Authentication & Token Security', () => {
    test('2.1 Rejects request without token (401)', async () => {
      const res = await apiRequest('/api/v1/datasets');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Not authorized, no token');
    });

    test('2.2 Rejects malformed / demo fake token (401)', async () => {
      const res = await apiRequest('/api/v1/datasets', {
        headers: { Authorization: 'Bearer demo-local-jwt-token' }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Not authorized, token failed');
    });

    test('2.3 Rejects invalid password for seeded user (401)', async () => {
      const res = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: 'raghuveer.chandran@ricoz-industries.demo',
          password: 'WrongPassword999!'
        }
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Invalid credentials');
    });

    test('2.4 Authenticates test@example.com with password', async () => {
      const res = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'test@example.com', password: 'password' }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.token);
    });
  });

  // =========================================================================
  // 3. DATA CATALOG REAL DATA FLOW
  // =========================================================================
  describe('Phase D: Data Catalog Persisted Data Flow', () => {
    let firstDatasetId = null;

    test('3.1 Fetches real persisted datasets with quality and owner populated', async () => {
      const res = await apiRequest('/api/v1/datasets?limit=10', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      const dsList = res.data.data.datasets;
      assert.strictEqual(dsList.length, 10);

      const first = dsList[0];
      firstDatasetId = first._id || first.id;
      assert.ok(first.name, 'Dataset must have name');
      assert.ok(first.domain, 'Dataset must have domain');
      assert.ok(first.source || first.sourceSystem, 'Dataset must have source');
      assert.ok(typeof first.qualityScore === 'number', 'Quality score must be numeric');
    });

    test('3.2 Fetches dynamic filter sources from actual catalog data', async () => {
      const res = await apiRequest('/api/v1/datasets/sources', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.ok(res.data.data.length > 0);
      const labels = res.data.data.map((s) => s.label);
      assert.ok(labels.includes('Snowflake'));
      assert.ok(labels.includes('SAP S/4HANA'));
    });

    test('3.3 Fetches dynamic filter tags from actual catalog data', async () => {
      const res = await apiRequest('/api/v1/datasets/tags', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(Array.isArray(res.data.data));
      assert.ok(res.data.data.length >= 10);
    });

    test('3.4 Fetches single dataset details with complete schema columns and related assets', async () => {
      assert.ok(firstDatasetId, 'Must have dataset id');
      const res = await apiRequest(`/api/v1/datasets/${firstDatasetId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.name);
      assert.ok(Array.isArray(res.data.data.schema));
      assert.ok(res.data.data.schema.length > 0);
      assert.ok(Array.isArray(res.data.data.related));
    });

    test('3.5 Data source test connection succeeds with real latency measurement', async () => {
      const dsListRes = await apiRequest('/api/v1/data-sources', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const firstSource = dsListRes.data.data.dataSources.find(s => s.type === 'mongodb') || dsListRes.data.data.dataSources[0];
      assert.ok(firstSource, 'Must have data source');

      const testRes = await apiRequest(`/api/v1/data-sources/${firstSource._id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(testRes.status, 200);
      assert.strictEqual(testRes.data.success, true);
      assert.strictEqual(testRes.data.data.connected, true);
      assert.ok(typeof testRes.data.data.latencyMs === 'number');
    });
  });

  // =========================================================================
  // 4. DASHBOARD INTEGRITY
  // =========================================================================
  describe('Phase E: Dashboard Real Metrics', () => {
    test('4.1 Dashboard metrics returns persisted counts matching actual catalog and user records', async () => {
      const res = await apiRequest('/api/v1/dashboard/metrics', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.data.summary.totalDatasets >= 10);
      assert.ok(res.data.data.summary.avgQuality >= 90);
      assert.ok(res.data.data.summary.activeUsers >= 10);
      assert.strictEqual(res.data.data.metrics.length, 4);
    });
  });
});
