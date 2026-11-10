import { ASSISTANT_INTENTS } from './assistantIntents.js';

function entry(id, category, patterns, response) {
  return Object.freeze({ id, category, patterns: Object.freeze(patterns), response });
}

export const PUBLIC_ASSISTANT_SAFETY_RESPONSES = Object.freeze({
  emergency: 'Arion Assistant cannot assess emergencies or provide a diagnosis. For severe or rapidly worsening symptoms, contact local emergency services or seek urgent medical attention immediately.',
  clinical: 'Arion Assistant can explain clinic and portal processes, but it cannot diagnose, prescribe, change medication or dosage, recommend treatment, or interpret clinical information. Please contact a qualified healthcare professional for medical guidance. If you believe this may be an emergency, seek urgent medical care.',
  emergencyFilipino: 'Hindi kayang suriin ng Arion Assistant ang emergency o magbigay ng diagnosis. Kung malubha o mabilis lumalala ang kondisyon, tumawag sa local emergency services o pumunta agad sa pinakamalapit na emergency facility.',
  clinicalFilipino: 'Makakapagpaliwanag ang Arion Assistant tungkol sa clinic at portal, pero hindi ito makakapag-diagnose, magrereseta, magpapalit ng dose, o magbibigay ng treatment advice. Kumonsulta sa qualified healthcare professional. Kung emergency ito, humingi agad ng emergency medical help.',
  unsafe: 'I cannot bypass Arion security, reveal protected information, or access Patient data. I can help with public clinic and portal-process questions.',
  personalAppointment: 'Please sign in to the Patient Portal and open My Appointments to see your own appointment date, Doctor, or current status. Public Arion Assistant cannot access Patient accounts or appointment data.',
  personalNotification: 'Please sign in to the Patient Portal and open Notifications to see updates for your account. Public Arion Assistant cannot access Patient notifications.',
  personalRecord: 'Please sign in to the Patient Portal and open My Records or My Certificates to view information issued to your account. Public Arion Assistant cannot access Patient records or certificates.',
  personalAccount: 'I can explain the public account process, but I cannot check whether an account, email address, or phone number exists. Use Login, Register, Email Verification, or Forgot Password as appropriate.',
  greeting: 'Hi! I can help with registration, login, appointments, clinic queue information, Medical Records, Certificates, and general portal guidance. What do you need help with?',
  thanks: 'You’re welcome! Let me know if you need help with another Arion clinic or portal question.',
  acknowledgement: 'Got it. What would you like help with next?',
  helpRequest: 'Of course. Do you need help with registration, login, appointments, Records, Certificates, or clinic information?',
  frustration: 'I understand why that feels frustrating. I can help with registration, login, appointments, clinic directions, or portal information. Which one do you need?',
  clarification: 'I didn’t quite understand that. Are you asking about registration, login, booking an appointment, appointment status, Records, or Certificates?',
  topicConflict: 'I found more than one possible request. Do you want to book a new appointment, reschedule one, cancel one, or learn about appointment status?',
  bookingClarification: 'Would you like to learn how to book a new appointment?',
  rescheduleClarification: 'Are you asking how to reschedule an existing appointment?',
  cancellationClarification: 'Are you asking how to cancel an existing appointment?',
  statusClarification: 'Are you asking what an appointment status means or trying to see your own status? Sign in for personal status information.',
  queueClarification: 'Are you asking about clinic arrival, check-in, or queue order?',
  accountClarification: 'Do you need help with registration, login, email verification, or password recovery?',
  recordsClarification: 'Are you asking where Patients can view Medical Records?',
  certificatesClarification: 'Are you asking where Patients can view Medical Certificates?',
  notificationsClarification: 'Are you asking how portal Notifications work?',
  portalClarification: 'Do you need help understanding or navigating the Arion Health Portal?',
  contextRejected: 'No problem. What would you like help with instead—registration, login, appointments, Records, or Certificates?',
  unsupported: 'I can help with registration, login, email verification, password recovery, appointment processes and statuses, the clinic queue, Medical Records and Certificates, and Arion Assistant’s public scope.',
});

