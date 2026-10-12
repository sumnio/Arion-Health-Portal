import { ASSISTANT_INTENTS } from './assistantIntents.js';
import { findPublicAssistantKnowledge } from './publicAssistantKnowledgeBase.js';

const emergencyPattern = /\b(chest pain|cannot breathe|can(?:not|'t) breathe|difficulty breathing|severe bleeding|unconscious|overdose|suicid(?:e|al)|self[- ]harm|stroke|seizure|rapidly worsening|life[- ]threatening|emergency)\b/i;
const clinicalPattern = /\b(symptom|diagnos(?:e|is)|disease|illness|medicat(?:e|ion)|medicine|dosage|dose|prescri(?:be|ption)|pregnan(?:t|cy)|mental health|depress(?:ed|ion)|anxiety|treatment|clinical result|test result|lab result|blood pressure|fever|pain|headache|cough|dizz(?:y|iness)|nausea|vomit(?:ing)?|shortness of breath|bleeding|rash|sore throat|diarrhea|abdominal|wound|swelling|numbness|weakness|fatigue|allerg(?:y|ies)|infection|tablet|pill|antibiotic|insulin|interpret (?:my )?(?:medical )?record)\b/i;
const unsafePattern = /\b(ignore (?:all |the )?(?:previous|prior|above) (?:rules|instructions|checks?)|system prompt|hidden (?:instructions?|fields?)|pretend i am (?:an? )?(?:patient|admin|staff|doctor)|api[ -]?key|query (?:the )?(?:mongo|mongodb|database)|list all appointments|show all notifications|(?:show|access|give|reveal) (?:me )?(?:another|other|someone else['’]?s?) patient(?:'s)? (?:data|records?|information|appointments?|doctor|notifications?)|reveal (?:rules|prompt|secrets?))\b/i;
const personalNotificationPattern = /\b(?:my notifications?|notifications? do i have|any new notifications?|show my notifications?|unread notifications?)\b/i;
const personalRecordPattern = /\b(?:my medical records?|my records?|my certificates?|certificate issued to me)\b/i;
const personalAppointmentPattern = /\b(?:my next appointment|my appointment status|who is my doctor|who am i seeing|did my appointment|get my appointment|show my appointment|appointment (?:date|time) for me)\b/i;
const accountDataPattern = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b09\d{9}\b|\b(?:check|find|look up|access|confirm)\b.{0,30}\b(?:my )?(?:account|email|phone|registration)\b)/i;

function classification(intent, topic, responseKey = null) {
  return Object.freeze({ intent, topic, responseKey });
}

export function createPublicAssistantPrivacyGateway() {
  return Object.freeze({
    classify(message) {
      if (emergencyPattern.test(message)) return classification(ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, 'emergency', 'emergency');
      if (clinicalPattern.test(message)) return classification(ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, 'clinical', 'clinical');
      if (unsafePattern.test(message)) return classification(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'unsafe_request', 'unsafe');
      if (personalNotificationPattern.test(message)) return classification(ASSISTANT_INTENTS.RECENT_NOTIFICATIONS, 'personal_notification', 'personalNotification');
      if (personalAppointmentPattern.test(message)) return classification(ASSISTANT_INTENTS.APPOINTMENT_STATUS, 'personal_appointment', 'personalAppointment');
      if (personalRecordPattern.test(message)) return classification(ASSISTANT_INTENTS.PORTAL_HELP, 'personal_record', 'personalRecord');
      if (accountDataPattern.test(message)) return classification(ASSISTANT_INTENTS.ACCOUNT_HELP, 'personal_account', 'personalAccount');
      const knowledge = findPublicAssistantKnowledge(message);
      if (knowledge) return Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge });
      return classification(ASSISTANT_INTENTS.UNSUPPORTED, 'unsupported', 'unsupported');
    },
  });
}
