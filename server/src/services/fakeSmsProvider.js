export function createFakeSmsProvider({ capture } = {}) {
  const deliveries = capture ?? [];
  return Object.freeze({
    name: 'fake',
    deliveries,
    async send(message) {
      deliveries.push(structuredClone(message));
      return {
        provider: 'fake',
        provider_reference_id: `fake-sms-${deliveries.length}`,
        outcome: 'sent',
        provider_status: 'sent',
        latency_ms: 0,
        safe_error_category: null,
      };
    },
  });
}
