import { Router } from 'express';
import { createDoctorAvailabilityController } from '../controllers/doctorAvailabilityController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createDoctorAvailabilityRouter({ authModule, schedulingModule }) {
  const router = Router();
  const controller = createDoctorAvailabilityController(schedulingModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('doctor'),
    requirePermission(PERMISSIONS.DOCTOR_PORTAL_ACCESS),
  );
  router.get('/availability', controller.listRecurring);
  router.get('/published-availability', controller.listPublished);
  router.get('/blocked-times', controller.listBlocked);
  return router;
}
