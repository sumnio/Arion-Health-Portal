import { Router } from 'express';
import { createPortalInvitationController } from '../controllers/portalInvitationController.js';

export function createPortalInvitationRouter({ portalInvitationModule, rateLimiters }) {
  const router = Router(); const controller = createPortalInvitationController(portalInvitationModule);
  router.get('/:token', controller.inspect);
  router.post('/:token/send-code', rateLimiters.verificationResendRateLimiter, controller.sendCode);
  router.post('/:token/verify-code', rateLimiters.verificationAttemptRateLimiter, controller.verifyCode);
  router.post('/:token/complete', rateLimiters.passwordResetRateLimiter, controller.complete);
  return router;
}
