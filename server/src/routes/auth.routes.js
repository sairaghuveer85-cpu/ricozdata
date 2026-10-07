import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  authLimiter,
  passwordResetLimiter,
  verificationLimiter
} from '../middleware/rateLimiter.js';

import { validateRequest } from '../middleware/validate.js';
import { loginSchema } from '../schemas/auth.schema.js';

const router = Router();

// Registration & Login (Tiered Auth Limiter)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);

// Session & Token Lifecycle
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', requireAuth, authController.logoutAll);
router.get('/me', requireAuth, authController.me);

// Password Reset Flow (Tiered Password Reset Limiter)
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

// Email Verification Flow (Tiered Verification Limiter)
router.post('/verify-email', verificationLimiter, authController.verifyEmail);
router.post('/resend-verification', verificationLimiter, authController.resendVerification);

// Google OAuth 2.0 Flow
router.get('/google', authLimiter, authController.initiateGoogleAuth);
router.get('/google/callback', authController.googleCallback);

// Pluggable Providers & SAML Status
router.get('/providers', authController.listProviders);

export default router;
