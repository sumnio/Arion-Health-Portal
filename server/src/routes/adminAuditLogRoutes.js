import { Router } from 'express';
import { createAuditLogController } from '../controllers/auditLogController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requireRole } from '../middleware/authorization.js';

export function createAdminAuditLogRouter({ authModule, auditLogModule }) {
  const router = Router();
  const controller = createAuditLogController(auditLogModule);
  router.get(
    '/audit-logs',
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole('admin'),
    controller.list,
  );
  return router;
}
