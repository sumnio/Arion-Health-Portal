import { ApiError, apiClient } from './apiClient.js';

export const ASSISTANT_MESSAGE_MAX_LENGTH = 800;
export const ASSISTANT_TEMPORARY_ERROR = 'Arion Assistant is temporarily unavailable. Please try again, or use the Patient Portal directly.';
export const ASSISTANT_RATE_LIMIT_ERROR = "You've sent several messages quickly. Please wait a moment before trying again.";

export function assistantErrorMessage(error) {
  return error instanceof ApiError && error.status === 429
    ? ASSISTANT_RATE_LIMIT_ERROR
    : ASSISTANT_TEMPORARY_ERROR;
}

export function createPatientAssistantApiService(client = apiClient) {
  return Object.freeze({
    async sendMessage(message) {
      const payload = await client.request('/api/patient/assistant/message', {
        method: 'POST',
        body: { message },
      });
      if (typeof payload?.reply !== 'string' || !payload.reply.trim()) {
        throw new ApiError('The assistant response was not recognized.', { code: 'INVALID_ASSISTANT_RESPONSE' });
      }
      return payload.reply.trim();
    },
  });
}

export const patientAssistantApiService = createPatientAssistantApiService();
