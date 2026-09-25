import { Router } from 'express';
import { createPatientController } from '../controllers/patientController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import {
  requireActiveUser,
  requirePermission,
  requireRole,
} from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createPatientRouter({ authModule, patientAppointmentModule }) {
  const router = Router();
  const controller = createPatientController(patientAppointmentModule);

  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('patient'),
    requirePermission(PERMISSIONS.PATIENT_SELF_ACCESS),
  );

  router.get('/profile', controller.profile);
  router.patch('/profile', controller.updateProfile);
  router.get('/doctors/:doctorId/available-slots', controller.availableSlots);
  router.post('/appointments', controller.createAppointment);
  router.get('/appointments', controller.listAppointments);
  router.get('/appointments/:appointmentId', controller.appointment);
  router.patch('/appointments/:appointmentId/cancel', controller.cancelAppointment);
  return router;
}
