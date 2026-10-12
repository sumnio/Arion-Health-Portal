import { createAssistantPrivacyGateway } from './assistantPrivacyGateway.js';
import { createAssistantResponseProvider } from './assistantResponseProvider.js';
import { createAssistantService } from './assistantService.js';
import { createAssistantPatientToolService } from './assistantPatientToolService.js';

export function createAssistantModule({
  maxMessageLength = 800,
  appointmentService,
  notificationService,
  clinicTimeZone = 'Asia/Manila',
  now,
} = {}) {
  const privacyGateway = createAssistantPrivacyGateway();
  const responseProvider = createAssistantResponseProvider();
  const patientTools = appointmentService && notificationService
    ? createAssistantPatientToolService({ appointmentService, notificationService, clinicTimeZone, now })
    : null;
  return Object.freeze({
    assistantService: createAssistantService({ privacyGateway, responseProvider, patientTools }),
    maxMessageLength,
  });
}

