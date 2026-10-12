const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_REPLY_CHARACTERS = 2_000;

function providerFailure(category) {
  return Object.freeze({ ok: false, category });
}

function outputText(payload) {
  if (!Array.isArray(payload?.output)) return '';
  return payload.output
    .filter((item) => item?.type === 'message' && Array.isArray(item.content))
    .flatMap((item) => item.content)
    .filter((item) => item?.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

function usage(payload) {
  const inputTokens = Number(payload?.usage?.input_tokens);
  const outputTokens = Number(payload?.usage?.output_tokens);
  return Object.freeze({
    inputTokens: Number.isSafeInteger(inputTokens) && inputTokens >= 0 ? inputTokens : null,
    outputTokens: Number.isSafeInteger(outputTokens) && outputTokens >= 0 ? outputTokens : null,
  });
}

export function createOpenAiResponsesProvider({
  apiKey,
  model,
  timeoutMs,
  maxOutputTokens,
  fetchImpl = globalThis.fetch,
  endpoint = OPENAI_RESPONSES_URL,
}) {
  return Object.freeze({
    name: 'openai',
    async generate({ instructions, prompt }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            instructions,
            input: prompt,
            reasoning: { effort: 'minimal' },
            max_output_tokens: maxOutputTokens,
            store: false,
            tools: [],
          }),
          signal: controller.signal,
        });
        if (response.status === 429) return providerFailure('rate_limited');
        if (!response.ok) return providerFailure(response.status >= 500 ? 'upstream_error' : 'provider_error');
        let payload;
        try {
          payload = await response.json();
        } catch {
          return providerFailure('invalid_response');
        }
        if (payload?.status !== 'completed') return providerFailure('invalid_response');
        const text = outputText(payload);
        if (!text || text.length > MAX_REPLY_CHARACTERS) return providerFailure('invalid_response');
        return Object.freeze({ ok: true, category: 'success', text, usage: usage(payload) });
      } catch (error) {
        return providerFailure(error?.name === 'AbortError' ? 'timeout' : 'provider_error');
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}
