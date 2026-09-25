import { apiClient } from '../services/apiClient.js';

export function createPatientApiRepository(client = apiClient) {
  return {
    async getProfile() { return (await client.request('/api/patient/profile')).patient; },
    async updateProfile(payload) { return (await client.request('/api/patient/profile', { method: 'PATCH', body: payload })).patient; },
    async getDoctors() { return (await client.request('/api/patient/doctors')).doctors; },
    async getAvailableSlots(doctorId, date) {
      return client.request(`/api/patient/doctors/${encodeURIComponent(doctorId)}/available-slots?date=${encodeURIComponent(date)}`);
    },
    async createAppointment(payload) { return (await client.request('/api/patient/appointments', { method: 'POST', body: payload })).appointment; },
    async getAppointments() { return (await client.request('/api/patient/appointments')).appointments; },
    async getAppointment(id) { return (await client.request(`/api/patient/appointments/${encodeURIComponent(id)}`)).appointment; },
    async cancelAppointment(id) { return (await client.request(`/api/patient/appointments/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' })).appointment; },
    async getRecords() { return (await client.request('/api/patient/records')).medical_records; },
    async getRecord(id) { return (await client.request(`/api/patient/records/${encodeURIComponent(id)}`)).medical_record; },
    async getCertificates() { return (await client.request('/api/patient/certificates')).medical_certificates; },
    async getCertificate(id) { return (await client.request(`/api/patient/certificates/${encodeURIComponent(id)}`)).medical_certificate; },
  };
}

export const patientApiRepository = createPatientApiRepository();
