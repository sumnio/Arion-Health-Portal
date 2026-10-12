import { ASSISTANT_AI_DEFAULTS } from '../config/assistantAiConfig.js';
import { createAssistantPrivacyGateway } from './assistantPrivacyGateway.js';
import { createAssistantResponseProvider } from './assistantResponseProvider.js';
import { createAssistantService } from './assistantService.js';
import { createAssistantPatientToolService } from './assistantPatientToolService.js';
import { createAssistantAiProvider } from './assistantAiProvider.js';

export function createAssistantModule({
  maxMessageLength = 800,
  appointmentService,
  notificationService,
  clinicTimeZone = 'Asia/Manila',
  now,
  aiExternalEnabled = ASSISTANT_AI_DEFAULTS.enabled,
  aiProvider = ASSISTANT_AI_DEFAULTS.provider,
  openAiApiKey = '',
  openAiModel = ASSISTANT_AI_DEFAULTS.model,
  aiProviderTimeoutMs = ASSISTANT_AI_DEFAULTS.timeoutMs,
  aiMaxOutputTokens = ASSISTANT_AI_DEFAULTS.maxOutputTokens,
  assistantAiProvider,
  aiFetch,
} = {}) {
  const privacyGateway = createAssistantPrivacyGateway();
  const responseProvider = createAssistantResponseProvider();
  const patientTools = appointmentService && notificationService
    ? createAssistantPatientToolService({ appointmentService, notificationService, clinicTimeZone, now })
    : null;
  const externalProvider = assistantAiProvider ?? createAssistantAiProvider({
    enabled: aiExternalEnabled,
    provider: aiProvider,
    apiKey: openAiApiKey,
    model: openAiModel,
    timeoutMs: aiProviderTimeoutMs,
    maxOutputTokens: aiMaxOutputTokens,
    fetchImpl: aiFetch,
  });
  return Object.freeze({
    assistantService: createAssistantService({
      privacyGateway,
      responseProvider,
      patientTools,
      aiProvider: externalProvider,
    }),
    maxMessageLength,
  });
}

