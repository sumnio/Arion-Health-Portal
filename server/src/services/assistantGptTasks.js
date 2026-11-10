export const ASSISTANT_GPT_TASKS = Object.freeze({
  EXPLAIN_APPOINTMENT_PROCESS_SIMPLY: 'EXPLAIN_APPOINTMENT_PROCESS_SIMPLY',
  COMPARE_PENDING_CONFIRMED_SIMPLY: 'COMPARE_PENDING_CONFIRMED_SIMPLY',
  EXPLAIN_APPOINTMENT_STATUSES: 'EXPLAIN_APPOINTMENT_STATUSES',
  EXPLAIN_RESCHEDULING_AND_CANCELLATION: 'EXPLAIN_RESCHEDULING_AND_CANCELLATION',
  EXPLAIN_ARRIVAL_AND_QUEUE: 'EXPLAIN_ARRIVAL_AND_QUEUE',
  EXPLAIN_ACCOUNT_ACCESS: 'EXPLAIN_ACCOUNT_ACCESS',
  EXPLAIN_REGISTRATION: 'EXPLAIN_REGISTRATION',
  EXPLAIN_PASSWORD_RECOVERY: 'EXPLAIN_PASSWORD_RECOVERY',
  EXPLAIN_PROFILE_EDITING: 'EXPLAIN_PROFILE_EDITING',
  EXPLAIN_SMS_REMINDERS: 'EXPLAIN_SMS_REMINDERS',
  EXPLAIN_CERTIFICATE_ACCESS: 'EXPLAIN_CERTIFICATE_ACCESS',
  EXPLAIN_RECORDS_AND_CERTIFICATES: 'EXPLAIN_RECORDS_AND_CERTIFICATES',
  EXPLAIN_NOTIFICATIONS: 'EXPLAIN_NOTIFICATIONS',
  EXPLAIN_PORTAL_FOR_NEW_PATIENT: 'EXPLAIN_PORTAL_FOR_NEW_PATIENT',
});

export const ASSISTANT_GPT_SYSTEM_INSTRUCTIONS = [
  'You are Arion Assistant.',
  'Give concise, simple Patient-facing guidance about the Arion clinic portal.',
  'Use only the approved facts in the task and do not invent clinic policies.',
  'Do not diagnose, prescribe, recommend treatment, or claim you can perform actions.',
  'Do not claim access to Patient data.',
  'The Patient using this authenticated Assistant is already signed in; do not tell them to sign in again.',
  'Direct the Patient to the named portal page when the task provides one.',
  'Follow the response-language instruction in the task.',
  'Keep the answer under 250 words.',
].join(' ');

