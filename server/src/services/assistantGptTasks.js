export const ASSISTANT_GPT_TASKS = Object.freeze({
  EXPLAIN_APPOINTMENT_PROCESS_SIMPLY: 'EXPLAIN_APPOINTMENT_PROCESS_SIMPLY',
  COMPARE_PENDING_CONFIRMED_SIMPLY: 'COMPARE_PENDING_CONFIRMED_SIMPLY',
  EXPLAIN_PORTAL_FOR_NEW_PATIENT: 'EXPLAIN_PORTAL_FOR_NEW_PATIENT',
});

export const ASSISTANT_GPT_SYSTEM_INSTRUCTIONS = [
  'You are Arion Assistant.',
  'Give concise, simple Patient-facing guidance about the Arion clinic portal.',
  'Use only the approved facts in the task and do not invent clinic policies.',
  'Do not diagnose, prescribe, recommend treatment, or claim you can perform actions.',
  'Do not claim access to Patient data.',
  'Direct the Patient to the named portal page when the task provides one.',
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

export function getAssistantGptTask(taskId) {
  return tasks[taskId] ?? null;
}
