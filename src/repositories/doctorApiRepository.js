import { apiClient } from '../services/apiClient.js';

export function createDoctorApiRepository(client = apiClient) {
  const request = (path, options) => client.request(path, options);
  return {
    async getAppointments(filters = {}) {
      const query = new URLSearchParams();
      if (filters.date) query.set('date', filters.date);
      if (filters.patientId) query.set('patient_id', filters.patientId);
      const suffix = query.size ? `?${query}` : '';
      return (await request(`/api/doctor/appointments${suffix}`)).appointments;
    },
    async getRecurringAvailability() { return (await request('/api/doctor/availability')).availability; },
    async createRecurringAvailability(payload) { return (await request('/api/doctor/availability', { method: 'POST', body: payload })).availability; },
    async updateRecurringAvailability(id, payload) { return (await request(`/api/doctor/availability/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })).availability; },
    async deleteRecurringAvailability(id) { return request(`/api/doctor/availability/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async getPublishedAvailability() { return (await request('/api/doctor/published-availability')).published_availability; },
    async createPublishedAvailability(payload) { return (await request('/api/doctor/published-availability', { method: 'POST', body: payload })).published_availability; },
    async deletePublishedAvailability(id) { return request(`/api/doctor/published-availability/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async getBlockedTimes() { return (await request('/api/doctor/blocked-times')).blocked_times; },
    async createBlockedTime(payload) { return (await request('/api/doctor/blocked-times', { method: 'POST', body: payload })).blocked_time; },
    async deleteBlockedTime(id) { return request(`/api/doctor/blocked-times/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async getPatientHistory(patientId) { return request(`/api/doctor/patients/${encodeURIComponent(patientId)}/records`); },
    async getRecord(recordId) { return (await request(`/api/doctor/records/${encodeURIComponent(recordId)}`)).medical_record; },
    async createMedicalRecord(appointmentId, payload) { return (await request(`/api/doctor/appointments/${encodeURIComponent(appointmentId)}/medical-record`, { method: 'POST', body: payload })).medical_record; },
    async createCertificate(recordId, payload) { return (await request(`/api/doctor/records/${encodeURIComponent(recordId)}/certificates`, { method: 'POST', body: payload })).medical_certificate; },
    async getCertificate(certificateId) { return (await request(`/api/doctor/certificates/${encodeURIComponent(certificateId)}`)).medical_certificate; },
    async completeAppointment(appointmentId) { return (await request(`/api/doctor/appointments/${encodeURIComponent(appointmentId)}/complete`, { method: 'PATCH' })).appointment; },
  };
}

export const doctorApiRepository = createDoctorApiRepository();
