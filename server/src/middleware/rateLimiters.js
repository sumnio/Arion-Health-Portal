import { rateLimit } from 'express-rate-limit';
import { requestSecurityEvent } from '../services/securityLogger.js';

export const RATE_LIMIT_DEFAULTS = Object.freeze({
  loginWindowMs: 15 * 60 * 1000,
  loginMax: 10,
  registerWindowMs: 60 * 60 * 1000,
  registerMax: 5,
  adminProvisionWindowMs: 15 * 60 * 1000,
  adminProvisionMax: 20,
  mfaVerifyWindowMs: 10 * 60 * 1000,
  mfaVerifyMax: 5,
  verificationAttemptWindowMs: 10 * 60 * 1000,
  verificationAttemptMax: 10,
  verificationResendWindowMs: 60 * 60 * 1000,
  verificationResendMax: 3,
  forgotPasswordWindowMs: 60 * 60 * 1000,
  forgotPasswordMax: 5,
  passwordResetWindowMs: 15 * 60 * 1000,
  passwordResetMax: 5,
});

const rateLimitedResponse = Object.freeze({
  error: Object.freeze({
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
  }),
});

function limiter({ windowMs, max, limiterType, skipSuccessfulRequests = false, event = 'RATE_LIMIT_TRIGGERED', store }) {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler(request, response) {
      requestSecurityEvent(request, {
        event, severity: 'warning', outcome: 'denied',
        metadata: { limiter_type: limiterType },
      });
      response.status(429).json(rateLimitedResponse);
    },
  });
}

export function createRateLimiters({
  loginWindowMs = RATE_LIMIT_DEFAULTS.loginWindowMs,
  loginMax = RATE_LIMIT_DEFAULTS.loginMax,
  registerWindowMs = RATE_LIMIT_DEFAULTS.registerWindowMs,
  registerMax = RATE_LIMIT_DEFAULTS.registerMax,
  adminProvisionWindowMs = RATE_LIMIT_DEFAULTS.adminProvisionWindowMs,
  adminProvisionMax = RATE_LIMIT_DEFAULTS.adminProvisionMax,
  mfaVerifyWindowMs = RATE_LIMIT_DEFAULTS.mfaVerifyWindowMs,
  mfaVerifyMax = RATE_LIMIT_DEFAULTS.mfaVerifyMax,
  verificationAttemptWindowMs = RATE_LIMIT_DEFAULTS.verificationAttemptWindowMs,
  verificationAttemptMax = RATE_LIMIT_DEFAULTS.verificationAttemptMax,
  verificationResendWindowMs = RATE_LIMIT_DEFAULTS.verificationResendWindowMs,
  verificationResendMax = RATE_LIMIT_DEFAULTS.verificationResendMax,
  forgotPasswordWindowMs = RATE_LIMIT_DEFAULTS.forgotPasswordWindowMs,
  forgotPasswordMax = RATE_LIMIT_DEFAULTS.forgotPasswordMax,
  passwordResetWindowMs = RATE_LIMIT_DEFAULTS.passwordResetWindowMs,
  passwordResetMax = RATE_LIMIT_DEFAULTS.passwordResetMax,
  storeFactory = () => undefined,
} = {}) {
  return {
    loginRateLimiter: limiter({
      windowMs: loginWindowMs,
      max: loginMax,
      limiterType: 'login',
      skipSuccessfulRequests: true,
      store: storeFactory('login'),
    }),
    registerRateLimiter: limiter({
      windowMs: registerWindowMs,
      max: registerMax,
      limiterType: 'registration',
      store: storeFactory('registration'),
    }),
    adminProvisionRateLimiter: limiter({
      windowMs: adminProvisionWindowMs,
      max: adminProvisionMax,
      limiterType: 'admin_provision',
      store: storeFactory('admin_provision'),
    }),
    mfaVerifyRateLimiter: limiter({
      windowMs: mfaVerifyWindowMs,
      max: mfaVerifyMax,
      limiterType: 'mfa_verification',
      skipSuccessfulRequests: true,
      event: 'MFA_RATE_LIMITED',
      store: storeFactory('mfa_verification'),
    }),
    verificationAttemptRateLimiter: limiter({
      windowMs: verificationAttemptWindowMs,
      max: verificationAttemptMax,
      limiterType: 'email_verification_attempt',
      skipSuccessfulRequests: true,
      store: storeFactory('email_verification_attempt'),
    }),
    verificationResendRateLimiter: limiter({
      windowMs: verificationResendWindowMs,
      max: verificationResendMax,
      limiterType: 'email_verification_resend',
      store: storeFactory('email_verification_resend'),
    }),
    forgotPasswordRateLimiter: limiter({
      windowMs: forgotPasswordWindowMs,
      max: forgotPasswordMax,
      limiterType: 'forgot_password',
      store: storeFactory('forgot_password'),
    }),
    passwordResetRateLimiter: limiter({
      windowMs: passwordResetWindowMs,
      max: passwordResetMax,
      limiterType: 'password_reset',
      skipSuccessfulRequests: true,
      store: storeFactory('password_reset'),
    }),
  };
}
