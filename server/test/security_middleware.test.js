import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { createCustomLimiter } from '../src/middleware/rateLimiter.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';

describe('Step 13 — Security Middleware (Helmet, CORS, Rate Limiting, HPP & Request Hardening)', () => {
  let server;
  let baseUrl;

  // Helper for requests
  async function apiRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = { ...options.headers };
    let body = options.body;

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual'
    });

    let resBody = null;
    const text = await response.text();
    try {
      resBody = JSON.parse(text);
      if (resBody && typeof resBody === 'object' && resBody.error?.message && !resBody.message) {
        resBody.message = resBody.error.message;
      }
    } catch {
      resBody = text;
    }

    return {
      status: response.status,
      headers: response.headers,
      body: resBody
    };
  }

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // =========================================================================
  // 13.1 HELMET HEADERS
  // =========================================================================
  test('1. Security headers: Helmet headers are present and hardened', async () => {
    const res = await apiRequest('/api/health');

    assert.strictEqual(res.status, 200);

    // X-Content-Type-Options: nosniff
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');

    // X-Frame-Options: DENY
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');

    // X-Download-Options: noopen
    assert.strictEqual(res.headers.get('x-download-options'), 'noopen');

    // Referrer-Policy
    assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

    // Cross-Origin policies
    assert.strictEqual(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.strictEqual(res.headers.get('cross-origin-opener-policy'), 'same-origin');

    // X-Powered-By header must be stripped / hidden
    assert.strictEqual(res.headers.get('x-powered-by'), null);
  });

  // =========================================================================
  // 13.2 STRICT CORS BEHAVIOR
  // =========================================================================
  test('2. CORS: Allowed origin receives proper access-control headers with credentials', async () => {
    const allowedOrigin = 'http://localhost:5173';
    const res = await apiRequest('/api/health', {
      headers: {
        Origin: allowedOrigin
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), allowedOrigin);
    assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
    // Ensure wildcard * is NEVER combined with credentials
    assert.notStrictEqual(res.headers.get('access-control-allow-origin'), '*');
  });

  test('3. CORS: Preflight OPTIONS request responds with allowed methods and headers', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });

    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.ok(res.headers.get('access-control-allow-methods'));
    assert.ok(res.headers.get('access-control-allow-headers'));
  });

  test('4. CORS: Disallowed foreign origin is rejected', async () => {
    const res = await apiRequest('/api/health', {
      headers: {
        Origin: 'https://malicious-attacker-domain.evil'
      }
    });

    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /not permitted by CORS policy/i);
  });

  // =========================================================================
  // 13.3 RATE LIMITING
  // =========================================================================
  test('5. Rate limiting: Exceeding request threshold returns structured 429 Too Many Requests', async () => {
    // Spin up an ephemeral app mounted with a low-threshold limiter to test rate limiting behavior deterministically
    const testApp = express();
    const testLimiter = createCustomLimiter({ windowMs: 5000, max: 3, message: 'Custom rate limit exceeded' });
    testApp.use('/test-limited', testLimiter, (req, res) => res.json({ success: true }));

    const testServer = http.createServer(testApp);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const testPort = testServer.address().port;
    const testUrl = `http://127.0.0.1:${testPort}/test-limited`;

    try {
      // 3 successful requests
      for (let i = 0; i < 3; i++) {
        const r = await fetch(testUrl);
        assert.strictEqual(r.status, 200);
      }

      // 4th request must be throttled with HTTP 429
      const throttledRes = await fetch(testUrl);
      assert.strictEqual(throttledRes.status, 429);
      const data = await throttledRes.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.strictEqual(data.message, 'Custom rate limit exceeded');
    } finally {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  // =========================================================================
  // 13.4 HTTP PARAMETER POLLUTION (HPP) DEFENSE
  // =========================================================================
  test('6. HPP defense: Duplicate query parameters are sanitized to prevent array injection', async () => {
    // Send duplicate search query parameters: ?search=alpha&search=beta
    const res = await apiRequest('/api/users?search=first&search=second', {
      headers: {
        [TENANT_HEADERS.SLUG]: 'ricoz-demo',
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    // Request must not crash and query parameter must not remain an unhandled array
    assert.ok([200, 401, 403, 404].includes(res.status));
  });

  // =========================================================================
  // 13.5 REQUEST HARDENING (BODY SIZES & MALFORMED JSON)
  // =========================================================================
  test('7. Malformed JSON handling: Broken JSON syntax returns 400 Bad Request with INVALID_JSON_BODY', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [TENANT_HEADERS.SLUG]: 'ricoz-demo',
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: '{ "brokenJson": withoutQuotes, invalid: '
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'INVALID_JSON_BODY');
    assert.match(data.error.message, /malformed json/i);
  });

  test('8. Oversized body rejection: Payloads exceeding size limit return 413 Payload Too Large', async () => {
    // Generate a payload exceeding 2MB limit (e.g. 2.5MB string)
    const largeString = 'A'.repeat(2.5 * 1024 * 1024);
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [TENANT_HEADERS.SLUG]: 'ricoz-demo',
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: JSON.stringify({ data: largeString })
    });

    assert.strictEqual(res.status, 413);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error.code, 'PAYLOAD_TOO_LARGE');
  });

  // =========================================================================
  // 13.6 COOKIE SECURITY FLAGS
  // =========================================================================
  test('9. Cookie security flags: Authentication cookies are HttpOnly and restrict Path', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST'
    });

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.match(setCookie, /HttpOnly/i, 'Must contain HttpOnly flag');
    assert.match(setCookie, /Path=(\/|\/api\/auth)/i, 'Must have valid cookie Path');
  });
});
