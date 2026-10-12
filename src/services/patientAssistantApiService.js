import { apiClient } from './apiClient.js';
import { createAssistantApiService } from './assistantApiService.js';
export {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  ASSISTANT_RATE_LIMIT_ERROR,
  ASSISTANT_TEMPORARY_ERROR,
  assistantErrorMessage,
} from './assistantApiService.js';

export function createPatientAssistantApiService(client = apiClient) {
  return createAssistantApiService('/api/patient/assistant/message', client);
}

export const patientAssistantApiService = createPatientAssistantApiService();
