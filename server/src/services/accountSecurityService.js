export const REGISTRATION_VERIFICATION_PURPOSE = 'registration_verification';
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function result(valid, reason, record = null) {
  return Object.freeze({ valid, reason, record });
}

function verificationState(challenge, now) {
  if (!challenge) return 'invalid';
  if (challenge.consumed_at) return 'consumed';
  if (challenge.invalidated_at) return 'invalidated';
  if (new Date(challenge.expires_at) <= now) return 'expired';
  if (challenge.attempt_count >= challenge.max_attempts) return 'attempts_exhausted';
  return 'active';
}

function resetState(token, now) {
  if (!token) return 'invalid';
  if (token.consumed_at) return 'consumed';
  if (token.invalidated_at) return 'invalidated';
  if (new Date(token.expires_at) <= now) return 'expired';
  return 'active';
}

export function createAccountSecurityService({ repository, tokens, clock = () => new Date() }) {
  return Object.freeze({
    async createRegistrationVerificationChallenge(accountId, { resendCount = 0 } = {}) {
      const now = clock();
      const code = tokens.generateVerificationCode();
      const challenge = await repository.replaceVerificationChallenge(
        {
          account_id: accountId,
          purpose: REGISTRATION_VERIFICATION_PURPOSE,
          code_hash: tokens.hashVerificationCode(
            accountId,
            REGISTRATION_VERIFICATION_PURPOSE,
            code,
          ),
          expires_at: new Date(now.getTime() + VERIFICATION_CODE_TTL_MS),
          attempt_count: 0,
          max_attempts: VERIFICATION_MAX_ATTEMPTS,
          resend_count: resendCount,
          last_sent_at: now,
          consumed_at: null,
          invalidated_at: null,
        },
        now,
      );
      return { challenge, code };
    },

    async verifyRegistrationCode({ challengeId, accountId, code }) {
      const now = clock();
      const challenge = await repository.findVerificationChallenge(challengeId);
      const state = verificationState(challenge, now);
      if (state !== 'active' || String(challenge.account_id) !== String(accountId)) {
        return result(false, state === 'active' ? 'invalid' : state);
      }
      if (!tokens.verifyVerificationCode(
        accountId,
        REGISTRATION_VERIFICATION_PURPOSE,
        code,
        challenge.code_hash,
      )) {
        const updated = await repository.recordFailedVerificationAttempt(challengeId, now);
        if (!updated || updated.attempt_count >= updated.max_attempts) {
          return result(false, 'attempts_exhausted');
        }
        return result(false, 'invalid');
      }
      const consumed = await repository.consumeVerificationChallenge(challengeId, now);
      return consumed ? result(true, 'verified', consumed) : result(false, 'invalid');
    },

    async issuePasswordResetToken(accountId) {
      const now = clock();
      const token = tokens.generatePasswordResetToken();
      const record = await repository.replacePasswordResetToken(
        {
          account_id: accountId,
          token_hash: tokens.hashPasswordResetToken(token),
          expires_at: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
          consumed_at: null,
          invalidated_at: null,
        },
        now,
      );
      return { record, token };
    },

    async inspectPasswordResetToken(token) {
      const now = clock();
      const tokenHash = tokens.hashPasswordResetToken(token);
      const record = await repository.findPasswordResetTokenByHash(tokenHash);
      const state = resetState(record, now);
      return state === 'active' ? result(true, 'active', record) : result(false, state);
    },

    async consumePasswordResetToken(token) {
      const now = clock();
      const tokenHash = tokens.hashPasswordResetToken(token);
      const record = await repository.findPasswordResetTokenByHash(tokenHash);
      const state = resetState(record, now);
      if (state !== 'active') return result(false, state);
      const consumed = await repository.consumePasswordResetToken(tokenHash, now);
      return consumed ? result(true, 'consumed', consumed) : result(false, 'invalid');
    },
  });
}
