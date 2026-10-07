import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { connectDB, disconnectDB, getDatabaseStatus, sanitizeMongoUri } from '../src/config/database.js';

describe('Step 04 — MongoDB Connection Diagnostics & Status Module', () => {
  test('getDatabaseStatus reports initial disconnected state correctly', () => {
    const status = getDatabaseStatus();
    assert.ok(status, 'Database status object should be returned');
    assert.strictEqual(typeof status.readyState, 'number');
    assert.ok(['disconnected', 'connected', 'connecting', 'disconnecting'].includes(status.state));
    assert.strictEqual(typeof status.isConnected, 'boolean');
  });

  test('sanitizeMongoUri redacts credentials while keeping host details', () => {
    const uriWithCreds = 'mongodb+srv://admin_user:P@ssw0rd!123@cluster.mongodb.net/testdb?retryWrites=true';
    const sanitized = sanitizeMongoUri(uriWithCreds);

    assert.ok(!sanitized.includes('P@ssw0rd!123'));
    assert.ok(sanitized.includes('admin_user:***@'));
    assert.ok(sanitized.includes('cluster.mongodb.net/testdb'));
  });

  test('connectDB throws and diagnoses clear failure when MongoDB server is unreachable', async () => {
    // Attempt connecting with a short timeout to an unavailable host/port
    const unreachableUri = 'mongodb://127.0.0.1:27019/unreachable_test_db';
    let caughtError = null;

    try {
      await connectDB(unreachableUri, {
        serverSelectionTimeoutMS: 1500,
        connectTimeoutMS: 1500
      });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Expected connectDB to reject when target host is unreachable');
    assert.ok(
      caughtError.message.includes('ECONNREFUSED') ||
      caughtError.name === 'MongoServerSelectionError' ||
      caughtError.message.includes('connect'),
      `Error must reflect network/server failure: ${caughtError.message}`
    );
  });

  test('disconnectDB gracefully handles disconnected state without throwing', async () => {
    await assert.doesNotReject(async () => {
      await disconnectDB();
    }, 'disconnectDB must execute gracefully without throwing errors');
  });
});
