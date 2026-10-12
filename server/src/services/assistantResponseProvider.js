import { ASSISTANT_INTENTS } from './assistantIntents.js';
import { ASSISTANT_SAFETY_RESPONSES, getAssistantKnowledgeEntry } from './assistantKnowledgeBase.js';

export function createAssistantResponseProvider() {
  return Object.freeze({
    reply(_message, classification) {
      if (classification.intent === ASSISTANT_INTENTS.HEALTH_OR_CLINICAL) {
        return classification.emergency ? ASSISTANT_SAFETY_RESPONSES.emergency : ASSISTANT_SAFETY_RESPONSES.clinical;
      }
      if (classification.topic === 'unsafe_request') return ASSISTANT_SAFETY_RESPONSES.unsafe;
      if (classification.intent === ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR) return ASSISTANT_SAFETY_RESPONSES.unclear;
      if (classification.intent === ASSISTANT_INTENTS.UNSUPPORTED) return ASSISTANT_SAFETY_RESPONSES.unsupported;
      if (classification.topic === 'personalized_lookup') return ASSISTANT_SAFETY_RESPONSES.personalizedAppointment;
      if (classification.topic === 'personalized_notifications') return ASSISTANT_SAFETY_RESPONSES.personalizedNotification;
      return getAssistantKnowledgeEntry(classification.topic)?.response ?? ASSISTANT_SAFETY_RESPONSES.unclear;
    },
  });
}

