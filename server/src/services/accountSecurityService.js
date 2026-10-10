export const REGISTRATION_VERIFICATION_PURPOSE = 'registration_verification';
export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_SESSION_TTL_MS = 15 * 60 * 1000;

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

function resetSessionState(token, now) {
  if (!token) return 'invalid';
  if (token.invalidated_at || token.session_consumed_at) return 'invalid';
  if (!token.consumed_at || !token.session_expires_at) return 'invalid';
  if (new Date(token.session_expires_at) <= now) return 'expired';
  return 'active';
}

export function createAccountSecurityService({ repository, tokens, clock = () => new Date() }) {
  async function challengeFromSession(sessionToken) {
    if (typeof sessionToken !== 'string' || sessionToken.length < 32) return null;
    return repository.findVerificationChallengeBySessionHash(
      tokens.hashVerificationSessionToken(sessionToken),
    );
  }

  async function verificationContext(sessionToken) {
    const challenge = await challengeFromSession(sessionToken);
    if (!challenge) return null;
    const account = await repository.findVerificationAccount(challenge.account_id);
    if (!account || account.role !== 'patient') return null;
    return { challenge, account };
  }

  async function createChallenge(accountId, { resendCount = 0 } = {}) {
    const now = clock();
    const code = tokens.generateVerificationCode();
    const sessionToken = tokens.generateVerificationSessionToken();
    const challenge = await repository.replaceVerificationChallenge(
      {
        account_id: accountId,
        purpose: REGISTRATION_VERIFICATION_PURPOSE,
        code_hash: tokens.hashVerificationCode(
          accountId,
          REGISTRATION_VERIFICATION_PURPOSE,
          code,
        ),
        session_hash: tokens.hashVerificationSessionToken(sessionToken),
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
    return { challenge, code, sessionToken };
  }

  return Object.freeze({
    async createRegistrationVerificationChallenge(accountId, { resendCount = 0 } = {}) {
      return createChallenge(accountId, { resendCount });
    },

    async createVerificationSession(accountId) {
      const challenge = await repository.findLatestVerificationChallengeForAccount(accountId);
      if (!challenge) return null;
      const sessionToken = tokens.generateVerificationSessionToken();
      const rotated = await repository.rotateVerificationSession(
        challenge._id,
        tokens.hashVerificationSessionToken(sessionToken),
      );
      return rotated ? { challenge: rotated, sessionToken } : null;
    },

    async getRegistrationVerificationStatus(sessionToken) {
      const context = await verificationContext(sessionToken);
      if (!context) return result(false, 'invalid');
      if (context.account.status !== 'active') return result(false, 'inactive');
      if (!context.account.email_verification_required) return result(false, 'already_verified');
      return result(true, verificationState(context.challenge, clock()), context);
    },

    async prepareRegistrationVerificationResend(sessionToken) {
      const context = await verificationContext(sessionToken);
      if (!context) return result(false, 'invalid');
      if (context.account.status !== 'active') return result(false, 'inactive');
      if (!context.account.email_verification_required) return result(false, 'already_verified');
      const replacement = await createChallenge(
        context.account._id,
        { resendCount: (context.challenge.resend_count ?? 0) + 1 },
      );
      return result(true, 'resent', { ...replacement, account: context.account });
    },

    async invalidateRegistrationVerificationChallenge(challengeId) {
      await repository.invalidateVerificationChallenge(challengeId, clock());
    },

    async verifyRegistrationCode({ sessionToken, challengeId, accountId, code }) {
      const now = clock();
      const challenge = sessionToken
        ? await challengeFromSession(sessionToken)
        : await repository.findVerificationChallenge(challengeId);
      const state = verificationState(challenge, now);
      const resolvedAccountId = accountId ?? challenge?.account_id;
      if (state !== 'active' || String(challenge.account_id) !== String(resolvedAccountId)) {
        return result(false, state === 'active' ? 'invalid' : state);
      }
      const account = repository.findVerificationAccount
        ? await repository.findVerificationAccount(resolvedAccountId)
        : null;
      if (repository.findVerificationAccount) {
        if (!account || account.role !== 'patient') return result(false, 'invalid');
        if (account.status !== 'active') return result(false, 'inactive');
        if (!account.email_verification_required) return result(false, 'already_verified');
      }
      if (!tokens.verifyVerificationCode(
        resolvedAccountId,
        REGISTRATION_VERIFICATION_PURPOSE,
        code,
        challenge.code_hash,
      )) {
        const updated = await repository.recordFailedVerificationAttempt(challenge._id, now);
        if (!updated || updated.attempt_count >= updated.max_attempts) {
          return result(false, 'attempts_exhausted');
        }
        return result(false, 'invalid');
      }
      const completed = repository.completeEmailVerification
        ? await repository.completeEmailVerification(challenge._id, resolvedAccountId, now)
        : await repository.consumeVerificationChallenge(challenge._id, now);
      return completed ? result(true, 'verified', completed) : result(false, 'invalid');
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

    async createPasswordResetSession(token) {
      const now = clock();
      const tokenHash = tokens.hashPasswordResetToken(token);
      const record = await repository.findPasswordResetTokenByHash(tokenHash);
      const state = resetState(record, now);
      if (state !== 'active') return result(false, state);
      const account = await repository.findPasswordResetAccount(record.account_id);
      if (!account || account.role !== 'patient' || account.status !== 'active') {
        return result(false, 'invalid');
      }
      const sessionToken = tokens.generatePasswordResetSessionToken();
      const exchanged = await repository.exchangePasswordResetToken(
        tokenHash,
        tokens.hashPasswordResetSessionToken(sessionToken),
        new Date(now.getTime() + PASSWORD_RESET_SESSION_TTL_MS),
        now,
      );
      return exchanged
        ? result(true, 'active', { sessionToken })
        : result(false, 'invalid');
    },

    async getPasswordResetSessionStatus(sessionToken) {
      if (typeof sessionToken !== 'string' || sessionToken.length < 32) {
        return result(false, 'invalid');
      }
      const record = await repository.findPasswordResetTokenBySessionHash(
        tokens.hashPasswordResetSessionToken(sessionToken),
      );
      const state = resetSessionState(record, clock());
      if (state !== 'active') return result(false, state);
      const account = await repository.findPasswordResetAccount(record.account_id);
      if (!account || account.role !== 'patient' || account.status !== 'active') {
        return result(false, 'invalid');
      }
      return result(true, 'active');
    },

    async completePasswordReset(sessionToken, passwordHash) {
      const now = clock();
      if (typeof sessionToken !== 'string' || sessionToken.length < 32) {
        return result(false, 'invalid');
      }
      const sessionHash = tokens.hashPasswordResetSessionToken(sessionToken);
      const record = await repository.findPasswordResetTokenBySessionHash(sessionHash);
      const state = resetSessionState(record, now);
      if (state !== 'active') return result(false, state);
      const completed = await repository.completePasswordReset(sessionHash, passwordHash, now);
      return completed ? result(true, 'completed', completed) : result(false, 'invalid');
    },

    async invalidatePasswordResetToken(id) {
      await repository.invalidatePasswordResetToken(id, clock());
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
