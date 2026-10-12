import { apiClient } from './apiClient.js';
import { createAssistantApiService } from './assistantApiService.js';

export function createPublicAssistantApiService(client = apiClient) {
  return createAssistantApiService('/api/public/assistant/message', client);
}

export const publicAssistantApiService = createPublicAssistantApiService();
