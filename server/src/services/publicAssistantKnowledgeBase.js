import { ASSISTANT_INTENTS } from './assistantIntents.js';

function entry(id, category, patterns, response) {
  return Object.freeze({ id, category, patterns: Object.freeze(patterns), response });
}

export const PUBLIC_ASSISTANT_SAFETY_RESPONSES = Object.freeze({
  emergency: 'Arion Assistant cannot assess emergencies or provide a diagnosis. For severe or rapidly worsening symptoms, contact local emergency services or seek urgent medical attention immediately.',
  clinical: 'Arion Assistant can explain clinic and portal processes, but it cannot diagnose, prescribe, change medication or dosage, recommend treatment, or interpret clinical information. Please contact a qualified healthcare professional for medical guidance. If you believe this may be an emergency, seek urgent medical care.',
  unsafe: 'I cannot bypass Arion security, reveal protected information, or access Patient data. I can help with public clinic and portal-process questions.',
  personalAppointment: 'Please sign in to the Patient Portal and open My Appointments to see your own appointment date, Doctor, or current status. Public Arion Assistant cannot access Patient accounts or appointment data.',
  personalNotification: 'Please sign in to the Patient Portal and open Notifications to see updates for your account. Public Arion Assistant cannot access Patient notifications.',
  personalRecord: 'Please sign in to the Patient Portal and open My Records or My Certificates to view information issued to your account. Public Arion Assistant cannot access Patient records or certificates.',
  personalAccount: 'I can explain the public account process, but I cannot check whether an account, email address, or phone number exists. Use Login, Register, Email Verification, or Forgot Password as appropriate.',
  unsupported: 'I can help with registration, login, email verification, password recovery, appointment processes and statuses, the clinic queue, Medical Records and Certificates, and Arion Assistant’s public scope.',
});

