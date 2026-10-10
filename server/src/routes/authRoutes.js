import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser } from '../middleware/authorization.js';
import {
  validateLoginRequest,
  validateForgotPasswordRequest,
  validateMfaCodeRequest,
  validatePasswordResetRequest,
  validatePasswordResetSessionRequest,
  validateEmailVerificationCodeRequest,
  validateRegistrationRequest,
} from '../middleware/validateAuthRequest.js';

export function createAuthRouter({ service, tokens, mfaService, nodeEnv, rateLimiters }) {
  const router = Router();
  const controller = createAuthController({ service, mfaService, nodeEnv });
  const requireAuth = createRequireAuth({ tokens, service });

  router.post('/register', rateLimiters.registerRateLimiter, validateRegistrationRequest, controller.register);
  router.post('/login', rateLimiters.loginRateLimiter, validateLoginRequest, controller.login);
  router.post(
    '/forgot-password',
    rateLimiters.forgotPasswordRateLimiter,
    validateForgotPasswordRequest,
    controller.forgotPassword,
  );
  router.post(
    '/password-reset/session',
    rateLimiters.passwordResetRateLimiter,
    validatePasswordResetSessionRequest,
    controller.createPasswordResetSession,
  );
  router.get('/password-reset/status', controller.passwordResetStatus);
  router.post(
    '/reset-password',
    rateLimiters.passwordResetRateLimiter,
    validatePasswordResetRequest,
    controller.resetPassword,
  );
  router.get('/verification-status', controller.emailVerificationStatus);
  router.post(
    '/verify-email',
    rateLimiters.verificationAttemptRateLimiter,
    validateEmailVerificationCodeRequest,
    controller.verifyEmail,
  );
  router.post(
    '/resend-verification',
    rateLimiters.verificationResendRateLimiter,
    controller.resendEmailVerification,
  );
  router.post('/mfa/setup', controller.setupMfa);
  router.post('/mfa/verify-setup', validateMfaCodeRequest, rateLimiters.mfaVerifyRateLimiter, controller.verifyMfaSetup);
  router.post('/mfa/verify', validateMfaCodeRequest, rateLimiters.mfaVerifyRateLimiter, controller.verifyMfa);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, requireActiveUser, controller.me);

  return router;
}
