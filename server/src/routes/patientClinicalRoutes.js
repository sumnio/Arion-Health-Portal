import { Router } from 'express';
import { createPatientClinicalController } from '../controllers/clinicalController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createPatientClinicalRouter({ authModule, clinicalModule }) {
  const router = Router();
  const controller = createPatientClinicalController(clinicalModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('patient'),
    requirePermission(PERMISSIONS.PATIENT_SELF_ACCESS),
  );
  router.get('/records', controller.records);
  router.get('/records/:recordId', controller.record);
  router.get('/certificates', controller.certificates);
  router.get('/certificates/:certificateId', controller.certificate);
  return router;
}
