import {
  AUTH_COOKIE_NAME,
  MFA_CHALLENGE_COOKIE_NAME,
  authCookieClearOptions,
  authCookieOptions,
  mfaChallengeCookieClearOptions,
  mfaChallengeCookieOptions,
} from '../services/tokenService.js';
import { validateEmptyBody } from '../validation/inputValidation.js';
import { requestSecurityEvent } from '../services/securityLogger.js';

export function createAuthController({ service, mfaService, nodeEnv }) {
  const cookieOptions = authCookieOptions(nodeEnv);
  const cookieClearOptions = authCookieClearOptions(nodeEnv);
  const challengeCookieOptions = mfaChallengeCookieOptions(nodeEnv);
  const challengeClearOptions = mfaChallengeCookieClearOptions(nodeEnv);

  function finishMfa(request, response, result, event) {
    requestSecurityEvent(request, {
      event,
      severity: 'info',
      outcome: 'success',
      actor_user_profile_id: result.user.user_profile_id,
      actor_role: result.user.role,
    });
    requestSecurityEvent(request, {
      event: 'MFA_VERIFY_SUCCESS',
      severity: 'info',
      outcome: 'success',
      actor_user_profile_id: result.user.user_profile_id,
      actor_role: result.user.role,
    });
    response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, challengeClearOptions);
    response.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
    response.json({ user: result.user });
  }

  return {
    async register(request, response) {
      const user = await service.registerPatient(request.validatedBody);
      response.status(201).json({ user });
    },
    async login(request, response) {
      try {
        const result = await service.login(request.validatedBody);
        if (result.status === 'MFA_SETUP_REQUIRED' || result.status === 'MFA_REQUIRED') {
          response.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions);
          response.cookie(MFA_CHALLENGE_COOKIE_NAME, result.challengeToken, challengeCookieOptions);
          return response.json({ status: result.status });
        }
        requestSecurityEvent(request, {
          event: 'AUTH_LOGIN_SUCCESS', severity: 'info', outcome: 'success',
          actor_user_profile_id: result.user.user_profile_id, actor_role: result.user.role,
        });
        response.cookie(AUTH_COOKIE_NAME, result.token, cookieOptions);
        return response.json({ user: result.user });
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
      response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, challengeClearOptions);
      response.json({ success: true });
    },
    me(request, response) {
      response.json({ user: request.authUser });
    },
    async setupMfa(request, response) {
      const result = await mfaService.setup(request.cookies?.[MFA_CHALLENGE_COOKIE_NAME]);
      requestSecurityEvent(request, { event: 'MFA_SETUP_STARTED', severity: 'info', outcome: 'success' });
      response.json(result);
    },
    async verifyMfaSetup(request, response) {
      try {
        const result = await mfaService.verifySetup(
          request.cookies?.[MFA_CHALLENGE_COOKIE_NAME],
          request.validatedBody.code,
        );
        finishMfa(request, response, result, 'MFA_SETUP_COMPLETED');
      } catch (error) {
        requestSecurityEvent(request, { event: 'MFA_VERIFY_FAILURE', severity: 'warning', outcome: 'denied' });
        throw error;
      }
    },
    async verifyMfa(request, response) {
      try {
        const result = await mfaService.verify(
          request.cookies?.[MFA_CHALLENGE_COOKIE_NAME],
          request.validatedBody.code,
        );
        finishMfa(request, response, result, 'AUTH_LOGIN_SUCCESS');
      } catch (error) {
        requestSecurityEvent(request, { event: 'MFA_VERIFY_FAILURE', severity: 'warning', outcome: 'denied' });
        throw error;
      }
    },
  };
}
