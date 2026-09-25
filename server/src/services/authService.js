import { httpError } from '../utils/httpError.js';

const INVALID_CREDENTIALS = 'Invalid email or password.';

function duplicateKey(error) {
  return error?.code === 11000;
}

export function createAuthService({ repository, passwords, tokens }) {
  return {
    async registerPatient(input) {
      if (await repository.findAccountByEmail(input.email)) {
        throw httpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
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
        });
        return registration.profile;
      } catch (error) {
        if (duplicateKey(error)) {
          throw httpError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
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

      return { user: profile, token: tokens.sign(profile.user_profile_id) };
    },

    async getAuthenticatedUser(userProfileId) {
      const profile = await repository.findSafeProfileById(userProfileId);
      if (!profile || profile.status !== 'active') {
        throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
      }
      return profile;
    },
  };
}
