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
    /\b(?:did not|didn['’]?t|never) (?:get|receive)\b.*\b(?:code|otp)\b/i,
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
    /\b(?:reschedul|move|change)\w*\b.*\b(?:appointment|schedule|time)\b/i,
  ], 'After signing in, use My Appointments. An eligible Patient-created Pending or Confirmed appointment can be moved while it is not checked in and is at least 60 minutes away; the Doctor, appointment type, and visit reason stay the same, and it returns to Pending.'),
  entry('cancellation', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\bcancel\w*\b.*\bappointment\b/i,
    /\bappointment\b.*\bcancel\w*\b/i,
  ], 'After signing in, use My Appointments. A future Pending or Confirmed appointment can be cancelled before check-in, unless completion or an issued Medical Record makes cancellation unavailable.'),
  entry('status_pending', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bpending\b/i], 'Pending means an appointment request is waiting for clinic confirmation. Sign in and open My Appointments to see your own current status.'),
  entry('status_confirmed', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bconfirmed\b/i], 'Confirmed means the clinic accepted the scheduled appointment. Clinic Staff still confirms arrival on the appointment day before the Patient enters the active queue.'),
  entry('status_completed', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bcompleted\b/i], 'Completed means the assigned Doctor finished the consultation workflow. A Patient can sign in to view any available issued information on the appropriate portal page.'),
  entry('status_cancelled', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bcancelled\b/i], 'Cancelled means the appointment is no longer scheduled to take place. Sign in and open My Appointments to review your own details.'),
  entry('status_no_show', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\bno[ -]?show\b/i], 'No-show is a Staff-controlled status for an unchecked appointment after its start time and the current 5-minute grace period. Arion Assistant cannot apply this status.'),
  entry('queue', ASSISTANT_INTENTS.APPOINTMENT_HELP, [/\b(?:clinic |appointment |waiting )?queue\b/i, /\bwaiting order\b/i], 'After Staff confirms arrival, the active queue is ordered Urgent first, then Senior/PWD, then Normal. Within the same priority group, earlier check-in comes first; Patients and Arion Assistant cannot change queue priority.'),
  entry('medical_records', ASSISTANT_INTENTS.PORTAL_HELP, [/\bmedical records?\b/i, /\bmy records\b/i], 'Medical Records are created through the Doctor’s clinical workflow and are read-only for Patients. After signing in, a Patient can open My Records to view records available to their own account.'),
  entry('certificates', ASSISTANT_INTENTS.PORTAL_HELP, [/\b(?:medical )?certificates?\b/i], 'Medical Certificates are issued through the clinic’s Doctor workflow when available. After signing in, a Patient can open My Certificates to view issued certificates; Arion Assistant cannot issue or change one.'),
  entry('scope', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\bwhat can (?:you|arion assistant) do\b/i,
    /\b(?:how|what) can (?:you|arion assistant) help(?: me)?(?: with)?\b/i,
  ], 'Public Arion Assistant can explain registration, login, account recovery, appointment processes and statuses, the queue, Medical Records, and Certificates. It cannot access accounts or Patient data, diagnose or prescribe, or perform appointment or clinical actions.'),
]);

export function findPublicAssistantKnowledge(message) {
  return PUBLIC_ASSISTANT_KNOWLEDGE_BASE.find(item => item.patterns.some(pattern => pattern.test(message))) ?? null;
}
