import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import crypto from 'crypto';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import tokenService from '../src/services/token.service.js';
import {
  EncryptionService,
  encryptionService,
  ENCRYPTION_ALGORITHM,
  TamperedCiphertextError
} from '../src/services/encryption/encryption.service.js';
import {
  LocalEnvironmentKeyProvider,
  InvalidEncryptionKeyError,
  KeyNotFoundError,
  KMSKeyProvider
} from '../src/services/encryption/keyProvider.js';
import { logger } from '../src/utils/logger.js';
import { MySQLConnector } from '../src/connectors/index.js';

describe('Step 15 — Credentials Security (AES-256-GCM, Key Rotation, Redaction & Zero Plaintext)', () => {
  let server;
  let baseUrl;
  let testOrg;
  let adminUser;
  let adminToken;

  const KEY_V1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 32 bytes
  const KEY_V2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'; // 32 bytes

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

    // Clean up previous test runs
    await Organization.deleteMany({ slug: 'security-cred-test-org' });
    await DataSource.deleteMany({ name: { $regex: /^Test-DS-/ } });

    testOrg = await Organization.create({
      name: 'Credentials Security Test Org',
      slug: 'security-cred-test-org',
      domain: 'credtest.ricoz.io'
    });

    adminUser = await User.create({
      organizationId: testOrg._id,
      name: 'Admin Security',
      email: 'admin.cred@credtest.ricoz.io',
      firstName: 'Admin',
      lastName: 'Security',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: USER_ROLES.ADMIN,
      status: 'active'
    });

    adminToken = tokenService.generateAccessToken(adminUser);
  });

  after(async () => {
    if (testOrg) {
      await DataSource.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // =========================================================================
  // 15.6.1 ENCRYPTION
  // =========================================================================
  test('1. Encryption: Encrypts sensitive credentials using AES-256-GCM', () => {
    const rawCredentials = {
      host: 'postgres.production.internal',
      port: 5432,
      database: 'finance_db',
      username: 'db_admin',
      password: 'SuperSecretEnterprisePassword2026!'
    };

    const bundle = encryptionService.encrypt(rawCredentials);

    assert.strictEqual(bundle.algorithm, ENCRYPTION_ALGORITHM);
    assert.strictEqual(bundle.algorithm, 'aes-256-gcm');
    assert.strictEqual(bundle.version, 1);
    assert.strictEqual(typeof bundle.keyId, 'string');
    assert.strictEqual(bundle.iv.length, 24); // 12 bytes = 24 hex characters
    assert.strictEqual(bundle.authTag.length, 32); // 16 bytes = 32 hex characters
    assert.ok(bundle.ciphertext.length > 0);
    assert.ok(bundle.serialized.startsWith('enc:v1:'));
  });

  // =========================================================================
  // 15.6.2 DECRYPTION
  // =========================================================================
  test('2. Decryption: Correctly restores plaintext credentials from ciphertext bundle', () => {
    const secret = 'EnterpriseApiKey_9876543210_RicozSecure';
    const bundle = encryptionService.encrypt(secret);

    const decrypted = encryptionService.decrypt(bundle.serialized);
    assert.strictEqual(decrypted, secret);

    // Also verify JSON decryption
    const jsonSecret = { apiKey: 'key_123', secretKey: 'secret_456' };
    const jsonBundle = encryptionService.encrypt(jsonSecret);
    const decryptedJson = encryptionService.decrypt(jsonBundle.serialized, { asJson: true });
    assert.deepStrictEqual(decryptedJson, jsonSecret);
  });

  // =========================================================================
  // 15.6.3 CIPHERTEXT DIFFERS FOR REPEATED ENCRYPTION (UNIQUE RANDOM IV)
  // =========================================================================
  test('3. Unique IV: Repeated encryptions of identical plaintext produce distinct IVs and ciphertexts', () => {
    const plaintext = 'IdenticalPasswordToEncryptMultipleTimes';

    const enc1 = encryptionService.encrypt(plaintext);
    const enc2 = encryptionService.encrypt(plaintext);
    const enc3 = encryptionService.encrypt(plaintext);

    // IVs must never be reused
    assert.notStrictEqual(enc1.iv, enc2.iv);
    assert.notStrictEqual(enc2.iv, enc3.iv);
    assert.notStrictEqual(enc1.iv, enc3.iv);

    // Ciphertexts must differ
    assert.notStrictEqual(enc1.ciphertext, enc2.ciphertext);
    assert.notStrictEqual(enc2.ciphertext, enc3.ciphertext);

    // All must decrypt back to original plaintext
    assert.strictEqual(encryptionService.decrypt(enc1.serialized), plaintext);
    assert.strictEqual(encryptionService.decrypt(enc2.serialized), plaintext);
    assert.strictEqual(encryptionService.decrypt(enc3.serialized), plaintext);
  });

  // =========================================================================
  // 15.6.4 INVALID KEY REJECTED
  // =========================================================================
  test('4. Key validation: Rejects keys that are not exactly 32 bytes (256 bits)', () => {
    const provider = new LocalEnvironmentKeyProvider();

    // 16-byte key (too short for AES-256)
    assert.throws(
      () => provider.setKey('SHORT_KEY', '0123456789abcdef'),
      InvalidEncryptionKeyError
    );

    // 33-byte key (too long)
    assert.throws(
      () => provider.setKey('LONG_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01'),
      InvalidEncryptionKeyError
    );

    // Empty key
    assert.throws(
      () => provider.setKey('EMPTY_KEY', ''),
      KeyNotFoundError
    );
  });

  // =========================================================================
  // 15.6.5 WRONG KEY REJECTED
  // =========================================================================
  test('5. Wrong key rejected: Attempting decryption with different key fails auth tag verification', () => {
    const customProvider = new LocalEnvironmentKeyProvider({
      currentKeyId: 'KEY_A',
      keys: {
        KEY_A: KEY_V1,
        KEY_B: KEY_V2
      }
    });

    const customService = new EncryptionService({ keyProvider: customProvider });
    const bundle = customService.encrypt('TopSecretData', { keyId: 'KEY_A' });

    // Tamper the keyId in the bundle to force decryption with KEY_B
    const tamperedBundle = { ...bundle, keyId: 'KEY_B' };

    assert.throws(
      () => customService.decrypt(tamperedBundle),
      TamperedCiphertextError
    );
  });

  // =========================================================================
  // 15.6.6 MODIFIED CIPHERTEXT REJECTED
  // =========================================================================
  test('6. Tamper detection: Modified ciphertext is rejected by authentication tag verification', () => {
    const bundle = encryptionService.encrypt('SecureDatabasePassword');

    // Flip the first character of ciphertext
    const flippedChar = bundle.ciphertext[0] === 'a' ? 'b' : 'a';
    const tamperedCiphertext = flippedChar + bundle.ciphertext.slice(1);
    const tamperedBundle = { ...bundle, ciphertext: tamperedCiphertext };

    assert.throws(
      () => encryptionService.decrypt(tamperedBundle),
      TamperedCiphertextError
    );
  });

  // =========================================================================
  // 15.6.7 MODIFIED AUTHENTICATION TAG REJECTED
  // =========================================================================
  test('7. Tamper detection: Modified authentication tag is rejected', () => {
    const bundle = encryptionService.encrypt('SecureDatabasePassword');

    // Flip the first character of auth tag
    const flippedTagChar = bundle.authTag[0] === 'f' ? '0' : 'f';
    const tamperedTag = flippedTagChar + bundle.authTag.slice(1);
    const tamperedBundle = { ...bundle, authTag: tamperedTag };

    assert.throws(
      () => encryptionService.decrypt(tamperedBundle),
      TamperedCiphertextError
    );
  });

  // =========================================================================
  // 15.6.8 MODIFIED IV REJECTED
  // =========================================================================
  test('8. Tamper detection: Modified IV is rejected', () => {
    const bundle = encryptionService.encrypt('SecureDatabasePassword');

    // Flip the first character of IV
    const flippedIvChar = bundle.iv[0] === '0' ? '1' : '0';
    const tamperedIv = flippedIvChar + bundle.iv.slice(1);
    const tamperedBundle = { ...bundle, iv: tamperedIv };

    assert.throws(
      () => encryptionService.decrypt(tamperedBundle),
      TamperedCiphertextError
    );
  });

  // =========================================================================
  // 15.6.9 KEY VERSION HANDLING
  // =========================================================================
  test('9. Key versioning: Correctly records and resolves versioned keys (KEY_V1, KEY_V2)', () => {
    const provider = new LocalEnvironmentKeyProvider({
      currentKeyId: 'KEY_V1',
      keys: {
        KEY_V1: KEY_V1,
        KEY_V2: KEY_V2
      }
    });
    const multiKeyService = new EncryptionService({ keyProvider: provider });

    const encV1 = multiKeyService.encrypt('SecretPayloadV1', { keyId: 'KEY_V1' });
    const encV2 = multiKeyService.encrypt('SecretPayloadV2', { keyId: 'KEY_V2' });

    assert.strictEqual(encV1.keyId, 'KEY_V1');
    assert.strictEqual(encV2.keyId, 'KEY_V2');

    assert.strictEqual(multiKeyService.decrypt(encV1.serialized), 'SecretPayloadV1');
    assert.strictEqual(multiKeyService.decrypt(encV2.serialized), 'SecretPayloadV2');
  });

  // =========================================================================
  // 15.6.10 ROTATION & 15.6.11 OLD-KEY DECRYPT & 15.6.12 NEW-KEY RE-ENCRYPTION
  // =========================================================================
  test('10, 11, 12. Credential Rotation: Old key decrypts during migration and re-encrypts under KEY_V2 without plaintext exposure', () => {
    const provider = new LocalEnvironmentKeyProvider({
      currentKeyId: 'KEY_V1',
      keys: {
        KEY_V1: KEY_V1,
        KEY_V2: KEY_V2
      }
    });
    const rotationService = new EncryptionService({ keyProvider: provider });

    // Step 1: Record originally encrypted with KEY_V1
    const originalCiphertext = rotationService.encrypt('SnowflakeMasterPassword123', { keyId: 'KEY_V1' });
    assert.strictEqual(originalCiphertext.keyId, 'KEY_V1');

    // Step 2: Switch active key to KEY_V2
    provider.setCurrentKeyId('KEY_V2');
    assert.strictEqual(provider.getCurrentKeyId(), 'KEY_V2');

    // Step 3: Verify old-key decrypt still works seamlessly
    const decryptedOld = rotationService.decrypt(originalCiphertext.serialized);
    assert.strictEqual(decryptedOld, 'SnowflakeMasterPassword123');

    // Step 4: Perform rotation re-encryption to KEY_V2
    const rotatedCiphertext = rotationService.rotate(originalCiphertext.serialized, 'KEY_V2');
    assert.strictEqual(rotatedCiphertext.keyId, 'KEY_V2');
    assert.notStrictEqual(rotatedCiphertext.ciphertext, originalCiphertext.ciphertext);
    assert.notStrictEqual(rotatedCiphertext.iv, originalCiphertext.iv);

    // Step 5: Verify new ciphertext decrypts with KEY_V2
    const decryptedNew = rotationService.decrypt(rotatedCiphertext.serialized);
    assert.strictEqual(decryptedNew, 'SnowflakeMasterPassword123');
  });

  // =========================================================================
  // 15.6.13 API CREDENTIAL REDACTION & 15.6.15 FRONTEND NEVER RECEIVES CREDENTIALS
  // =========================================================================
  test('13, 15. API Credential Redaction: POST & GET /api/data-sources return credentialStatus: "configured" and zero plaintext', async () => {
    const sensitivePassword = 'HighlyClassifiedSecretPassword!';
    const sensitiveApiKey = 'sk-prod-enterprise-key-secret-999';

    // Create Data Source with secrets via API
    const createRes = await apiRequest('/api/data-sources', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Test-DS-Redaction-Postgres',
        type: 'postgresql',
        connectionConfig: {
          host: 'db.internal',
          port: 5432,
          database: 'analytics'
        },
        credentials: {
          password: sensitivePassword,
          apiKey: sensitiveApiKey
        }
      }
    });

    assert.strictEqual(createRes.status, 201);
    const createdData = createRes.body.data;

    // Verify safe metadata ONLY
    assert.strictEqual(createdData.credentials.credentialStatus, 'configured');

    // Verify plaintext secrets are completely absent from API response
    assert.strictEqual(createdData.credentials.password, undefined);
    assert.strictEqual(createdData.credentials.apiKey, undefined);
    assert.strictEqual(createdData.credentials.encryptedData, undefined);
    assert.strictEqual(createdData.credentials.keyId, undefined);

    // Verify via GET /api/data-sources/:id
    const getRes = await apiRequest(`/api/data-sources/${createdData._id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        [TENANT_HEADERS.SLUG]: testOrg.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.strictEqual(getRes.status, 200);
    const fetchedData = getRes.body.data;
    assert.strictEqual(fetchedData.credentials.credentialStatus, 'configured');
    assert.strictEqual(fetchedData.credentials.password, undefined);
    assert.strictEqual(fetchedData.credentials.apiKey, undefined);
    assert.strictEqual(fetchedData.credentials.encryptedData, undefined);

    // Also verify JSON stringified body contains neither the password nor apiKey
    const rawBodyString = JSON.stringify(getRes.body);
    assert.ok(!rawBodyString.includes(sensitivePassword));
    assert.ok(!rawBodyString.includes(sensitiveApiKey));
  });

  // =========================================================================
  // 15.6.14 LOGGING REDACTION
  // =========================================================================
  test('14. Logging Redaction: Server-side connection test executes without logging plaintext credentials', async () => {
    const sensitiveSecret = 'SecretDatabasePasswordForLoggingTest!';

    // Create data source
    const ds = new DataSource({
      organizationId: testOrg._id,
      name: 'Test-DS-Logging-Redaction',
      type: 'mysql',
      connectionConfig: { host: 'mysql.internal', port: 3306 }
    });
    ds.setCredentials({ password: sensitiveSecret });
    await ds.save();

    // Intercept logger calls during connection test
    const loggedMessages = [];
    const originalLogInfo = logger.info;
    const originalLogDebug = logger.debug;
    const originalTest = MySQLConnector.prototype.test;

    logger.info = (msg) => {
      loggedMessages.push(String(msg));
      originalLogInfo.call(logger, msg);
    };
    logger.debug = (msg) => {
      loggedMessages.push(String(msg));
      originalLogDebug.call(logger, msg);
    };
    MySQLConnector.prototype.test = async function () {
      return {
        success: true,
        connectorType: 'mysql',
        status: 'HEALTHY',
        latencyMs: 12,
        checkedAt: new Date().toISOString()
      };
    };

    try {
      const testRes = await apiRequest(`/api/data-sources/${ds._id}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          [TENANT_HEADERS.SLUG]: testOrg.slug,
          [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
        }
      });

      assert.strictEqual(testRes.status, 200);
      assert.strictEqual(testRes.body.status, 'connected');
      assert.strictEqual(testRes.body.diagnostic.hasRequiredSecrets, true);

      // Plaintext must NOT appear in HTTP response
      assert.ok(!JSON.stringify(testRes.body).includes(sensitiveSecret));

      // Plaintext must NOT appear in logged messages
      for (const logMsg of loggedMessages) {
        assert.ok(!logMsg.includes(sensitiveSecret));
      }
    } finally {
      MySQLConnector.prototype.test = originalTest;
      logger.info = originalLogInfo;
      logger.debug = originalLogDebug;
    }
  });

  // =========================================================================
  // 15.6.16 DATABASE NEVER STORES PLAINTEXT CREDENTIALS
  // =========================================================================
  test('16. MongoDB Plaintext Absence: Raw database document contains ONLY AES-256-GCM ciphertext, zero plaintext', async () => {
    const sensitivePlainText = 'RawPlaintextSecretMustNeverBeInMongoDB2026!';

    const ds = new DataSource({
      organizationId: testOrg._id,
      name: 'Test-DS-Raw-Mongo-Inspection',
      type: 'snowflake',
      connectionConfig: { warehouse: 'COMPUTE_WH' }
    });
    ds.setCredentials({ password: sensitivePlainText });
    await ds.save();

    // Query raw MongoDB collection directly via Mongoose collection driver (bypassing Mongoose models)
    const rawMongoDoc = await DataSource.collection.findOne({ _id: ds._id });

    assert.ok(rawMongoDoc !== null);
    assert.strictEqual(rawMongoDoc.credentials.type, 'encrypted_payload');

    // Ciphertext must exist and start with versioned prefix
    assert.ok(typeof rawMongoDoc.credentials.encryptedData === 'string');
    assert.ok(rawMongoDoc.credentials.encryptedData.startsWith('enc:v1:'));

    // The raw plaintext password MUST NOT appear anywhere in the database document
    const rawDocumentString = JSON.stringify(rawMongoDoc);
    assert.ok(
      !rawDocumentString.includes(sensitivePlainText),
      'SECURITY VIOLATION: Plaintext password found in raw MongoDB document!'
    );

    // Decrypting the stored ciphertext via server service layer restores the exact plaintext
    const decrypted = ds.getDecryptedCredentials();
    assert.strictEqual(decrypted.password, sensitivePlainText);
  });

  // =========================================================================
  // 15.2 KMS EXTENSION POINT
  // =========================================================================
  test('17. KMS Key Provider extension point fails safely without false simulation', () => {
    const kmsProvider = new KMSKeyProvider();
    assert.throws(
      () => kmsProvider.getKey('AWS_KMS_KEY_1'),
      /Cloud KMS provider/
    );
  });
});
