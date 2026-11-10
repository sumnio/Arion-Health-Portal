import { PUBLIC_ASSISTANT_SAFETY_RESPONSES } from './publicAssistantKnowledgeBase.js';
import { createPublicAssistantPrivacyGateway } from './publicAssistantPrivacyGateway.js';
import { ASSISTANT_AI_DEFAULTS } from '../config/assistantAiConfig.js';
import { createAssistantAiProvider } from './assistantAiProvider.js';
import { ASSISTANT_GPT_TASKS, getAssistantGptTask } from './assistantGptTasks.js';

const CONTEXT_TOPICS = new Set([
  'booking_clarification', 'reschedule_clarification', 'cancellation_clarification',
  'status_clarification', 'queue_clarification', 'account_clarification',
  'records_clarification', 'certificates_clarification', 'notifications_clarification',
  'portal_clarification', 'doctor_availability', 'prescription_context',
  'clinic_hours_context', 'topic_conflict',
]);

const PUBLIC_GPT_TASKS = Object.freeze({
  registration: ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION,
  registration_password: ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION,
  login: ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS,
  appointment_process: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_PROCESS_SIMPLY,
  reschedule: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  cancellation: ASSISTANT_GPT_TASKS.EXPLAIN_RESCHEDULING_AND_CANCELLATION,
  arrival: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
  queue: ASSISTANT_GPT_TASKS.EXPLAIN_ARRIVAL_AND_QUEUE,
  status_pending: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_confirmed: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_completed: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_cancelled: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  status_no_show: ASSISTANT_GPT_TASKS.EXPLAIN_APPOINTMENT_STATUSES,
  account_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_ACCOUNT_ACCESS,
  email_verification: ASSISTANT_GPT_TASKS.EXPLAIN_REGISTRATION,
  password_reset: ASSISTANT_GPT_TASKS.EXPLAIN_PASSWORD_RECOVERY,
  profile_editing: ASSISTANT_GPT_TASKS.EXPLAIN_PROFILE_EDITING,
  sms_reminders: ASSISTANT_GPT_TASKS.EXPLAIN_SMS_REMINDERS,
  sms_delivery_reason: ASSISTANT_GPT_TASKS.EXPLAIN_SMS_REMINDERS,
  medical_records: ASSISTANT_GPT_TASKS.EXPLAIN_RECORDS_AND_CERTIFICATES,
  certificates: ASSISTANT_GPT_TASKS.EXPLAIN_CERTIFICATE_ACCESS,
  notifications: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
  notifications_general_help: ASSISTANT_GPT_TASKS.EXPLAIN_NOTIFICATIONS,
  scope: ASSISTANT_GPT_TASKS.EXPLAIN_PORTAL_FOR_NEW_PATIENT,
});

const SAFE_CONTEXT_BY_TOPIC = Object.freeze({
  registration: 'registration_context',
  registration_password: 'registration_context',
  email_verification: 'registration_context',
  password_reset: 'password_context',
  profile_editing: 'profile_context',
  emergency_contact_editing: 'profile_context',
  sms_reminders: 'sms_context',
  sms_delivery_reason: 'sms_context',
  clinic_contact_location: 'clinic_contact_context',
  clinic_hours: 'clinic_hours_context',
  medical_records: 'records_context',
  record_search_help: 'records_context',
  prescription_access: 'prescription_context',
  records_general_help: 'records_context',
  certificates: 'certificates_context',
  certificate_download: 'certificates_context',
  expired_certificate_download: 'certificates_context',
  certificate_validity: 'certificates_context',
  certificates_general_help: 'certificates_context',
  appointment_process: 'booking_clarification',
  doctor_booking_times: 'booking_clarification',
});

function responseContextTopic(classification) {
  if (classification.intent === 'CLARIFICATION' && CONTEXT_TOPICS.has(classification.topic)) return classification.topic;
  return SAFE_CONTEXT_BY_TOPIC[classification.topic] ?? null;
}

function plainAssistantText(value) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function createPublicAssistantModule({
  maxMessageLength = 800,
  aiExternalEnabled = ASSISTANT_AI_DEFAULTS.enabled,
  aiProvider = ASSISTANT_AI_DEFAULTS.provider,
  openAiApiKey = '',
  openAiModel = ASSISTANT_AI_DEFAULTS.model,
  aiProviderTimeoutMs = ASSISTANT_AI_DEFAULTS.timeoutMs,
  aiMaxOutputTokens = ASSISTANT_AI_DEFAULTS.maxOutputTokens,
  assistantAiProvider,
  aiFetch,
} = {}) {
  const privacyGateway = createPublicAssistantPrivacyGateway();
  const externalProvider = assistantAiProvider ?? createAssistantAiProvider({
    enabled: aiExternalEnabled,
    provider: aiProvider,
    apiKey: openAiApiKey,
    model: openAiModel,
    timeoutMs: aiProviderTimeoutMs,
    maxOutputTokens: aiMaxOutputTokens,
    fetchImpl: aiFetch,
  });
  const assistantService = Object.freeze({
    async respond(message, context = null) {
      const classification = privacyGateway.classify(message, context?.contextTopic ?? null);
      const taskId = PUBLIC_GPT_TASKS[classification.topic];
      const task = taskId ? getAssistantGptTask(taskId, classification.language) : null;
      let providerResult = null;
      if (task && externalProvider.name !== 'none') {
        try {
          providerResult = await externalProvider.generate({
            instructions: 'You are the public Arion Assistant. Explain only the approved Arion portal and clinic facts in the task. Never claim access to an account, Patient data, appointments, records, notifications, or clinical information. Do not diagnose, prescribe, or provide treatment advice. Keep the answer concise and friendly.',
            prompt: task.prompt,
            taskId: task.id,
          });
        } catch {
          providerResult = Object.freeze({ ok: false, category: 'provider_error' });
        }
        if (providerResult?.ok && typeof providerResult.text === 'string') {
          return Object.freeze({
            reply: plainAssistantText(providerResult.text),
            intent: classification.intent,
            resultCategory: 'gpt_answer',
            providerTelemetry: Object.freeze({ provider: externalProvider.name, outcome: 'success' }),
            contextTopic: responseContextTopic(classification),
          });
        }
      }
      const reply = classification.knowledge?.response
        ?? PUBLIC_ASSISTANT_SAFETY_RESPONSES[classification.responseKey]
        ?? PUBLIC_ASSISTANT_SAFETY_RESPONSES.unsupported;
      return Object.freeze({
        reply,
        intent: classification.intent,
        resultCategory: classification.topic,
        providerTelemetry: task && externalProvider.name !== 'none' ? Object.freeze({
          provider: externalProvider.name,
          outcome: providerResult?.category ?? 'provider_error',
        }) : null,
        contextTopic: responseContextTopic(classification),
      });
    },
  });
  return Object.freeze({ assistantService, maxMessageLength });
}
