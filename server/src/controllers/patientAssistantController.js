import { requestSecurityEvent } from '../services/securityLogger.js';
import { validateAssistantMessage } from '../validation/assistantValidation.js';

export function createPatientAssistantController({ assistantService, maxMessageLength }) {
  return Object.freeze({
    message(request, response, next) {
      try {
        const message = validateAssistantMessage(request.body, maxMessageLength);
        const result = assistantService.respond(message);
        requestSecurityEvent(request, {
          event: 'ASSISTANT_MESSAGE_HANDLED',
          severity: 'info',
          outcome: 'success',
          metadata: { intent_category: result.intent },
        });
        response.json({ reply: result.reply });
      } catch (error) {
        next(error);
      }
    },
  });
}

