const UNISMS_SEND_ENDPOINT = 'https://unismsapi.com/api/sms';

const ACCEPTED_PROVIDER_STATUSES = new Set(['pending', 'retrying', 'sent']);

function elapsed(startedAt) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function failure(category, status = null, latencyMs = 0) {
  return {
    provider: 'unisms',
    provider_reference_id: null,
    outcome: 'failed',
    provider_status: status,
    latency_ms: latencyMs,
    safe_error_category: category,
  };
}

function failureCategory(status) {
  if (status === 401 || status === 403) return 'authentication_error';
  if (status === 429) return 'rate_limited';
  if (status === 400 || status === 422) return 'invalid_recipient';
  return 'provider_error';
}

export function createUniSmsProvider({ apiKey = '', senderId = '', timeoutMs = 5_000, fetchImpl = fetch } = {}) {
  return Object.freeze({
    name: 'unisms',
    async send({ recipient, content }) {
      const startedAt = performance.now();
      if (!apiKey || !senderId) return failure('configuration_error', null, elapsed(startedAt));
      try {
        const response = await fetchImpl(UNISMS_SEND_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ recipient, content, sender_id: senderId }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status !== 201) {
          const providerStatus = response.status == null ? null : String(response.status);
          return failure(failureCategory(response.status), providerStatus, elapsed(startedAt));
        }
        const body = await response.json().catch(() => ({}));
        const message = body?.message;
        const referenceId = typeof message?.reference_id === 'string' && message.reference_id.trim()
          ? message.reference_id.trim()
          : null;
        const providerStatus = typeof message?.status === 'string'
          ? message.status.trim().toLowerCase()
          : null;
        if (!referenceId || !ACCEPTED_PROVIDER_STATUSES.has(providerStatus)) {
          return failure('provider_error', providerStatus, elapsed(startedAt));
        }
        return {
          provider: 'unisms',
          provider_reference_id: referenceId,
          outcome: 'sent',
          provider_status: providerStatus,
          latency_ms: elapsed(startedAt),
          safe_error_category: null,
        };
      } catch (error) {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          return failure('timeout', null, elapsed(startedAt));
        }
        return failure('unknown_error', null, elapsed(startedAt));
      }
    },
  });
}

export { UNISMS_SEND_ENDPOINT };
