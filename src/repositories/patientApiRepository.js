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
    async rescheduleAppointment(id, payload) { return (await client.request(`/api/patient/appointments/${encodeURIComponent(id)}/reschedule`, { method: 'PATCH', body: payload })).appointment; },
    async uploadSupportingDocuments(appointmentId, files) {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file, file.name));
      return (await client.upload(`/api/patient/appointments/${encodeURIComponent(appointmentId)}/supporting-documents`, formData, { method: 'POST' })).supporting_documents;
    },
    async listSupportingDocuments(appointmentId) {
      return (await client.request(`/api/patient/appointments/${encodeURIComponent(appointmentId)}/supporting-documents`)).supporting_documents;
    },
    async downloadSupportingDocument(appointmentId, documentId) {
      return client.download(`/api/patient/appointments/${encodeURIComponent(appointmentId)}/supporting-documents/${encodeURIComponent(documentId)}`);
    },
    async getRecords() { return (await client.request('/api/patient/records')).medical_records; },
    async getRecord(id) { return (await client.request(`/api/patient/records/${encodeURIComponent(id)}`)).medical_record; },
    async getCertificates() { return (await client.request('/api/patient/certificates')).medical_certificates; },
    async getCertificate(id) { return (await client.request(`/api/patient/certificates/${encodeURIComponent(id)}`)).medical_certificate; },
  };
}

export const patientApiRepository = createPatientApiRepository();
