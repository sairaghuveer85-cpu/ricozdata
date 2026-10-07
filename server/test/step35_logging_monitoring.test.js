import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import app from '../src/app.js';
import { logger } from '../src/utils/logger.js';
import { register } from '../src/metrics/prometheus.js';
import correlationIdMiddleware from '../src/middleware/correlationId.js';

test('Step 35 — Logging & Monitoring Verification', async (t) => {
  await connectDB();

  await t.test('35.1 Structured Logging & Credential Redaction: Strips secrets and formats output', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // Capture stdout/stderr
      let capturedLog = '';
      const originalConsoleLog = console.log;
      console.log = (msg) => { capturedLog += msg; };

      logger.info('Test operational audit log', {
        organizationId: '60d0fe4f5311236168a109ca',
        correlationId: 'test-corr-abc',
        password: 'SuperSecretPassword123!',
        jwt_secret: 'secret_key_value',
        token: 'ey.jwt.token',
        connectionUrl: 'postgres://user:pass@host:5432/db',
        safeMetadata: 'public_value'
      });

      console.log = originalConsoleLog;

      assert.ok(capturedLog.length > 0);
      const parsed = JSON.parse(capturedLog);

      assert.strictEqual(parsed.service, 'ricozdata-backend');
      assert.strictEqual(parsed.level, 'info');
      assert.strictEqual(parsed.message, 'Test operational audit log');
      assert.strictEqual(parsed.correlationId, 'test-corr-abc');
      assert.strictEqual(parsed.organizationId, '60d0fe4f5311236168a109ca');
      assert.strictEqual(parsed.safeMetadata, 'public_value');

      // Verify all sensitive keys are redacted
      assert.strictEqual(parsed.password, '***REDACTED***');
      assert.strictEqual(parsed.jwt_secret, '***REDACTED***');
      assert.strictEqual(parsed.token, '***REDACTED***');
      assert.strictEqual(parsed.connectionUrl, '***REDACTED***');
      assert.strictEqual(capturedLog.includes('SuperSecretPassword123!'), false);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  await t.test('35.2 Correlation ID Middleware: Propagates valid header and sanitizes invalid/oversized input', async () => {
    // 1. Valid client correlation ID
    let req1 = { headers: { 'x-correlation-id': 'client-corr-valid-123' } };
    let res1 = { setHeader: (k, v) => { res1[k] = v; } };
    let nextCalled1 = false;

    correlationIdMiddleware(req1, res1, () => { nextCalled1 = true; });
    assert.strictEqual(nextCalled1, true);
    assert.strictEqual(req1.correlationId, 'client-corr-valid-123');
    assert.strictEqual(res1['X-Correlation-ID'], 'client-corr-valid-123');

    // 2. Oversized / malicious injection attempt (exceeds 64 chars or invalid chars)
    let req2 = { headers: { 'x-correlation-id': 'a'.repeat(200) + '<script>alert(1)</script>' } };
    let res2 = { setHeader: (k, v) => { res2[k] = v; } };
    let nextCalled2 = false;

    correlationIdMiddleware(req2, res2, () => { nextCalled2 = true; });
    assert.strictEqual(nextCalled2, true);
    assert.ok(req2.correlationId.startsWith('corr_'));
    assert.ok(req2.correlationId.length <= 64);
    assert.strictEqual(req2.correlationId.includes('<script>'), false);
  });

  await t.test('35.3 Operational Health Probes: GET /healthz and /readyz', async () => {
    // Test /healthz
    const reqZ = {};
    let healthzRes = null;
    let healthzStatus = 0;
    const resZ = {
      status(code) { healthzStatus = code; return this; },
      json(payload) { healthzRes = payload; return this; }
    };

    // Invoke /healthz handler
    const healthzHandler = app._router.stack
      .find(s => s.handle?.stack?.some(r => r.route?.path === '/healthz'))
      ?.handle?.stack?.find(r => r.route?.path === '/healthz')?.route?.stack[0]?.handle;

    assert.ok(healthzHandler, 'healthz handler must be registered on app');
    healthzHandler(reqZ, resZ);

    assert.strictEqual(healthzStatus, 200);
    assert.strictEqual(healthzRes.status, 'healthy');
    assert.ok(typeof healthzRes.uptime === 'number');

    // Test /readyz
    let readyzRes = null;
    let readyzStatus = 0;
    const resR = {
      status(code) { readyzStatus = code; return this; },
      json(payload) { readyzRes = payload; return this; }
    };

    const readyzHandler = app._router.stack
      .find(s => s.handle?.stack?.some(r => r.route?.path === '/readyz'))
      ?.handle?.stack?.find(r => r.route?.path === '/readyz')?.route?.stack[0]?.handle;

    assert.ok(readyzHandler, 'readyz handler must be registered on app');
    await readyzHandler(reqZ, resR);

    assert.strictEqual(readyzStatus, 200);
    assert.strictEqual(readyzRes.status, 'ready');
    assert.strictEqual(readyzRes.dependencies.database.status, 'connected');
  });

  await t.test('35.4 Prometheus Metrics: Exposes standard low-cardinality metrics', async () => {
    // Record sample observation to instantiate metric series with labels
    const { httpRequestsTotal } = await import('../src/metrics/prometheus.js');
    httpRequestsTotal.inc({ method: 'GET', route: '/api/v1/health', status_code: '200' });

    const metricsOutput = await register.metrics();
    assert.ok(typeof metricsOutput === 'string');

    // Check core metric names exist
    assert.ok(metricsOutput.includes('http_requests_total'));
    assert.ok(metricsOutput.includes('http_request_duration_seconds'));
    assert.ok(metricsOutput.includes('ricoz_cache_hits_total'));
    assert.ok(metricsOutput.includes('ricoz_queue_jobs_total'));

    // Check low-cardinality labels
    assert.ok(metricsOutput.includes('method="GET"'));
    assert.ok(metricsOutput.includes('route="/api/v1/health"'));
    assert.ok(metricsOutput.includes('status_code="200"'));

    // Security: Verify NO passwords or sensitive data in metrics output
    assert.strictEqual(metricsOutput.includes('password'), false);
    assert.strictEqual(metricsOutput.includes('secret'), false);
  });

  await disconnectDB();
});
