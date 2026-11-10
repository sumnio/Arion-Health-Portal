import { findAssistantGeneralKnowledge, findAssistantKnowledge, getAssistantKnowledgeEntry } from './assistantKnowledgeBase.js';
import { ASSISTANT_GPT_TASKS } from './assistantGptTasks.js';
import { ASSISTANT_INTENTS } from './assistantIntents.js';
import { scoreAssistantTopics } from './assistantTopicScorer.js';

export { ASSISTANT_INTENTS } from './assistantIntents.js';

const emergencyPattern = /\b(chest pain|cannot breathe|can(?:not|'t) breathe|difficulty breathing|severe bleeding|unconscious|overdose|suicid(?:e|al)|self[- ]harm|stroke|seizure|rapidly worsening|life[- ]threatening|emergency|hirap huminga|hindi makahinga|walang malay|matinding pagdurugo)\b/i;
const clinicalPattern = /\b(symptom|diagnos(?:e|is)|disease|illness|medicat(?:e|ion)|medicine|dosage|dose|prescri(?:be|ption)|pregnan(?:t|cy)|mental health|depress(?:ed|ion)|anxiety|treatment|clinical result|test result|lab result|blood pressure|fever|pain|headache|cough|dizz(?:y|iness)|nausea|vomit(?:ing)?|shortness of breath|bleeding|rash|sore throat|diarrhea|abdominal|wound|swelling|numbness|weakness|fatigue|allerg(?:y|ies)|infection|tablet|pill|antibiotic|insulin|interpret (?:my )?(?:medical )?record|what does (?:my )?(?:medical )?record|sintomas?|sakit|lagnat|ubo|gamot|reseta|dosis|paggamot|sugat|nahihilo|buntis|pagdurugo)\b/i;
const injectionPattern = /\b(ignore (?:all |the )?(?:previous|prior|above|ownership) (?:rules|instructions|checks?)|ignore (?:your rules|ownership checks?)|system prompt|hidden (?:instructions?|fields?)|pretend i am (?:an? )?(?:admin|staff|doctor)|api[ -]?key|query (?:the )?(?:mongo|mongodb|database)|(?:list|show) all appointments|show all notifications|(?:show|access|give|reveal) (?:me )?(?:another|other|patient\s+\d+) patient(?:'s)? (?:data|records?|information|appointments?|doctor|notifications?)|patient\s+\d+['’]?s? (?:appointments?|doctor|notifications?)|show (?:me )?(?:your )?(?:rules|prompt|secrets?))\b/i;
const unreadNotificationPattern = /\b(?:how many|count|number of)\b.{0,30}\bunread notifications?\b|\bunread notification count\b|\bdo i have (?:any )?unread notifications?\b/i;
const recentNotificationPattern = /\b(?:do i have (?:any )?notifications?|what (?:notifications? do i have|are my (?:recent )?notifications?)|any new notifications?|did i get (?:a|any) notifications?|what did i get notified about|show my notifications?)\b/i;
const appointmentStatusPattern = /\b(?:what is my appointment status|check my appointment status|did my appointment (?:get )?(?:approved|confirmed|cancelled|rescheduled)|is my appointment (?:still )?(?:pending|confirmed)|is it (?:still )?(?:pending|confirmed)|what happened to my appointment)\b/i;
const appointmentLookupHelpPattern = /\b(?:paano|pano)\b.*\bmalalaman\b.*\b(?:appointment|schedule)(?: ko)?\b/i;
const allergyProfilePattern = /\b(?:add|update|change|edit|record)\b.*\ballerg(?:y|ies)\b|\ballerg(?:y|ies)\b.*\b(?:profile|add|update|change|edit|record)\b/i;
const emergencyContactProfilePattern = /\b(?:add|update|change|edit|replace)\b.*\bemergency contact\b|\bemergency contact\b.*\b(?:number|name|relationship|profile|add|update|change|edit|replace)\b/i;
const certificateValidityPattern = /\b(?:certificate|cert)\b.*\b(?:expir(?:e|ed|es|ation|y)|valid(?:ity)?|valid until|end date)\b|\b(?:expir(?:e|ed|es|ation|y)|valid(?:ity)?|valid until)\b.*\b(?:certificate|cert)\b/i;
const expiredCertificateDownloadPattern = /\b(?:download|open|view|save|get)\b.*\bexpired\b.*\b(?:certificate|cert|pdf)\b|\bexpired\b.*\b(?:certificate|cert|pdf)\b.*\b(?:download|open|view|save|get)\b/i;
const recordSearchPattern = /\b(?:show|find|look for|search|open|view|get)\b.*\b(?:record|records)\b.*\b(?:last|recent|latest|date|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|\d{1,2})\b|\b(?:record|records)\b.*\b(?:last|recent|latest|date|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|\d{1,2})\b/i;
const prescriptionAccessPattern = /\b(?:my |the )?prescription\b|\b(?:where|find|view|open|download|save|get|show)\b.*\bprescription\b|\bprescription\b.*\b(?:where|find|view|open|download|save|get|show|attachment|file|pdf)\b/i;
const doctorDirectoryPattern = /\b(?:list|show|tell|who|what)\b.*\b(?:doctor|doctors)\b.*\b(?:service|services|specialty|specialties|available|portal|clinic)\b|\b(?:doctor|doctors)\b.*\b(?:service|services|specialty|specialties)\b/i;
const doctorAvailabilityPattern = /\b(?:available|availability|bookable)\b.*\b(?:doctor|doctors)\b|\b(?:doctor|doctors)\b.*\b(?:available|availability|bookable)\b/i;
const clinicHoursPattern = /\b(?:clinic|arion)\b.*\b(?:hours|open|opening|close|closing|time|schedule|available)\b|\b(?:what|which) time\b.*\bclinic\b|\b(?:kailan|kelan|anong oras)\b.*\b(?:clinic|bukas|open)\b/i;
const pastAppointmentPattern = /\b(?:appointment|schedule)\b.*\b(?:last|past|previous|history|ago|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|sep|oct)\b|\b(?:last|past|previous)\b.*\b(?:appointment|schedule)\b/i;
const directBookingRequestPattern = /\b(?:book|schedule|reserve|set|make|create|go)\b.*\bappointment\b.*\b(?:me|for me|my|please)\b|\b(?:book|schedule|reserve|set|make|create|go)\b.*\b(?:me|for me|my)\b.*\bappointment\b/i;
const doctorPresencePattern = /\b(?:doctor|doc)\b.*\b(?:already )?(?:here|at (?:the )?clinic|arrived|present)\b|\b(?:here|at (?:the )?clinic|arrived|present)\b.*\b(?:doctor|doc)\b/i;
const assignedDoctorPattern = /\b(?:who(?:'s|s| is) my (?:doc|doctor)|which doctor is assigned to my appointment|who am i seeing|sino (?:ang |yung )?(?:doc|doctor)(?: ko)?|sinong (?:doc|doctor))\b/i;
const nextAppointmentPattern = /\b(?:when|where|what time) (?:is|are) my next appointment\b|\b(?:my )?next appointment\b|\b(?:kailan|kelan|anong oras) (?:ang |yung )?(?:next )?(?:appointment|appoint|schedule)(?: ko)?\b|\bnext (?:appointment|appoint|schedule) ko\b/i;
const upcomingAppointmentsPattern = /\b(?:do i have (?:any )?upcoming appointments?|what appointments do i have|show my upcoming appointments?|my upcoming appointments?)\b/i;
const externalRestrictedPattern = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b09\d{9}\b|\b(?:my (?:name|email|phone|address|date of birth|dob|patient id|appointment id|account id)\s+(?:is|=)|i was born|my doctor is|my appointment is (?:on|at)|my notification says)\b)/i;
const unsupportedPattern = /\b(weather|sports?|movie|music|recipe|stock price|cryptocurrency|homework|write (?:a )?(?:poem|essay))\b/i;

const typoReplacements = Object.freeze({
  appoint: 'appointment',
  appointmen: 'appointment',
  apointment: 'appointment',
  appoinment: 'appointment',
  appointmnt: 'appointment',
  appt: 'appointment',
  bookingg: 'booking',
  avail: 'available',
  availble: 'available',
  avialable: 'available',
  okk: 'ok',
  boook: 'book',
  rescedule: 'reschedule',
  reshedule: 'reschedule',
  reschedul: 'reschedule',
  resched: 'reschedule',
  cancle: 'cancel',
  cancelation: 'cancellation',
  confimed: 'confirmed',
  confirmd: 'confirmed',
  pendng: 'pending',
  notif: 'notification',
  notifcation: 'notification',
  notificaton: 'notification',
  cert: 'certificate',
  certs: 'certificate',
  certficate: 'certificate',
  certifcate: 'certificate',
  medcert: 'certificate',
  medcer: 'certificate',
  downlaod: 'download',
  dowload: 'download',
  donwload: 'download',
  exipred: 'expired',
  expried: 'expired',
  expird: 'expired',
  expriation: 'expiration',
  expiratoin: 'expiration',
  presciption: 'prescription',
  perscription: 'prescription',
  prescriptin: 'prescription',
  reseta: 'prescription',
  recrod: 'record',
  recrods: 'records',
  docters: 'doctors',
  servces: 'services',
  pasword: 'password',
  oassword: 'password',
  passwrod: 'password',
  verfication: 'verification',
  scheduel: 'schedule',
  sched: 'schedule',
  docter: 'doctor',
  doc: 'doctor',
  loging: 'login',
  fevr: 'fever',
  coff: 'cough',
  dizy: 'dizzy',
  medecine: 'medicine',
  diagnos: 'diagnose',
  salmat: 'salamat',
  thnks: 'thanks',
  pls: 'please',
  plz: 'please',
  tnx: 'thanks',
  ty: 'thanks',
  cant: 'cannot',
  didnt: 'did not',
  dont: 'do not',
  im: 'i am',
  san: 'saan',
  bat: 'bakit',
  di: 'hindi',
  kelangan: 'kailangan',
});

const fuzzyTerms = Object.freeze([
  'appointment', 'booking', 'schedule', 'reschedule', 'cancel', 'cancellation',
  'pending', 'confirmed', 'completed', 'notification', 'certificate', 'password',
  'verification', 'doctor', 'queue', 'arrival', 'profile', 'record', 'login',
  'prescription', 'download', 'expired', 'expiration', 'available', 'allergy',
]);

const filipinoMarkers = new Set([
  'ako', 'ano', 'ang', 'ba', 'bakit', 'gusto', 'hindi', 'kailan', 'kailangan', 'ko', 'mag',
  'mga', 'mo', 'ng', 'nasan', 'oo', 'opo', 'paano', 'pano', 'para', 'po', 'pwede',
  'palitan', 'resetin', 'saan', 'sige', 'tama', 'tulong', 'yung', 'tagalog', 'filipino',
]);

function editDistanceAtMostOne(left, right) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const mismatches = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatches.push(index);
      if (mismatches.length > 2) return false;
    }
    if (mismatches.length === 1) return true;
    return mismatches.length === 2
      && mismatches[1] === mismatches[0] + 1
      && left[mismatches[0]] === right[mismatches[1]]
      && left[mismatches[1]] === right[mismatches[0]];
  }
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  let shortIndex = 0;
  let longIndex = 0;
  let skipped = false;
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      longIndex += 1;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      longIndex += 1;
    }
  }
  return true;
}

