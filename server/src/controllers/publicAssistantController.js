import { requestSecurityEvent } from '../services/securityLogger.js';
import { validateAssistantMessage } from '../validation/assistantValidation.js';

export function createPublicAssistantController({ assistantService, maxMessageLength }) {
  return Object.freeze({
    async message(request, response, next) {
      const startedAt = Date.now();
      try {
        const { message, contextTopic } = validateAssistantMessage(request.body, maxMessageLength);
        const result = await assistantService.respond(message, { contextTopic });
        requestSecurityEvent(request, {
          event: 'PUBLIC_ASSISTANT_MESSAGE_HANDLED',
          severity: 'info',
          outcome: 'success',
          metadata: {
            intent_category: result.intent,
            result_category: result.resultCategory,
            ...(result.providerTelemetry ? {
              provider_name: result.providerTelemetry.provider,
              provider_outcome: result.providerTelemetry.outcome,
            } : {}),
            latency_ms: Date.now() - startedAt,
          },
        }, { includeActor: false, includeIp: false });
        response.json({
          reply: result.reply,
          ...(result.contextTopic ? { context_topic: result.contextTopic } : {}),
        });
      } catch (error) {
        requestSecurityEvent(request, {
          event: 'PUBLIC_ASSISTANT_MESSAGE_FAILED',
          severity: 'warning',
          outcome: 'failure',
          metadata: { result_category: 'failed', latency_ms: Date.now() - startedAt },
        }, { includeActor: false, includeIp: false });
        next(error);
      }
    },
  });
}
