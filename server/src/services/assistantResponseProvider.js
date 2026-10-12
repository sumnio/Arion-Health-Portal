import { ASSISTANT_INTENTS } from './assistantPrivacyGateway.js';

const CLINICAL_REPLY = 'Arion Assistant can provide clinic and portal guidance, but it cannot diagnose conditions or recommend medication. Please consult a qualified healthcare professional. If you believe this may be an emergency, seek urgent medical care.';
const EMERGENCY_REPLY = 'Arion Assistant cannot assess emergencies. If you are experiencing severe or rapidly worsening symptoms, seek urgent medical attention or emergency services immediately.';
const APPOINTMENT_LOOKUP_REPLY = 'You can view your upcoming appointments and status in My Appointments. Personalized appointment lookup will be added to Arion Assistant in a later milestone.';
const SAFE_SCOPE_REPLY = 'I’m not able to answer that safely yet. I can help with appointments, portal navigation, account support, Medical Records, Certificates, and clinic-related guidance.';

function appointmentReply(message) {
  if (/\breschedul/i.test(message)) return 'To reschedule, open My Appointments, choose an eligible appointment, select View Details, and use the reschedule option.';
  if (/\bcancel/i.test(message)) return 'To cancel, open My Appointments, choose an eligible appointment, select View Details, and use the cancel option.';
  if (/\bbook/i.test(message)) return 'To book an appointment, open Book Appointment, choose a Doctor and available time, then submit your request.';
  if (/\b(status|pending|confirmed|completed|no[- ]?show)\b/i.test(message)) return 'Appointment statuses show whether a request is pending, confirmed, completed, cancelled, or marked no-show. Open My Appointments for your current status.';
  return 'Use My Appointments to view appointment details. You can use Book Appointment to request a new visit.';
}

function accountReply(message) {
  if (/\b(email verification|verify (?:my )?email|verification code)\b/i.test(message)) return 'Use the verification page to enter the code sent to your email. You can request a new code there if needed.';
  if (/\b(password|account recovery)\b/i.test(message)) return 'Use Forgot Password on the Login page to request a secure password-reset link by email.';
  return 'Open My Profile to view your account information. Select Edit Profile before changing approved profile fields.';
}

function portalReply(message) {
  if (/\bmedical records?|records?\b/i.test(message)) return 'Open My Records from the Patient navigation to view your available medical visit records.';
  if (/\bcertificate/i.test(message)) return 'Open My Certificates from the Patient navigation to view issued medical certificates.';
  if (/\bnotification/i.test(message)) return 'Open Notifications or the notification bell to review clinic and appointment updates for your account.';
  return 'Use the Patient navigation to access appointments, records, certificates, notifications, and your profile.';
}

export function createAssistantResponseProvider() {
  return Object.freeze({
    reply(message, classification) {
      if (classification.intent === ASSISTANT_INTENTS.HEALTH_OR_CLINICAL) {
        return classification.emergency ? EMERGENCY_REPLY : CLINICAL_REPLY;
      }
      if (classification.intent === ASSISTANT_INTENTS.SENSITIVE_OR_UNCLEAR || classification.intent === ASSISTANT_INTENTS.UNSUPPORTED) return SAFE_SCOPE_REPLY;
      if (classification.intent === ASSISTANT_INTENTS.ACCOUNT_HELP) return accountReply(message);
      if (classification.intent === ASSISTANT_INTENTS.APPOINTMENT_HELP) {
        return classification.topic === 'personalized_lookup' ? APPOINTMENT_LOOKUP_REPLY : appointmentReply(message);
      }
      return portalReply(message);
    },
  });
}

