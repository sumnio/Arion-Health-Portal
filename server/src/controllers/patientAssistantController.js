import { requestSecurityEvent } from '../services/securityLogger.js';
import { validateAssistantMessage } from '../validation/assistantValidation.js';

export function createPatientAssistantController({ assistantService, maxMessageLength }) {
  return Object.freeze({
    async message(request, response, next) {
      const startedAt = Date.now();
      try {
        const message = validateAssistantMessage(request.body, maxMessageLength);
        const result = await assistantService.respond(message, {
          userProfileId: request.authUser.user_profile_id,
        });
        requestSecurityEvent(request, {
          event: 'ASSISTANT_MESSAGE_HANDLED',
          severity: 'info',
          outcome: 'success',
          metadata: {
            intent_category: result.intent,
            tool_name: result.tool ?? 'none',
            result_category: result.resultCategory,
            ...(result.providerTelemetry ? {
              provider_name: result.providerTelemetry.provider,
              provider_outcome: result.providerTelemetry.outcome,
            } : {}),
            latency_ms: Date.now() - startedAt,
          },
        }, { includeActor: false, includeIp: false });
        response.json({ reply: result.reply });
      } catch (error) {
        requestSecurityEvent(request, {
          event: 'ASSISTANT_MESSAGE_FAILED',
          severity: 'warning',
          outcome: 'failure',
          metadata: { result_category: 'failed', latency_ms: Date.now() - startedAt },
        }, { includeActor: false, includeIp: false });
        next(error);
      }
    },
  });
}

