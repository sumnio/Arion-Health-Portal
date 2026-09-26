import { AUTH_COOKIE_NAME, authCookieClearOptions, authCookieOptions } from '../services/tokenService.js';
import { validateEmptyBody } from '../validation/inputValidation.js';

export function createAuthController({ service, nodeEnv }) {
  const cookieOptions = authCookieOptions(nodeEnv);
  const cookieClearOptions = authCookieClearOptions(nodeEnv);

  return {
    async register(request, response) {
      const user = await service.registerPatient(request.validatedBody);
      response.status(201).json({ user });
    },
    async login(request, response) {
      const result = await service.login(request.validatedBody);
      response.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
      response.json({ user: result.user });
    },
    logout(request, response) {
      validateEmptyBody(request.body);
      response.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions);
      response.json({ success: true });
    },
    me(request, response) {
      response.json({ user: request.authUser });
    },
  };
}
