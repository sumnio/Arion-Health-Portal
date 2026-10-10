import {
  AUTH_COOKIE_NAME,
  MFA_CHALLENGE_COOKIE_NAME,
  EMAIL_VERIFICATION_COOKIE_NAME,
  PASSWORD_RESET_COOKIE_NAME,
  authCookieClearOptions,
  authCookieOptions,
  mfaChallengeCookieClearOptions,
  mfaChallengeCookieOptions,
  emailVerificationCookieOptions,
  emailVerificationCookieClearOptions,
  passwordResetCookieOptions,
  passwordResetCookieClearOptions,
} from '../services/tokenService.js';
import { validateEmptyBody } from '../validation/inputValidation.js';
import { requestSecurityEvent } from '../services/securityLogger.js';

export function createAuthController({ service, mfaService, nodeEnv }) {
  const cookieOptions = authCookieOptions(nodeEnv);
  const cookieClearOptions = authCookieClearOptions(nodeEnv);
  const challengeCookieOptions = mfaChallengeCookieOptions(nodeEnv);
  const challengeClearOptions = mfaChallengeCookieClearOptions(nodeEnv);
  const verificationCookieOptions = emailVerificationCookieOptions(nodeEnv);
  const verificationCookieClearOptions = emailVerificationCookieClearOptions(nodeEnv);
  const resetCookieOptions = passwordResetCookieOptions(nodeEnv);
  const resetCookieClearOptions = passwordResetCookieClearOptions(nodeEnv);

  function beginEmailVerification(response, result, status = 200) {
    response.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions);
    response.cookie(
      EMAIL_VERIFICATION_COOKIE_NAME,
      result.verificationToken,
      verificationCookieOptions,
    );
    return response.status(status).json({
      status: result.status,
      masked_email: result.masked_email,
    });
  }

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
      const result = await service.registerPatient(request.validatedBody);
      if (result.status !== 'EMAIL_VERIFICATION_REQUIRED') {
        return response.status(201).json({ user: result });
      }
      return beginEmailVerification(response, result, 201);
    },
    async login(request, response) {
      try {
        const result = await service.login(request.validatedBody);
        if (result.status === 'EMAIL_VERIFICATION_REQUIRED') {
          requestSecurityEvent(request, {
            event: 'AUTH_EMAIL_VERIFICATION_REQUIRED', severity: 'info', outcome: 'denied',
          });
          return beginEmailVerification(response, result);
        }
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
      response.clearCookie(EMAIL_VERIFICATION_COOKIE_NAME, verificationCookieClearOptions);
      response.clearCookie(PASSWORD_RESET_COOKIE_NAME, resetCookieClearOptions);
      response.json({ success: true });
    },
    me(request, response) {
      response.json({ user: request.authUser });
    },
    async emailVerificationStatus(request, response) {
      const result = await service.getEmailVerificationStatus(
        request.cookies?.[EMAIL_VERIFICATION_COOKIE_NAME],
      );
      response.json(result);
    },
    async verifyEmail(request, response) {
      const result = await service.verifyEmail(
        request.cookies?.[EMAIL_VERIFICATION_COOKIE_NAME],
        request.validatedBody.code,
      );
      requestSecurityEvent(request, {
        event: 'EMAIL_VERIFICATION_SUCCESS', severity: 'info', outcome: 'success',
      });
      response.clearCookie(EMAIL_VERIFICATION_COOKIE_NAME, verificationCookieClearOptions);
      response.json(result);
    },
    async resendEmailVerification(request, response) {
      validateEmptyBody(request.body);
      const result = await service.resendEmailVerification(
        request.cookies?.[EMAIL_VERIFICATION_COOKIE_NAME],
      );
      response.cookie(
        EMAIL_VERIFICATION_COOKIE_NAME,
        result.verificationToken,
        verificationCookieOptions,
      );
      requestSecurityEvent(request, {
        event: 'EMAIL_VERIFICATION_RESENT', severity: 'info', outcome: 'success',
      });
      response.json({ status: result.status, masked_email: result.masked_email });
    },
    async forgotPassword(request, response) {
      const result = await service.forgotPassword(request.validatedBody);
      requestSecurityEvent(request, {
        event: 'PASSWORD_RESET_REQUESTED', severity: 'info', outcome: 'accepted',
      });
      response.json(result);
    },
    async createPasswordResetSession(request, response) {
      try {
        const result = await service.createPasswordResetSession(request.validatedBody.token);
        response.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions);
        response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, challengeClearOptions);
        response.cookie(PASSWORD_RESET_COOKIE_NAME, result.resetSessionToken, resetCookieOptions);
        requestSecurityEvent(request, {
          event: 'PASSWORD_RESET_SESSION_CREATED', severity: 'info', outcome: 'success',
        });
        response.json({ status: result.status });
      } catch (error) {
        requestSecurityEvent(request, {
          event: 'PASSWORD_RESET_FAILED', severity: 'warning', outcome: 'denied',
          metadata: { stage: 'session_exchange' },
        });
        throw error;
      }
    },
    async passwordResetStatus(request, response) {
      const result = await service.getPasswordResetStatus(
        request.cookies?.[PASSWORD_RESET_COOKIE_NAME],
      );
      response.json(result);
    },
    async resetPassword(request, response) {
      try {
        const result = await service.resetPassword(
          request.cookies?.[PASSWORD_RESET_COOKIE_NAME],
          request.validatedBody.password,
        );
        response.clearCookie(PASSWORD_RESET_COOKIE_NAME, resetCookieClearOptions);
        response.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions);
        response.clearCookie(MFA_CHALLENGE_COOKIE_NAME, challengeClearOptions);
        requestSecurityEvent(request, {
          event: 'PASSWORD_RESET_COMPLETED', severity: 'info', outcome: 'success',
        });
        response.json(result);
      } catch (error) {
        requestSecurityEvent(request, {
          event: 'PASSWORD_RESET_FAILED', severity: 'warning', outcome: 'denied',
          metadata: { stage: 'password_update' },
        });
        throw error;
      }
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
