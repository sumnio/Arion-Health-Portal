import { Router } from 'express';
import { createNotificationController } from '../controllers/notificationController.js';
import { createRequireAuth } from '../middleware/authenticate.js';
import { requireActiveUser, requireRole } from '../middleware/authorization.js';
import { NOTIFICATION_RECIPIENT_ROLES } from '../models/index.js';

export function createNotificationRouter({ authModule, notificationModule }) {
  const router = Router();
  const controller = createNotificationController(notificationModule);
  router.use(
    createRequireAuth({ tokens: authModule.tokens, service: authModule.service }),
    requireActiveUser,
    requireRole(...NOTIFICATION_RECIPIENT_ROLES),
  );
  router.get('/', controller.list);
  router.get('/unread-count', controller.unreadCount);
  router.patch('/read-all', controller.markAllRead);
  router.patch('/:notificationId/read', controller.markRead);
  return router;
}
