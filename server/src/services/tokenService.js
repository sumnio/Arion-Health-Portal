import jwt from 'jsonwebtoken';

export const AUTH_COOKIE_NAME = 'arion_auth';
export const AUTH_TOKEN_TTL_SECONDS = 8 * 60 * 60;

export function requireAuthSecret(secret) {
  if (!secret?.trim()) {
    throw new Error('AUTH_SECRET is required. Add it to server/.env before starting the API.');
  }
  return secret.trim();
}

export function createTokenService(secret) {
  return {
    sign(userProfileId) {
      return jwt.sign({}, requireAuthSecret(secret), {
        subject: String(userProfileId),
        expiresIn: AUTH_TOKEN_TTL_SECONDS,
        issuer: 'arion-health-api',
        audience: 'arion-health-portal',
      });
    },
    verify(token) {
      return jwt.verify(token, requireAuthSecret(secret), {
        issuer: 'arion-health-api',
        audience: 'arion-health-portal',
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
