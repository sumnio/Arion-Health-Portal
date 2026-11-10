import { boundedText, rejectUnknownFields, requireObject } from './inputValidation.js';
import { httpError } from '../utils/httpError.js';

const allowedFields = new Set(['message', 'context_topic']);
const allowedContextTopics = new Set([
  'booking_clarification', 'reschedule_clarification', 'cancellation_clarification',
  'status_clarification', 'queue_clarification', 'account_clarification',
  'records_clarification', 'certificates_clarification', 'notifications_clarification',
  'portal_clarification', 'doctor_availability', 'topic_conflict',
  'registration_context', 'password_context', 'profile_context', 'sms_context',
  'clinic_contact_context', 'records_context', 'certificates_context',
]);

export function validateAssistantMessage(body, maxMessageLength) {
  const input = requireObject(body);
  rejectUnknownFields(input, allowedFields, 'RESTRICTED_FIELD');
  const message = boundedText(input.message, 'message', maxMessageLength, { code: 'INVALID_ASSISTANT_MESSAGE' });
  const contextTopic = boundedText(input.context_topic, 'context_topic', 80, { optional: true, code: 'INVALID_ASSISTANT_CONTEXT' });
  if (contextTopic && !allowedContextTopics.has(contextTopic)) {
    throw httpError(400, 'INVALID_ASSISTANT_CONTEXT', 'context_topic is not supported.');
  }
  return Object.freeze({ message, contextTopic });
}

