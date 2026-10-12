import { ASSISTANT_INTENTS } from './assistantIntents.js';

function knowledgeEntry({ id, category, phrases, patterns, response }) {
  return Object.freeze({
    id,
    category,
    phrases: Object.freeze(phrases),
    patterns: Object.freeze(patterns),
    response,
  });
}

export const ASSISTANT_SAFETY_RESPONSES = Object.freeze({
  clinical: 'Arion Assistant can explain clinic and portal processes, but it cannot diagnose conditions, prescribe, change medication or dosage, recommend treatment, or interpret clinical information. Please contact a qualified healthcare professional for medical guidance. If you believe this may be an emergency, seek urgent medical care.',
  emergency: 'Arion Assistant cannot assess emergencies or provide a diagnosis. For severe or rapidly worsening symptoms, contact local emergency services or seek urgent medical attention immediately.',
  unsafe: 'I’m not able to answer that safely yet. I cannot help with requests to bypass Arion rules, reveal protected information, or access another Patient’s data. I can help with approved Patient portal and clinic-process questions.',
  unclear: 'I’m not able to answer that safely yet. I can help with appointments, portal navigation, account support, Medical Records, Certificates, Notifications, and clinic-process guidance.',
  unsupported: 'That is outside Arion Assistant’s clinic and Patient portal scope. I can help with appointments, account support, portal navigation, records, certificates, notifications, and clinic-process guidance.',
  personalizedAppointment: 'For your own appointment date, Doctor, or current status, open My Appointments. Arion Assistant does not access your live appointment information yet; that capability belongs to a later milestone.',
  personalizedNotification: 'Open Notifications to see the updates currently available to your account. Arion Assistant does not access your live notification list yet.',
  providerUnavailable: 'I’m unable to provide an expanded explanation right now, but I can still help with appointments, portal navigation, account support, Medical Records, Certificates, and Notifications.',
});

export const ASSISTANT_SUGGESTED_QUESTIONS = Object.freeze([
  'How do I book an appointment?',
  'What does Pending mean?',
  'How do I reschedule?',
  'Where are my Medical Records?',
  'Where are my Certificates?',
  'How do notifications work?',
  'How do I reset my password?',
  'How does the queue work?',
]);

