import { apiClient, ApiError } from './apiClient.js';

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
        return result.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          throw new ApiError('Invalid email or password.', { status: error.status, code: error.code });
        }
        throw error;
      }
    },
    async registerPatient(values) {
      const result = await client.request('/api/auth/register', {
        method: 'POST', body: patientRegistrationPayload(values), skipUnauthorizedHandling: true,
      });
      return result.user;
    },
    async logout() {
      return client.request('/api/auth/logout', { method: 'POST', skipUnauthorizedHandling: true });
    },
    async getCurrentUser() {
      const result = await client.request('/api/auth/me', { skipUnauthorizedHandling: true });
      return result.user;
    },
  };
}

export const authService = createAuthService();

