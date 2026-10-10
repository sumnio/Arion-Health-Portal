import { Router } from 'express';
import { createStaffSchedulingController } from '../controllers/staffSchedulingController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createStaffSchedulingRouter({ authModule, schedulingModule }) {
  const router = Router();
  const controller = createStaffSchedulingController(schedulingModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('staff'),
    requirePermission(PERMISSIONS.STAFF_OPERATIONS),
  );
  router.get('/doctors/:doctorId/available-slots', controller.availableSlots);
  router.get('/doctors/:doctorId/schedule', controller.schedule);
  router.post('/doctors/:doctorId/availability', controller.createRecurring);
  router.patch('/doctors/:doctorId/availability/:availabilityId', controller.updateRecurring);
  router.delete('/doctors/:doctorId/availability/:availabilityId', controller.deleteRecurring);
  router.post('/doctors/:doctorId/published-availability', controller.createPublished);
  router.delete('/doctors/:doctorId/published-availability/:publishedId', controller.deletePublished);
  router.post('/doctors/:doctorId/blocked-times', controller.createBlocked);
  router.delete('/doctors/:doctorId/blocked-times/:blockedTimeId', controller.deleteBlocked);
  return router;
}
