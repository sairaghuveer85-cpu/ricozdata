import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Invitation } from '../src/models/Invitation.js';
import { USER_STATUS, USER_ROLES, INVITATION_STATUS } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import { hashPassword, verifyPassword, hashToken } from '../src/utils/crypto.js';

describe('Step 07 — User Management & Team Invitations Verification', () => {
  let server;
  let baseUrl;
  let orgAlpha;
  let orgBeta;
  let userAlphaAdmin;
  let userAlphaViewer;
  let userBetaAdmin;

  before(async () => {
    await connectDB();

    // Clean up test organizations & users
    const testSlugs = ['test-step7-alpha', 'test-step7-beta'];
    const existingOrgs = await Organization.find({ slug: { $in: testSlugs } });
    const orgIds = existingOrgs.map((o) => o._id);

    await User.deleteMany({ organizationId: { $in: orgIds } });
    await Invitation.deleteMany({ organizationId: { $in: orgIds } });
    await Organization.deleteMany({ _id: { $in: orgIds } });

    // Seed test organizations
    orgAlpha = await Organization.create({
      name: 'Step7 Alpha Corp',
      slug: 'test-step7-alpha',
      status: 'active'
    });

    orgBeta = await Organization.create({
      name: 'Step7 Beta Corp',
      slug: 'test-step7-beta',
      status: 'active'
    });

    // Seed test users
    userAlphaAdmin = await User.create({
      organizationId: orgAlpha._id,
      name: 'Alpha Admin',
      email: 'admin@alpha.com',
      passwordHash: hashPassword('AdminPass123!'),
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      department: 'Engineering'
    });

    userAlphaViewer = await User.create({
      organizationId: orgAlpha._id,
      name: 'Alpha Viewer',
      email: 'viewer@alpha.com',
      passwordHash: hashPassword('ViewerPass123!'),
      role: USER_ROLES.VIEWER,
      status: USER_STATUS.ACTIVE,
      department: 'Analytics'
    });

    userBetaAdmin = await User.create({
      organizationId: orgBeta._id,
      name: 'Beta Admin',
      email: 'admin@beta.com',
      passwordHash: hashPassword('BetaAdminPass123!'),
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      department: 'Security'
    });

    // Start HTTP server on port 0
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (orgAlpha && orgBeta) {
      await User.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
      await Invitation.deleteMany({ organizationId: { $in: [orgAlpha._id, orgBeta._id] } });
      await Organization.deleteMany({ _id: { $in: [orgAlpha._id, orgBeta._id] } });
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await disconnectDB();
  });

  // Helper for making tenant-scoped requests to Org Alpha
  function alphaHeaders(extra = {}) {
    return {
      'x-forwarded-host': 'test-step7-alpha.localhost',
      Host: 'test-step7-alpha.localhost',
      ...extra
    };
  }

  // Helper for making tenant-scoped requests to Org Beta
  function betaHeaders(extra = {}) {
    return {
      'x-forwarded-host': 'test-step7-beta.localhost',
      Host: 'test-step7-beta.localhost',
      ...extra
    };
  }

  // ============================================================================
  // 1 & 2. User Creation Validation & Email Normalization
  // ============================================================================
  test('1. User creation validation rejects invalid email or missing name', () => {
    const invalidUser = new User({
      organizationId: orgAlpha._id,
      email: 'not-an-email',
      passwordHash: 'dummy'
    });

    const error = invalidUser.validateSync();
    assert.ok(error, 'Should fail validation');
    assert.ok(error.errors.email, 'Email regex validation must fail');
    assert.ok(error.errors.name, 'Name required validation must fail');
  });

  test('2. Email normalization lowercases and trims email addresses', async () => {
    const user = await User.create({
      organizationId: orgAlpha._id,
      name: 'Normalized User',
      email: '   CaSe.SensItive@Alpha.com   ',
      passwordHash: hashPassword('Pass12345!'),
      role: USER_ROLES.ANALYST
    });

    assert.strictEqual(user.email, 'case.sensitive@alpha.com');
  });

  // ============================================================================
  // 3. Tenant-Scoped Email Uniqueness
  // ============================================================================
  test('3. Tenant-scoped email uniqueness permits identical email across tenants, blocks within tenant', async () => {
    const sharedEmail = 'shared.employee@enterprise.com';

    // Same email can exist in Org Alpha and Org Beta
    const userAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Shared Employee (Alpha)',
      email: sharedEmail,
      passwordHash: hashPassword('Pass12345!')
    });
    assert.ok(userAlpha._id);

    const userBeta = await User.create({
      organizationId: orgBeta._id,
      name: 'Shared Employee (Beta)',
      email: sharedEmail,
      passwordHash: hashPassword('Pass12345!')
    });
    assert.ok(userBeta._id);

    // But duplicate in same Org Alpha must fail with duplicate key error (11000)
    let duplicateError = null;
    try {
      await User.create({
        organizationId: orgAlpha._id,
        name: 'Alpha Duplicate',
        email: sharedEmail,
        passwordHash: hashPassword('Pass12345!')
      });
    } catch (err) {
      duplicateError = err;
    }

    assert.ok(duplicateError, 'Must reject duplicate email in same tenant');
    assert.strictEqual(duplicateError.code, 11000);
  });

  // ============================================================================
  // 4 & 5. User Profile Retrieval & Update
  // ============================================================================
  test('4. User profile retrieval GET /api/users/:id returns user without passwordHash', async () => {
    const res = await fetch(`${baseUrl}/api/users/${userAlphaViewer._id}`, {
      headers: alphaHeaders()
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.email, 'viewer@alpha.com');
    assert.strictEqual(body.data.name, 'Alpha Viewer');
    assert.strictEqual(body.data.passwordHash, undefined, 'passwordHash must never be returned');
  });

  test('5. Profile update PATCH /api/users/:id updates profile and account settings', async () => {
    const res = await fetch(`${baseUrl}/api/users/${userAlphaViewer._id}`, {
      method: 'PATCH',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name: 'Alpha Viewer Senior',
        department: 'Business Intelligence',
        profile: {
          title: 'Senior BI Analyst',
          bio: 'Data intelligence specialist'
        },
        settings: {
          theme: 'light',
          timezone: 'America/New_York',
          notifications: { weeklyDigest: true }
        }
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.name, 'Alpha Viewer Senior');
    assert.strictEqual(body.data.department, 'Business Intelligence');
    assert.strictEqual(body.data.profile.title, 'Senior BI Analyst');
    assert.strictEqual(body.data.settings.theme, 'light');
    assert.strictEqual(body.data.settings.timezone, 'America/New_York');
    assert.strictEqual(body.data.settings.notifications.weeklyDigest, true);
  });

  // ============================================================================
  // 6. Protected-Field Rejection (Mass Assignment Defense)
  // ============================================================================
  test('6. Protected-field rejection prevents modifying role, status, or organizationId via profile PATCH', async () => {
    const attempts = [
      { organizationId: orgBeta._id.toString() },
      { role: USER_ROLES.OWNER },
      { status: USER_STATUS.SUSPENDED },
      { passwordHash: 'hacked_hash' }
    ];

    for (const payload of attempts) {
      const res = await fetch(`${baseUrl}/api/users/${userAlphaViewer._id}`, {
        method: 'PATCH',
        headers: alphaHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      assert.ok(
        [400, 403].includes(res.status),
        `Protected field modification must be rejected with 400 or 403. Payload: ${JSON.stringify(payload)}`
      );
    }
  });

  // ============================================================================
  // 7, 8, 9. Cross-Tenant Read, Update, and Delete Prevention
  // ============================================================================
  test('7. Cross-tenant read prevention: Tenant A caller querying Tenant B user ID returns 404', async () => {
    // Tenant Alpha requests User from Tenant Beta
    const res = await fetch(`${baseUrl}/api/users/${userBetaAdmin._id}`, {
      headers: alphaHeaders()
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'NOT_FOUND');
  });

  test('8. Cross-tenant update prevention: Tenant A caller modifying Tenant B user returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/users/${userBetaAdmin._id}`, {
      method: 'PATCH',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: 'Hacked Name' })
    });

    assert.strictEqual(res.status, 404);

    // Verify Beta user is untouched in database
    const freshBeta = await User.findById(userBetaAdmin._id);
    assert.strictEqual(freshBeta.name, 'Beta Admin');
  });

  test('9. Cross-tenant delete prevention: Tenant A caller deleting Tenant B user returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/users/${userBetaAdmin._id}`, {
      method: 'DELETE',
      headers: alphaHeaders()
    });

    assert.strictEqual(res.status, 404);

    // Verify Beta user is still active in database
    const freshBeta = await User.findById(userBetaAdmin._id);
    assert.strictEqual(freshBeta.status, USER_STATUS.ACTIVE);
  });

  // ============================================================================
  // 10, 11, 12. User Statuses: ACTIVE, SUSPENDED, INVITED
  // ============================================================================
  test('10. Status ACTIVE users require passwordHash and are normal members', async () => {
    const activeUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Active Member',
      email: 'active.member@alpha.com',
      passwordHash: hashPassword('Pass12345!'),
      status: USER_STATUS.ACTIVE
    });
    assert.strictEqual(activeUser.status, 'active');
  });

  test('11. Status SUSPENDED can be set on existing active users', async () => {
    const targetUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'To Suspend',
      email: 'to.suspend@alpha.com',
      passwordHash: hashPassword('Pass12345!'),
      status: USER_STATUS.ACTIVE
    });

    const res = await fetch(`${baseUrl}/api/users/${targetUser._id}/status`, {
      method: 'PATCH',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: USER_STATUS.SUSPENDED })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.status, 'suspended');

    const inDb = await User.findById(targetUser._id);
    assert.strictEqual(inDb.status, 'suspended');
  });

  test('12. Status INVITED allows placeholder accounts before password is set', async () => {
    const invitedUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Invited Placeholder',
      email: 'placeholder@alpha.com',
      status: USER_STATUS.INVITED
    });
    assert.strictEqual(invitedUser.status, 'invited');
  });

  // ============================================================================
  // 13 & 14. Valid and Invalid Status Transitions
  // ============================================================================
  test('13. Valid status transitions: SUSPENDED -> ACTIVE reactivates account', async () => {
    const suspendedUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Reactivate Me',
      email: 'reactivate@alpha.com',
      passwordHash: hashPassword('Pass12345!'),
      status: USER_STATUS.SUSPENDED
    });

    const res = await fetch(`${baseUrl}/api/users/${suspendedUser._id}/status`, {
      method: 'PATCH',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: USER_STATUS.ACTIVE })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.status, 'active');
  });

  test('14. Invalid status transitions: ACTIVE -> INVITED is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/users/${userAlphaAdmin._id}/status`, {
      method: 'PATCH',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: USER_STATUS.INVITED })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.message.includes('Invalid status transition'));
  });

  // ============================================================================
  // 15, 16, 17, 18, 19, 20, 21. Team Invitations Lifecycle & Cryptography
  // ============================================================================
  let inviteToken = null;
  let inviteId = null;

  test('15. Invitation creation POST /api/users/invitations generates invitation and returns raw token', async () => {
    const res = await fetch(`${baseUrl}/api/users/invitations`, {
      method: 'POST',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        email: 'new.engineer@alpha.com',
        role: USER_ROLES.DATA_ENGINEER,
        department: 'Infrastructure'
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token, 'Must return raw token on generation');
    assert.strictEqual(body.data.token.length, 64, 'Token must be 64-char hex');
    assert.strictEqual(body.data.email, 'new.engineer@alpha.com');
    assert.strictEqual(body.data.role, 'data_engineer');
    assert.strictEqual(body.data.status, 'pending');

    inviteToken = body.data.token;
    inviteId = body.data._id;
  });

  test('16. Invitation token hashing: Verified in MongoDB that only SHA-256 hash is stored, never raw token', async () => {
    const invitationInDb = await Invitation.findById(inviteId).select('+tokenHash');
    assert.ok(invitationInDb);
    assert.notStrictEqual(invitationInDb.tokenHash, inviteToken, 'Database must not contain raw token');
    assert.strictEqual(invitationInDb.tokenHash, hashToken(inviteToken), 'Database must store SHA-256 hash');
  });

  test('17. Invitation expiration: Expired invitation cannot be accepted', async () => {
    // Create an expired invitation directly
    const expiredRaw = 'expired_raw_token_value_1234567890abcdef1234567890abcdef12345678';
    await Invitation.create({
      organizationId: orgAlpha._id,
      email: 'expired.user@alpha.com',
      tokenHash: hashToken(expiredRaw),
      role: USER_ROLES.VIEWER,
      status: INVITATION_STATUS.PENDING,
      expiresAt: new Date(Date.now() - 3600000) // Expired 1 hour ago
    });

    const res = await fetch(`${baseUrl}/api/users/invitations/${expiredRaw}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Expired User',
        password: 'ValidPassword123!'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.message.includes('expired'));
  });

  test('19. Invitation acceptance POST /api/users/invitations/:token/accept creates active user in correct tenant', async () => {
    const res = await fetch(`${baseUrl}/api/users/invitations/${inviteToken}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Elena Rostova',
        password: 'SecurePassword123!'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.email, 'new.engineer@alpha.com');
    assert.strictEqual(body.data.name, 'Elena Rostova');
    assert.strictEqual(body.data.role, 'data_engineer');
    assert.strictEqual(body.data.status, 'active');
    assert.strictEqual(body.data.organizationId.toString(), orgAlpha._id.toString());
    assert.strictEqual(body.data.emailVerified, true);

    // Verify password hash in DB is verifiable with candidate password
    const userInDb = await User.findById(body.data._id).select('+passwordHash');
    assert.ok(verifyPassword('SecurePassword123!', userInDb.passwordHash));
  });

  test('18. Invitation single-use enforcement: Attempting to accept already accepted token fails', async () => {
    const res = await fetch(`${baseUrl}/api/users/invitations/${inviteToken}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Replay',
        password: 'SecurePassword123!'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.message.includes('already been accepted'));
  });

  test('20. Invitation revocation DELETE /api/users/invitations/:id marks invitation revoked', async () => {
    // Generate a fresh invitation
    const createRes = await fetch(`${baseUrl}/api/users/invitations`, {
      method: 'POST',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        email: 'to.revoke@alpha.com',
        role: USER_ROLES.VIEWER
      })
    });
    const createBody = await createRes.json();
    const toRevokeId = createBody.data._id;
    const toRevokeToken = createBody.data.token;

    // Revoke it
    const revokeRes = await fetch(`${baseUrl}/api/users/invitations/${toRevokeId}`, {
      method: 'DELETE',
      headers: alphaHeaders()
    });
    assert.strictEqual(revokeRes.status, 200);

    // Attempting to accept revoked token fails
    const acceptRes = await fetch(`${baseUrl}/api/users/invitations/${toRevokeToken}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Revoked Person',
        password: 'Password123!'
      })
    });
    assert.strictEqual(acceptRes.status, 400);
    const acceptBody = await acceptRes.json();
    assert.ok(acceptBody.error.message.includes('revoked'));
  });

  test('21. Duplicate pending invitation prevention: Re-inviting same email while pending is rejected', async () => {
    const duplicateEmail = 'duplicate.test@alpha.com';

    // First invitation succeeds
    const firstRes = await fetch(`${baseUrl}/api/users/invitations`, {
      method: 'POST',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: duplicateEmail, role: USER_ROLES.VIEWER })
    });
    assert.strictEqual(firstRes.status, 201);

    // Second invitation to same email in same tenant fails with 409 Conflict
    const secondRes = await fetch(`${baseUrl}/api/users/invitations`, {
      method: 'POST',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email: duplicateEmail, role: USER_ROLES.VIEWER })
    });
    assert.strictEqual(secondRes.status, 409);
    const secondBody = await secondRes.json();
    assert.strictEqual(secondBody.error.code, 'CONFLICT');
  });

  // ============================================================================
  // 22 & 23. Role & Organization Boundary Security
  // ============================================================================
  test('22. Role-change protection: Non-admin or self-role change is rejected', async () => {
    // Normal user attempting to promote themselves
    const res = await fetch(`${baseUrl}/api/users/${userAlphaViewer._id}/role`, {
      method: 'PATCH',
      headers: alphaHeaders({
        'Content-Type': 'application/json',
        'x-caller-role': USER_ROLES.VIEWER,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }),
      body: JSON.stringify({ role: USER_ROLES.OWNER })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INSUFFICIENT_PERMISSIONS');
  });

  test('23. OrganizationId cannot be modified or injected in payload', async () => {
    const res = await fetch(`${baseUrl}/api/users/${userAlphaViewer._id}`, {
      method: 'PATCH',
      headers: alphaHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        organizationId: orgBeta._id.toString(),
        name: 'Attempted Move'
      })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'TENANT_PAYLOAD_MISMATCH');
  });
});