function normalizeToken(token) {
  const repeatedLettersReduced = token.replace(/(.)\1{2,}/g, '$1$1');
  const replacement = typoReplacements[repeatedLettersReduced];
  if (replacement) return replacement;
  if (repeatedLettersReduced.length < 5 || /^\d+$/.test(repeatedLettersReduced)) return repeatedLettersReduced;
  return fuzzyTerms.find((term) => editDistanceAtMostOne(repeatedLettersReduced, term)) ?? repeatedLettersReduced;
}

function normalizeMessage(message) {
  return message
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken)
    .join(' ');
}

function hasAny(tokens, words) {
  return words.some((word) => tokens.has(word));
}

function responseLanguage(tokens) {
  return [...tokens].some((token) => filipinoMarkers.has(token)) ? 'filipino' : 'english';
}

function approvedTask(id, tokens) {
  return Object.freeze({ id, language: responseLanguage(tokens) });
}

const scoredTaskIds = Object.freeze({
  booking: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY,
  reschedule: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  cancellation: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  status: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  queue: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
  account: ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS,
  records: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
  certificates: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
  notifications: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
  portal: ASSISTANT_GPT_TASKS.EXPLAIN_PORTAL_FOR_NEW_PATIENT,
});

const contextTaskIds = Object.freeze({
  booking_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY,
  reschedule_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  cancellation_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  status_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  queue_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
  account_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS,
  records_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
  certificates_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
  notifications_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
  portal_clarification: ASSISTANT_GPT_TASKS.EXPLAIN_PORTAL_FOR_NEW_PATIENT,
});

