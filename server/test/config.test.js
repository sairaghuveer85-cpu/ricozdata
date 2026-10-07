import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import config from '../src/config/env.js';
import { sanitizeMongoUri } from '../src/config/database.js';

describe('Step 03 — Environment Variables & Configuration Module', () => {
  test('should load and validate core environment configuration', () => {
    assert.ok(config, 'Configuration object should be defined');
    assert.strictEqual(typeof config.port, 'number', 'Port must be a number');
    assert.strictEqual(config.port, 5000, 'Default development port should be 5000');
    assert.ok(['development', 'test', 'production', 'staging'].includes(config.env), 'Valid NODE_ENV');
    assert.strictEqual(typeof config.clientUrl, 'string');
    assert.ok(config.clientUrl.startsWith('http'), 'Client URL should be valid HTTP/HTTPS URL');
  });

  test('should provide configured MongoDB connection URI', () => {
    assert.ok(config.mongo, 'Mongo config section must exist');
    assert.strictEqual(typeof config.mongo.uri, 'string');
    assert.ok(
      config.mongo.uri.startsWith('mongodb://') || config.mongo.uri.startsWith('mongodb+srv://'),
      'MONGO_URI must be a valid Mongo URI'
    );
  });

  test('should provide secure structure for JWT, encryption, and integrations', () => {
    assert.ok(config.jwt, 'JWT configuration section should exist');
    assert.ok(config.jwt.secret, 'JWT secret should be present');
    assert.ok(config.jwt.expiresIn, 'JWT expiresIn should be present');
    assert.ok(config.security.encryptionKey, 'Encryption key should be configured');
    assert.ok(config.oauth, 'OAuth configuration section should exist');
    assert.ok(config.email, 'Email configuration section should exist');
    assert.ok(config.logging, 'Logging configuration section should exist');
  });

  test('should properly sanitize MongoDB URIs to avoid exposing passwords', () => {
    const rawUri = 'mongodb://app_user:super_secret_password_123@cluster0.abc.mongodb.net/ricozdata';
    const sanitized = sanitizeMongoUri(rawUri);

    assert.ok(!sanitized.includes('super_secret_password_123'), 'Sanitized URI must not contain password');
    assert.ok(sanitized.includes('app_user:***@'), 'Sanitized URI must mask password with ***');
    assert.ok(sanitized.includes('cluster0.abc.mongodb.net/ricozdata'), 'Host and DB name must be preserved');
  });
});
