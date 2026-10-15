import { Router } from 'express';
import { createDoctorClinicalController } from '../controllers/clinicalController.js';
import { createDoctorSupportingDocumentController } from '../controllers/supportingDocumentController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createDoctorClinicalRouter({ authModule, clinicalModule, supportingDocumentModule }) {
  const router = Router();
  const controller = createDoctorClinicalController(clinicalModule);
  const supportingDocumentController = createDoctorSupportingDocumentController(supportingDocumentModule);
  router.use(createRequireAuth({ tokens: authModule.tokens, service: authModule.service }), requireActiveUser, requireRole('doctor'));
  router.get('/appointments', controller.appointments);
  router.get('/appointments/:appointmentId/priority-history', controller.priorityHistory);
  router.get('/appointments/:appointmentId/supporting-documents', supportingDocumentController.list);
  router.get('/appointments/:appointmentId/supporting-documents/:documentId', supportingDocumentController.download);
  router.post('/appointments/:appointmentId/medical-record', requirePermission(PERMISSIONS.CLINICAL_RECORD_CREATE), controller.createRecord);
  router.patch('/appointments/:appointmentId/complete', requirePermission(PERMISSIONS.CONSULTATION_COMPLETE), controller.complete);
  router.get('/patients/:patientId/records', controller.patientRecords);
  router.get('/records/:recordId', controller.record);
  router.post('/records/:recordId/certificates/preview', requirePermission(PERMISSIONS.CERTIFICATE_ISSUE), controller.previewCertificate);
  router.post('/records/:recordId/certificates', requirePermission(PERMISSIONS.CERTIFICATE_ISSUE), controller.createCertificate);
  router.get('/certificates/:certificateId', controller.certificate);
  router.get('/certificates/:certificateId/pdf', controller.certificatePdf);
  return router;
}
