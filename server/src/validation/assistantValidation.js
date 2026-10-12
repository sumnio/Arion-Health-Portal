import { boundedText, rejectUnknownFields, requireObject } from './inputValidation.js';

const allowedFields = new Set(['message']);

export function validateAssistantMessage(body, maxMessageLength) {
  const input = requireObject(body);
  rejectUnknownFields(input, allowedFields, 'RESTRICTED_FIELD');
  return boundedText(input.message, 'message', maxMessageLength, { code: 'INVALID_ASSISTANT_MESSAGE' });
}

