import { apiClient } from '../services/apiClient.js';

function queryString(values) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : '';
}

export function createAdminApiRepository(client = apiClient) {
  const request = (path, options) => client.request(path, options);
  return {
    async getDoctors(params = {}) { return (await request(`/api/admin/doctors${queryString(params)}`)).doctors; },
    async getDoctor(id) { return (await request(`/api/admin/doctors/${encodeURIComponent(id)}`)).doctor; },
    async createDoctor(payload) { return (await request('/api/admin/doctors', { method: 'POST', body: payload })).doctor; },
    async updateDoctor(id, payload) { return (await request(`/api/admin/doctors/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).doctor; },
    async deactivateDoctor(id) { return (await request(`/api/admin/doctors/${encodeURIComponent(id)}/deactivate`, { method: 'PATCH' })).doctor; },
    async reactivateDoctor(id) { return (await request(`/api/admin/doctors/${encodeURIComponent(id)}/reactivate`, { method: 'PATCH' })).doctor; },
    async getStaff(params = {}) { return (await request(`/api/admin/staff${queryString(params)}`)).staff; },
    async getStaffMember(id) { return (await request(`/api/admin/staff/${encodeURIComponent(id)}`)).staff; },
    async createStaff(payload) { return (await request('/api/admin/staff', { method: 'POST', body: payload })).staff; },
    async updateStaff(id, payload) { return (await request(`/api/admin/staff/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).staff; },
    async deactivateStaff(id) { return (await request(`/api/admin/staff/${encodeURIComponent(id)}/deactivate`, { method: 'PATCH' })).staff; },
    async reactivateStaff(id) { return (await request(`/api/admin/staff/${encodeURIComponent(id)}/reactivate`, { method: 'PATCH' })).staff; },
    async getPatients(params = {}) { return (await request(`/api/admin/patients${queryString(params)}`)).patients; },
    async getPatient(id) { return (await request(`/api/admin/patients/${encodeURIComponent(id)}`)).patient; },
    async deactivatePatient(id) { return (await request(`/api/admin/patients/${encodeURIComponent(id)}/deactivate`, { method: 'PATCH' })).patient; },
    async reactivatePatient(id) { return (await request(`/api/admin/patients/${encodeURIComponent(id)}/reactivate`, { method: 'PATCH' })).patient; },
  };
}

export const adminApiRepository = createAdminApiRepository();
