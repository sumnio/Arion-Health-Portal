import { Router } from 'express';
import { createPublicAssistantController } from '../controllers/publicAssistantController.js';

export function createPublicAssistantRouter({ publicAssistantModule, rateLimiters }) {
  const router = Router();
  const controller = createPublicAssistantController(publicAssistantModule);
  router.post('/message', rateLimiters.publicAssistantRateLimiter, controller.message);
  return router;
}