const affirmativeWords = ['yes', 'yeah', 'yep', 'yup', 'sure', 'correct', 'right', 'oo', 'opo', 'sige', 'ge', 'tama'];
const negativeWords = ['no', 'nope', 'hindi', 'iba'];

function contextualReply(tokens, contextTopic) {
  if (!contextTopic || tokens.size > 10) return null;
  const knowledge = (topic) => Object.freeze({ type: 'knowledge', topic });
  if (contextTopic === 'doctor_availability'
    && hasAny(tokens, ['bookable', 'book', 'booking', 'available', 'availability', 'time', 'schedule', 'appointment', 'doctor', 'doc', 'date', 'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])) {
    return knowledge('doctor_booking_times');
  }
  if (contextTopic === 'booking_clarification'
    && hasAny(tokens, ['bookable', 'available', 'availability', 'slot', 'slots'])) {
    return knowledge('doctor_booking_times');
  }
  if (contextTopic === 'certificates_context') {
    if (hasAny(tokens, ['expired', 'expiration', 'expiry', 'valid', 'validity', 'until', 'date'])) return knowledge('certificate_validity');
    if (hasAny(tokens, ['download', 'save', 'open', 'view', 'pdf', 'it', 'that'])) return knowledge('certificate_download');
    if (hasAny(tokens, ['where', 'find', 'latest', 'recent', 'mine', 'have'])) return knowledge('certificate_location');
  }
  if (contextTopic === 'records_context'
    && hasAny(tokens, ['where', 'find', 'open', 'view', 'latest', 'recent', 'last', 'date', 'it', 'that', 'mine', 'prescription', 'download'])) {
    if (hasAny(tokens, ['prescription', 'download'])) return knowledge('prescription_access');
    if (hasAny(tokens, ['latest', 'recent', 'last', 'date'])) return knowledge('record_search_help');
    return knowledge('medical_records_location');
  }
  if (contextTopic === 'prescription_context'
    && hasAny(tokens, ['download', 'save', 'open', 'view', 'find', 'where', 'it', 'that', 'file', 'attachment', 'pdf'])) {
    return knowledge('prescription_access');
  }
  if (contextTopic === 'clinic_hours_context'
    && hasAny(tokens, ['when', 'kailan', 'kelan', 'week', 'weekly', 'every', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'time', 'open'])) {
    return knowledge('clinic_hours');
  }
  if (contextTopic === 'sms_context'
    && hasAny(tokens, ['why', 'guaranteed', 'guarantee', 'deliver', 'delivered', 'delivery', 'arrive', 'delayed', 'delay', 'fail'])) {
    return knowledge('sms_delivery_reason');
  }
  if (contextTopic === 'profile_context'
    && hasAny(tokens, ['edit', 'update', 'change', 'save', 'okay', 'ok', 'profile', 'it'])) {
    return knowledge('profile_editing');
  }
  if (contextTopic === 'registration_context') {
    if (hasAny(tokens, ['password', 'required', 'require', 'need', 'needed'])) return knowledge('registration_password');
    if (hasAny(tokens, ['email', 'code', 'otp', 'verify', 'verification'])) return knowledge('email_verification');
  }
  if (contextTopic === 'password_context'
    && hasAny(tokens, ['email', 'link', 'send', 'reset', 'change', 'forgot', 'password', 'it'])) {
    return knowledge('password_reset');
  }
  if (contextTopic === 'clinic_contact_context'
    && hasAny(tokens, ['call', 'phone', 'number', 'address', 'location', 'where', 'saan', 'nasan'])) {
    return knowledge('clinic_contact_location');
  }
  if (hasAny(tokens, affirmativeWords)) {
    const taskId = contextTaskIds[contextTopic];
    if (taskId) return Object.freeze({ type: 'task', taskId });
    if (['topic_conflict', 'doctor_availability'].includes(contextTopic)) {
      return Object.freeze({ type: 'clarification', topic: contextTopic });
    }
  }
  if (hasAny(tokens, negativeWords)) return Object.freeze({ type: 'rejected' });
  return null;
}

function socialTopic(normalized, tokens) {
  const shortMessage = tokens.size <= 7;
  if (shortMessage && hasAny(tokens, ['hello', 'hi', 'hey', 'kamusta', 'yo'])) return 'greeting';
  if (shortMessage && hasAny(tokens, ['thanks', 'thank', 'salamat'])) return 'thanks';
  if (tokens.size <= 3 && hasAny(tokens, ['okay', 'ok', 'oki', 'okey', 'sige', 'ge', 'got', 'nice', 'yup'])) return 'acknowledgement';
  if (shortMessage && hasAny(tokens, ['help', 'tulong', 'assist'])) return 'help_request';
  if (/\b(?:useless|cannot tell|cant tell|cannot help|hard|difficult|confusing|nakakalito|ayaw|frustrat|bro)\b/i.test(normalized)) {
    return 'frustration';
  }
  return null;
}

function explicitGptTask(message) {
  const normalized = normalizeMessage(message);
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  if (tokens.has('pending') && tokens.has('confirmed')
    && hasAny(tokens, ['simple', 'simpler', 'easy', 'easier', 'difference', 'compare', 'versus', 'vs', 'mean', 'means'])) {
    return approvedTask(ASSISTANT_GPT_TASKS.COMPARE_PENDING_CONFIRMED_SIMPLY, tokens);
  }
  if (tokens.has('portal') && hasAny(tokens, ['explain', 'describe'])
    && hasAny(tokens, ['new', 'work', 'works', 'simple', 'simpler'])) {
    return approvedTask(ASSISTANT_GPT_TASKS.EXPLAIN_PORTAL_FOR_NEW_PATIENT, tokens);
  }
  if (tokens.has('appointment') && hasAny(tokens, ['explain', 'describe', 'confused'])
    && hasAny(tokens, ['process', 'simple', 'simpler', 'work', 'works', 'confused', 'tagalog', 'filipino', 'words', 'booking'])) {
    return approvedTask(ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY, tokens);
  }
  return null;
}

function gptTask(message) {
  const normalized = normalizeMessage(message);
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  const task = (id) => approvedTask(id, tokens);

  if (tokens.has('pending') && tokens.has('confirmed')) {
    return task(ASSISTANT_GPT_TASKS.COMPARE_PENDING_CONFIRMED_SIMPLY);
  }
  if (hasAny(tokens, ['pending', 'confirmed', 'completed', 'cancelled', 'canceled', 'status', 'no', 'show'])
    && hasAny(tokens, ['meaning', 'mean', 'means', 'ano', 'explain', 'simple', 'status'])) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES);
  }
  if (hasAny(tokens, ['reschedule', 'cancel', 'cancellation', 'move', 'change'])
    && !hasAny(tokens, ['password', 'pass', 'account', 'profile', 'email'])
    && (hasAny(tokens, ['appointment', 'booking', 'schedule', 'time', 'book']) || tokens.size <= 5)) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION);
  }
  if (hasAny(tokens, ['arrival', 'arrive', 'checkin', 'queue', 'waiting', 'line', 'pila', 'dating', 'priority'])) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE);
  }
  if (hasAny(tokens, ['password', 'otp', 'verification', 'verify', 'login', 'account', 'email'])
    && hasAny(tokens, ['help', 'how', 'paano', 'pano', 'forgot', 'reset', 'recover', 'work', 'works', 'explain', 'ano'])) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS);
  }
  if (hasAny(tokens, ['record', 'records', 'certificate', 'certificates'])
    && hasAny(tokens, ['where', 'saan', 'find', 'view', 'see', 'open', 'how', 'paano', 'pano', 'explain', 'help', 'ko'])) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES);
  }
  if (hasAny(tokens, ['notification', 'notifications', 'alert', 'alerts', 'update', 'updates'])
    && hasAny(tokens, ['how', 'paano', 'pano', 'work', 'works', 'explain', 'help', 'ano'])) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS);
  }
  if (hasAny(tokens, ['portal', 'dashboard', 'navigation'])
    && hasAny(tokens, ['explain', 'describe', 'how', 'paano', 'pano', 'new', 'start', 'use', 'works', 'work'])) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_PORTAL_FOR_NEW_PATIENT);
  }
  if (hasAny(tokens, ['appointment', 'appointments', 'booking', 'book', 'schedule'])
    && hasAny(tokens, ['explain', 'describe', 'how', 'paano', 'pano', 'confused', 'process', 'work', 'works', 'start', 'kumuha', 'mag', 'need', 'gusto', 'tell', 'where'])) {
    return task(ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY);
  }
  return null;
}

