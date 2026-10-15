import { toPhilippineE164 } from '../utils/smsPhone.js';

export function createSmsService({ enabled = false, provider }) {
  return Object.freeze({
    enabled: Boolean(enabled),
    providerName: provider?.name ?? null,
    async send({ phoneNumber, content }) {
      if (!enabled) {
        return {
          provider: provider?.name ?? null,
          provider_reference_id: null,
          outcome: 'disabled',
          provider_status: null,
          latency_ms: 0,
          safe_error_category: null,
        };
      }
      let recipient;
      try {
        recipient = toPhilippineE164(phoneNumber);
      } catch {
        return {
          provider: provider?.name ?? null,
          provider_reference_id: null,
          outcome: 'failed',
          provider_status: null,
          latency_ms: 0,
          safe_error_category: 'invalid_recipient',
        };
      }
      return provider.send({ recipient, content });
    },
  });
}
