import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { requireAccountTokenHmacSecret } from '../config/env.js';

export const VERIFICATION_CODE_LENGTH = 6;
export const PASSWORD_RESET_TOKEN_BYTES = 32;
function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAccountTokenService(
  secret,
  nodeEnv = 'development',
  { randomInteger = randomInt, randomByteSource = randomBytes } = {},
) {
  const key = requireAccountTokenHmacSecret(secret, nodeEnv);
  const digest = value => createHmac('sha256', key).update(value).digest('hex');

  function hashVerificationCode(accountId, purpose, code) {
    return digest(`email-verification\0${purpose}\0${String(accountId)}\0${String(code)}`);
  }

  function hashPasswordResetToken(token) {
    return digest(`password-reset\0${String(token)}`);
  }

  return Object.freeze({
    generateVerificationCode() {
      return String(randomInteger(0, 10 ** VERIFICATION_CODE_LENGTH)).padStart(
        VERIFICATION_CODE_LENGTH,
        '0',
      );
    },
    hashVerificationCode,
    verifyVerificationCode(accountId, purpose, code, expectedHash) {
      return safeEqual(hashVerificationCode(accountId, purpose, code), expectedHash);
    },
    generatePasswordResetToken() {
      return randomByteSource(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');
    },
    hashPasswordResetToken,
    verifyPasswordResetToken(token, expectedHash) {
      return safeEqual(hashPasswordResetToken(token), expectedHash);
    },
  });
}
