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
  router.post('/availability', controller.createRecurring);
  router.patch('/availability/:id', controller.updateRecurring);
  router.delete('/availability/:id', controller.deleteRecurring);
  router.get('/published-availability', controller.listPublished);
  router.post('/published-availability', controller.createPublished);
  router.delete('/published-availability/:id', controller.deletePublished);
  router.get('/blocked-times', controller.listBlocked);
  router.post('/blocked-times', controller.createBlocked);
  router.delete('/blocked-times/:id', controller.deleteBlocked);
  return router;
}
