import { findAssistantKnowledge } from './assistantKnowledgeBase.js';
import { ASSISTANT_INTENTS } from './assistantIntents.js';

export { ASSISTANT_INTENTS } from './assistantIntents.js';

const emergencyPattern = /\b(chest pain|cannot breathe|can(?:not|'t) breathe|difficulty breathing|severe bleeding|unconscious|overdose|suicid(?:e|al)|self[- ]harm|stroke|seizure|rapidly worsening|life[- ]threatening|emergency)\b/i;
const clinicalPattern = /\b(symptom|diagnos(?:e|is)|disease|illness|medicat(?:e|ion)|medicine|dosage|dose|prescri(?:be|ption)|pregnan(?:t|cy)|mental health|depress(?:ed|ion)|anxiety|treatment|clinical result|test result|lab result|blood pressure|fever|pain|headache|cough|dizz(?:y|iness)|nausea|vomit(?:ing)?|shortness of breath|bleeding|rash|sore throat|diarrhea|abdominal|wound|swelling|numbness|weakness|fatigue|allerg(?:y|ies)|infection|tablet|pill|antibiotic|insulin|interpret (?:my )?(?:medical )?record|what does (?:my )?(?:medical )?record)\b/i;
const injectionPattern = /\b(ignore (?:all |the )?(?:previous|prior|above|ownership) (?:rules|instructions|checks?)|ignore ownership checks?|system prompt|hidden (?:instructions?|fields?)|pretend i am (?:an? )?(?:admin|staff|doctor)|api[ -]?key|query (?:the )?(?:mongo|mongodb|database)|list all appointments|show all notifications|(?:show|access|give|reveal) (?:me )?(?:another|other|patient\s+\d+) patient(?:'s)? (?:data|records?|information|appointments?|doctor|notifications?)|patient\s+\d+['’]?s? (?:appointments?|doctor|notifications?)|show (?:me )?(?:your )?(?:rules|prompt|secrets?))\b/i;
const unreadNotificationPattern = /\b(?:how many|count|number of)\b.{0,30}\bunread notifications?\b|\bunread notification count\b/i;
const recentNotificationPattern = /\b(?:do i have (?:any )?notifications?|what (?:notifications? do i have|are my (?:recent )?notifications?)|any new notifications?|what did i get notified about|show my notifications?)\b/i;
const appointmentStatusPattern = /\b(?:what is my appointment status|did my appointment (?:get )?(?:confirmed|cancelled|rescheduled)|is my appointment still (?:pending|confirmed)|what happened to my appointment)\b/i;
const assignedDoctorPattern = /\b(?:who is my doctor|which doctor is assigned to my appointment|who am i seeing)\b/i;
const nextAppointmentPattern = /\b(?:when|where|what time) (?:is|are) my next appointment\b|\bmy next appointment\b/i;
const upcomingAppointmentsPattern = /\b(?:do i have (?:any )?upcoming appointments?|what appointments do i have|show my upcoming appointments?|my upcoming appointments?)\b/i;
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
      if (unreadNotificationPattern.test(message)) return detail(ASSISTANT_INTENTS.UNREAD_NOTIFICATION_COUNT, 'unread_notification_count');
      if (recentNotificationPattern.test(message)) return detail(ASSISTANT_INTENTS.RECENT_NOTIFICATIONS, 'recent_notifications');
      if (appointmentStatusPattern.test(message)) return detail(ASSISTANT_INTENTS.APPOINTMENT_STATUS, 'appointment_status');
      if (assignedDoctorPattern.test(message)) return detail(ASSISTANT_INTENTS.ASSIGNED_DOCTOR, 'assigned_doctor');
      if (nextAppointmentPattern.test(message)) return detail(ASSISTANT_INTENTS.NEXT_APPOINTMENT, 'next_appointment');
      if (upcomingAppointmentsPattern.test(message)) return detail(ASSISTANT_INTENTS.UPCOMING_APPOINTMENTS, 'upcoming_appointments');
      const knowledge = findAssistantKnowledge(message);
      if (knowledge) return detail(knowledge.category, knowledge.id);
      if (unsupportedPattern.test(message)) return detail(ASSISTANT_INTENTS.UNSUPPORTED, 'unsupported');
      return detail(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'unclear');
    },
  });
}

