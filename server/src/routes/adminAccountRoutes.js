import { Router } from 'express';
import { createAdminAccountController } from '../controllers/adminAccountController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createAdminAccountRouter({ authModule, adminAccountModule, rateLimiters }) {
  const router = Router(); const controller = createAdminAccountController(adminAccountModule);
  router.use(createRequireAuth({ tokens: authModule.tokens, service: authModule.service }), requireActiveUser, requireRole('admin'), requirePermission(PERMISSIONS.ADMIN_ACCOUNT_MANAGEMENT));
  router.get('/doctors', controller.doctors); router.post('/doctors', rateLimiters.adminProvisionRateLimiter, controller.createDoctor); router.get('/doctors/:doctorId', controller.doctor); router.patch('/doctors/:doctorId', controller.updateDoctor); router.patch('/doctors/:doctorId/deactivate', controller.deactivateDoctor); router.patch('/doctors/:doctorId/reactivate', controller.reactivateDoctor);
  router.get('/staff', controller.staffList); router.post('/staff', rateLimiters.adminProvisionRateLimiter, controller.createStaff); router.get('/staff/:staffId', controller.staffDetail); router.patch('/staff/:staffId', controller.updateStaff); router.patch('/staff/:staffId/deactivate', controller.deactivateStaff); router.patch('/staff/:staffId/reactivate', controller.reactivateStaff);
  router.get('/patients', controller.patients); router.get('/patients/:patientId', controller.patient); router.patch('/patients/:patientId/deactivate', controller.deactivatePatient); router.patch('/patients/:patientId/reactivate', controller.reactivatePatient);
  return router;
}
