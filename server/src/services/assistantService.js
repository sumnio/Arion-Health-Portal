import { ASSISTANT_INTENTS } from './assistantIntents.js';
import { ASSISTANT_GPT_SYSTEM_INSTRUCTIONS, getAssistantGptTask } from './assistantGptTasks.js';

const LIVE_DATA_INTENTS = new Set([
  ASSISTANT_INTENTS.NEXT_APPOINTMENT,
  ASSISTANT_INTENTS.UPCOMING_APPOINTMENTS,
  ASSISTANT_INTENTS.APPOINTMENT_STATUS,
  ASSISTANT_INTENTS.ASSIGNED_DOCTOR,
  ASSISTANT_INTENTS.RECENT_NOTIFICATIONS,
  ASSISTANT_INTENTS.UNREAD_NOTIFICATION_COUNT,
]);

export function createAssistantService({ privacyGateway, responseProvider, patientTools = null, aiProvider = null }) {
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
      if (classification.intent === ASSISTANT_INTENTS.GPT_CONVERSATIONAL && aiProvider) {
        const task = getAssistantGptTask(classification.topic);
        if (task) {
          return Promise.resolve(aiProvider.generate({
            instructions: ASSISTANT_GPT_SYSTEM_INSTRUCTIONS,
            prompt: task.prompt,
            taskId: task.id,
          })).then((providerResult) => {
            if (providerResult?.ok && typeof providerResult.text === 'string') {
              return Object.freeze({
                reply: providerResult.text,
                intent: classification.intent,
                tool: 'openai_responses',
                resultCategory: 'gpt_answer',
                providerTelemetry: Object.freeze({
                  provider: aiProvider.name,
                  outcome: 'success',
                }),
              });
            }
            return Object.freeze({
              reply: responseProvider.reply(message, classification),
              intent: classification.intent,
              tool: 'external_ai',
              resultCategory: 'gpt_fallback',
              providerTelemetry: Object.freeze({
                provider: aiProvider.name,
                outcome: providerResult?.category ?? 'provider_error',
              }),
            });
          }).catch(() => Object.freeze({
            reply: responseProvider.reply(message, classification),
            intent: classification.intent,
            tool: 'external_ai',
            resultCategory: 'gpt_fallback',
            providerTelemetry: Object.freeze({ provider: aiProvider.name, outcome: 'provider_error' }),
          }));
        }
      }
      return Object.freeze({
        reply: responseProvider.reply(message, classification),
        intent: classification.intent,
        tool: null,
        resultCategory: 'static',
        providerTelemetry: null,
      });
    },
  });
}

