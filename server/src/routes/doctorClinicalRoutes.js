import { Router } from 'express';
import { createDoctorClinicalController } from '../controllers/clinicalController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createDoctorClinicalRouter({ authModule, clinicalModule }) {
  const router = Router();
  const controller = createDoctorClinicalController(clinicalModule);
  router.use(createRequireAuth({ tokens: authModule.tokens, service: authModule.service }), requireActiveUser, requireRole('doctor'));
  router.post('/appointments/:appointmentId/medical-record', requirePermission(PERMISSIONS.CLINICAL_RECORD_CREATE), controller.createRecord);
  router.patch('/appointments/:appointmentId/complete', requirePermission(PERMISSIONS.CONSULTATION_COMPLETE), controller.complete);
  router.get('/patients/:patientId/records', controller.patientRecords);
  router.get('/records/:recordId', controller.record);
  router.post('/records/:recordId/certificates', requirePermission(PERMISSIONS.CERTIFICATE_ISSUE), controller.createCertificate);
  router.get('/certificates/:certificateId', controller.certificate);
  return router;
}
