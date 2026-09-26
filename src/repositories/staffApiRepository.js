import { apiClient } from '../services/apiClient.js';

export function createStaffApiRepository(client = apiClient) {
  const request = (path, options) => client.request(path, options);
  return {
    async getAppointments(date) { return (await request(`/api/staff/appointments?date=${encodeURIComponent(date)}`)).appointments; },
    async getDoctors() { return (await request('/api/staff/doctors')).doctors; },
    async searchPatients(search = '') { return (await request(`/api/staff/patients?search=${encodeURIComponent(search)}`)).patients; },
    async getPatient(id) { return (await request(`/api/staff/patients/${encodeURIComponent(id)}`)).patient; },
    async registerWalkIn(payload) { return (await request('/api/staff/patients/walk-in', { method: 'POST', body: payload })).patient; },
    async createWalkInAppointment(patientId, payload) { return (await request(`/api/staff/patients/${encodeURIComponent(patientId)}/walk-in-appointments`, { method: 'POST', body: payload })).appointment; },
    async getQueue() { return (await request('/api/staff/queue')).queue; },
    async confirmAppointment(id) { return (await request(`/api/staff/appointments/${encodeURIComponent(id)}/confirm`, { method: 'PATCH' })).appointment; },
    async checkIn(id) { return (await request(`/api/staff/appointments/${encodeURIComponent(id)}/check-in`, { method: 'PATCH' })).queue_entry; },
    async updatePriority(id, priority) { return (await request(`/api/staff/appointments/${encodeURIComponent(id)}/priority`, { method: 'PATCH', body: { priority } })).appointment; },
    async markNoShow(id) { return (await request(`/api/staff/appointments/${encodeURIComponent(id)}/no-show`, { method: 'PATCH' })).appointment; },
    async cancelAppointment(id) { return (await request(`/api/staff/appointments/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' })).appointment; },
    async getRecordSummary(patientId) { return (await request(`/api/staff/patients/${encodeURIComponent(patientId)}/record-summary`)).medical_record_summaries; },
  };
}

export const staffApiRepository = createStaffApiRepository();
