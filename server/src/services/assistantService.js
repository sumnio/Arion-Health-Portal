import { ASSISTANT_INTENTS } from './assistantIntents.js';
import { ASSISTANT_GPT_SYSTEM_INSTRUCTIONS, ASSISTANT_GPT_TASKS, getAssistantGptTask } from './assistantGptTasks.js';

const LIVE_DATA_INTENTS = new Set([
  ASSISTANT_INTENTS.NEXT_APPOINTMENT,
  ASSISTANT_INTENTS.UPCOMING_APPOINTMENTS,
  ASSISTANT_INTENTS.APPOINTMENT_STATUS,
  ASSISTANT_INTENTS.ASSIGNED_DOCTOR,
  ASSISTANT_INTENTS.RECENT_NOTIFICATIONS,
  ASSISTANT_INTENTS.UNREAD_NOTIFICATION_COUNT,
]);

const CONTEXT_TOPICS = new Set([
  'booking_clarification', 'reschedule_clarification', 'cancellation_clarification',
  'status_clarification', 'queue_clarification', 'account_clarification',
  'records_clarification', 'certificates_clarification', 'notifications_clarification',
  'portal_clarification', 'doctor_availability', 'prescription_context',
  'clinic_hours_context', 'topic_conflict',
]);

const KNOWLEDGE_GPT_TASKS = Object.freeze({
  appointment_booking: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY,
  appointment_reschedule: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  appointment_cancellation: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  arrival_check_in: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
  clinic_queue: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
  status_pending: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_confirmed: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_completed: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_cancelled: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_no_show: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  registration_password: ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION,
  email_verification: ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION,
  password_reset: ASSISTANT_GPT_TASKS.EXPLAIN_PASSWORD_RECOVERY,
  profile_editing: ASSISTANT_GPT_TASKS.EXPLAIN_PROFILE_EDITING,
  sms_reminders: ASSISTANT_GPT_TASKS.EXPLAIN_SMS_REMINDERS,
  sms_delivery_reason: ASSISTANT_GPT_TASKS.EXPLAIN_SMS_REMINDERS,
  medical_records_location: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
  certificate_location: ASSISTANT_GPT_TASKS.EXPLAIN_CERTIFICATE_ACCESS,
  certificate_download: ASSISTANT_GPT_TASKS.EXPLAIN_CERTIFICATE_ACCESS,
  notifications: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
  notification_read_status: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
  appointment_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY,
  account_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS,
  records_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
  certificates_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_CERTIFICATE_ACCESS,
  notifications_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
  queue_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
});

const SAFE_CONTEXT_BY_TOPIC = Object.freeze({
  appointment_booking: 'booking_clarification',
  appointment_general_help: 'booking_clarification',
  doctor_booking_times: 'booking_clarification',
  registration_password: 'registration_context',
  email_verification: 'registration_context',
  password_reset: 'password_context',
  profile_editing: 'profile_context',
  emergency_contact_editing: 'profile_context',
  sms_reminders: 'sms_context',
  sms_delivery_reason: 'sms_context',
  clinic_contact_location: 'clinic_contact_context',
  clinic_hours: 'clinic_hours_context',
  medical_records_location: 'records_context',
  record_search_help: 'records_context',
  prescription_access: 'prescription_context',
  records_general_help: 'records_context',
  certificate_location: 'certificates_context',
  certificate_download: 'certificates_context',
  expired_certificate_download: 'certificates_context',
  certificate_validity: 'certificates_context',
  certificates_general_help: 'certificates_context',
  [ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY]: 'booking_clarification',
  [ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION]: 'registration_context',
  [ASSISTANT_GPT_TASKS.EXPLAIN_PASSWORD_RECOVERY]: 'password_context',
  [ASSISTANT_GPT_TASKS.EXPLAIN_PROFILE_EDITING]: 'profile_context',
  [ASSISTANT_GPT_TASKS.EXPLAIN_SMS_REMINDERS]: 'sms_context',
  [ASSISTANT_GPT_TASKS.EXPLAIN_CERTIFICATE_ACCESS]: 'certificates_context',
  [ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES]: 'records_context',
});

function responseContextTopic(classification) {
  if (classification.intent === ASSISTANT_INTENTS.CLARIFICATION && CONTEXT_TOPICS.has(classification.topic)) {
    return classification.topic;
  }
  return SAFE_CONTEXT_BY_TOPIC[classification.topic] ?? null;
}

function plainAssistantText(value) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function createAssistantService({ privacyGateway, responseProvider, patientTools = null, aiProvider = null }) {
  return Object.freeze({
    respond(message, authContext = null) {
      const classification = privacyGateway.classify(message, authContext?.contextTopic ?? null);
      if (patientTools && LIVE_DATA_INTENTS.has(classification.intent)) {
        return patientTools.execute(classification.intent, {
          userProfileId: authContext?.userProfileId,
          message,
        }).then((toolResult) => Object.freeze({
          reply: toolResult.reply,
          intent: classification.intent,
          tool: toolResult.tool,
          resultCategory: toolResult.resultCategory,
        }));
      }
      const taskId = classification.intent === ASSISTANT_INTENTS.GPT_CONVERSATIONAL
        ? classification.topic
        : KNOWLEDGE_GPT_TASKS[classification.topic];
      if (taskId && aiProvider && aiProvider.name !== 'none') {
        const task = getAssistantGptTask(taskId, classification.language);
        if (task) {
          return Promise.resolve(aiProvider.generate({
            instructions: ASSISTANT_GPT_SYSTEM_INSTRUCTIONS,
            prompt: task.prompt,
            taskId: task.id,
          })).then((providerResult) => {
            if (providerResult?.ok && typeof providerResult.text === 'string') {
              return Object.freeze({
                reply: plainAssistantText(providerResult.text),
                intent: classification.intent,
                tool: 'openai_responses',
                resultCategory: 'gpt_answer',
                providerTelemetry: Object.freeze({
                  provider: aiProvider.name,
                  outcome: 'success',
                }),
                contextTopic: responseContextTopic(classification),
              });
            }
            return Object.freeze({
              reply: responseProvider.reply(message, classification),
              intent: classification.intent,
              tool: 'external_ai',
              resultCategory: 'gpt_fallback',
              providerTelemetry: Object.freeze({
                provider: aiProvider.name,
                outcome: providerResult?.category ?? 'provider_error',
              }),
              contextTopic: responseContextTopic(classification),
            });
          }).catch(() => Object.freeze({
            reply: responseProvider.reply(message, classification),
            intent: classification.intent,
            tool: 'external_ai',
            resultCategory: 'gpt_fallback',
            providerTelemetry: Object.freeze({ provider: aiProvider.name, outcome: 'provider_error' }),
            contextTopic: responseContextTopic(classification),
          }));
        }
      }
      return Object.freeze({
        reply: responseProvider.reply(message, classification),
        intent: classification.intent,
        tool: null,
        resultCategory: 'static',
        providerTelemetry: null,
        contextTopic: responseContextTopic(classification),
      });
    },
  });
}

