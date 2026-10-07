import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';

import app from '../src/app.js';
import config from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { USER_STATUS, USER_ROLES } from '../src/constants/user.js';
import { TENANT_HEADERS } from '../src/constants/tenant.js';
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateSecureToken,
  generateOtp,
  hashOtp,
  verifyOtp
} from '../src/utils/crypto.js';
import emailService from '../src/services/email.service.js';
import authService from '../src/services/auth.service.js';
import authProviderRegistry from '../src/services/auth/providerRegistry.js';
import { GoogleOAuthProvider } from '../src/services/auth/googleProvider.js';

describe('Step 08 — Authentication, OAuth 2.0 & Email Verification Verification', () => {
  let server;
  let baseUrl;
  let orgAlpha;
  let orgBeta;
  let activeUserAlpha;
  let suspendedUserAlpha;
  let invitedUserAlpha;

  const validPassword = 'SecurePassword123!';
  const updatedPassword = 'NewSecurePassword456#';

  before(async () => {
    await connectDB();

    // Clean up previous test organizations
    const testSlugs = ['test-step8-alpha', 'test-step8-beta'];
    const existingOrgs = await Organization.find({ slug: { $in: testSlugs } });
    const orgIds = existingOrgs.map((o) => o._id);

    await User.deleteMany({ organizationId: { $in: orgIds } });
    await Organization.deleteMany({ _id: { $in: orgIds } });

    // Seed test organizations
    orgAlpha = await Organization.create({
      name: 'Step8 Alpha Corp',
      slug: 'test-step8-alpha',
      status: 'active'
    });

    orgBeta = await Organization.create({
      name: 'Step8 Beta Corp',
      slug: 'test-step8-beta',
      status: 'active'
    });

    // Seed active user in Alpha
    activeUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Alice Alpha',
      email: 'alice@alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerified: true
    });

    // Seed suspended user in Alpha
    suspendedUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Sam Suspended',
      email: 'sam@alpha.com',
      passwordHash: hashPassword(validPassword),
      role: USER_ROLES.ANALYST,
      status: USER_STATUS.SUSPENDED
    });

    // Seed invited user in Alpha (no password yet)
    invitedUserAlpha = await User.create({
      organizationId: orgAlpha._id,
      name: 'Ivy Invited',
      email: 'ivy@alpha.com',
      role: USER_ROLES.VIEWER,
      status: USER_STATUS.INVITED
    });

    // Start ephemeral HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    const testSlugs = ['test-step8-alpha', 'test-step8-beta'];
    const existingOrgs = await Organization.find({ slug: { $in: testSlugs } });
    const orgIds = existingOrgs.map((o) => o._id);
    await User.deleteMany({ organizationId: { $in: orgIds } });
    await Organization.deleteMany({ _id: { $in: orgIds } });
    await disconnectDB();
  });

  // Helper for requests
  async function apiRequest(path, options = {}) {
    const { headers = {}, body, ...rest } = options;
    const reqHeaders = { ...headers };

    if (body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${baseUrl}${path}`, {
      ...rest,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
      if (json && typeof json === 'object' && json.error?.message && !json.message) {
        json.message = json.error.message;
      }
    } catch {
      json = text;
    }

    return { status: res.status, headers: res.headers, body: json };
  }

  // ------------------------------------------------------------------------
  // 1. Registration Success
  // ------------------------------------------------------------------------
  test('1. Registration success: POST /api/auth/register creates active user with bcrypt hash', async () => {
    emailService.clearOutbox();

    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Bob Builder',
        email: 'bob.builder@alpha.com',
        password: 'StrongPassword123!',
        department: 'Data Platform'
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, 'bob.builder@alpha.com');
    assert.equal(res.body.data.user.name, 'Bob Builder');
    assert.equal(res.body.data.user.emailVerified, false);
    assert.equal(res.body.data.user.passwordHash, undefined, 'passwordHash must never be exposed');

    // Verify in MongoDB
    const dbUser = await User.findOne({ organizationId: orgAlpha._id, email: 'bob.builder@alpha.com' }).select('+passwordHash +emailVerificationTokenHash +emailVerificationOtpHash');
    assert.ok(dbUser);
    assert.ok(dbUser.passwordHash.startsWith('$2a$') || dbUser.passwordHash.startsWith('$2b$'));
    assert.ok(dbUser.emailVerificationTokenHash);
    assert.ok(dbUser.emailVerificationOtpHash);
  });

  // ------------------------------------------------------------------------
  // 2. Duplicate Registration Prevention
  // ------------------------------------------------------------------------
  test('2. Duplicate registration prevention: re-registering existing email in same tenant returns 409', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Duplicate Bob',
        email: 'bob.builder@alpha.com',
        password: 'AnotherPassword123!'
      }
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already exists/i);
  });

  // ------------------------------------------------------------------------
  // 3. Email Normalization
  // ------------------------------------------------------------------------
  test('3. Email normalization: trims and lowercases email during registration', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        name: 'Normalized User',
        email: '  CaSe.SeNsItIvE@Alpha.com  ',
        password: 'Password123!'
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email, 'case.sensitive@alpha.com');

    const dbUser = await User.findOne({ organizationId: orgAlpha._id, email: 'case.sensitive@alpha.com' });
    assert.ok(dbUser);
  });

  // ------------------------------------------------------------------------
  // 4. Password Hashing
  // ------------------------------------------------------------------------
  test('4. Password hashing: bcrypt produces valid hashes with salt rounds >= 12', () => {
    const hash = hashPassword('MySecretPass123!');
    assert.ok(hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$'));
    assert.notEqual(hash, 'MySecretPass123!');
  });

  // ------------------------------------------------------------------------
  // 5. Password Verification
  // ------------------------------------------------------------------------
  test('5. Password verification: matches correct candidate and rejects incorrect candidate', () => {
    const hash = hashPassword('MySecretPass123!');
    assert.equal(verifyPassword('MySecretPass123!', hash), true);
    assert.equal(verifyPassword('WrongPass!', hash), false);
    assert.equal(verifyPassword('', hash), false);
  });

  // ------------------------------------------------------------------------
  // 6. Login Success
  // ------------------------------------------------------------------------
  test('6. Login success: POST /api/auth/login authenticates user and updates lastLoginAt', async () => {
    const beforeLogin = new Date();

    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'alice@alpha.com',
        password: validPassword
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, 'alice@alpha.com');
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.ok(res.body.data.session);
    assert.equal(res.body.data.session.role, USER_ROLES.ADMIN);

    const dbUser = await User.findById(activeUserAlpha._id);
    assert.ok(dbUser.lastLoginAt >= beforeLogin);
  });

  // ------------------------------------------------------------------------
  // 7. Invalid Password Rejection
  // ------------------------------------------------------------------------
  test('7. Invalid password: login with incorrect password returns 401 Unauthorized', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'alice@alpha.com',
        password: 'CompletelyWrongPassword123!'
      }
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  // ------------------------------------------------------------------------
  // 8. Invalid/Nonexistent Credentials Without Enumeration
  // ------------------------------------------------------------------------
  test('8. Anti-enumeration: nonexistent email returns identical 401 message as wrong password', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'ghost.user.does.not.exist@alpha.com',
        password: 'SomePassword123!'
      }
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  // ------------------------------------------------------------------------
  // 9. Suspended Account Rejection
  // ------------------------------------------------------------------------
  test('9. Suspended account rejection: suspended user cannot log in', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'sam@alpha.com',
        password: validPassword
      }
    });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /suspended/i);
  });

  // ------------------------------------------------------------------------
  // 10. Invited Account Handling
  // ------------------------------------------------------------------------
  test('10. Invited account handling: invited placeholder cannot log in until setup complete', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'ivy@alpha.com',
        password: 'AnyPassword123!'
      }
    });

    assert.equal(res.status, 401);
    assert.match(res.body.message, /invitation is pending/i);
  });

  // ------------------------------------------------------------------------
  // 11. Password Reset Request
  // ------------------------------------------------------------------------
  test('11. Password reset request: POST /api/auth/forgot-password returns safe generic message', async () => {
    const res = await apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'alice@alpha.com'
      }
    });

    assert.equal(res.status, 200);
    assert.match(res.body.message, /password reset instructions have been sent/i);
  });

  // ------------------------------------------------------------------------
  // 12. Reset Token Hashing
  // ------------------------------------------------------------------------
  test('12. Reset token hashing: MongoDB stores only SHA-256 hash of password reset token', async () => {
    const rawResetToken = generateSecureToken(32);
    const tokenHash = hashToken(rawResetToken);

    await User.updateOne(
      { _id: activeUserAlpha._id },
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 3600000)
      }
    );

    const doc = await User.findById(activeUserAlpha._id).select('+passwordResetTokenHash');
    assert.equal(doc.passwordResetTokenHash, tokenHash);
    assert.notEqual(doc.passwordResetTokenHash, rawResetToken);
    assert.equal(doc.passwordResetTokenHash.length, 64);
  });

  // ------------------------------------------------------------------------
  // 13. Reset Token Expiration
  // ------------------------------------------------------------------------
  test('13. Reset token expiration: expired reset token is rejected with 400', async () => {
    const rawExpiredToken = generateSecureToken(32);
    const tokenHash = hashToken(rawExpiredToken);

    await User.updateOne(
      { _id: activeUserAlpha._id },
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      }
    );

    const res = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawExpiredToken,
        newPassword: 'BrandNewPassword123!'
      }
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /invalid or expired/i);
  });

  // ------------------------------------------------------------------------
  // 14. Reset Token Single-Use
  // ------------------------------------------------------------------------
  test('14. Reset token single-use & 15. Successful password reset', async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    await User.updateOne(
      { _id: activeUserAlpha._id },
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 3600000)
      }
    );

    // 15. Successful password reset
    const res = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawToken,
        newPassword: updatedPassword
      }
    });

    assert.equal(res.status, 200);
    assert.match(res.body.message, /successfully reset/i);

    // 14. Single-use check: reusing same token must fail
    const reuseRes = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: rawToken,
        newPassword: 'AnotherNewPassword999!'
      }
    });

    assert.equal(reuseRes.status, 400);
    assert.match(reuseRes.body.message, /invalid or expired/i);

    // Verify user can log in with new password
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'alice@alpha.com',
        password: updatedPassword
      }
    });

    assert.equal(loginRes.status, 200);
  });

  // ------------------------------------------------------------------------
  // 16. Email Verification via Token
  // ------------------------------------------------------------------------
  test('16. Email verification: POST /api/auth/verify-email with valid token verifies user', async () => {
    const rawVerifyToken = generateSecureToken(32);
    const tokenHash = hashToken(rawVerifyToken);

    const unverifiedUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Unverified Dan',
      email: 'dan@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: new Date(Date.now() + 86400000)
    });

    const res = await apiRequest('/api/auth/verify-email', {
      method: 'POST',
      body: {
        token: rawVerifyToken
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.emailVerified, true);

    const dbUser = await User.findById(unverifiedUser._id);
    assert.equal(dbUser.emailVerified, true);
    assert.ok(dbUser.emailVerifiedAt);
  });

  // ------------------------------------------------------------------------
  // 17. Verification Token Hashing
  // ------------------------------------------------------------------------
  test('17. Verification token hashing: MongoDB stores SHA-256 digest, never raw token', async () => {
    const rawToken = generateSecureToken(32);
    const expectedHash = hashToken(rawToken);

    const testUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Hash Check User',
      email: 'hashcheck@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerificationTokenHash: expectedHash,
      emailVerificationExpiresAt: new Date(Date.now() + 86400000)
    });

    const doc = await User.findById(testUser._id).select('+emailVerificationTokenHash');
    assert.equal(doc.emailVerificationTokenHash, expectedHash);
    assert.notEqual(doc.emailVerificationTokenHash, rawToken);
  });

  // ------------------------------------------------------------------------
  // 18. Verification Expiration
  // ------------------------------------------------------------------------
  test('18. Verification expiration: expired token cannot verify email', async () => {
    const rawToken = generateSecureToken(32);
    await User.create({
      organizationId: orgAlpha._id,
      name: 'Expired Verify User',
      email: 'expired.verify@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerificationTokenHash: hashToken(rawToken),
      emailVerificationExpiresAt: new Date(Date.now() - 5000) // Expired
    });

    const res = await apiRequest('/api/auth/verify-email', {
      method: 'POST',
      body: {
        token: rawToken
      }
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /invalid or expired/i);
  });

  // ------------------------------------------------------------------------
  // 19. Verification Single-Use
  // ------------------------------------------------------------------------
  test('19. Verification single-use: token cannot be reused after verification', async () => {
    const rawToken = generateSecureToken(32);
    await User.create({
      organizationId: orgAlpha._id,
      name: 'Single Use Verify',
      email: 'single.verify@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerificationTokenHash: hashToken(rawToken),
      emailVerificationExpiresAt: new Date(Date.now() + 86400000)
    });

    // First use
    const firstRes = await apiRequest('/api/auth/verify-email', {
      method: 'POST',
      body: { token: rawToken }
    });
    assert.equal(firstRes.status, 200);

    // Second use
    const secondRes = await apiRequest('/api/auth/verify-email', {
      method: 'POST',
      body: { token: rawToken }
    });
    assert.equal(secondRes.status, 400);
    assert.match(secondRes.body.message, /invalid or expired/i);
  });

  // ------------------------------------------------------------------------
  // 20. Resend Verification Behavior
  // ------------------------------------------------------------------------
  test('20. Resend verification behavior: generates new tokens and enforces 60-second cooldown', async () => {
    const resendUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Resend Test',
      email: 'resend.test@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerified: false,
      emailVerificationSentAt: new Date(Date.now() - 70000) // Sent 70s ago
    });

    // 1st request should succeed
    const res1 = await apiRequest('/api/auth/resend-verification', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: { email: 'resend.test@alpha.com' }
    });
    assert.equal(res1.status, 200);

    // 2nd immediate request should hit 60s cooldown
    const res2 = await apiRequest('/api/auth/resend-verification', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: { email: 'resend.test@alpha.com' }
    });
    assert.equal(res2.status, 400);
    assert.match(res2.body.message, /wait/i);
  });

  // ------------------------------------------------------------------------
  // 21. OTP Generation
  // ------------------------------------------------------------------------
  test('21. OTP generation: produces 6-digit numeric string', () => {
    const otp = generateOtp(6);
    assert.equal(otp.length, 6);
    assert.match(otp, /^\d{6}$/);
  });

  // ------------------------------------------------------------------------
  // 22. OTP Hashing
  // ------------------------------------------------------------------------
  test('22. OTP hashing: produces SHA-256 digest and verifies in constant time', () => {
    const otp = '849201';
    const otpHash = hashOtp(otp);
    assert.equal(otpHash.length, 64);
    assert.equal(verifyOtp(otp, otpHash), true);
    assert.equal(verifyOtp('000000', otpHash), false);
  });

  // ------------------------------------------------------------------------
  // 23. OTP Expiration
  // ------------------------------------------------------------------------
  test('23. OTP expiration: expired OTP code returns 400', async () => {
    const otp = '123456';
    await User.create({
      organizationId: orgAlpha._id,
      name: 'Expired OTP User',
      email: 'expired.otp@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerified: false,
      emailVerificationOtpHash: hashOtp(otp),
      emailVerificationExpiresAt: new Date(Date.now() - 1000) // Expired
    });

    const res = await apiRequest('/api/auth/verify-email', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'expired.otp@alpha.com',
        otp: '123456'
      }
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /expired/i);
  });

  // ------------------------------------------------------------------------
  // 24. OTP Attempt Limits & 25. OTP Single-Use
  // ------------------------------------------------------------------------
  test('24. OTP attempt limits: 5 failed attempts lock verification; 25. OTP single-use', async () => {
    const otp = '999888';
    const otpUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Brute Force Test',
      email: 'brute.otp@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerified: false,
      emailVerificationOtpHash: hashOtp(otp),
      emailVerificationExpiresAt: new Date(Date.now() + 600000),
      emailVerificationAttempts: 0
    });

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          [TENANT_HEADERS.SLUG]: orgAlpha.slug,
          [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
        },
        body: { email: 'brute.otp@alpha.com', otp: '000000' }
      });
      assert.equal(res.status, 400);
    }

    // 5th failed attempt locks code
    const res5 = await apiRequest('/api/auth/verify-email', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: { email: 'brute.otp@alpha.com', otp: '000000' }
    });
    assert.equal(res5.status, 400);

    // 6th attempt with correct OTP is locked out
    const lockedRes = await apiRequest('/api/auth/verify-email', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: { email: 'brute.otp@alpha.com', otp }
    });
    assert.equal(lockedRes.status, 400);
    assert.match(lockedRes.body.message, /maximum verification attempts exceeded/i);
  });

  // ------------------------------------------------------------------------
  // 26. Google OAuth Initiation
  // ------------------------------------------------------------------------
  test('26. Google OAuth initiation: GET /api/auth/google generates authorization URL with signed state', async () => {
    const res = await apiRequest('/api/auth/google', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        [TENANT_HEADERS.SLUG]: orgAlpha.slug,
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      }
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.authUrl);
    assert.ok(res.body.data.authUrl.includes('accounts.google.com'));
    assert.ok(res.body.data.authUrl.includes('client_id='));
    assert.ok(res.body.data.state);
  });

  // ------------------------------------------------------------------------
  // 27. Google OAuth Callback Handling
  // ------------------------------------------------------------------------
  test('27. Google OAuth callback handling: verified state and profile create active user', async () => {
    const googleProvider = authProviderRegistry.get('google');
    const state = googleProvider.generateState(orgAlpha._id);

    // Mock exchangeCodeForProfile for controlled integration verification
    const originalExchange = googleProvider.exchangeCodeForProfile;
    googleProvider.exchangeCodeForProfile = async (code) => {
      assert.equal(code, 'mock_google_valid_auth_code');
      return {
        googleId: 'google_user_1092837465',
        email: 'google.engineer@alpha.com',
        emailVerified: true,
        name: 'Google Engineer',
        avatarUrl: 'https://lh3.googleusercontent.com/a/mock'
      };
    };

    try {
      const res = await apiRequest(`/api/auth/google/callback?code=mock_google_valid_auth_code&state=${encodeURIComponent(state)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.email, 'google.engineer@alpha.com');
      assert.equal(res.body.data.user.authProvider, 'google');
      assert.equal(res.body.data.user.googleId, 'google_user_1092837465');
      assert.equal(res.body.data.user.emailVerified, true);
    } finally {
      googleProvider.exchangeCodeForProfile = originalExchange;
    }
  });

  // ------------------------------------------------------------------------
  // 28. OAuth State Validation (Anti-CSRF & Tampering)
  // ------------------------------------------------------------------------
  test('28. OAuth state validation: rejects tampered state parameter with 401', async () => {
    const tamperedState = 'eyJvcmdJZCI6IjEyMzQ1NiJ9.invalid_signature_tampered';

    const res = await apiRequest(`/api/auth/google/callback?code=testcode&state=${encodeURIComponent(tamperedState)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    assert.equal(res.status, 401);
    assert.match(res.body.message, /signature verification failed/i);
  });

  // ------------------------------------------------------------------------
  // 29. Unsafe Google Account-Link Prevention
  // ------------------------------------------------------------------------
  test('29. Unsafe Google account-link prevention: cannot link account already bound to another googleId', async () => {
    // Seed user already linked to a different googleId
    await User.create({
      organizationId: orgAlpha._id,
      name: 'Bound Google User',
      email: 'bound.google@alpha.com',
      authProvider: 'google',
      googleId: 'existing_google_id_111',
      emailVerified: true
    });

    const googleProvider = authProviderRegistry.get('google');
    const state = googleProvider.generateState(orgAlpha._id);

    const originalExchange = googleProvider.exchangeCodeForProfile;
    googleProvider.exchangeCodeForProfile = async () => ({
      googleId: 'different_attacker_google_id_222',
      email: 'bound.google@alpha.com',
      emailVerified: true,
      name: 'Attacker'
    });

    try {
      const res = await apiRequest(`/api/auth/google/callback?code=code&state=${encodeURIComponent(state)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      assert.equal(res.status, 409);
      assert.match(res.body.message, /already linked to a different Google account/i);
    } finally {
      googleProvider.exchangeCodeForProfile = originalExchange;
    }
  });

  // ------------------------------------------------------------------------
  // 30. Tenant Isolation During Authentication
  // ------------------------------------------------------------------------
  test('30. Tenant isolation: credentials for Tenant A cannot authenticate against Tenant B', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        [TENANT_HEADERS.SLUG]: orgBeta.slug, // Request targeted at Beta
        [TENANT_HEADERS.INTERNAL_SECRET]: config.tenant.trustedInternalSecret
      },
      body: {
        email: 'alice@alpha.com', // Alice belongs to Alpha
        password: updatedPassword
      }
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  // ------------------------------------------------------------------------
  // 31. Nodemailer Service Behavior
  // ------------------------------------------------------------------------
  test('31. Nodemailer service behavior: formats email templates without leaking passwords or internal secrets', async () => {
    emailService.clearOutbox();

    await emailService.sendVerificationEmail({
      to: 'template.test@alpha.com',
      name: 'Template Tester',
      token: 'raw_verification_token_secret_123',
      otp: '777888'
    });

    assert.equal(emailService.outbox.length, 1);
    const sent = emailService.outbox[0];
    assert.equal(sent.to, 'template.test@alpha.com');
    assert.ok(sent.html.includes('Verify Email Address'));
    assert.ok(sent.html.includes('777888'));
    assert.ok(!sent.html.includes('passwordHash'));
  });

  // ------------------------------------------------------------------------
  // 32. SMTP Failure Handling
  // ------------------------------------------------------------------------
  test('32. SMTP failure handling: transporter send error handled gracefully without crashing API', async () => {
    const originalTransporter = emailService.transporter;

    // Simulate failing SMTP transport
    emailService.transporter = {
      sendMail: async () => {
        throw new Error('Connection timeout to SMTP gateway');
      }
    };

    try {
      const result = await emailService.sendMail({
        to: 'fail.test@alpha.com',
        subject: 'Test Fail',
        html: '<p>Test</p>',
        text: 'Test'
      });

      assert.equal(result.delivered, false);
      assert.ok(result.error);
    } finally {
      emailService.transporter = originalTransporter;
    }
  });

  // ------------------------------------------------------------------------
  // 33. Protected Credentials
  // ------------------------------------------------------------------------
  test('33. Protected credentials: toJSON & query transforms strip passwordHash and token hashes', async () => {
    const rawResetToken = generateSecureToken(32);
    const rawVerifyToken = generateSecureToken(32);

    const user = await User.create({
      organizationId: orgAlpha._id,
      name: 'Secret Stripping Test',
      email: 'secret.strip@alpha.com',
      passwordHash: hashPassword(validPassword),
      passwordResetTokenHash: hashToken(rawResetToken),
      emailVerificationTokenHash: hashToken(rawVerifyToken),
      emailVerificationOtpHash: hashOtp('123456')
    });

    const json = user.toJSON();
    assert.equal(json.passwordHash, undefined);
    assert.equal(json.passwordResetTokenHash, undefined);
    assert.equal(json.emailVerificationTokenHash, undefined);
    assert.equal(json.emailVerificationOtpHash, undefined);
  });

  // ------------------------------------------------------------------------
  // 34. Browser OAuth Initiation (Zero-Header Top-Level Navigation)
  // ------------------------------------------------------------------------
  test('34. Browser OAuth initiation: GET /api/auth/google without headers performs 302 redirect to Google with client_id and signed state', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location);
    assert.ok(location.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
    assert.ok(location.includes(`client_id=${config.oauth.google.clientId}`));
    assert.ok(location.includes(`redirect_uri=${encodeURIComponent(config.oauth.google.callbackUrl)}`));
    assert.ok(location.includes('state='));
  });

  // ------------------------------------------------------------------------
  // 35. Browser OAuth Callback Redirects to Frontend with Session Data
  // ------------------------------------------------------------------------
  test('35. Browser OAuth callback redirects to frontend with user parameters', async () => {
    const googleProvider = authProviderRegistry.get('google');
    const state = googleProvider.generateState(orgAlpha._id);

    const originalExchange = googleProvider.exchangeCodeForProfile;
    googleProvider.exchangeCodeForProfile = async () => ({
      googleId: 'google_browser_flow_user_123',
      email: 'browser.user@alpha.com',
      emailVerified: true,
      name: 'Browser User'
    });

    try {
      const res = await fetch(`${baseUrl}/api/auth/google/callback?code=mock_code&state=${encodeURIComponent(state)}`, {
        redirect: 'manual'
      });

      assert.equal(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location.startsWith('http://localhost:5173/auth/callback'));
      const url = new URL(location);
      assert.equal(url.searchParams.get('status'), 'success');
      // Step 09 Migration: Identity MUST NOT be exposed in URL query parameters
      assert.equal(url.searchParams.get('email'), null, 'Email must not be in query params');
      assert.equal(url.searchParams.get('name'), null, 'Name must not be in query params');
      assert.equal(url.searchParams.get('userId'), null, 'UserId must not be in query params');

      // Refresh token cookie must be set on response
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie && setCookie.includes('ricoz_refresh_token='));
    } finally {
      googleProvider.exchangeCodeForProfile = originalExchange;
    }
  });

  // ------------------------------------------------------------------------
  // 36. Existing User Linking via Google
  // ------------------------------------------------------------------------
  test('36. Existing user linking: safely binds Google ID to existing local account', async () => {
    const localUser = await User.create({
      organizationId: orgAlpha._id,
      name: 'Pre-existing Local',
      email: 'preexisting@alpha.com',
      passwordHash: hashPassword(validPassword),
      emailVerified: false
    });

    const googleProvider = authProviderRegistry.get('google');
    const state = googleProvider.generateState(orgAlpha._id);

    const originalExchange = googleProvider.exchangeCodeForProfile;
    googleProvider.exchangeCodeForProfile = async () => ({
      googleId: 'new_bound_google_id_777',
      email: 'preexisting@alpha.com',
      emailVerified: true,
      name: 'Pre-existing Local'
    });

    try {
      const res = await apiRequest(`/api/auth/google/callback?code=mock_code&state=${encodeURIComponent(state)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.email, 'preexisting@alpha.com');
      assert.equal(res.body.data.user.googleId, 'new_bound_google_id_777');
      assert.equal(res.body.data.user.emailVerified, true);

      const dbUser = await User.findById(localUser._id);
      assert.equal(dbUser.googleId, 'new_bound_google_id_777');
      assert.equal(dbUser.emailVerified, true);
    } finally {
      googleProvider.exchangeCodeForProfile = originalExchange;
    }
  });

  // ------------------------------------------------------------------------
  // 37. OAuth Cancellation & Error Handling
  // ------------------------------------------------------------------------
  test('37. OAuth error handling: user cancellation redirects browser to /auth/callback with error message', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/callback?error=access_denied`, {
      redirect: 'manual'
    });

    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.includes('/auth/callback?status=error'));
    assert.ok(location.includes('access_denied'));
  });
});
