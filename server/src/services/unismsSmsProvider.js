const UNISMS_SEND_ENDPOINT = 'https://unismsapi.com/api/sms';

function failure(category, status = null) {
  return {
    provider: 'unisms',
    provider_reference_id: null,
    outcome: 'failed',
    provider_status: status,
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
      if (!apiKey || !senderId) return failure('configuration_error');
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
        if (!response.ok) return failure(failureCategory(response.status), String(response.status));
        const body = await response.json().catch(() => ({}));
        return {
          provider: 'unisms',
          provider_reference_id: body.reference_id ?? body.id ?? null,
          outcome: 'sent',
          provider_status: body.status ?? 'accepted',
          safe_error_category: null,
        };
      } catch (error) {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return failure('timeout');
        return failure('unknown_error');
      }
    },
  });
}

export { UNISMS_SEND_ENDPOINT };
