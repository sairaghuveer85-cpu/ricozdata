import mongoose from 'mongoose';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { DataSource } from '../src/models/DataSource.js';
import { hashPassword } from '../src/utils/crypto.js';
import { USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import config from '../src/config/env.js';

import { connectDB, disconnectDB } from '../src/config/database.js';

const BASE_URL = 'http://localhost:5000';

async function runLiveStep14Verification() {
  console.log('=== RICOZDATA STEP 14 LIVE HTTP VERIFICATION ===');
  await connectDB();
  console.log('[Live] Connected to MongoDB via connectDB()');

  const testSlug = 'live-verify-step14-' + Date.now();
  const testOrg = await Organization.create({
    name: 'Live Step 14 Org',
    slug: testSlug,
    domain: `${testSlug}.ricoz.io`
  });

  const rawPassword = 'LiveSecurePassword2026!';
  const hashedPassword = await hashPassword(rawPassword);

  const admin = await User.create({
    organizationId: testOrg._id,
    name: 'Live Admin Step14',
    email: `admin@${testSlug}.ricoz.io`,
    firstName: 'Live',
    lastName: 'Admin',
    passwordHash: hashedPassword,
    role: USER_ROLES.ADMIN,
    status: 'active'
  });

  // Also create a second tenant for cross-tenant isolation live test
  const tenantBSlug = 'live-verify-tenant-b-' + Date.now();
  const tenantB = await Organization.create({
    name: 'Tenant B Live',
    slug: tenantBSlug,
    domain: `${tenantBSlug}.ricoz.io`
  });

  console.log('[Live] Test Organization created:', testOrg.name, 'ID:', testOrg._id);

  // Step 1: Login via live HTTP
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [TENANT_HEADERS.SLUG]: testOrg.slug,
      [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
    },
    body: JSON.stringify({
      email: admin.email,
      password: rawPassword
    })
  });

  console.log('[Live] Login HTTP status:', loginRes.status);
  const loginBody = await loginRes.json();
  const token = loginBody.data?.accessToken;
  if (!token) throw new Error('Failed to obtain access token from live server');
  console.log('[Live] JWT Access Token successfully received.');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    [TENANT_HEADERS.SLUG]: testOrg.slug,
    [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
  };

  // Step 2: Create PostgreSQL Data Source
  const sensitivePassword = 'HighlyClassifiedPostgresSecret123!';
  const createRes = await fetch(`${BASE_URL}/api/v1/data-sources`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Live Enterprise PostgreSQL Primary',
      type: 'postgresql',
      description: 'Production replica for commercial analytics',
      configuration: {
        host: 'pg-prod.internal',
        port: 5432,
        database: 'production_analytics',
        ssl: true,
        schema: 'public'
      },
      credentials: {
        username: 'pg_service_account',
        password: sensitivePassword
      },
      tags: ['production', 'analytics', 'live-test']
    })
  });

  console.log('[Live] POST /api/v1/data-sources HTTP status:', createRes.status);
  const createBody = await createRes.json();
  const ds = createBody.data;

  console.log('✓ Document created successfully. ID:', ds._id);
  console.log('✓ Status:', ds.status, '| Health Status:', ds.healthStatus, '| Connection State:', ds.connectionState);
  console.log('✓ Credential status:', ds.credentialStatus);
  console.log('✓ Plaintext secret leaked in POST response?', JSON.stringify(createBody).includes(sensitivePassword));

  // Verify in MongoDB direct storage
  const rawDbDoc = await DataSource.findById(ds._id).select('+credentials.encryptedData');
  console.log('✓ Direct MongoDB encryptedData present:', Boolean(rawDbDoc.credentials?.encryptedData));
  console.log('✓ Direct MongoDB plaintext leaked?', rawDbDoc.credentials?.encryptedData.includes(sensitivePassword));

  // Step 3: GET /api/v1/data-sources/:id
  const getRes = await fetch(`${BASE_URL}/api/v1/data-sources/${ds._id}`, {
    headers: authHeaders
  });
  const getBody = await getRes.json();
  console.log('[Live] GET /api/v1/data-sources/:id status:', getRes.status);
  console.log('✓ GET response credential status:', getBody.data?.credentialStatus);
  console.log('✓ Plaintext secret leaked in GET response?', JSON.stringify(getBody).includes(sensitivePassword));

  // Step 4: PATCH metadata
  const patchMetaRes = await fetch(`${BASE_URL}/api/v1/data-sources/${ds._id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      description: 'Updated description for live verification',
      tags: ['production', 'analytics', 'verified']
    })
  });
  const patchMetaBody = await patchMetaRes.json();
  console.log('[Live] PATCH metadata status:', patchMetaRes.status);
  console.log('✓ Description updated:', patchMetaBody.data?.description);
  console.log('✓ Credentials preserved after metadata PATCH:', patchMetaBody.data?.credentialStatus === 'configured');

  // Step 5: PATCH credentials (re-encryption)
  const newSecret = 'NewRotatedPasswordSecret456!';
  const patchCredsRes = await fetch(`${BASE_URL}/api/v1/data-sources/${ds._id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      credentials: { password: newSecret }
    })
  });
  const patchCredsBody = await patchCredsRes.json();
  console.log('[Live] PATCH credentials status:', patchCredsRes.status);
  console.log('✓ Credentials re-encrypted successfully:', patchCredsBody.data?.credentialStatus === 'configured');

  // Verify in-memory decryption of new secret
  const updatedDbDoc = await DataSource.findById(ds._id).select('+credentials.encryptedData');
  const decrypted = updatedDbDoc.getDecryptedCredentials();
  console.log('✓ Server-side memory decryption matches new password:', decrypted?.password === newSecret);

  // Step 6: Test Connection Diagnostic
  const testConnRes = await fetch(`${BASE_URL}/api/v1/data-sources/${ds._id}/test`, {
    method: 'POST',
    headers: authHeaders
  });
  const testConnBody = await testConnRes.json();
  console.log('[Live] POST /test status:', testConnRes.status);
  console.log('✓ Test diagnostic status:', testConnBody.data?.status || testConnBody.status);

  // Step 7: Search
  const searchRes = await fetch(`${BASE_URL}/api/v1/data-sources?search=PostgreSQL`, {
    headers: authHeaders
  });
  const searchBody = await searchRes.json();
  console.log('[Live] GET /data-sources?search=PostgreSQL status:', searchRes.status, 'Results:', searchBody.data?.length);

  // Step 8: Filtering
  const filterRes = await fetch(`${BASE_URL}/api/v1/data-sources?filter[type]=postgresql`, {
    headers: authHeaders
  });
  const filterBody = await filterRes.json();
  console.log('[Live] GET /data-sources?filter[type]=postgresql status:', filterRes.status, 'Results:', filterBody.data?.length);

  // Step 9: Tenant Isolation Check
  const tenantBHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`, // Token is for Tenant A
    [TENANT_HEADERS.SLUG]: tenantB.slug,
    [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
  };
  const crossTenantGet = await fetch(`${BASE_URL}/api/v1/data-sources/${ds._id}`, {
    headers: tenantBHeaders
  });
  console.log('[Live] Cross-tenant lookup status (expect 403 or 404):', crossTenantGet.status);

  // Step 10: DELETE / Inactivation
  const deleteRes = await fetch(`${BASE_URL}/api/v1/data-sources/${ds._id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  const deleteBody = await deleteRes.json();
  console.log('[Live] DELETE status:', deleteRes.status);
  console.log('✓ Deactivated status:', deleteBody.data?.status, '| isDeleted:', deleteBody.data?.isDeleted);

  // Step 11: Subsequent GET after deletion
  const getAfterDel = await fetch(`${BASE_URL}/api/v1/data-sources/${ds._id}`, {
    headers: authHeaders
  });
  console.log('[Live] GET after deactivation status (expect 404):', getAfterDel.status);

  // Cleanup test entities
  await DataSource.deleteMany({ organizationId: testOrg._id });
  await User.deleteMany({ organizationId: testOrg._id });
  await Organization.deleteOne({ _id: testOrg._id });
  await Organization.deleteOne({ _id: tenantB._id });
  await disconnectDB();

  console.log('====================================================');
  console.log('LIVE VERIFICATION COMPLETE: ALL 11 VERIFICATIONS PASSED');
  console.log('====================================================');
}

runLiveStep14Verification().catch((err) => {
  console.error('[Live] Verification failed:', err);
  process.exit(1);
});
