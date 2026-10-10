import { httpError } from '../utils/httpError.js';

const INVALID_CREDENTIALS = 'Invalid email or password.';
export const FORGOT_PASSWORD_RESPONSE =
  'If a Patient account exists for that email, password reset instructions have been sent.';

function passwordResetError(reason) {
  if (reason === 'expired') {
    return httpError(401, 'PASSWORD_RESET_SESSION_EXPIRED', 'Your password reset session has expired. Request a new link.');
  }
  return httpError(400, 'PASSWORD_RESET_INVALID', 'This password reset link is invalid or has expired.');
}

export function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return 'your email address';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function verificationError(reason) {
  const errors = {
    invalid: [400, 'INVALID_VERIFICATION_CODE', 'The verification code is incorrect.'],
    expired: [400, 'VERIFICATION_CODE_EXPIRED', 'This verification code has expired. Request a new code.'],
    attempts_exhausted: [400, 'VERIFICATION_ATTEMPTS_EXHAUSTED', 'Too many incorrect attempts. Request a new code.'],
    consumed: [400, 'VERIFICATION_CODE_USED', 'This verification code has already been used.'],
    invalidated: [400, 'VERIFICATION_CODE_REPLACED', 'This code was replaced. Use the newest code sent to you.'],
    inactive: [403, 'ACCOUNT_INACTIVE', 'This account is inactive. Contact an administrator for access.'],
    already_verified: [409, 'EMAIL_ALREADY_VERIFIED', 'This email address has already been verified.'],
  };
  const [status, code, message] = errors[reason] ?? [400, 'VERIFICATION_FAILED', 'Email verification could not be completed.'];
  return httpError(status, code, message);
}

function duplicateKey(error) {
  return error?.code === 11000;
}

