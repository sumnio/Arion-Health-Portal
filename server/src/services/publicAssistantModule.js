import { PUBLIC_ASSISTANT_SAFETY_RESPONSES } from './publicAssistantKnowledgeBase.js';
import { createPublicAssistantPrivacyGateway } from './publicAssistantPrivacyGateway.js';

export function createPublicAssistantModule({ maxMessageLength = 800 } = {}) {
  const privacyGateway = createPublicAssistantPrivacyGateway();
  const assistantService = Object.freeze({
    async respond(message) {
      const classification = privacyGateway.classify(message);
      const reply = classification.knowledge?.response
        ?? PUBLIC_ASSISTANT_SAFETY_RESPONSES[classification.responseKey]
        ?? PUBLIC_ASSISTANT_SAFETY_RESPONSES.unsupported;
      return Object.freeze({
        reply,
        intent: classification.intent,
        resultCategory: classification.topic,
      });
    },
  });
  return Object.freeze({ assistantService, maxMessageLength });
}
