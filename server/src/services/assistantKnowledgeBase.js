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
  clinicalFilipino: 'Makakapagpaliwanag ang Arion Assistant tungkol sa clinic at portal, pero hindi ito makakapag-diagnose, magrereseta, magpapalit ng dose, o magbibigay ng treatment advice. Kumonsulta sa qualified healthcare professional. Kung emergency ito, humingi agad ng emergency medical help.',
  emergencyFilipino: 'Hindi kayang suriin ng Arion Assistant ang emergency o magbigay ng diagnosis. Kung malubha o mabilis lumalala ang kondisyon, tumawag sa local emergency services o pumunta agad sa pinakamalapit na emergency facility.',
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
    id: 'registration_password',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['does registration need a password', 'password for registration', 'create account password'],
    patterns: [/\b(?:register|registration|create (?:an? )?account)\b.*\bpassword\b/i, /\bpassword\b.*\b(?:register|registration|create (?:an? )?account)\b/i],
    response: 'Yes. Patient registration requires a password and matching confirmation password. After registration, complete email verification before signing in. Never share your password or verification code in chat.',
  }),
  knowledgeEntry({
    id: 'phone_number_format',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['phone number format', 'contact number format', 'valid mobile number'],
    patterns: [/\b(?:phone|mobile|contact) number\b.*\b(?:format|digits?|valid|use|enter|start)\b/i, /\bwhat (?:phone|mobile|contact) number should i use\b/i, /\b09x{5,}x*\b/i],
    response: 'Use the Philippine mobile format 09XXXXXXXXX. It must contain exactly 11 digits and start with 09.',
  }),
  knowledgeEntry({
    id: 'email_verification',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['verify my email', 'verification code', "didn't get verification code", 'resend code'],
    patterns: [/\b(?:verify|verification|otp|one[- ]time code|resend code)\b.*\b(?:email|code|registration)?\b/i, /\b(?:did not|didn['’]?t|never|haven['’]?t) (?:get|receive|received)\b.*\b(?:code|otp)\b/i],
    response: 'New Patient registration uses a 6-digit email verification code. Enter the newest code in the verification flow within 10 minutes; requesting another code makes the previous code invalid.',
  }),
  knowledgeEntry({
    id: 'password_reset',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['forgot my password', 'reset my password', 'change my password', 'password recovery'],
    patterns: [/\b(?:forgot|reset|change|recover)\b.*\bpassword\b/i, /\bpassword\b.*\b(?:forgot|reset|change|recover|recovery)\b/i, /\b(?:palitan|i-?reset|resetin|irereset)\b.*\b(?:password|pass)\b/i, /\b(?:palitan|i-?reset|resetin|irereset)\b.*\bko\b/i, /\b(?:change|forgot|reset)\b.*\bpass\b/i],
    response: 'To reset your Patient password, select Forgot Password on Login. If you are already signed in, open Profile and select Change Password. Arion sends the reset link to your registered email when email delivery is available. A successful reset signs out earlier Patient sessions.',
  }),
  knowledgeEntry({
    id: 'profile_editing',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['edit my profile', 'change my profile', 'update my details'],
    patterns: [/\b(?:profile|personal information|my details)\b.*\b(?:edit|change|update|read[- ]only)\b/i, /\b(?:edit|change|update)\b.*\b(?:profile|personal information|my details)\b/i, /\bprofile help\b/i],
    response: 'My Profile opens in read-only mode. Select Edit Profile, change permitted personal details such as your full name or update allergies, then select Save Changes. Your account email cannot be changed there.',
  }),
  knowledgeEntry({
    id: 'emergency_contact_editing',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['change emergency contact', 'edit emergency contact number'],
    patterns: [/\bemergency contact\b/i],
    response: 'Open My Profile and select Edit Profile. You can update the emergency contact name, contact number, and relationship, then select Save Changes. Arion Assistant cannot edit the profile for you.',
  }),
  knowledgeEntry({
    id: 'allergy_profile_update',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['add allergies', 'update allergies', 'change my allergies'],
    patterns: [/\b(?:add|update|change|edit|record)\b.*\ballerg(?:y|ies)\b/i, /\ballerg(?:y|ies)\b.*\b(?:profile|add|update|change|edit|record)\b/i],
    response: 'Open My Profile and select Edit Profile. Add or change the Allergies field, separate multiple allergies with commas or new lines, then select Save Changes. Your related Doctor can see the updated allergy information.',
  }),
  knowledgeEntry({
    id: 'email_delivery_help',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['will they email me', 'send me an email', 'email ba'],
    patterns: [/\b(?:will|do|can) (?:they|arion|the clinic)\b.*\bemail\b/i, /\b(?:send|receive|get)\b.*\bemail\b/i, /\bmag\s*e?email\b/i, /\bemail\b.*\b(?:ba|send|receive|get)\b/i],
    response: 'Arion uses your registered email for account verification, password-reset links, and supported appointment updates. Delivery can sometimes be delayed or fail, so also check the portal and your spam folder. Never share a verification code or reset link.',
  }),
  knowledgeEntry({
    id: 'sms_reminders',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['will they text me', 'sms reminder', 'text reminder'],
    patterns: [/\b(?:sms|text message|text me|text reminder|phone reminder)\b/i, /\b(?:will|do|can) (?:they|arion|the clinic)\b.*\btext\b/i],
    response: 'When the clinic SMS service is enabled and your Patient profile has a valid mobile number, Arion can send appointment booking, reschedule, cancellation, and timed reminder texts. SMS delivery is not guaranteed, so check My Appointments and Notifications for the current information.',
  }),
  knowledgeEntry({
    id: 'sms_delivery_reason',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['why is sms not guaranteed', 'why did the text not arrive'],
    patterns: [/\bwhy\b.*\b(?:sms|text)\b.*\b(?:not )?(?:guaranteed|arrive|delivered?)\b/i, /\b(?:sms|text)\b.*\b(?:delayed|failed|not arrive|not delivered)\b/i],
    response: 'SMS delivery can be delayed or fail because it depends on the configured clinic service, the saved mobile number, and the mobile network. Check My Appointments and Notifications for the current portal information.',
  }),
  knowledgeEntry({
    id: 'clinic_contact_location',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['clinic location', 'clinic address', 'contact the clinic', 'get directions'],
    patterns: [/\b(?:clinic )?(?:location|address|directions?)\b/i, /\b(?:where|saan|nasan)\b.*\b(?:clinic|arion)\b/i, /\b(?:contact|call|phone)\b.*\b(?:clinic|them|arion)\b/i, /\b(?:contact info|contact information|who can i call|number to call|clinic number)\b/i, /\b(?:puntahan|pupunta)\b/i],
    response: 'Arion Medical Surgical Clinic is at 20 Indonesia Street, corner France Street, Better Living Subdivision, Parañaque City, 1700 Metro Manila. Call (02) 8821 0577. The landing page also has the clinic map and Get Directions button.',
  }),
  knowledgeEntry({
    id: 'clinic_hours',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['clinic opening hours', 'what time is the clinic open', 'clinic schedule every week'],
    patterns: [/\b(?:clinic|arion)\b.*\b(?:hours|open|opening|close|closing|time|schedule)\b/i, /\b(?:kailan|kelan|anong oras)\b.*\b(?:clinic|bukas|open)\b/i],
    response: 'The portal does not publish a guaranteed weekly clinic opening schedule. Doctor booking times can also differ from general clinic hours. For current clinic hours, call (02) 8821 0577. For Doctor booking times, open Book Appointment.',
  }),
  knowledgeEntry({
    id: 'doctor_directory_services',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['show doctors and services', 'doctor specialties', 'what doctors are available'],
    patterns: [/\b(?:doctor|doctors)\b.*\b(?:service|services|specialty|specialties)\b/i, /\b(?:list|show|tell)\b.*\b(?:doctor|doctors)\b/i],
    response: 'Open Book Appointment to see the active Doctors, their specialties, and their published booking times. The available visit types are General Consultation, Follow-up, and Check-up. Arion Assistant cannot confirm that a Doctor is physically at the clinic.',
  }),
  knowledgeEntry({
    id: 'doctor_booking_times',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['doctor available this date', 'doctor available next week', 'bookable doctor times'],
    patterns: [/\b(?:doctor|doc)\b.*\b(?:available|availability|bookable)\b.*\b(?:date|day|today|tomorrow|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i],
    response: 'Open Book Appointment to see each Doctor’s currently published and bookable appointment times. The page shows availability within the next 14 days. Arion Assistant cannot guarantee a time until you select an open slot and submit the request.',
  }),
  knowledgeEntry({
    id: 'doctor_presence',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['is the doctor here', 'doctor already at clinic', 'has my doctor arrived'],
    patterns: [/\b(?:doctor|doc)\b.*\b(?:already )?(?:here|at (?:the )?clinic|arrived|present)\b/i],
    response: 'Arion Assistant cannot detect whether a Doctor is physically at the clinic. On your appointment day, ask clinic Staff or call (02) 8821 0577 for current arrival information. Open My Appointments to review your scheduled Doctor and time.',
  }),
  knowledgeEntry({
    id: 'logout_help',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['log out', 'logout', 'sign out'],
    patterns: [/\b(?:log ?out|sign ?out)\b/i],
    response: 'Select Log out from the portal navigation menu. This ends your current portal session on this device.',
  }),
  knowledgeEntry({
    id: 'account_deletion',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['delete my account', 'remove my account'],
    patterns: [/\b(?:delete|remove|close)\b.*\b(?:my )?(?:account|acc)\b/i, /\b(?:account|acc)\b.*\b(?:delete|remove|close)\b/i],
    response: 'The Patient portal does not provide self-service account deletion. Contact the clinic for account assistance. Do not send your password or verification code through chat.',
  }),
  knowledgeEntry({
    id: 'pwd_rejected',
    category: ASSISTANT_INTENTS.ACCOUNT_HELP,
    phrases: ['pwd rejected', 'pwd verification rejected'],
    patterns: [/\bpwd\b.*\b(?:reject|rejected|denied|failed)\b/i, /\b(?:reject|rejected|denied|failed)\b.*\bpwd\b/i],
    response: 'Open Profile and review the PWD Verification section for the rejection reason. You may submit clear front and back images of the PWD ID again. The name printed on the ID must match the name on your Patient profile.',
  }),
  knowledgeEntry({
    id: 'appointment_actions',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['can you book for me', 'can you cancel for me', 'can you reschedule for me', 'can arion assistant cancel for me'],
    patterns: [/\b(?:can|will|could) (?:you|the assistant)\b.*\b(?:book|cancel|reschedule|move|change)\b.*\bappointment\b/i, /\bcan arion assistant\b.*\b(?:book|cancel|reschedule|move|change)\b/i, /\b(?:book|cancel|reschedule|move|change)\b.*\bappointment\b.*\bfor me\b/i],
    response: 'Arion Assistant can explain appointment steps, but it cannot book, confirm, cancel, reschedule, check in, or change priority for you. Use Book Appointment or My Appointments for the actions available to your account.',
  }),
  knowledgeEntry({
    id: 'appointment_history_location',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['past appointments', 'previous appointment', 'appointment last november'],
    patterns: [/\b(?:past|previous|last)\b.*\bappointments?\b/i, /\bappointments?\b.*\b(?:history|past|previous|last)\b/i],
    response: 'Open My Appointments to review your appointment history and statuses. Arion Assistant can show approved upcoming appointment details, but it does not search or display past appointments inside the chat.',
  }),
  knowledgeEntry({
    id: 'appointment_reschedule',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i reschedule', 'move my appointment', 'change appointment time', 'change schedule'],
    patterns: [/\b(?:reschedul|move|change)\w*\b.*\b(?:appointment|schedule|booking|time)\b/i, /\bchange (?:my )?schedule\b/i, /\b(?:different|another) appointment time\b/i],
    response: 'In My Appointments, you may reschedule a Patient-created Pending or Confirmed appointment that is not checked in and is still at least 60 minutes away. Choose a new available time within the 14-day booking window; the Doctor, appointment type, and visit reason stay the same, and the appointment returns to Pending for confirmation.',
  }),
  knowledgeEntry({
    id: 'appointment_cancellation',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i cancel', 'when can i cancel', 'cancel appointment'],
    patterns: [/\bcancel\w*\b.*\bappointment\b/i, /\bappointment\b.*\bcancel\w*\b/i, /\bhow (?:do|can) i cancel\b/i],
    response: 'In My Appointments, a future Pending or Confirmed appointment can be cancelled before check-in. Cancellation is unavailable after check-in, after completion or another final status, or once a Medical Record exists.',
  }),
  knowledgeEntry({
    id: 'appointment_booking',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i book an appointment', 'make an appointment', 'request an appointment'],
    patterns: [/\b(?:book|make|request|schedule|set up)\w*\b.*\bappointment\b/i, /\bappointment\b.*\b(?:book|make|request|schedule|set up)\w*\b/i, /\bneed (?:to see|an appointment with) (?:a )?doctor\b/i],
    response: 'Open Book Appointment, choose a Doctor and an available published time within the next 14 days, enter the visit details, and submit the request. Patient bookings start as Pending and are not instantly confirmed; Arion Assistant cannot book for you.',
  }),
  knowledgeEntry({
    id: 'arrival_check_in',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how do i check in', 'confirm my arrival', 'appointment arrival'],
    patterns: [/\b(?:check[ -]?in|checked in|confirm(?:ed)? (?:my )?arrival|arrival|i['’]?m at the clinic|i am at the clinic)\b/i],
    response: 'Clinic Staff confirms your arrival for an eligible appointment on the clinic day. Patients cannot self-check in through Arion Assistant. After arrival is confirmed, the appointment can join the active queue.',
  }),
  knowledgeEntry({
    id: 'clinic_queue',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['how does the queue work', 'queue priority', 'waiting order'],
    patterns: [/\b(?:clinic |appointment |waiting )?queue\b/i, /\bwaiting (?:order|line)\b/i, /\bhow does waiting work\b/i, /\b(?:patient|priority) order\b/i, /\b(?:senior\s*\/\s*pwd|urgent|normal) priority\b/i, /\bwho (?:goes|is seen) first\b/i],
    response: 'After Staff confirms arrival, the active queue is ordered Urgent first, then Senior/PWD, then Normal. Within the same priority group, the earlier check-in time comes first. Patients cannot change their own priority, and Arion Assistant cannot mark anyone Urgent.',
  }),
  knowledgeEntry({
    id: 'status_no_show',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['what does no-show mean', 'marked no-show', 'no show status'],
    patterns: [/\bno[ -]?show\b/i, /\bi missed my appointment\b/i],
    response: 'No-show means clinic Staff marked an unchecked appointment as unattended. Staff can apply it only after the scheduled start time plus the current 5-minute grace period; Arion Assistant cannot mark this status.',
  }),
  knowledgeEntry({
    id: 'medical_records_creation',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['who creates my medical record'],
    patterns: [/\bwho (?:creates?|writes?|makes?)\b.*\bmedical records?\b/i],
    response: 'Medical Records are created through the Doctor’s clinical workflow. Patients can view their own issued records in My Records, but cannot edit them or ask Arion Assistant to interpret them.',
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
    id: 'record_search_help',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['show my latest records', 'record from a date', 'last three medical records'],
    patterns: [/\b(?:show|find|search|view)\b.*\b(?:record|records)\b.*\b(?:last|recent|latest|date)\b/i, /\b(?:record|records)\b.*\b(?:last|recent|latest|date)\b/i],
    response: 'Open My Records to review your available Medical Records, including their dates. Arion Assistant cannot search, filter, or display an individual Medical Record inside the chat, and it cannot interpret clinical information.',
  }),
  knowledgeEntry({
    id: 'prescription_access',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['where is my prescription', 'view prescription', 'download prescription attachment'],
    patterns: [/\b(?:my |the )?prescription\b/i, /\b(?:where|find|view|open|download|save)\b.*\bprescription\b/i],
    response: 'Open My Records, select the related Medical Record, and review its Prescriptions section. If the Doctor attached a prescription file, use its secure View or Download action. Arion Assistant can help you find it but cannot read, interpret, or change a prescription.',
  }),
  knowledgeEntry({
    id: 'certificate_issuance',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['can you issue a certificate', 'get a medical certificate'],
    patterns: [/\b(?:issues?|create|make|request|get)\b.*\b(?:medical )?certificates?\b/i, /\bwho issues certificates?\b/i],
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
    id: 'certificate_download',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['download my certificate', 'can i download the certificate'],
    patterns: [/\b(?:download|save|open|view)\b.*\b(?:medical )?certificate\b/i, /\b(?:medical )?certificate\b.*\b(?:download|save|open|view)\b/i],
    response: 'Open My Certificates. Active and legacy certificates can be viewed and downloaded as secure PDFs. Expired certificates are archived with limited metadata and their PDFs cannot be opened or downloaded through the Patient portal.',
  }),
  knowledgeEntry({
    id: 'expired_certificate_download',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['download expired certificate', 'open expired certificate'],
    patterns: [/\bexpired\b.*\bcertificate\b.*\b(?:download|open|view|save)\b/i],
    response: 'Expired certificate details remain archived, but their PDFs cannot be opened or downloaded through the Patient portal. Open My Certificates to review the archived certificate information.',
  }),
  knowledgeEntry({
    id: 'certificate_validity',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['certificate expiration date', 'when does my certificate expire', 'valid until certificate'],
    patterns: [/\b(?:certificate|cert)\b.*\b(?:expir(?:e|ed|es|ation|y)|valid(?:ity)?|valid until)\b/i, /\b(?:expir(?:e|ed|es|ation|y)|valid until)\b.*\b(?:certificate|cert)\b/i],
    response: 'A newly issued certificate has a Valid Until date. It is Active through that date and becomes Expired afterward. Expired certificate details remain archived, but the PDF cannot be opened or downloaded through the Patient portal. A Legacy certificate has no recorded validity date.',
  }),
  knowledgeEntry({
    id: 'appointment_translation',
    category: ASSISTANT_INTENTS.APPOINTMENT_HELP,
    phrases: ['tagalog of appointment', 'appointment in tagalog'],
    patterns: [/\b(?:tagalog|filipino)\b.*\bappointment\b/i, /\bappointment\b.*\b(?:tagalog|filipino)\b/i],
    response: 'Sa portal, puwedeng gamitin ang “appointment” o “schedule ng konsultasyon.” Ang Book Appointment ay para humiling ng schedule sa Doctor.',
  }),
  knowledgeEntry({
    id: 'notification_read_status',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['notification read and unread', 'mark notifications read', 'unread notifications'],
    patterns: [/\bnotifications?\b.*\b(?:read|unread|mark)\b/i, /\b(?:read|unread|mark)\b.*\bnotifications?\b/i],
    response: 'Notifications can be unread or read. Open Notifications to review them, mark them as read, or clear them from your inbox. Clearing removes them from view without changing the related appointment or the clinic’s retained notification history.',
  }),
  knowledgeEntry({
    id: 'notifications',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['how do notifications work', 'appointment notifications', 'notification page'],
    patterns: [/\bnotifications?\b/i],
    response: 'Open Notifications or the notification bell to review appointment and clinic workflow updates relevant to your account. When available, the page shows relevant appointment context. Arion currently shows these inside the portal; Arion Assistant does not claim SMS, push, email, or real-time delivery.',
  }),
  knowledgeEntry({
    id: 'appointment_general_help',
    category: ASSISTANT_INTENTS.APPOINTMENT_GENERAL_HELP,
    phrases: ['appointment help', 'appointments help me', 'help with appointments'],
    patterns: [/\bappointments?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bappointments?\b/i, /\btell me about appointments?\b/i],
    response: 'I can explain how to book, reschedule, or cancel an appointment and what each appointment status means. I can also show your own upcoming appointment details when you ask a specific question, such as “When is my next appointment?”',
  }),
  knowledgeEntry({
    id: 'account_general_help',
    category: ASSISTANT_INTENTS.ACCOUNT_GENERAL_HELP,
    phrases: ['account help', 'help with my account'],
    patterns: [/\baccount\b.{0,20}\b(?:help|support|guidance|problem)\b/i, /\bhelp(?: me)?\b.{0,20}\b(?:account|login|profile)\b/i],
    response: 'I can explain email verification, password recovery, Profile editing, and the required phone-number format. For a specific step, ask about the part of your account you need help with.',
  }),
  knowledgeEntry({
    id: 'records_general_help',
    category: ASSISTANT_INTENTS.RECORDS_GENERAL_HELP,
    phrases: ['records help', 'help with records'],
    patterns: [/\b(?:medical )?records?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\b(?:medical )?records?\b/i, /\btell me about (?:medical )?records?\b/i],
    response: 'Open My Records to view Medical Records issued to your account. Doctors create them through the clinical workflow, and Patients cannot edit them or use Arion Assistant for clinical interpretation.',
  }),
  knowledgeEntry({
    id: 'certificates_general_help',
    category: ASSISTANT_INTENTS.CERTIFICATES_GENERAL_HELP,
    phrases: ['certificate help', 'help with certificates'],
    patterns: [/\bcertificates?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bcertificates?\b/i, /\btell me about certificates?\b/i],
    response: 'Open My Certificates to view certificates issued to your account. Certificates come from the clinic’s Doctor workflow, and Arion Assistant cannot issue or change one.',
  }),
  knowledgeEntry({
    id: 'notifications_general_help',
    category: ASSISTANT_INTENTS.NOTIFICATIONS_GENERAL_HELP,
    phrases: ['notification help', 'help with notifications'],
    patterns: [/\bnotifications?\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bnotifications?\b/i, /\btell me about notifications?\b/i],
    response: 'Open Notifications or the notification bell to review appointment and clinic workflow updates. You can ask me how read and unread notifications work or ask a specific question about your own recent notifications.',
  }),
  knowledgeEntry({
    id: 'queue_general_help',
    category: ASSISTANT_INTENTS.QUEUE_GENERAL_HELP,
    phrases: ['queue help', 'help with the queue'],
    patterns: [/\bqueue\b.{0,20}\b(?:help|information|guidance|question)\b/i, /\bhelp(?: me)?\b.{0,20}\bqueue\b/i, /\btell me about (?:the )?queue\b/i],
    response: 'I can explain arrival confirmation and how the clinic queue is ordered: Urgent, then Senior/PWD, then Normal, with earlier check-in first within each group. Staff manages arrival and priority; Patients and Arion Assistant cannot change them.',
  }),
  knowledgeEntry({
    id: 'assistant_scope',
    category: ASSISTANT_INTENTS.PORTAL_HELP,
    phrases: ['what can you do', 'how can you help', 'what can arion assistant do', 'what can arion assistant help me with'],
    patterns: [/\bwhat can (?:you|arion assistant) do\b/i, /\b(?:how|what) can (?:you|arion assistant) help(?: me)?(?: with)?\b/i, /\b(?:can|do) you access another patient\b/i],
    response: 'I can explain portal navigation, appointments and statuses, queue processes, Medical Records and Certificates pages, Notifications, account recovery, and clinic workflows. I cannot diagnose, prescribe, change medication, modify Medical Records, perform appointment actions, or access another Patient’s information.',
  }),
]);

const GENERAL_HELP_IDS = new Set([
  'appointment_general_help',
  'account_general_help',
  'records_general_help',
  'certificates_general_help',
  'notifications_general_help',
  'queue_general_help',
]);

export function findAssistantGeneralKnowledge(message) {
  return ASSISTANT_KNOWLEDGE_BASE.find((item) =>
    GENERAL_HELP_IDS.has(item.id)
      && (item.phrases.some((phrase) => message.toLowerCase().includes(phrase))
        || item.patterns.some((pattern) => pattern.test(message))),
  ) ?? null;
}

export function findAssistantKnowledge(message) {
  return ASSISTANT_KNOWLEDGE_BASE.find((item) =>
    !GENERAL_HELP_IDS.has(item.id)
      && (item.phrases.some((phrase) => message.toLowerCase().includes(phrase))
        || item.patterns.some((pattern) => pattern.test(message))),
  ) ?? null;
}

export function getAssistantKnowledgeEntry(id) {
  return ASSISTANT_KNOWLEDGE_BASE.find((item) => item.id === id) ?? null;
}
