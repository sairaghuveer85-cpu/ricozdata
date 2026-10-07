import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

/**
 * Standardized rate limit error response generator.
 */
function createRateLimitHandler(customMessage = 'Too many requests from this IP. Please try again later.') {
  return (req, res, next, options) => {
    res.status(options.statusCode || 429).json({
      success: false,
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: customMessage,
        details: { retryAfter: res.getHeader('Retry-After') || null }
      },
      meta: {},
      message: customMessage
    });
  };
}

/**
 * General platform API rate limiter.
 * Guards general endpoints from denial of service and scraping.
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isTest ? 50000 : 1000, // Generous in test mode to avoid test throttling
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: createRateLimitHandler('API rate limit exceeded. Please throttle your requests.')
});

/**
 * Sensitive Authentication Limiter.
 * Strictly limits brute-force attempts on login, registration, and refresh.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isTest ? 10000 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many authentication attempts. Please try again after 15 minutes.')
});

/**
 * Password Reset Limiter.
 * Prevents reset token flooding and email spamming.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isTest ? 5000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many password reset requests. Please try again after 15 minutes.')
});

/**
 * OTP & Verification Limiter.
 * Prevents 6-digit OTP code brute-forcing.
 */
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.isTest ? 5000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many verification attempts. Please try again after 15 minutes.')
});

/**
 * Factory helper for testing rate limits or mounting specific endpoint limits.
 */
export function createCustomLimiter({ windowMs = 60 * 1000, max = 5, message = 'Rate limit exceeded' } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimitHandler(message)
  });
}

export default {
  generalApiLimiter,
  authLimiter,
  passwordResetLimiter,
  verificationLimiter,
  createCustomLimiter
};
