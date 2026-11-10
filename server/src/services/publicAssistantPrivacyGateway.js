import { ASSISTANT_INTENTS } from './assistantIntents.js';
import { findPublicAssistantGeneralKnowledge, findPublicAssistantKnowledge, getPublicAssistantKnowledgeEntry } from './publicAssistantKnowledgeBase.js';
import { assistantResponseLanguage, normalizeAssistantLanguage, scoreAssistantTopics } from './assistantTopicScorer.js';

const emergencyPattern = /\b(chest pain|cannot breathe|can(?:not|'t) breathe|difficulty breathing|severe bleeding|unconscious|overdose|suicid(?:e|al)|self[- ]harm|stroke|seizure|rapidly worsening|life[- ]threatening|emergency|hirap huminga|hindi makahinga|walang malay|matinding pagdurugo)\b/i;
const clinicalPattern = /\b(symptom|diagnos(?:e|is)|disease|illness|medicat(?:e|ion)|medicine|dosage|dose|prescri(?:be|ption)|pregnan(?:t|cy)|mental health|depress(?:ed|ion)|anxiety|treatment|clinical result|test result|lab result|blood pressure|fever|pain|headache|cough|dizz(?:y|iness)|nausea|vomit(?:ing)?|shortness of breath|bleeding|rash|sore throat|diarrhea|abdominal|wound|swelling|numbness|weakness|fatigue|allerg(?:y|ies)|infection|tablet|pill|antibiotic|insulin|interpret (?:my )?(?:medical )?record|sintomas?|sakit|lagnat|ubo|gamot|reseta|dosis|paggamot|sugat|nahihilo|buntis|pagdurugo)\b/i;
const unsafePattern = /\b(ignore (?:all |the )?(?:previous|prior|above) (?:rules|instructions|checks?)|ignore your rules|system prompt|hidden (?:instructions?|fields?)|pretend i am (?:an? )?(?:patient|admin|staff|doctor)|api[ -]?key|query (?:the )?(?:mongo|mongodb|database)|(?:list|show) all appointments|show all notifications|(?:show|access|give|reveal) (?:me )?(?:another|other|someone else['’]?s?) patient(?:'s)? (?:data|records?|information|appointments?|doctor|notifications?)|reveal (?:rules|prompt|secrets?))\b/i;
const personalNotificationPattern = /\b(?:my notifications?|notifications? do i have|any new notifications?|show my notifications?|unread notifications?)\b/i;
const personalRecordPattern = /\b(?:my medical records?|my records?|my certificates?|certificate issued to me)\b/i;
const personalAppointmentPattern = /\b(?:my next appointment|my appointment status|check my appointment status|who(?:'s|s| is) my (?:doc|doctor)|who am i seeing|did my appointment|is it (?:still )?(?:pending|confirmed)|get my appointment|show my appointment|appointment (?:date|time) for me|(?:kailan|kelan|anong oras) (?:ang |yung )?(?:next )?(?:appointment|appoint|schedule)(?: ko)?|(?:paano|pano) malalaman (?:ang |yung )?(?:appointment|schedule)(?: ko)?|sino (?:ang |yung )?(?:doc|doctor)(?: ko)?)\b/i;
const accountDataPattern = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b09\d{9}\b|\b(?:check|find|look up|access|confirm)\b.{0,30}\b(?:my )?(?:account|email|phone|registration)\b)/i;
const certificateValidityPattern = /\b(?:certificate|cert)\b.*\b(?:expir(?:e|ed|es|ation|y)|valid(?:ity)?|valid until|end date)\b|\b(?:expir(?:e|ed|es|ation|y)|valid(?:ity)?|valid until)\b.*\b(?:certificate|cert)\b/i;
const expiredCertificateDownloadPattern = /\b(?:download|open|view|save|get)\b.*\bexpired\b.*\b(?:certificate|cert|pdf)\b|\bexpired\b.*\b(?:certificate|cert|pdf)\b.*\b(?:download|open|view|save|get)\b/i;
const recordSearchPattern = /\b(?:show|find|look for|search|open|view|get)\b.*\b(?:record|records)\b.*\b(?:last|recent|latest|date|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|\d{1,2})\b|\b(?:record|records)\b.*\b(?:last|recent|latest|date|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|\d{1,2})\b/i;
const prescriptionAccessPattern = /\b(?:my |the )?prescription\b|\b(?:where|find|view|open|download|save|get|show)\b.*\bprescription\b|\bprescription\b.*\b(?:where|find|view|open|download|save|get|show|attachment|file|pdf)\b/i;
const doctorDirectoryPattern = /\b(?:list|show|tell|who|what)\b.*\b(?:doctor|doctors)\b.*\b(?:service|services|specialty|specialties|available|portal|clinic)\b|\b(?:doctor|doctors)\b.*\b(?:service|services|specialty|specialties)\b/i;
const doctorAvailabilityPattern = /\b(?:available|availability|bookable)\b.*\b(?:doctor|doctors)\b|\b(?:doctor|doctors)\b.*\b(?:available|availability|bookable)\b/i;
const clinicHoursPattern = /\b(?:clinic|arion)\b.*\b(?:hours|open|opening|close|closing|time|schedule|available)\b|\b(?:what|which) time\b.*\bclinic\b|\b(?:kailan|kelan|anong oras)\b.*\b(?:clinic|bukas|open)\b/i;
const directBookingRequestPattern = /\b(?:book|schedule|reserve|set|make|create|go)\b.*\bappointment\b.*\b(?:me|for me|my|please)\b|\b(?:book|schedule|reserve|set|make|create|go)\b.*\b(?:me|for me|my)\b.*\bappointment\b/i;
const emergencyContactProfilePattern = /\b(?:add|update|change|edit|replace)\b.*\bemergency contact\b|\bemergency contact\b.*\b(?:number|name|relationship|profile|add|update|change|edit|replace)\b/i;

function classification(intent, topic, responseKey = null) {
  return Object.freeze({ intent, topic, responseKey });
}

const scoredKnowledgeIds = Object.freeze({
  booking: 'appointment_process',
  reschedule: 'reschedule',
  cancellation: 'cancellation',
  queue: 'queue',
  account: 'account_general_help',
  records: 'medical_records',
  certificates: 'certificates',
  notifications: 'notifications_general_help',
  portal: 'scope',
});

const clarificationKeys = Object.freeze({
  booking: 'bookingClarification',
  reschedule: 'rescheduleClarification',
  cancellation: 'cancellationClarification',
  status: 'statusClarification',
  queue: 'queueClarification',
  account: 'accountClarification',
  records: 'recordsClarification',
  certificates: 'certificatesClarification',
  notifications: 'notificationsClarification',
  portal: 'portalClarification',
});

const contextKnowledgeIds = Object.freeze({
  booking_clarification: 'appointment_process',
  reschedule_clarification: 'reschedule',
  cancellation_clarification: 'cancellation',
  status_clarification: 'appointment_general_help',
  queue_clarification: 'queue',
  account_clarification: 'account_general_help',
  records_clarification: 'medical_records',
  certificates_clarification: 'certificates',
  notifications_clarification: 'notifications_general_help',
  portal_clarification: 'scope',
});

const affirmativeWords = new Set(['yes', 'yeah', 'yep', 'yup', 'sure', 'correct', 'right', 'oo', 'opo', 'sige', 'ge', 'tama']);
const negativeWords = new Set(['no', 'nope', 'hindi', 'iba']);

function contextualClassification(normalized, contextTopic) {
  if (!contextTopic) return null;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length > 10) return null;
  const has = (...words) => words.some((word) => tokens.includes(word));
  const knowledgeFor = (id) => {
    const knowledge = getPublicAssistantKnowledgeEntry(id);
    return knowledge ? Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge }) : null;
  };
  if (contextTopic === 'doctor_availability' && has('bookable', 'book', 'booking', 'available', 'availability', 'time', 'schedule', 'appointment', 'doctor', 'doc', 'date', 'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')) {
    return knowledgeFor('doctor_booking_times');
  }
  if (contextTopic === 'certificates_context') {
    if (has('expired', 'expiration', 'expiry', 'valid', 'validity', 'until', 'date')) return knowledgeFor('certificate_validity');
    if (has('download', 'save', 'open', 'view', 'pdf', 'it', 'that')) return knowledgeFor('certificate_download');
    if (has('where', 'find', 'latest', 'recent', 'mine', 'have')) return knowledgeFor('certificates');
  }
  if (contextTopic === 'records_context' && has('where', 'find', 'open', 'view', 'latest', 'recent', 'last', 'date', 'it', 'that', 'mine', 'prescription', 'download')) {
    if (has('prescription', 'download')) return knowledgeFor('prescription_access');
    if (has('latest', 'recent', 'last', 'date')) return knowledgeFor('record_search_help');
    return knowledgeFor('medical_records');
  }
  if (contextTopic === 'prescription_context' && has('download', 'save', 'open', 'view', 'find', 'where', 'it', 'that', 'file', 'attachment', 'pdf')) {
    return knowledgeFor('prescription_access');
  }
  if (contextTopic === 'clinic_hours_context' && has('when', 'kailan', 'kelan', 'week', 'weekly', 'every', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'time', 'open')) {
    return knowledgeFor('clinic_hours');
  }
  if (contextTopic === 'sms_context' && has('why', 'guaranteed', 'guarantee', 'deliver', 'delivered', 'delivery', 'arrive', 'delayed', 'delay', 'fail')) {
    return knowledgeFor('sms_delivery_reason');
  }
  if (contextTopic === 'profile_context' && has('edit', 'update', 'change', 'save', 'okay', 'ok', 'profile', 'it')) {
    return knowledgeFor('profile_editing');
  }
  if (contextTopic === 'registration_context') {
    if (has('password', 'required', 'require', 'need', 'needed')) return knowledgeFor('registration_password');
    if (has('email', 'code', 'otp', 'verify', 'verification')) return knowledgeFor('email_verification');
  }
  if (contextTopic === 'password_context' && has('email', 'link', 'send', 'reset', 'change', 'forgot', 'password', 'it')) {
    return knowledgeFor('password_reset');
  }
  if (contextTopic === 'clinic_contact_context' && has('call', 'phone', 'number', 'address', 'location', 'where', 'saan', 'nasan')) {
    return knowledgeFor('clinic_contact_location');
  }
  if (tokens.some((token) => affirmativeWords.has(token))) {
    const knowledge = getPublicAssistantKnowledgeEntry(contextKnowledgeIds[contextTopic]);
    if (knowledge) return Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge });
    if (['topic_conflict', 'doctor_availability'].includes(contextTopic)) {
      return Object.freeze({ intent: ASSISTANT_INTENTS.CLARIFICATION, topic: contextTopic, responseKey: contextTopic === 'topic_conflict' ? 'topicConflict' : 'clarification' });
    }
  }
  if (tokens.some((token) => negativeWords.has(token))) {
    return classification(ASSISTANT_INTENTS.PORTAL_HELP, 'context_rejected', 'contextRejected');
  }
  return null;
}

