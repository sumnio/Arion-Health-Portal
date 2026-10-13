import { Router } from 'express';
import { createPatientController } from '../controllers/patientController.js';
import { createPatientAssistantController } from '../controllers/patientAssistantController.js';
import { createPatientSupportingDocumentController } from '../controllers/supportingDocumentController.js';
import { supportingDocumentUpload } from '../middleware/supportingDocumentUpload.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import {
  requireActiveUser,
  requirePermission,
  requireRole,
} from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createPatientRouter({ authModule, patientAppointmentModule, assistantModule, supportingDocumentModule, rateLimiters }) {
  const router = Router();
  const controller = createPatientController(patientAppointmentModule);
  const assistantController = createPatientAssistantController(assistantModule);
  const supportingDocumentController = createPatientSupportingDocumentController(supportingDocumentModule);

  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('patient'),
    requirePermission(PERMISSIONS.PATIENT_SELF_ACCESS),
  );

  router.get('/profile', controller.profile);
  router.patch('/profile', controller.updateProfile);
  router.get('/doctors', controller.doctors);
  router.get('/doctors/:doctorId/available-slots', controller.availableSlots);
  router.post('/appointments', controller.createAppointment);
  router.get('/appointments', controller.listAppointments);
  router.get('/appointments/:appointmentId', controller.appointment);
  router.patch('/appointments/:appointmentId/cancel', controller.cancelAppointment);
  router.patch('/appointments/:appointmentId/reschedule', controller.rescheduleAppointment);
  router.post('/appointments/:appointmentId/supporting-documents', supportingDocumentUpload, supportingDocumentController.upload);
  router.get('/appointments/:appointmentId/supporting-documents', supportingDocumentController.list);
  router.get('/appointments/:appointmentId/supporting-documents/:documentId', supportingDocumentController.download);
  router.post('/assistant/message', rateLimiters.assistantRateLimiter, assistantController.message);
  return router;
}
