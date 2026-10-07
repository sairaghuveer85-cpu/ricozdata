import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Enterprise cryptographic utilities for RicozData.
 * Implements:
 * - Production-grade password hashing with bcrypt (cost factor 12)
 * - Safe dual-algorithm verification with scrypt legacy compatibility & transparent rehash
 * - Cryptographically secure token generation and SHA-256 storage hashing
 * - Cryptographically secure 6-digit OTP generation, hashing, and constant-time verification
 */

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcrypt with standard cost factor 12.
 * @param {string} password Plaintext password
 * @returns {string} bcrypt hash ($2a$ or $2b$)
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Legacy scrypt hash generator (kept for migration & test backward-compatibility).
 * @param {string} password Plaintext password
 * @returns {string} Formatted hash string `scrypt:<salt>:<derivedKey>`
 */
export function hashPasswordScrypt(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

/**
 * Verifies a candidate password against an existing stored hash.
 * Supports both modern bcrypt ($2a$ / $2b$) and legacy scrypt (scrypt:<salt>:<derivedKey>).
 * Uses constant-time comparisons to prevent timing side-channel attacks.
 * @param {string} candidatePassword Plaintext password candidate
 * @param {string} storedHash Stored formatted hash
 * @returns {boolean} True if password matches, false otherwise
 */
export function verifyPassword(candidatePassword, storedHash) {
  if (!candidatePassword || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  // 1. Modern bcrypt check
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    try {
      return bcrypt.compareSync(candidatePassword, storedHash);
    } catch {
      return false;
    }
  }

  // 2. Legacy scrypt check
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) {
      return false;
    }

    const [, salt, expectedHashHex] = parts;
    try {
      const candidateBuffer = crypto.scryptSync(candidatePassword, salt, 64);
      const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

      if (candidateBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Checks whether an existing password hash needs to be upgraded to modern bcrypt.
 * @param {string} storedHash
 * @returns {boolean}
 */
export function needsRehash(storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  // Upgrade if legacy scrypt
  if (storedHash.startsWith('scrypt:')) return true;
  // If bcrypt, check if rounds match BCRYPT_SALT_ROUNDS
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    const rounds = parseInt(storedHash.split('$')[2], 10);
    return rounds < BCRYPT_SALT_ROUNDS;
  }
  return true;
}

/**
 * Generates a cryptographically secure random token (e.g. for invitations, password resets, email verification).
 * @param {number} bytes Number of random bytes (default 32 -> 64 hex characters)
 * @returns {string} Hex string token
 */
export function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hashes a token using SHA-256 for secure database storage.
 * @param {string} rawToken Raw token string
 * @returns {string} SHA-256 hex digest
 */
export function hashToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a cryptographically secure 6-digit OTP string.
 * @param {number} digits Number of digits (default 6)
 * @returns {string} 6-digit string
 */
export function generateOtp(digits = 6) {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits);
  const num = crypto.randomInt(min, max);
  return num.toString();
}

/**
 * Hashes an OTP with SHA-256 for storage in database.
 * @param {string} otp Raw OTP string
 * @returns {string} SHA-256 hex digest
 */
export function hashOtp(otp) {
  if (!otp || (typeof otp !== 'string' && typeof otp !== 'number')) {
    throw new Error('OTP must be provided');
  }
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
}

/**
 * Constant-time comparison for OTP verification.
 * @param {string} candidateOtp
 * @param {string} storedOtpHash
 * @returns {boolean}
 */
export function verifyOtp(candidateOtp, storedOtpHash) {
  if (!candidateOtp || !storedOtpHash || typeof storedOtpHash !== 'string') {
    return false;
  }
  const candidateHash = hashOtp(candidateOtp);
  try {
    const b1 = Buffer.from(candidateHash, 'hex');
    const b2 = Buffer.from(storedOtpHash, 'hex');
    if (b1.length !== b2.length) return false;
    return crypto.timingSafeEqual(b1, b2);
  } catch {
    return false;
  }
}

export default {
  hashPassword,
  hashPasswordScrypt,
  verifyPassword,
  needsRehash,
  generateSecureToken,
  hashToken,
  generateOtp,
  hashOtp,
  verifyOtp
};
