import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import config from '../src/config/env.js';

describe('Step 02 — Node.js + Express Setup & API Endpoints', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Start server on an ephemeral port (port 0) for automated testing
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/health returns 200 with structured health payload', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200, 'Health check should return status 200');

    const body = await res.json();
    assert.strictEqual(body.success, true, 'success flag should be true');
    assert.strictEqual(body.message, 'RicozData API is healthy');
    assert.strictEqual(body.environment, config.env, 'Environment should match runtime config');
    assert.ok(body.timestamp, 'Timestamp should be present');
    assert.ok(!isNaN(Date.parse(body.timestamp)), 'Timestamp must be a valid ISO date');
    assert.ok(typeof body.uptime === 'number', 'Uptime should be a number');
    assert.ok(body.services, 'Services section must exist');
    assert.ok(body.services.database, 'Database service status must be reported');
  });

  test('GET / returns root API information', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.name, 'RicozData Platform API');
    assert.strictEqual(body.status, 'online');
  });

  test('GET /api returns base API router information', async () => {
    const res = await fetch(`${baseUrl}/api`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.name, 'RicozData Enterprise API');
    assert.strictEqual(body.version, '1.0.0');
    assert.ok(body.endpoints.health);
  });

  test('GET /api/nonexistent returns structured 404 response', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route-for-testing`);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'ROUTE_NOT_FOUND');
    assert.ok(body.error.message.includes('/api/nonexistent-route-for-testing'));
  });

  test('POST with malformed JSON body returns 400 with structured error', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid_json: '
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INVALID_JSON_BODY');
  });

  test('OPTIONS request handles CORS preflight with proper headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });

    assert.ok([200, 204].includes(res.status));
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
  });
});
