import { Router } from 'express';
import { createSmsReminderController } from '../controllers/smsReminderController.js';
import { createCronReminderAuth } from '../middleware/cronReminderAuth.js';

export function createInternalSmsReminderRouter({ smsModule, cronReminderSecret, rateLimiters }) {
  const router = Router();
  const controller = createSmsReminderController({ smsModule });
  router.post(
    '/run',
    rateLimiters.smsSchedulerRateLimiter,
    createCronReminderAuth(cronReminderSecret),
    controller.run,
  );
  return router;
}
