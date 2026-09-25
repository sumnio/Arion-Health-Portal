import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import {
  validateLoginRequest,
  validateRegistrationRequest,
} from '../middleware/validateAuthRequest.js';

export function createAuthRouter({ service, tokens, nodeEnv }) {
  const router = Router();
  const controller = createAuthController({ service, nodeEnv });
  const authenticate = createAuthenticate({ tokens, service });

  router.post('/register', validateRegistrationRequest, controller.register);
  router.post('/login', validateLoginRequest, controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);

  return router;
}