export const PUBLIC_ASSISTANT_KNOWLEDGE_BASE = Object.freeze([
  entry('registration', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:how (?:do|can) i |can i |where (?:do|can) i )?(?:register|sign up|create (?:an? )?account)\b/i,
  ], 'Select Register, enter the requested Patient details, and submit the form. New Patient accounts must complete email verification before signing in.'),
  entry('registration_password', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:registration|register|sign up|create (?:an? )?account)\b.*\bpassword\b/i,
    /\bpassword\b.*\b(?:registration|register|sign up|create (?:an? )?account)\b/i,
  ], 'Registration requires a password and a matching confirmation password. After submitting the form, complete email verification before signing in.'),
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
  ], 'Select Forgot Password on Login to request an email reset link. After a successful reset, earlier Patient sessions are signed out. Never share a password or verification code in chat.'),
  entry('profile_editing', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:edit|update|change)\b.*\bprofile\b/i,
    /\bprofile\b.*\b(?:edit|update|change)\b/i,
  ], 'After signing in, open My Profile and select Edit Profile. Change the permitted personal details or allergies, then select Save Changes. The account email cannot be changed there.'),
  entry('emergency_contact_editing', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\bemergency contact\b/i,
  ], 'Sign in, open My Profile, and select Edit Profile. You can update the emergency contact name, contact number, and relationship, then save your changes.'),
  entry('allergy_profile_update', ASSISTANT_INTENTS.ACCOUNT_HELP, [
    /\b(?:add|update|change|edit|record)\b.*\ballerg(?:y|ies)\b/i,
    /\ballerg(?:y|ies)\b.*\b(?:profile|add|update|change|edit|record)\b/i,
  ], 'Sign in, open My Profile, and select Edit Profile. Add or change the Allergies field, separate multiple allergies with commas or new lines, then select Save Changes.'),
  entry('clinic_contact_location', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:clinic )?(?:location|address|directions?)\b/i,
    /\b(?:where|saan|nasan)\b.*\b(?:clinic|arion)\b/i,
    /\b(?:contact|call|phone)\b.*\b(?:clinic|them|arion)\b/i,
    /\b(?:contact info|contact information|who can i call|number to call|clinic number)\b/i,
    /\b(?:puntahan|pupunta)\b/i,
  ], 'Arion Medical Surgical Clinic is at 20 Indonesia Street, corner France Street, Better Living Subdivision, Parañaque City, 1700 Metro Manila. Call (02) 8821 0577. The landing page also provides the clinic map and Get Directions button.'),
  entry('clinic_hours', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:clinic|arion)\b.*\b(?:hours|open|opening|close|closing|time|schedule)\b/i,
    /\b(?:kailan|kelan|anong oras)\b.*\b(?:clinic|bukas|open)\b/i,
  ], 'The website does not publish a guaranteed weekly clinic opening schedule. Doctor booking times can also differ from general clinic hours. Call (02) 8821 0577 for current clinic hours. Sign in and open Book Appointment for Doctor booking times.'),
  entry('doctor_directory_services', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:doctor|doctors)\b.*\b(?:service|services|specialty|specialties)\b/i,
    /\b(?:list|show|tell)\b.*\b(?:doctor|doctors)\b/i,
  ], 'Sign in and open Book Appointment to see active Doctors, their specialties, and published booking times. The available visit types are General Consultation, Follow-up, and Check-up. Public Arion Assistant cannot confirm that a Doctor is physically at the clinic.'),
  entry('doctor_booking_times', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\b(?:doctor|doc)\b.*\b(?:available|availability|bookable)\b.*\b(?:date|day|today|tomorrow|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  ], 'Sign in first, then open Book Appointment to see each Doctor’s currently published and bookable dates and times within the next 14 days. Public Arion Assistant cannot view or reserve a specific slot for you.'),
  entry('doctor_presence', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:doctor|doc)\b.*\b(?:already )?(?:here|at (?:the )?clinic|arrived|present)\b/i,
  ], 'Public Arion Assistant cannot detect whether a Doctor is physically at the clinic. Call (02) 8821 0577 for current arrival information. Sign in and open My Appointments to review your scheduled Doctor and time.'),
  entry('sms_reminders', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:sms|text message|text me|text reminder|phone reminder)\b/i,
    /\b(?:will|do|can) (?:they|arion|the clinic)\b.*\btext\b/i,
  ], 'When the clinic SMS service is enabled and a Patient profile has a valid mobile number, Arion can send appointment booking, reschedule, cancellation, and timed reminder texts. SMS delivery is not guaranteed, so Patients should also check My Appointments and Notifications after signing in.'),
  entry('sms_delivery_reason', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\bwhy\b.*\b(?:sms|text)\b.*\b(?:not guaranteed|fail|delayed|late|missing|not delivered)\b/i,
    /\b(?:sms|text)\b.*\b(?:not guaranteed|fail|delayed|late|missing|not delivered)\b/i,
  ], 'SMS can be delayed or fail because delivery depends on the mobile network and messaging provider. My Appointments and Notifications remain the reliable places to check current portal information.'),
  entry('appointment_process', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\b(?:how (?:do|can) i |can i )?(?:book|make|request|schedule)\w*\b.*\bappointment\b/i,
    /\bhow (?:do|does) appointments? work\b/i,
  ], 'After signing in as a Patient, open Book Appointment and choose an available published time within the next 14 days. Patient bookings start as Pending and are not instantly confirmed; public Arion Assistant cannot book for you.'),
  entry('appointment_actions', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\b(?:can|will|could) (?:you|the assistant)\b.*\b(?:book|cancel|reschedule|move|change)\b/i,
    /\b(?:book|appoint|schedule|reserve|set)\b.*\b(?:me|for me|my)\b/i,
  ], 'Public Arion Assistant cannot book or change an appointment for you. Sign in and use Book Appointment for a new request, or My Appointments for actions available on an existing appointment.'),
  entry('reschedule', ASSISTANT_INTENTS.APPOINTMENT_HELP, [
    /\b(?:reschedul|move|change)\w*\b.*\b(?:appointment|schedule|booking|time)\b/i,
    /\bhow (?:do|can) i reschedul\w*\b/i,
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
  entry('record_search_help', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:show|find|search|view)\b.*\b(?:record|records)\b.*\b(?:last|recent|latest|date)\b/i,
    /\b(?:record|records)\b.*\b(?:last|recent|latest|date)\b/i,
  ], 'Sign in and open My Records to review available Medical Records and their dates. Public Arion Assistant cannot search, filter, or display an individual Medical Record inside the chat.'),
  entry('prescription_access', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:my |the )?prescription\b/i,
    /\b(?:where|find|view|open|download|save)\b.*\bprescription\b/i,
  ], 'Sign in and open My Records, then select the related Medical Record and review its Prescriptions section. If the Doctor attached a prescription file, use its secure View or Download action. Arion Assistant cannot read, interpret, or change a prescription.'),
  entry('certificates', ASSISTANT_INTENTS.PORTAL_HELP, [/\b(?:medical )?certificates?\b/i], 'Medical Certificates are issued through the clinic’s Doctor workflow when available. After signing in, a Patient can open My Certificates to view issued certificates; Arion Assistant cannot issue or change one.'),
  entry('certificate_download', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:download|save|open|view)\b.*\b(?:medical )?certificate\b/i,
    /\b(?:medical )?certificate\b.*\b(?:download|save|open|view|pdf)\b/i,
  ], 'After signing in, open My Certificates. Active and legacy certificates can be opened and downloaded as secure PDFs. Expired certificates remain as archived details, but their PDFs cannot be opened or downloaded through the Patient portal.'),
  entry('expired_certificate_download', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\bexpired\b.*\bcertificate\b.*\b(?:download|open|view|save)\b/i,
  ], 'After signing in, open My Certificates to review the archived information. An expired certificate PDF cannot be opened or downloaded through the Patient portal.'),
  entry('certificate_validity', ASSISTANT_INTENTS.PORTAL_HELP, [
    /\b(?:certificate|cert)\b.*\b(?:expir(?:e|ed|es|ation|y)|valid(?:ity)?|valid until)\b/i,
    /\b(?:expir(?:e|ed|es|ation|y)|valid until)\b.*\b(?:certificate|cert)\b/i,
  ], 'A newly issued certificate has a Valid Until date. It is Active through that date and becomes Expired afterward. Expired certificate details remain archived, but the PDF cannot be opened or downloaded through the Patient portal. A Legacy certificate has no recorded validity date.'),
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

export function getPublicAssistantKnowledgeEntry(id) {
  return PUBLIC_ASSISTANT_KNOWLEDGE_BASE.find(item => item.id === id) ?? null;
}
