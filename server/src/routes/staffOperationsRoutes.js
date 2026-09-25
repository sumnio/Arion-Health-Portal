import { Router } from 'express';
import { createStaffOperationsController } from '../controllers/staffOperationsController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createStaffOperationsRouter({ authModule, staffOperationsModule }) {
  const router = Router();
  const controller = createStaffOperationsController(staffOperationsModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('staff'),
    requirePermission(PERMISSIONS.STAFF_OPERATIONS),
  );
  router.get('/patients', controller.patients);
  router.post('/patients/walk-in', controller.registerWalkIn);
  router.post('/patients/:patientId/walk-in-appointments', controller.createWalkInAppointment);
  router.get('/patients/:patientId/record-summary', controller.recordSummary);
  router.patch('/appointments/:appointmentId/check-in', controller.checkIn);
  router.patch('/appointments/:appointmentId/priority', controller.priority);
  router.patch('/appointments/:appointmentId/no-show', controller.noShow);
  router.get('/queue', controller.queue);
  return router;
}
