import jwt from 'jsonwebtoken';
import { requireAuthSecret } from '../config/env.js';

export { requireAuthSecret } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'arion_auth';
export const AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60;
export const MFA_CHALLENGE_COOKIE_NAME = 'arion_mfa_challenge';
export const MFA_CHALLENGE_TTL_SECONDS = 10 * 60;

export function createTokenService(secret, nodeEnv = 'development') {
  return {
    sign(userProfileId, { mfaVerified = false } = {}) {
      return jwt.sign(mfaVerified ? { mfa_verified: true } : {}, requireAuthSecret(secret, nodeEnv), {
        subject: String(userProfileId),
        expiresIn: AUTH_TOKEN_TTL_SECONDS,
        issuer: 'arion-health-api',
        audience: 'arion-health-portal',
      });
    },
    verify(token) {
      return jwt.verify(token, requireAuthSecret(secret, nodeEnv), {
        issuer: 'arion-health-api',
        audience: 'arion-health-portal',
      });
    },
    signMfaChallenge(userProfileId, nonce) {
      return jwt.sign({ purpose: 'admin_mfa' }, requireAuthSecret(secret, nodeEnv), {
        subject: String(userProfileId),
        jwtid: nonce,
        expiresIn: MFA_CHALLENGE_TTL_SECONDS,
        issuer: 'arion-health-api',
        audience: 'arion-health-portal:mfa',
      });
    },
    verifyMfaChallenge(token) {
      return jwt.verify(token, requireAuthSecret(secret, nodeEnv), {
        issuer: 'arion-health-api',
        audience: 'arion-health-portal:mfa',
      });
    },
  };
}

export function authCookieOptions(nodeEnv = 'development') {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
    path: '/',
  };
}

export function authCookieClearOptions(nodeEnv = 'development') {
  const { maxAge: _maxAge, ...options } = authCookieOptions(nodeEnv);
  return options;
}

export function mfaChallengeCookieOptions(nodeEnv = 'development') {
  return {
    ...authCookieOptions(nodeEnv),
    maxAge: MFA_CHALLENGE_TTL_SECONDS * 1000,
  };
}

export function mfaChallengeCookieClearOptions(nodeEnv = 'development') {
  const { maxAge: _maxAge, ...options } = mfaChallengeCookieOptions(nodeEnv);
  return options;
}
