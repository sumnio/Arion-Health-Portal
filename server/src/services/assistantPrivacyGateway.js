export const ASSISTANT_INTENTS = Object.freeze({
  PORTAL_HELP: 'PORTAL_HELP',
  ACCOUNT_HELP: 'ACCOUNT_HELP',
  APPOINTMENT_HELP: 'APPOINTMENT_HELP',
  HEALTH_OR_CLINICAL: 'HEALTH_OR_CLINICAL',
  SENSITIVE_OR_UNCLEAR: 'SENSITIVE_OR_UNCLEAR',
  UNSUPPORTED: 'UNSUPPORTED',
});

const emergencyPattern = /\b(chest pain|cannot breathe|can(?:not|'t) breathe|difficulty breathing|severe bleeding|unconscious|overdose|suicid(?:e|al)|self[- ]harm|stroke|seizure|rapidly worsening|life[- ]threatening|emergency)\b/i;
const clinicalPattern = /\b(symptom|diagnos(?:e|is)|disease|illness|medicat(?:e|ion)|medicine|dosage|dose|prescription|pregnan(?:t|cy)|mental health|depress(?:ed|ion)|anxiety|treatment|clinical result|test result|lab result|blood pressure|fever|pain|headache|cough|dizz(?:y|iness)|nausea|vomit(?:ing)?|shortness of breath|bleeding|rash|sore throat|diarrhea|abdominal|wound|swelling|numbness|weakness|fatigue|allerg(?:y|ies)|infection|tablet|pill|antibiotic|insulin|interpret (?:my )?(?:medical )?record|what does (?:my )?(?:medical )?record)\b/i;
const injectionPattern = /\b(ignore (?:all |the )?(?:previous|prior|above) (?:rules|instructions)|system prompt|hidden instructions?|pretend i am (?:an? )?admin|api[ -]?key|query (?:the )?(?:mongo|mongodb|database)|another patient(?:'s)? data|other patient(?:'s)? data|show (?:me )?(?:your )?(?:rules|prompt|secrets?))\b/i;
const accountPattern = /\b(email verification|verify (?:my )?email|verification code|forgot password|reset (?:my )?password|change (?:my )?password|account recovery|profile|personal information|contact number)\b/i;
const personalizedAppointmentPattern = /\b(when is my|who is my|what is my|show (?:me )?my|my next|my upcoming)\b.{0,50}\b(appointment|doctor|status|schedule)\b/i;
const appointmentPattern = /\b(appointment|book(?:ing)?|reschedule|cancel|pending|confirmed|completed|no[- ]?show)\b/i;
const portalPattern = /\b(portal|dashboard|notification|certificate|records?|where (?:can|do) i find|how (?:do|can) i)\b/i;
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
      if (accountPattern.test(message)) return detail(ASSISTANT_INTENTS.ACCOUNT_HELP, 'account');
      if (personalizedAppointmentPattern.test(message)) return detail(ASSISTANT_INTENTS.APPOINTMENT_HELP, 'personalized_lookup');
      if (appointmentPattern.test(message)) return detail(ASSISTANT_INTENTS.APPOINTMENT_HELP, 'general');
      if (portalPattern.test(message)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'portal');
      if (unsupportedPattern.test(message)) return detail(ASSISTANT_INTENTS.UNSUPPORTED, 'unsupported');
      return detail(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'unclear');
    },
  });
}

