import { ASSISTANT_INTENTS } from './assistantIntents.js';

const LIVE_DATA_INTENTS = new Set([
  ASSISTANT_INTENTS.NEXT_APPOINTMENT,
  ASSISTANT_INTENTS.UPCOMING_APPOINTMENTS,
  ASSISTANT_INTENTS.APPOINTMENT_STATUS,
  ASSISTANT_INTENTS.ASSIGNED_DOCTOR,
  ASSISTANT_INTENTS.RECENT_NOTIFICATIONS,
  ASSISTANT_INTENTS.UNREAD_NOTIFICATION_COUNT,
]);

export function createAssistantService({ privacyGateway, responseProvider, patientTools = null }) {
  return Object.freeze({
    respond(message, authContext = null) {
      const classification = privacyGateway.classify(message);
      if (patientTools && LIVE_DATA_INTENTS.has(classification.intent)) {
        return patientTools.execute(classification.intent, {
          userProfileId: authContext?.userProfileId,
          message,
        }).then((toolResult) => Object.freeze({
          reply: toolResult.reply,
          intent: classification.intent,
          tool: toolResult.tool,
          resultCategory: toolResult.resultCategory,
        }));
      }
      return Object.freeze({
        reply: responseProvider.reply(message, classification),
        intent: classification.intent,
        tool: null,
        resultCategory: 'static',
      });
    },
  });
}

