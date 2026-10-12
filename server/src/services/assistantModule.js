import { createAssistantPrivacyGateway } from './assistantPrivacyGateway.js';
import { createAssistantResponseProvider } from './assistantResponseProvider.js';
import { createAssistantService } from './assistantService.js';

export function createAssistantModule({ maxMessageLength = 800 } = {}) {
  const privacyGateway = createAssistantPrivacyGateway();
  const responseProvider = createAssistantResponseProvider();
  return Object.freeze({
    assistantService: createAssistantService({ privacyGateway, responseProvider }),
    maxMessageLength,
  });
}