export function createAuthService({ repository, passwords, tokens, mfa, accountSecurity, email }) {
  return {
    async registerPatient(input) {
      if (await repository.findAccountByEmail(input.email)) {
        throw httpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists. Sign in to continue.');
      }
      if (
        repository.findUnlinkedPatientCandidate &&
        (await repository.findUnlinkedPatientCandidate(input))
      ) {
        throw httpError(
          409,
          'PATIENT_LINK_REVIEW_REQUIRED',
          'An existing patient record must be linked before registration can continue.',
        );
      }

      const passwordHash = await passwords.hash(input.password);
      try {
        const registration = await repository.createPatientRegistration({
          ...input,
          password_hash: passwordHash,
          email_verification_required: Boolean(accountSecurity && email),
          email_verified_at: null,
        });
        if (!accountSecurity || !email) return registration.profile;
        const verification = await accountSecurity.createRegistrationVerificationChallenge(
          registration.account._id,
        );
        try {
          await email.sendRegistrationVerificationEmail({
            to: input.email,
            code: verification.code,
          });
        } catch (error) {
          await accountSecurity.invalidateRegistrationVerificationChallenge(verification.challenge._id);
          throw httpError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'Your account was created, but the verification email could not be sent. Sign in and request a new code.');
        }
        return {
          status: 'EMAIL_VERIFICATION_REQUIRED',
          masked_email: maskEmail(input.email),
          verificationToken: verification.sessionToken,
        };
      } catch (error) {
        if (duplicateKey(error)) {
          throw httpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists. Sign in to continue.');
        }
        throw error;
      }
    },

    async login({ email, password }) {
      const account = await repository.findAccountByEmail(email);
      if (!account || !(await passwords.compare(password, account.password_hash))) {
        throw httpError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
      }

      const profile = await repository.findSafeProfileById(account.user_profile_id);
      if (!profile || profile.status !== 'active') {
        throw httpError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
      }

      if (profile.role === 'patient' && account.email_verification_required) {
        const verification = await accountSecurity?.createVerificationSession(account._id);
        if (!verification) {
          throw httpError(409, 'EMAIL_VERIFICATION_UNAVAILABLE', 'Email verification cannot be resumed. Please contact the clinic.');
        }
        return {
          status: 'EMAIL_VERIFICATION_REQUIRED',
          masked_email: maskEmail(account.email),
          verificationToken: verification.sessionToken,
        };
      }

      if (profile.role === 'admin') {
        if (!mfa) throw new Error('Admin MFA service is not configured.');
        return mfa.begin(profile, account);
      }

      return {
        user: profile,
        token: tokens.sign(profile.user_profile_id, {
          sessionVersion: account.auth_session_version ?? 0,
        }),
      };
    },

    async getEmailVerificationStatus(sessionToken) {
      const status = await accountSecurity.getRegistrationVerificationStatus(sessionToken);
      if (!status.valid) {
        if (status.reason === 'already_verified') return { status: 'EMAIL_VERIFIED' };
        throw httpError(401, 'VERIFICATION_SESSION_REQUIRED', 'Return to login to continue email verification.');
      }
      return {
        status: 'EMAIL_VERIFICATION_REQUIRED',
        masked_email: maskEmail(status.record.account.email),
        code_status: status.reason,
      };
    },

    async verifyEmail(sessionToken, code) {
      const verified = await accountSecurity.verifyRegistrationCode({ sessionToken, code });
      if (!verified.valid) throw verificationError(verified.reason);
      return { status: 'EMAIL_VERIFIED' };
    },

    async resendEmailVerification(sessionToken) {
      const prepared = await accountSecurity.prepareRegistrationVerificationResend(sessionToken);
      if (!prepared.valid) throw verificationError(prepared.reason);
      const { challenge, code, sessionToken: replacementToken, account } = prepared.record;
      try {
        await email.sendRegistrationVerificationEmail({ to: account.email, code });
      } catch {
        await accountSecurity.invalidateRegistrationVerificationChallenge(challenge._id);
        throw httpError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'A new verification email could not be sent. Please try again later.');
      }
      return {
        status: 'EMAIL_VERIFICATION_REQUIRED',
        masked_email: maskEmail(account.email),
        verificationToken: replacementToken,
      };
    },

    async forgotPassword({ email: address }) {
      const account = await repository.findAccountByEmail(address);
      const profile = account
        ? await repository.findSafeProfileById(account.user_profile_id)
        : null;
      if (account && profile?.role === 'patient' && profile.status === 'active') {
        const issued = await accountSecurity.issuePasswordResetToken(account._id);
        try {
          await email.sendPasswordResetEmail({ to: account.email, token: issued.token });
        } catch {
          await accountSecurity.invalidatePasswordResetToken(issued.record._id);
        }
      }
      return { message: FORGOT_PASSWORD_RESPONSE };
    },

    async createPasswordResetSession(token) {
      const created = await accountSecurity.createPasswordResetSession(token);
      if (!created.valid) {
        throw httpError(400, 'PASSWORD_RESET_INVALID', 'This password reset link is invalid or has expired.');
      }
      return {
        status: 'PASSWORD_RESET_SESSION_READY',
        resetSessionToken: created.record.sessionToken,
      };
    },

    async getPasswordResetStatus(sessionToken) {
      const status = await accountSecurity.getPasswordResetSessionStatus(sessionToken);
      if (!status.valid) throw passwordResetError(status.reason);
      return { status: 'PASSWORD_RESET_SESSION_READY' };
    },

    async resetPassword(sessionToken, password) {
      const passwordHash = await passwords.hash(password);
      const completed = await accountSecurity.completePasswordReset(sessionToken, passwordHash);
      if (!completed.valid) throw passwordResetError(completed.reason);
      return { status: 'PASSWORD_RESET_COMPLETED' };
    },

    async getAuthenticatedUser(userProfileId, sessionVersion = 0) {
      let profile;
      if (repository.findAuthenticationContextByProfileId) {
        const context = await repository.findAuthenticationContextByProfileId(userProfileId);
        if (!context || context.sessionVersion !== sessionVersion) {
          throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
        }
        profile = context.profile;
      } else {
        profile = await repository.findSafeProfileById(userProfileId);
      }
      if (!profile) {
        throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
      }
      return profile;
    },
  };
}
