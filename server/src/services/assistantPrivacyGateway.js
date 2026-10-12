import { findAssistantKnowledge } from './assistantKnowledgeBase.js';
import { ASSISTANT_INTENTS } from './assistantIntents.js';

export { ASSISTANT_INTENTS } from './assistantIntents.js';

const emergencyPattern = /\b(chest pain|cannot breathe|can(?:not|'t) breathe|difficulty breathing|severe bleeding|unconscious|overdose|suicid(?:e|al)|self[- ]harm|stroke|seizure|rapidly worsening|life[- ]threatening|emergency)\b/i;
const clinicalPattern = /\b(symptom|diagnos(?:e|is)|disease|illness|medicat(?:e|ion)|medicine|dosage|dose|prescri(?:be|ption)|pregnan(?:t|cy)|mental health|depress(?:ed|ion)|anxiety|treatment|clinical result|test result|lab result|blood pressure|fever|pain|headache|cough|dizz(?:y|iness)|nausea|vomit(?:ing)?|shortness of breath|bleeding|rash|sore throat|diarrhea|abdominal|wound|swelling|numbness|weakness|fatigue|allerg(?:y|ies)|infection|tablet|pill|antibiotic|insulin|interpret (?:my )?(?:medical )?record|what does (?:my )?(?:medical )?record)\b/i;
const injectionPattern = /\b(ignore (?:all |the )?(?:previous|prior|above) (?:rules|instructions)|system prompt|hidden instructions?|pretend i am (?:an? )?admin|api[ -]?key|query (?:the )?(?:mongo|mongodb|database)|(?:show|access|give|reveal) (?:me )?(?:another|other) patient(?:'s)? (?:data|records?|information)|show (?:me )?(?:your )?(?:rules|prompt|secrets?))\b/i;
const personalizedAppointmentPattern = /(?:\b(?:when|where|what time) (?:is|are) my\b.{0,50}\b(?:appointment|schedule)\b|\bwho is my doctor\b|\bwhat is my appointment status\b|\bdid my appointment (?:get )?(?:confirmed|cancelled|rescheduled)\b|\bmy next appointment\b)/i;
const personalizedNotificationPattern = /\b(?:what|which|show|do)\b.{0,40}\bmy notifications?\b|\bnotifications? do i have\b/i;
const unsupportedPattern = /\b(weather|sports?|movie|music|recipe|stock price|cryptocurrency|homework|write (?:a )?(?:poem|essay))\b/i;

function detail(intent, topic = null, emergency = false) {
  return Object.freeze({ intent, topic, emergency });
}

export function createAssistantPrivacyGateway() {
  return Object.freeze({
    classify(message) {
      if (emergencyPattern.test(message)) return detail(ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, 'emergency', true);
      if (clinicalPattern.test(message)) return detail(ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, 'clinical');
      if (injectionPattern.test(message)) return detail(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'unsafe_request');
      if (personalizedAppointmentPattern.test(message)) return detail(ASSISTANT_INTENTS.APPOINTMENT_HELP, 'personalized_lookup');
      if (personalizedNotificationPattern.test(message)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'personalized_notifications');
      const knowledge = findAssistantKnowledge(message);
      if (knowledge) return detail(knowledge.category, knowledge.id);
      if (unsupportedPattern.test(message)) return detail(ASSISTANT_INTENTS.UNSUPPORTED, 'unsupported');
      return detail(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'unclear');
    },
  });
}

