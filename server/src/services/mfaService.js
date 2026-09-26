import { createHash, randomBytes } from 'node:crypto';
import { MFA_CHALLENGE_TTL_SECONDS } from './tokenService.js';
import { httpError } from '../utils/httpError.js';

const CHALLENGE_ERROR = () => httpError(
  401,
  'MFA_CHALLENGE_INVALID',
  'The MFA challenge is missing, expired, or already used. Please log in again.',
);

function challengeHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createMfaService({ repository, tokens, encryption, totp, now = () => new Date() }) {
  async function challengeContext(token) {
    if (!token) throw CHALLENGE_ERROR();
    let payload;
    try {
      payload = tokens.verifyMfaChallenge(token);
    } catch {
      throw CHALLENGE_ERROR();
    }
    if (payload.purpose !== 'admin_mfa' || !payload.sub) throw CHALLENGE_ERROR();
    const account = await repository.findAccountForMfa(payload.sub);
    const hash = challengeHash(token);
    if (
      !account ||
      account.mfa_challenge_hash !== hash ||
      !account.mfa_challenge_expires_at ||
      new Date(account.mfa_challenge_expires_at) <= now()
    ) throw CHALLENGE_ERROR();
    const profile = await repository.findSafeProfileById(payload.sub);
    if (!profile || profile.role !== 'admin' || profile.status !== 'active') throw CHALLENGE_ERROR();
    return { account, profile, hash };
  }

  return Object.freeze({
    async begin(profile, account) {
      const nonce = randomBytes(24).toString('base64url');
      const token = tokens.signMfaChallenge(profile.user_profile_id, nonce);
      const expiresAt = new Date(now().getTime() + MFA_CHALLENGE_TTL_SECONDS * 1000);
      const stored = await repository.setMfaChallenge(profile.user_profile_id, {
        challengeHash: challengeHash(token),
        expiresAt,
      });
      if (!stored) throw httpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      return {
        status: account.mfa_enabled ? 'MFA_REQUIRED' : 'MFA_SETUP_REQUIRED',
        challengeToken: token,
      };
    },

    async setup(token) {
      const { account, profile, hash } = await challengeContext(token);
      if (account.mfa_enabled) {
        throw httpError(409, 'MFA_ALREADY_ENROLLED', 'MFA is already configured for this account.');
      }
      const enrollment = totp.createEnrollment(account.email);
      const stored = await repository.setPendingMfaSecret(
        profile.user_profile_id,
        hash,
        encryption.encrypt(enrollment.secret),
        now(),
      );
      if (!stored) throw CHALLENGE_ERROR();
      return { otpauth_uri: enrollment.uri, manual_key: enrollment.secret };
    },

    async verifySetup(token, code) {
      const { account, profile, hash } = await challengeContext(token);
      if (account.mfa_enabled || !account.mfa_pending_secret_encrypted) {
        throw httpError(409, 'MFA_SETUP_REQUIRED', 'Start MFA setup before verifying a code.');
      }
      const secret = encryption.decrypt(account.mfa_pending_secret_encrypted);
      if (!(await totp.verify(code, secret))) {
        throw httpError(401, 'INVALID_MFA_CODE', 'The verification code is invalid or expired.');
      }
      const enrolledAt = now();
      const completed = await repository.completeMfaEnrollment(
        profile.user_profile_id,
        hash,
        account.mfa_pending_secret_encrypted,
        enrolledAt,
      );
      if (!completed) throw CHALLENGE_ERROR();
      return { user: profile, token: tokens.sign(profile.user_profile_id, { mfaVerified: true }) };
    },

    async verify(token, code) {
      const { account, profile, hash } = await challengeContext(token);
      if (!account.mfa_enabled || !account.mfa_secret_encrypted) {
        throw httpError(409, 'MFA_SETUP_REQUIRED', 'MFA setup is required for this Admin account.');
      }
      const secret = encryption.decrypt(account.mfa_secret_encrypted);
      if (!(await totp.verify(code, secret))) {
        throw httpError(401, 'INVALID_MFA_CODE', 'The verification code is invalid or expired.');
      }
      if (!(await repository.consumeMfaChallenge(profile.user_profile_id, hash, now()))) {
        throw CHALLENGE_ERROR();
      }
      return { user: profile, token: tokens.sign(profile.user_profile_id, { mfaVerified: true }) };
    },
  });
}
