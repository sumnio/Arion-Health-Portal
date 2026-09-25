import { Router } from 'express';
import { createStaffAppointmentController } from '../controllers/staffAppointmentController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import {
  requireActiveUser,
  requirePermission,
  requireRole,
} from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createStaffAppointmentRouter({ authModule, patientAppointmentModule }) {
  const router = Router();
  const controller = createStaffAppointmentController(patientAppointmentModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('staff'),
    requirePermission(PERMISSIONS.STAFF_OPERATIONS),
  );
  router.patch('/:appointmentId/confirm', controller.confirm);
  return router;
}
