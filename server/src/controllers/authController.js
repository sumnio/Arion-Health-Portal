import { AUTH_COOKIE_NAME, authCookieClearOptions, authCookieOptions } from '../services/tokenService.js';
import { validateEmptyBody } from '../validation/inputValidation.js';
import { requestSecurityEvent } from '../services/securityLogger.js';

export function createAuthController({ service, nodeEnv }) {
  const cookieOptions = authCookieOptions(nodeEnv);
  const cookieClearOptions = authCookieClearOptions(nodeEnv);

  return {
    async register(request, response) {
      const user = await service.registerPatient(request.validatedBody);
      response.status(201).json({ user });
    },
    async login(request, response) {
      try {
        const result = await service.login(request.validatedBody);
        requestSecurityEvent(request, {
          event: 'AUTH_LOGIN_SUCCESS', severity: 'info', outcome: 'success',
          actor_user_profile_id: result.user.user_profile_id, actor_role: result.user.role,
        });
        response.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
        response.json({ user: result.user });
      } catch (error) {
        requestSecurityEvent(request, {
          event: 'AUTH_LOGIN_FAILURE', severity: 'warning', outcome: 'denied',
          metadata: { reason: 'invalid_credentials_or_account' },
        });
        throw error;
      }
    },
    logout(request, response) {
      validateEmptyBody(request.body);
      requestSecurityEvent(request, { event: 'AUTH_LOGOUT', severity: 'info', outcome: 'success' });
      response.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions);
      response.json({ success: true });
    },
    me(request, response) {
      response.json({ user: request.authUser });
    },
  };
}
