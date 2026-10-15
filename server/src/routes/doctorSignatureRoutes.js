import { Router } from 'express';
import { createDoctorSignatureController } from '../controllers/doctorSignatureController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requireRole } from '../middleware/authorization.js';
import { doctorSignatureUpload } from '../middleware/doctorSignatureUpload.js';

export function createDoctorSignatureRouter({ authModule, doctorSignatureModule }) {
  const router = Router();
  const controller = createDoctorSignatureController(doctorSignatureModule);
  router.use(createRequireAuth({ tokens: authModule.tokens, service: authModule.service }), requireActiveUser, requireRole('doctor'));
  router.get('/profile/signature/status', controller.status);
  router.get('/profile/signature', controller.view);
  router.post('/profile/signature', doctorSignatureUpload, controller.upload);
  return router;
}
