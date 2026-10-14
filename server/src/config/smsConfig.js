export const SMS_DEFAULTS = Object.freeze({
  enabled: false,
  provider: 'unisms',
  providerTimeoutMs: 5_000,
  schedulerRateLimitWindowMs: 60 * 60 * 1000,
  schedulerRateLimitMax: 30,
  staleProcessingMs: 10 * 60 * 1000,
});

export const SMS_PROVIDERS = Object.freeze(['fake', 'unisms']);
