import { apiClient, ApiError } from './apiClient.js';
import { canonicalizePhilippineMobile } from './phoneNumber.js';

const registrationFields = [
  'email', 'password', 'display_name', 'full_name', 'contact_number', 'dob', 'sex',
  'address', 'emergency_contact_name', 'emergency_contact_number',
  'emergency_contact_relationship', 'allergies', 'is_pwd',
];

function patientRegistrationPayload(values) {
  const payload = {};
  for (const field of registrationFields) {
    if (values[field] !== undefined) payload[field] = values[field];
  }
  payload.full_name = payload.full_name || payload.display_name;
  if (payload.contact_number != null) payload.contact_number = canonicalizePhilippineMobile(payload.contact_number);
  if (payload.emergency_contact_number != null) payload.emergency_contact_number = canonicalizePhilippineMobile(payload.emergency_contact_number) || null;
  payload.allergies = payload.allergies || [];
  payload.is_pwd = payload.is_pwd ?? false;
  return payload;
}

export function createAuthService(client = apiClient) {
  return {
    async login({ email, password }) {
      try {
        const result = await client.request('/api/auth/login', {
          method: 'POST', body: { email, password }, skipUnauthorizedHandling: true,
        });
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          throw new ApiError('Invalid email or password.', { status: error.status, code: error.code });
        }
        throw error;
      }
    },
    async registerPatient(values) {
      return client.request('/api/auth/register', {
        method: 'POST', body: patientRegistrationPayload(values), skipUnauthorizedHandling: true,
      });
    },
    async getEmailVerificationStatus() {
      return client.request('/api/auth/verification-status', { skipUnauthorizedHandling: true });
    },
    async verifyEmail(code) {
      return client.request('/api/auth/verify-email', {
        method: 'POST', body: { code }, skipUnauthorizedHandling: true,
      });
    },
    async resendEmailVerification() {
      return client.request('/api/auth/resend-verification', {
        method: 'POST', skipUnauthorizedHandling: true,
      });
    },
    async forgotPassword(email) {
      return client.request('/api/auth/forgot-password', {
        method: 'POST', body: { email }, skipUnauthorizedHandling: true,
      });
    },
    async createPasswordResetSession(token) {
      return client.request('/api/auth/password-reset/session', {
        method: 'POST', body: { token }, skipUnauthorizedHandling: true,
      });
    },
    async getPasswordResetStatus() {
      return client.request('/api/auth/password-reset/status', {
        skipUnauthorizedHandling: true,
      });
    },
    async resetPassword(password, confirmPassword) {
      return client.request('/api/auth/reset-password', {
        method: 'POST',
        body: { password, confirm_password: confirmPassword },
        skipUnauthorizedHandling: true,
      });
    },
    async logout() {
      return client.request('/api/auth/logout', { method: 'POST', skipUnauthorizedHandling: true });
    },
    async getCurrentUser() {
      const result = await client.request('/api/auth/me', { skipUnauthorizedHandling: true });
      return result.user;
    },
    async startMfaSetup() {
      return client.request('/api/auth/mfa/setup', {
        method: 'POST', skipUnauthorizedHandling: true,
      });
    },
    async verifyMfaSetup(code) {
      return client.request('/api/auth/mfa/verify-setup', {
        method: 'POST', body: { code }, skipUnauthorizedHandling: true,
      });
    },
    async verifyMfa(code) {
      return client.request('/api/auth/mfa/verify', {
        method: 'POST', body: { code }, skipUnauthorizedHandling: true,
      });
    },
  };
}

export const authService = createAuthService();