function detail(intent, topic = null, emergency = false) {
  return Object.freeze({ intent, topic, emergency });
}

export function createAssistantPrivacyGateway() {
  return Object.freeze({
    classify(message, contextTopic = null) {
      const normalized = normalizeMessage(message);
      const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
      if (emergencyContactProfilePattern.test(normalized)) return detail(ASSISTANT_INTENTS.ACCOUNT_HELP, 'emergency_contact_editing');
      if (emergencyPattern.test(message) || emergencyPattern.test(normalized)) {
        return Object.freeze({ intent: ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, topic: 'emergency', emergency: true, language: responseLanguage(tokens) });
      }
      if (allergyProfilePattern.test(normalized)) return detail(ASSISTANT_INTENTS.ACCOUNT_HELP, 'allergy_profile_update');
      // Navigation and download questions about an existing prescription are
      // portal-help requests, not requests for medication advice.
      if (prescriptionAccessPattern.test(normalized)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'prescription_access');
      if (clinicalPattern.test(message) || clinicalPattern.test(normalized)) {
        return Object.freeze({ intent: ASSISTANT_INTENTS.HEALTH_OR_CLINICAL, topic: 'clinical', emergency: false, language: responseLanguage(tokens) });
      }
      if (injectionPattern.test(message)) return detail(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'unsafe_request');
      if (externalRestrictedPattern.test(message)) return detail(ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR, 'external_data_restricted');
      const conversationalTopic = socialTopic(normalized, tokens);
      if (['greeting', 'thanks', 'acknowledgement'].includes(conversationalTopic)) {
        return Object.freeze({ intent: ASSISTANT_INTENTS.CONVERSATIONAL, topic: conversationalTopic, language: responseLanguage(tokens), emergency: false });
      }
      // Explicit topic words take priority over short-term conversation
      // context so a new Certificate or Records question cannot be pulled
      // back into an earlier appointment discussion.
      if (expiredCertificateDownloadPattern.test(normalized)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'expired_certificate_download');
      if (certificateValidityPattern.test(normalized)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'certificate_validity');
      if (recordSearchPattern.test(normalized)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'record_search_help');
      if (pastAppointmentPattern.test(normalized)) return detail(ASSISTANT_INTENTS.APPOINTMENT_HELP, 'appointment_history_location');
      if (clinicHoursPattern.test(normalized)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'clinic_hours');
      if (doctorDirectoryPattern.test(normalized)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'doctor_directory_services');
      if (doctorAvailabilityPattern.test(normalized)) return detail(ASSISTANT_INTENTS.APPOINTMENT_HELP, 'doctor_booking_times');
      if (doctorPresencePattern.test(normalized)) return detail(ASSISTANT_INTENTS.PORTAL_HELP, 'doctor_presence');
      if (directBookingRequestPattern.test(normalized)) return detail(ASSISTANT_INTENTS.APPOINTMENT_HELP, 'appointment_actions');
      // Clear personal lookup questions and explicit explanation requests must
      // override an older conversation topic.
      if (unreadNotificationPattern.test(normalized)) return detail(ASSISTANT_INTENTS.UNREAD_NOTIFICATION_COUNT, 'unread_notification_count');
      if (recentNotificationPattern.test(normalized)) return detail(ASSISTANT_INTENTS.RECENT_NOTIFICATIONS, 'recent_notifications');
      if (appointmentStatusPattern.test(normalized) || appointmentLookupHelpPattern.test(normalized)) return detail(ASSISTANT_INTENTS.APPOINTMENT_STATUS, 'appointment_status');
      if (assignedDoctorPattern.test(normalized)) return detail(ASSISTANT_INTENTS.ASSIGNED_DOCTOR, 'assigned_doctor');
      if (nextAppointmentPattern.test(normalized)) return detail(ASSISTANT_INTENTS.NEXT_APPOINTMENT, 'next_appointment');
      if (upcomingAppointmentsPattern.test(normalized)) return detail(ASSISTANT_INTENTS.UPCOMING_APPOINTMENTS, 'upcoming_appointments');
      const explicitTask = explicitGptTask(message);
      if (explicitTask) {
        return Object.freeze({ intent: ASSISTANT_INTENTS.GPT_CONVERSATIONAL, topic: explicitTask.id, language: explicitTask.language, emergency: false });
      }
      const contextual = contextualReply(tokens, contextTopic);
      if (contextual?.type === 'task') {
        return Object.freeze({ intent: ASSISTANT_INTENTS.GPT_CONVERSATIONAL, topic: contextual.taskId, language: responseLanguage(tokens), emergency: false });
      }
      if (contextual?.type === 'knowledge') {
        const knowledge = getAssistantKnowledgeEntry(contextual.topic);
        if (knowledge) {
          return Object.freeze({ intent: knowledge.category, topic: knowledge.id, language: responseLanguage(tokens), emergency: false });
        }
      }
      if (contextual?.type === 'clarification') {
        return Object.freeze({ intent: ASSISTANT_INTENTS.CLARIFICATION, topic: contextual.topic, language: responseLanguage(tokens), emergency: false });
      }
      if (contextual?.type === 'rejected') {
        return Object.freeze({ intent: ASSISTANT_INTENTS.CONVERSATIONAL, topic: 'context_rejected', language: responseLanguage(tokens), emergency: false });
      }
      if (tokens.has('doctor') && hasAny(tokens, ['available', 'availability', 'when', 'kailan', 'nandiyan', 'nandyan'])) {
        return Object.freeze({ intent: ASSISTANT_INTENTS.CLARIFICATION, topic: 'doctor_availability', language: responseLanguage(tokens), emergency: false });
      }
      const scoredTopic = scoreAssistantTopics(message);
      if (scoredTopic.kind === 'conflict') {
        return Object.freeze({
          intent: ASSISTANT_INTENTS.CLARIFICATION,
          topic: 'topic_conflict',
          candidates: scoredTopic.candidates,
          language: scoredTopic.language,
          emergency: false,
        });
      }
      const generalHelp = findAssistantGeneralKnowledge(message);
      if (generalHelp) return detail(generalHelp.category, generalHelp.id);
      const knowledge = findAssistantKnowledge(message);
      if (knowledge) return detail(knowledge.category, knowledge.id);
      const approvedGptTask = gptTask(message);
      if (approvedGptTask) {
        return Object.freeze({
          intent: ASSISTANT_INTENTS.GPT_CONVERSATIONAL,
          topic: approvedGptTask.id,
          language: approvedGptTask.language,
          emergency: false,
        });
      }
      if (scoredTopic.kind === 'match' && scoredTaskIds[scoredTopic.topic]) {
        return Object.freeze({
          intent: ASSISTANT_INTENTS.GPT_CONVERSATIONAL,
          topic: scoredTaskIds[scoredTopic.topic],
          language: scoredTopic.language,
          emergency: false,
        });
      }
      if (scoredTopic.kind === 'clarify') {
        return Object.freeze({
          intent: ASSISTANT_INTENTS.CLARIFICATION,
          topic: `${scoredTopic.topic}_clarification`,
          language: scoredTopic.language,
          emergency: false,
        });
      }
      if (conversationalTopic) {
        return Object.freeze({ intent: ASSISTANT_INTENTS.CONVERSATIONAL, topic: conversationalTopic, language: responseLanguage(tokens), emergency: false });
      }
      if (unsupportedPattern.test(message)) return detail(ASSISTANT_INTENTS.UNSUPPORTED, 'unsupported');
      return Object.freeze({
        intent: ASSISTANT_INTENTS.CLARIFICATION,
        topic: hasAny(tokens, ['doctor', 'available', 'availability']) ? 'doctor_availability' : 'unclear',
        language: responseLanguage(tokens),
        emergency: false,
      });
    },
  });
}

