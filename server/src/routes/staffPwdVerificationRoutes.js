import { Router } from 'express';
import { createStaffPwdVerificationController } from '../controllers/pwdVerificationController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createStaffPwdVerificationRouter({ authModule, pwdVerificationModule }) {
  const router = Router();
  const controller = createStaffPwdVerificationController(pwdVerificationModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('staff'),
    requirePermission(PERMISSIONS.STAFF_OPERATIONS),
  );
  router.get('/', controller.list);
  router.get('/:verificationId', controller.review);
  router.get('/:verificationId/document', controller.document);
  router.patch('/:verificationId/verify', controller.verify);
  router.patch('/:verificationId/reject', controller.reject);
  return router;
}