export const PUBLIC_ASSISTANT_KNOWLEDGE_BASE = Object.freeze([
  entry('registration', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:how (?:do|can) i |can i |where (?:do|can) i )?(?:register|sign up|create (?:an? )?account)\b/i,
  ], 'Select Register, enter the requested Patient details, and submit the form. New Patient accounts must complete email verification before signing in.'),
  entry('login', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:how (?:do|can) i |where (?:do|can) i )?(?:log ?in|sign in)\b/i,
  ], 'Select Login and enter your registered email address and password. Patient, Staff, Doctor, and Admin access follows the secure sign-in steps for that account type.'),
  entry('email_verification', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:verify|verification|otp|one[- ]time code|resend code)\b.*\b(?:email|code|registration)?\b/i,
    /\b(?:did not|didn['’]?t|never|haven['’]?t) (?:get|receive|received)\b.*\b(?:code|otp)\b/i,
  ], 'New Patient registration uses a 6-digit email verification code. Enter the newest code in the verification page within 10 minutes; requesting another code makes the previous code invalid.'),
  entry('password_reset', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:forgot|reset|change|recover)\b.*\bpassword\b/i,
    /\bpassword\b.*\b(?:forgot|reset|change|recover|recovery)\b/i,
  ], 'Patients can select Forgot Password on Login to request an email reset link. After a successful reset, earlier Patient sessions are signed out; Staff, Doctor, and Admin accounts do not use Patient self-service recovery.'),
  entry('appointment_process', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\b(?:how (?:do|can) i |can i )?(?:book|make|request|schedule)\w*\b.*\bappointment\b/i,
    /\bhow (?:do|does) appointments? work\b/i,
  ], 'After signing in as a Patient, open Book Appointment and choose an available published time within the next 14 days. Patient bookings start as Pending and are not instantly confirmed; public Arion Assistant cannot book for you.'),
  entry('reschedule', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\b(?:reschedul|move|change)\w*\b.*\b(?:appointment|schedule|booking|time)\b/i,
    /\bchange (?:my )?schedule\b/i,
  ], 'After signing in, use My Appointments. An eligible Patient-created Pending or Confirmed appointment can be moved while it is not checked in and is at least 60 minutes away; the Doctor, appointment type, and visit reason stay the same, and it returns to Pending.'),
  entry('cancellation', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\bcancel\w*\b.*\bappointment\b/i,
    /\bappointment\b.*\bcancel\w*\b/i,
    /\bhow (?:do|can) i cancel\b/i,
  ], 'After signing in, use My Appointments. A future Pending or Confirmed appointment can be cancelled before check-in, unless completion or an issued Medical Record makes cancellation unavailable.'),
  entry('arrival', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\b(?:arrival|check[ -]?in|i['’]?m at the clinic|i am at the clinic)\b/i], 'Clinic Staff confirms a Patient’s arrival for an eligible appointment on the clinic day. Patients cannot self-check in through Arion Assistant; confirmed arrival allows the appointment to join the active queue.'),
  entry('status_pending', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bpending\b/i], 'Pending means an appointment request is waiting for clinic confirmation. Sign in and open My Appointments to see your own current status.'),
  entry('status_confirmed', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bconfirmed\b/i], 'Confirmed means the clinic accepted the scheduled appointment. Clinic Staff still confirms arrival on the appointment day before the Patient enters the active queue.'),
  entry('status_completed', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bcompleted\b/i], 'Completed means the assigned Doctor finished the consultation workflow. A Patient can sign in to view any available issued information on the appropriate portal page.'),
  entry('status_cancelled', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bcancelled\b/i], 'Cancelled means the appointment is no longer scheduled to take place. Sign in and open My Appointments to review your own details.'),
  entry('status_no_show', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bno[ -]?show\b/i, /\bi missed my appointment\b/i], 'No-show is a Staff-controlled status for an unchecked appointment after its start time and the current 5-minute grace period. Arion Assistant cannot apply this status.'),
  entry('queue', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\b(?:clinic |appointment |waiting )?queue\b/i, /\bwaiting (?:order|line)\b/i, /\bhow does waiting work\b/i, /\b(?:patient|priority) order\b/i, /\b(?:senior\s*\/\s*pwd|urgent|normal) priority\b/i, /\bwho (?:goes|is seen) first\b/i], 'After Staff confirms arrival, the active queue is ordered Urgent first, then Senior/PWD, then Normal. Within the same priority group, earlier check-in comes first; Patients and Arion Assistant cannot change queue priority.'),
  entry('records_and_certificates_location', ASSISTANT_INTENTS.PORTAL_HELP, [/\bwhere can i view (?:medical records and certificates|them) after signing in\b/i], 'After signing in, open My Records for Medical Records and My Certificates for issued certificates. Both areas are read-only for Patients.'),
  entry('medical_records', ASSISTANT_INTENTS.PORTAL_HELP, [/\bmedical records?\b/i, /\bmy records\b/i], 'Medical Records are created through the Doctor’s clinical workflow and are read-only for Patients. After signing in, a Patient can open My Records to view records available to their own account.'),
  entry('certificates', ASSISTANT_INTENTS.PORTAL_HELP, [/\b(?:medical )?certificates?\b/i], 'Medical Certificates are issued through the clinic’s Doctor workflow when available. After signing in, a Patient can open My Certificates to view issued certificates; Arion Assistant cannot issue or change one.'),
  entry('appointment_general_help', ASSISTANT_INTENTS.APPOINTMENT_GENERAL_HELP, [/\bappointments?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bappointments?\b/i, /\btell me about appointments?\b/i], 'I can explain booking, rescheduling, cancellation, appointment statuses, arrival, and the clinic queue. Public Arion Assistant cannot access or change anyone’s appointment.'),
  entry('account_general_help', ASSISTANT_INTENTS.ACCOUNT_GENERAL_HELP, [/\baccount\b.{0,20}\b(?:help|support|guidance|problem)\b/i, /\bhelp(?: me)?\b.{0,20}\b(?:account|login|profile)\b/i], 'I can explain registration, login, email verification, and Patient password recovery. I cannot look up or access an account.'),
  entry('records_general_help', ASSISTANT_INTENTS.RECORDS_GENERAL_HELP, [/\b(?:medical )?records?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\b(?:medical )?records?\b/i, /\btell me about (?:medical )?records?\b/i], 'Medical Records are created through the Doctor’s clinical workflow and can be viewed by the Patient in My Records after signing in. Public Arion Assistant cannot access or interpret them.'),
  entry('certificates_general_help', ASSISTANT_INTENTS.CERTIFICATES_GENERAL_HELP, [/\bcertificates?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bcertificates?\b/i, /\btell me about certificates?\b/i], 'Certificates are issued through the clinic’s Doctor workflow when available and can be viewed in My Certificates after signing in. Arion Assistant cannot issue or change one.'),
  entry('notifications_general_help', ASSISTANT_INTENTS.NOTIFICATIONS_GENERAL_HELP, [/\bnotifications?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bnotifications?\b/i, /\btell me about notifications?\b/i], 'After signing in, Patients can open Notifications to review relevant appointment and clinic workflow updates. Public Arion Assistant cannot access anyone’s notifications.'),
  entry('queue_general_help', ASSISTANT_INTENTS.QUEUE_GENERAL_HELP, [/\bqueue\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bqueue\b/i, /\btell me about (?:the )?queue\b/i], 'I can explain arrival and the clinic queue order: Urgent, then Senior/PWD, then Normal, with earlier check-in first within each group. Staff manages arrival and priority.'),
  entry('scope', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\bwhat can (?:you|arion assistant) do\b/i,
    /\b(?:how|what) can (?:you|arion assistant) help(?: me)?(?: with)?\b/i,
  ], 'Public Arion Assistant can explain registration, login, account recovery, appointment processes and statuses, the queue, Medical Records, and Certificates. It cannot access accounts or Patient data, diagnose or prescribe, or perform appointment or clinical actions.'),
]);

const GENERAL_HELP_IDS = new Set(['appointment_general_help', 'account_general_help', 'records_general_help', 'certificates_general_help', 'notifications_general_help', 'queue_general_help']);

export function findPublicAssistantGeneralKnowledge(message) {
  return PUBLIC_ASSISTANT_KNOWLEDGE_BASE.find(item => GENERAL_HELP_IDS.has(item.id) && item.patterns.some(pattern => pattern.test(message))) ?? null;
}

export function findPublicAssistantKnowledge(message) {
  return PUBLIC_ASSISTANT_KNOWLEDGE_BASE.find(item => !GENERAL_HELP_IDS.has(item.id) && item.patterns.some(pattern => pattern.test(message))) ?? null;
}
