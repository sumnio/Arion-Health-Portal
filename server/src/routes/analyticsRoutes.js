import { Router } from 'express';
import { createAnalyticsController } from '../controllers/analyticsController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requirePermission, requireRole } from '../middleware/authorization.js';
import { PERMISSIONS } from '../services/authorizationPolicy.js';

export function createAnalyticsRouter({ authModule, analyticsModule, role }) {
  const router = Router();
  const controller = createAnalyticsController(analyticsModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole(role),
    requirePermission(PERMISSIONS.CLINIC_ANALYTICS_READ),
  );
  router.get('/analytics', controller.analytics);
  return router;
}