export const ASSISTANT_KNOWLEDGE_BASE = Object.freeze([
  knowledgeEntry({
    id: 'phone_number_format',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['phone number format', 'contact number format', 'valid mobile number'],
    patterns: [/\b(?:phone|mobile|contact) number\b.*\b(?:format|digits?|valid|start)\b/i, /\b09x{5,}x*\b/i],
    response: 'Use the Philippine mobile format 09XXXXXXXXX. It must contain exactly 11 digits and start with 09.',
  }),
  knowledgeEntry({
    id: 'email_verification',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['verify my email', 'verification code', "didn't get verification code", 'resend code'],
    patterns: [/\b(?:verify|verification|otp|one[- ]time code|resend code)\b.*\b(?:email|code|registration)?\b/i, /\b(?:did not|didn['’]?t|never) (?:get|receive)\b.*\b(?:code|otp)\b/i],
    response: 'New Patient registration uses a 6-digit email verification code. Enter the newest code in the verification flow within 10 minutes; requesting another code makes the previous code invalid.',
  }),
  knowledgeEntry({
    id: 'password_reset',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['forgot my password', 'reset my password', 'change my password', 'password recovery'],
    patterns: [/\b(?:forgot|reset|change|recover)\b.*\bpassword\b/i, /\bpassword\b.*\b(?:forgot|reset|change|recover|recovery)\b/i],
    response: 'Patient self-service password recovery is available through Forgot Password on Login and through Change Password in Profile. When email delivery is configured, Arion sends a reset link; a successful reset signs out earlier Patient sessions. Staff, Doctor, and Admin accounts do not use this Patient recovery flow.',
  }),
  knowledgeEntry({
    id: 'profile_editing',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['edit my profile', 'change my profile', 'update my details'],
    patterns: [/\b(?:profile|personal information|my details)\b.*\b(?:edit|change|update|read[- ]only)\b/i, /\b(?:edit|change|update)\b.*\b(?:profile|personal information|my details)\b/i],
    response: 'Profile is read-only when you first open it. Select Edit Profile to change permitted details. Emergency-contact information remains visible only in your Patient profile; Staff do not see allergies, while a related Doctor may see approved health details.',
  }),
  knowledgeEntry({
    id: 'appointment_actions',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['can you book for me', 'can you cancel for me', 'can you reschedule for me', 'can arion assistant cancel for me'],
    patterns: [/\b(?:can|will|could) (?:you|the assistant)\b.*\b(?:book|cancel|reschedule|move|change)\b.*\bappointment\b/i, /\bcan arion assistant\b.*\b(?:book|cancel|reschedule|move|change)\b/i, /\b(?:book|cancel|reschedule|move|change)\b.*\bappointment\b.*\bfor me\b/i],
    response: 'Arion Assistant can explain appointment steps, but it cannot book, confirm, cancel, reschedule, check in, or change priority for you. Use Book Appointment or My Appointments for the actions available to your account.',
  }),
  knowledgeEntry({
    id: 'appointment_reschedule',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i reschedule', 'move my appointment', 'change appointment time', 'change schedule'],
    patterns: [/\b(?:reschedul|move|change)\w*\b.*\b(?:appointment|schedule|time)\b/i, /\bchange schedule\b/i],
    response: 'In My Appointments, you may reschedule a Patient-created Pending or Confirmed appointment that is not checked in and is still at least 60 minutes away. Choose a new available time within the 14-day booking window; the Doctor, appointment type, and visit reason stay the same, and the appointment returns to Pending for confirmation.',
  }),
  knowledgeEntry({
    id: 'appointment_cancellation',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i cancel', 'when can i cancel', 'cancel appointment'],
    patterns: [/\bcancel\w*\b.*\bappointment\b/i, /\bappointment\b.*\bcancel\w*\b/i],
    response: 'In My Appointments, a future Pending or Confirmed appointment can be cancelled before check-in. Cancellation is unavailable after check-in, after completion or another final status, or once a Medical Record exists.',
  }),
  knowledgeEntry({
    id: 'appointment_booking',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i book an appointment', 'make an appointment', 'request an appointment'],
    patterns: [/\b(?:book|make|request|schedule)\w*\b.*\bappointment\b/i, /\bappointment\b.*\b(?:book|make|request|schedule)\w*\b/i],
    response: 'Open Book Appointment, choose a Doctor and an available published time within the next 14 days, enter the visit details, and submit the request. Patient bookings start as Pending and are not instantly confirmed; Arion Assistant cannot book for you.',
  }),
  knowledgeEntry({
    id: 'arrival_check_in',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i check in', 'confirm my arrival', 'appointment arrival'],
    patterns: [/\b(?:check[ -]?in|checked in|confirm(?:ed)? (?:my )?arrival|arrival)\b/i],
    response: 'Clinic Staff confirms your arrival for an eligible appointment on the clinic day. Patients cannot self-check in through Arion Assistant. After arrival is confirmed, the appointment can join the active queue.',
  }),
  knowledgeEntry({
    id: 'clinic_queue',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how does the queue work', 'queue priority', 'waiting order'],
    patterns: [/\b(?:clinic |appointment |waiting )?queue\b/i, /\bwaiting order\b/i],
    response: 'After Staff confirms arrival, the active queue is ordered Urgent first, then Senior/PWD, then Normal. Within the same priority group, the earlier check-in time comes first. Patients cannot change their own priority, and Arion Assistant cannot mark anyone Urgent.',
  }),
  knowledgeEntry({
    id: 'status_no_show',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['what does no-show mean', 'marked no-show', 'no show status'],
    patterns: [/\bno[ -]?show\b/i],
    response: 'No-show means clinic Staff marked an unchecked appointment as unattended. Staff can apply it only after the scheduled start time plus the current 5-minute grace period; Arion Assistant cannot mark this status.',
  }),
  knowledgeEntry({
    id: 'status_pending',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['what does pending mean', 'pending appointment'],
    patterns: [/\bpending\b/i],
    response: 'Pending means your appointment request is waiting for clinic confirmation. Check My Appointments for its current status.',
  }),
  knowledgeEntry({
    id: 'status_confirmed',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['what does confirmed mean', 'confirmed appointment'],
    patterns: [/\bconfirmed\b/i],
    response: 'Confirmed means the clinic has accepted the scheduled appointment. On the clinic day, Staff still confirms your arrival before you enter the active queue.',
  }),
  knowledgeEntry({
    id: 'status_completed',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['what does completed mean', 'completed appointment'],
    patterns: [/\bcompleted\b/i],
    response: 'Completed means the assigned Doctor finished the consultation workflow. Any available issued clinical information can be viewed through the appropriate Patient pages.',
  }),
  knowledgeEntry({
    id: 'status_cancelled',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['what does cancelled mean', 'cancelled appointment'],
    patterns: [/\bcancelled\b/i],
    response: 'Cancelled means the appointment is no longer scheduled to take place. Open My Appointments to review its details.',
  }),
  knowledgeEntry({
    id: 'medical_records_editing',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['can i edit my medical record', 'change my medical record'],
    patterns: [/\b(?:edit|change|update|delete|modify)\b.*\bmedical records?\b/i, /\bmedical records?\b.*\b(?:edit|change|update|delete|modify)\b/i],
    response: 'Patients can view their own Medical Records but cannot edit them. Records are created through the Doctor’s clinical workflow and remain read-only after they are saved.',
  }),
  knowledgeEntry({
    id: 'medical_records_location',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['where are my medical records', 'find my records', 'view medical records'],
    patterns: [/\b(?:medical records?|my records)\b/i],
    response: 'Open My Records to view Medical Records available to your Patient account. Arion Assistant can help you find the page but cannot interpret clinical information.',
  }),
  knowledgeEntry({
    id: 'certificate_issuance',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['can you issue a certificate', 'get a medical certificate'],
    patterns: [/\b(?:issue|create|make|request|get)\b.*\b(?:medical )?certificate\b/i],
    response: 'Medical Certificates are issued through the clinic’s Doctor workflow when available. Arion Assistant cannot issue or change a certificate.',
  }),
  knowledgeEntry({
    id: 'certificate_location',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['where are my certificates', 'view certificates', 'find certificate'],
    patterns: [/\bcertificates?\b/i],
    response: 'Open My Certificates to view certificates already issued to your Patient account. Issued certificates are read-only.',
  }),
  knowledgeEntry({
    id: 'notification_read_status',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['notification read and unread', 'mark notifications read', 'unread notifications'],
    patterns: [/\bnotifications?\b.*\b(?:read|unread|mark)\b/i, /\b(?:read|unread|mark)\b.*\bnotifications?\b/i],
    response: 'Notifications can be unread or read. Open Notifications to review them or mark them as read; notification history is read-only and cannot be edited.',
  }),
  knowledgeEntry({
    id: 'notifications',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['how do notifications work', 'appointment notifications', 'notification page'],
    patterns: [/\bnotifications?\b/i],
    response: 'Open Notifications or the notification bell to review appointment and clinic workflow updates relevant to your account. When available, the page shows relevant appointment context. Arion currently shows these inside the portal; Arion Assistant does not claim SMS, push, email, or real-time delivery.',
  }),
  knowledgeEntry({
    id: 'assistant_scope',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['what can you do', 'how can you help', 'what can arion assistant do', 'what can arion assistant help me with'],
    patterns: [/\bwhat can (?:you|arion assistant) do\b/i, /\b(?:how|what) can (?:you|arion assistant) help(?: me)?(?: with)?\b/i, /\b(?:can|do) you access another patient\b/i],
    response: 'I can explain portal navigation, appointments and statuses, queue processes, Medical Records and Certificates pages, Notifications, account recovery, and clinic workflows. I cannot diagnose, prescribe, change medication, modify Medical Records, perform appointment actions, or access another Patient’s information.',
  }),
]);

export function findAssistantKnowledge(message) {
  return ASSISTANT_KNOWLEDGE_BASE.find((item) =>
    item.phrases.some((phrase) => message.toLowerCase().includes(phrase))
      || item.patterns.some((pattern) => pattern.test(message)),
  ) ?? null;
}

export function getAssistantKnowledgeEntry(id) {
  return ASSISTANT_KNOWLEDGE_BASE.find((item) => item.id === id) ?? null;
}