const tasks = Object.freeze({
  [ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY,
    prompt: [
      'Explain the Arion appointment process in simpler words.',
      'Approved facts:',
      '- A Patient uses Book Appointment to choose a Doctor and an available published time within 14 days.',
      '- A Patient booking starts as Pending and is not instantly confirmed.',
      '- Confirmed means the clinic accepted the scheduled appointment.',
      '- On the clinic day, Staff confirms arrival before the Patient enters the active queue.',
      '- Arion Assistant can explain the process but cannot book, confirm, cancel, reschedule, or check in.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.COMPARE_PENDING_CONFIRMED_SIMPLY]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.COMPARE_PENDING_CONFIRMED_SIMPLY,
    prompt: [
      'Explain the difference between Pending and Confirmed in very simple words.',
      'Approved facts:',
      '- Pending means the appointment request is waiting for clinic confirmation.',
      '- Confirmed means the clinic accepted the scheduled appointment.',
      '- The Patient can check the current status in My Appointments.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
    prompt: [
      'Explain Arion appointment statuses in simple words.',
      'Approved facts:',
      '- Pending means the request is waiting for clinic confirmation.',
      '- Confirmed means the clinic accepted the scheduled appointment.',
      '- Completed means the consultation workflow was finished.',
      '- Cancelled means the appointment will not continue.',
      '- No-show means the Patient did not arrive within the clinic workflow.',
      '- The Patient can see the current status in My Appointments.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
    prompt: [
      'Explain appointment rescheduling and cancellation in simple words.',
      'Approved facts:',
      '- A Patient uses My Appointments for available reschedule or cancel actions.',
      '- Rescheduling is limited to eligible Patient-created Pending or Confirmed appointments that are not checked in and are still at least 60 minutes away.',
      '- A new time must be available within the 14-day booking window.',
      '- After rescheduling, the request returns to Pending for clinic confirmation.',
      '- A future Pending or Confirmed appointment may be cancelled before check-in when no Medical Record already prevents cancellation.',
      '- Arion Assistant explains the process but cannot perform the action.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
    prompt: [
      'Explain clinic arrival and queue order in simple words.',
      'Approved facts:',
      '- Clinic Staff confirms arrival for an eligible appointment on the clinic day.',
      '- Patients cannot check themselves in through Arion Assistant.',
      '- After arrival is confirmed, the appointment may enter the active queue.',
      '- Queue order is Urgent first, then Senior/PWD, then Normal.',
      '- Within the same priority group, earlier check-in comes first.',
      '- Patients and Arion Assistant cannot change queue priority.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS,
    prompt: [
      'Explain Patient account access help in simple words.',
      'Approved facts:',
      '- New Patient registration uses a 6-digit email verification code that expires after 10 minutes.',
      '- Requesting another verification code makes the previous code invalid.',
      '- Patient password recovery starts from Forgot Password on Login or Change Password in Profile.',
      '- A successful Patient password reset signs out earlier Patient sessions.',
      '- Arion Assistant never asks for or handles a password or verification code.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION,
    prompt: [
      'Explain Patient registration in simple words.',
      'Approved facts:',
      '- Select Register and provide the required Patient details.',
      '- Registration requires a password and matching confirmation password.',
      '- The new Patient account must complete email verification before signing in.',
      '- Email verification uses the newest 6-digit code and the code expires after 10 minutes.',
      '- Arion Assistant cannot create the account or handle a password or verification code.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_PASSWORD_RECOVERY]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_PASSWORD_RECOVERY,
    prompt: [
      'Explain Patient password recovery in simple words.',
      'Approved facts:',
      '- Select Forgot Password on Login to request a reset link through the registered email.',
      '- A signed-in Patient can also select Change Password in Profile to begin the same secure recovery flow.',
      '- A successful reset signs out earlier Patient sessions.',
      '- Email delivery can be delayed or fail, so the Patient may also check the spam folder.',
      '- Arion Assistant never asks for or handles a password, reset link, or verification code.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_PROFILE_EDITING]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_PROFILE_EDITING,
    prompt: [
      'Explain how a Patient edits their Arion profile in simple words.',
      'Approved facts:',
      '- Profile opens in read-only mode.',
      '- Select Edit Profile to change the permitted profile fields.',
      '- The Patient may add or update allergies and separate multiple entries with commas or new lines.',
      '- Save the permitted changes from the Profile page.',
      '- The account email cannot be changed from Profile.',
      '- Arion Assistant cannot edit the profile for the Patient.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_SMS_REMINDERS]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_SMS_REMINDERS,
    prompt: [
      'Explain Arion SMS reminders in simple words.',
      'Approved facts:',
      '- When the clinic SMS service is enabled and the Patient profile has a valid mobile number, Arion can send appointment booking, reschedule, cancellation, and timed reminder texts.',
      '- SMS delivery can be delayed or fail and is not guaranteed.',
      '- My Appointments and Notifications remain the reliable places to check current portal information.',
      '- Arion Assistant cannot send or resend an SMS.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_CERTIFICATE_ACCESS]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_CERTIFICATE_ACCESS,
    prompt: [
      'Explain Patient certificate access in simple words.',
      'Approved facts:',
      '- My Certificates lists certificates issued to the signed-in Patient.',
      '- Active and legacy certificates can be opened and downloaded as secure PDFs.',
      '- Expired certificates are archived and show limited metadata only; their PDFs cannot be opened or downloaded through the Patient portal.',
      '- Certificates are read-only and Arion Assistant cannot issue or change one.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
    prompt: [
      'Explain where Patients find Medical Records and Certificates in simple words.',
      'Approved facts:',
      '- My Records shows Medical Records available to the signed-in Patient and they are read-only.',
      '- Doctors create Medical Records through the clinical workflow.',
      '- My Certificates shows certificates already issued to the signed-in Patient and they are read-only.',
      '- Medical Certificates come from the clinic Doctor workflow when available.',
      '- Arion Assistant cannot interpret clinical information, issue a certificate, or change a record or certificate.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
    prompt: [
      'Explain portal notifications in simple words.',
      'Approved facts:',
      '- Notifications and the notification bell show appointment and clinic workflow updates for the signed-in account.',
      '- Notifications may be unread or read.',
      '- Clearing a notification removes it from the inbox view without changing the related appointment.',
      '- Arion Assistant does not claim that every portal notification is also delivered by SMS, push, or email.',
    ].join('\n'),
  }),
  [ASSISTANT_GPT_TASKS.EXPLAIN_PORTAL_FOR_NEW_PATIENT]: Object.freeze({
    id: ASSISTANT_GPT_TASKS.EXPLAIN_PORTAL_FOR_NEW_PATIENT,
    prompt: [
      'Give a short, welcoming explanation of the Arion Patient portal for a new Patient.',
      'Approved facts:',
      '- Book Appointment is used to request an appointment.',
      '- My Appointments shows appointment requests and statuses.',
      '- My Records shows available Medical Records and is read-only for Patients.',
      '- My Certificates shows issued certificates and is read-only.',
      '- Notifications shows appointment and clinic workflow updates for the account.',
      '- Profile shows personal information and starts in read-only mode until Edit Profile is selected.',
      '- Arion Assistant provides guidance but cannot perform appointment actions or provide medical advice.',
    ].join('\n'),
  }),
});

export function getAssistantGptTask(taskId, language = 'english') {
  const task = tasks[taskId];
  if (!task) return null;
  const languageInstruction = language === 'filipino'
    ? 'Response language: Use clear, natural Filipino or Taglish that matches an everyday Patient conversation.'
    : 'Response language: Use clear, simple English.';
  return Object.freeze({
    ...task,
    prompt: `${task.prompt}\n${languageInstruction}`,
  });
}
