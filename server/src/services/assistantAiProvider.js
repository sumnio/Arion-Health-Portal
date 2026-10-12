import { ASSISTANT_AI_DEFAULTS } from '../config/assistantAiConfig.js';
import { createOpenAiResponsesProvider } from './openAiResponsesProvider.js';

function unavailableProvider(category) {
  return Object.freeze({
    name: 'none',
    async generate() {
      return Object.freeze({ ok: false, category });
    },
  });
}

export function createAssistantAiProvider({
  enabled = ASSISTANT_AI_DEFAULTS.enabled,
  provider = ASSISTANT_AI_DEFAULTS.provider,
  apiKey = '',
  model = ASSISTANT_AI_DEFAULTS.model,
  timeoutMs = ASSISTANT_AI_DEFAULTS.timeoutMs,
  maxOutputTokens = ASSISTANT_AI_DEFAULTS.maxOutputTokens,
  fetchImpl,
} = {}) {
  if (!enabled) return unavailableProvider('disabled');
  if (provider !== 'openai') return unavailableProvider('unsupported_provider');
  if (!apiKey || !model) return unavailableProvider('misconfigured');
  return createOpenAiResponsesProvider({ apiKey, model, timeoutMs, maxOutputTokens, fetchImpl });
}