function socialResponseKey(normalized) {
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  if (tokens.size <= 7 && ['hello', 'hi', 'hey', 'kamusta', 'yo'].some((word) => tokens.has(word))) return 'greeting';
  if (tokens.size <= 7 && ['thanks', 'thank', 'salamat'].some((word) => tokens.has(word))) return 'thanks';
  if (tokens.size <= 3 && ['okay', 'ok', 'oki', 'okey', 'sige', 'ge', 'got', 'nice', 'yup'].some((word) => tokens.has(word))) return 'acknowledgement';
  if (tokens.size <= 7 && ['help', 'tulong', 'assist'].some((word) => tokens.has(word))) return 'helpRequest';
  if (/\b(?:useless|cannot tell|cant tell|cannot help|hard|difficult|confusing|nakakalito|ayaw|frustrat|bro)\b/i.test(normalized)) return 'frustration';
  return null;
}

export function createPublicAssistantPrivacyGateway() {
  return Object.freeze({
    classify(message, contextTopic = null) {
      const normalized = normalizeAssistantLanguage(message);
      const language = assistantResponseLanguage(normalized);
      if (emergencyContactProfilePattern.test(normalized)) {
        const knowledge = getPublicAssistantKnowledgeEntry('emergency_contact_editing');
        return Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge, language });
      }
      if (emergencyPattern.test(message) || emergencyPattern.test(normalized)) return classification(ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, 'emergency', language === 'filipino' ? 'emergencyFilipino' : 'emergency');
      if (/\b(?:add|update|change|edit|record)\b.*\ballerg(?:y|ies)\b|\ballerg(?:y|ies)\b.*\b(?:profile|add|update|change|edit|record)\b/i.test(normalized)) {
        const knowledge = getPublicAssistantKnowledgeEntry('allergy_profile_update');
        return Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge, language });
      }
      if (prescriptionAccessPattern.test(normalized)) {
        const knowledge = getPublicAssistantKnowledgeEntry('prescription_access');
        return Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge, language });
      }
      if (clinicalPattern.test(message) || clinicalPattern.test(normalized)) return classification(ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, 'clinical', language === 'filipino' ? 'clinicalFilipino' : 'clinical');
      if (unsafePattern.test(message)) return classification(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'unsafe_request', 'unsafe');
      if (personalNotificationPattern.test(message) || personalNotificationPattern.test(normalized)) return classification(ASSISTANT_INTENTS.RECENT_NOTIFICATIONS, 'personal_notification', 'personalNotification');
      if (personalAppointmentPattern.test(message) || personalAppointmentPattern.test(normalized)) return classification(ASSISTANT_INTENTS.APPOINTMENT_STATUS, 'personal_appointment', 'personalAppointment');
      if (personalRecordPattern.test(message) || personalRecordPattern.test(normalized)) return classification(ASSISTANT_INTENTS.PORTAL_HELP, 'personal_record', 'personalRecord');
      if (accountDataPattern.test(message)) return classification(ASSISTANT_INTENTS.ACCOUNT_HELP, 'personal_account', 'personalAccount');
      const socialKey = socialResponseKey(normalized);
      if (['greeting', 'thanks', 'acknowledgement'].includes(socialKey)) {
        return Object.freeze({ intent: ASSISTANT_INTENTS.PORTAL_HELP, topic: socialKey, responseKey: socialKey, language });
      }
      const explicitKnowledgeId = expiredCertificateDownloadPattern.test(normalized) ? 'expired_certificate_download'
        : certificateValidityPattern.test(normalized) ? 'certificate_validity'
          : recordSearchPattern.test(normalized) ? 'record_search_help'
            : clinicHoursPattern.test(normalized) ? 'clinic_hours'
              : doctorDirectoryPattern.test(normalized) ? 'doctor_directory_services'
                : doctorAvailabilityPattern.test(normalized) ? 'doctor_booking_times'
                  : directBookingRequestPattern.test(normalized) ? 'appointment_actions'
                    : null;
      if (explicitKnowledgeId) {
        const knowledge = getPublicAssistantKnowledgeEntry(explicitKnowledgeId);
        return Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge, language });
      }
      const contextual = contextualClassification(normalized, contextTopic);
      if (contextual) return contextual;
      const scoredTopic = scoreAssistantTopics(message);
      if (scoredTopic.kind === 'conflict') {
        return Object.freeze({ intent: ASSISTANT_INTENTS.CLARIFICATION, topic: 'topic_conflict', responseKey: 'topicConflict', language: scoredTopic.language });
      }
      const generalHelp = findPublicAssistantGeneralKnowledge(message) ?? findPublicAssistantGeneralKnowledge(normalized);
      if (generalHelp) return Object.freeze({ intent: generalHelp.category, topic: generalHelp.id, knowledge: generalHelp });
      const knowledge = findPublicAssistantKnowledge(message) ?? findPublicAssistantKnowledge(normalized);
      if (knowledge) return Object.freeze({ intent: knowledge.category, topic: knowledge.id, knowledge });
      if (scoredTopic.kind === 'match' && scoredKnowledgeIds[scoredTopic.topic]) {
        const scoredKnowledge = getPublicAssistantKnowledgeEntry(scoredKnowledgeIds[scoredTopic.topic]);
        if (scoredKnowledge) return Object.freeze({ intent: scoredKnowledge.category, topic: scoredKnowledge.id, knowledge: scoredKnowledge, language: scoredTopic.language });
      }
      if (['clarify', 'match'].includes(scoredTopic.kind)) {
        return Object.freeze({
          intent: ASSISTANT_INTENTS.CLARIFICATION,
          topic: `${scoredTopic.topic}_clarification`,
          responseKey: clarificationKeys[scoredTopic.topic] ?? 'clarification',
          language: scoredTopic.language,
        });
      }
      if (socialKey) return Object.freeze({ intent: ASSISTANT_INTENTS.PORTAL_HELP, topic: socialKey, responseKey: socialKey, language });
      if (/\b(weather|sports?|movie|music|recipe|stock price|cryptocurrency|homework|write (?:a )?(?:poem|essay))\b/i.test(message)) {
        return classification(ASSISTANT_INTENTS.UNSUPPORTED, 'unsupported', 'unsupported');
      }
      return Object.freeze({ intent: ASSISTANT_INTENTS.CLARIFICATION, topic: 'unclear', responseKey: 'clarification', language: scoredTopic.language });
    },
  });
}
