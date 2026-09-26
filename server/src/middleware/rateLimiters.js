import { rateLimit } from 'express-rate-limit';

export const RATE_LIMIT_DEFAULTS = Object.freeze({
  loginWindowMs: 15 * 60 * 1000,
  loginMax: 10,
  registerWindowMs: 60 * 60 * 1000,
  registerMax: 5,
  adminProvisionWindowMs: 15 * 60 * 1000,
  adminProvisionMax: 20,
});

const rateLimitedResponse = Object.freeze({
  error: Object.freeze({
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
  }),
});

function limiter({ windowMs, max, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(_request, response) {
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
} = {}) {
  return {
    loginRateLimiter: limiter({
      windowMs: loginWindowMs,
      max: loginMax,
      skipSuccessfulRequests: true,
    }),
    registerRateLimiter: limiter({ windowMs: registerWindowMs, max: registerMax }),
    adminProvisionRateLimiter: limiter({
      windowMs: adminProvisionWindowMs,
      max: adminProvisionMax,
    }),
  };
}
