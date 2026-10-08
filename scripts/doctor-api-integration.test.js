import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ApiError } from '../src/services/apiClient.js';
import { createDoctorApiRepository } from '../src/repositories/doctorApiRepository.js';
import { createDoctorApiService, doctorApiErrorMessage } from '../src/services/doctorApiService.js';

const patient = { id: 'p1', full_name: 'Alex Patient', dob: '1990-01-15', sex: 'male', contact_number: '0917', allergies: [], is_pwd: false };
const appointment = { id: 'a1', patient, appointment_at: '2026-09-25T02:00:00.000Z', visit_type: 'general_consultation', reason: 'Headache', status: 'confirmed', priority: 'normal', check_in_at: '2026-09-25T01:45:00.000Z', medical_record_id: null };
const doctor = { id: 'd1', display_name: 'Dr. Maria Santos', specialty: 'General Medicine', license_number: 'LIC-1', ptr_number: 'PTR-1', signature_available: true };
const record = { id: 'r1', patient, doctor, appointment, encounter_at: '2026-09-25T02:10:00.000Z', diagnosis: 'Migraine', notes: null, follow_up: null, prescriptions: [{ id: 'rx1', medicine: 'Paracetamol', dosage: '500 mg', instructions: null }] };
const certificate = { id: 'c1', medical_certificate_number: 'AHC-1', patient_id: 'p1', doctor, medical_record_id: 'r1', date_issued: '2026-09-25', purpose: 'Medical leave', diagnosis_summary: 'Migraine', valid_until: null, status: 'issued', clinic: { name: 'Arion Health Clinic', location: 'Quezon City' } };

test('Doctor repository uses approved live endpoints and keeps scheduling read-only', async () => {
  const calls = []; const client = { async request(path, options = {}) { calls.push([path, options]); if (path.startsWith('/api/doctor/appointments?')) return { appointments: [appointment] }; if (path.endsWith('/priority-history')) return { priority_history: [] }; if (path === '/api/doctor/availability') return { availability: [] }; if (path === '/api/doctor/published-availability') return { published_availability: [] }; if (path === '/api/doctor/blocked-times') return { blocked_times: [] }; if (path.includes('/patients/')) return { medical_records: [], medical_certificates: [] }; if (path.includes('/medical-record')) return { medical_record: record }; if (path.includes('/certificates') && options.method === 'POST') return { medical_certificate: certificate }; if (path.includes('/certificates/')) return { medical_certificate: certificate }; if (path.endsWith('/complete')) return { appointment: { ...appointment, status: 'completed' } }; throw new Error(path); } };
  const repository = createDoctorApiRepository(client);
  await repository.getAppointments({ date: '2026-09-25', patientId: 'p1' }); await repository.getPriorityHistory('a1'); await repository.getRecurringAvailability(); await repository.getPublishedAvailability(); await repository.getBlockedTimes(); await repository.getPatientHistory('p1'); await repository.createMedicalRecord('a1', { diagnosis: 'A' }); await repository.createCertificate('r1', { purpose: 'A' }); await repository.getCertificate('c1'); await repository.completeAppointment('a1');
  assert(calls.every(([, options]) => !options.body || !('doctor_id' in options.body)));
  assert(calls.some(([path]) => path === '/api/doctor/appointments?date=2026-09-25&patient_id=p1'));
  assert(calls.filter(([path]) => path.includes('/api/doctor/availability') || path.includes('/published-availability') || path.includes('/blocked-times')).every(([, options]) => !options.method || options.method === 'GET'));
  assert(calls.some(([path, options]) => path === '/api/doctor/appointments/a1/complete' && options.method === 'PATCH'));
});

test('Doctor service normalizes consultation context and submits prescriptions without ownership fields', async () => {
  let recordPayload; let certificatePayload; let refreshedCertificate = false;
  const repository = { async getAppointments() { return [appointment]; }, async getPriorityHistory() { return [{ id: 'pa1', urgency_reason: 'Severe pain or discomfort' }]; }, async getPatientHistory() { return { medical_records: [], medical_certificates: [] }; }, async createMedicalRecord(_id, payload) { recordPayload = payload; return record; }, async createCertificate(_id, payload) { certificatePayload = payload; return certificate; }, async getCertificate() { refreshedCertificate = true; return certificate; } };
  const service = createDoctorApiService(repository); const context = await service.getPatientContext('p1', { appointmentId: 'a1' }); assert.equal(context.patient.full_name, 'Alex Patient'); assert.equal(context.canAddRecord, true); assert.equal(context.priorityHistory[0].urgency_reason,'Severe pain or discomfort');
  await service.createMedicalRecord('a1', { diagnosis: ' Migraine ', notes: '', follow_up: '', prescriptions: [{ medicine: ' Drug ', dosage: ' 5 mg ', instructions: '' }] });
  assert.deepEqual(recordPayload, { diagnosis: 'Migraine', notes: null, follow_up: null, prescriptions: [{ medicine: 'Drug', dosage: '5 mg', instructions: null }] });
  const issued = await service.issueCertificate('r1', { purpose: ' Work ', diagnosis_summary: ' Well ', date_issued: '2026-09-25', valid_until: '' }, 'Alex Patient');
  assert.equal(certificatePayload.medical_certificate_number, undefined); assert.equal(certificatePayload.status, undefined); assert.equal(refreshedCertificate, true); assert.equal(issued.medical_certificate_number, 'AHC-1'); assert.equal('signature_path' in issued, false);
});

test('Doctor API errors expose safe backend business messages', () => { assert.equal(doctorApiErrorMessage(new ApiError('Blocked time overlaps an existing active appointment.', { status: 409, code: 'BLOCK_OVERLAPS_APPOINTMENT' })), 'Blocked time overlaps an existing active appointment.'); });

test('Doctor service derives a unique related-Patient list only from assigned appointments', async () => {
  const future = { ...appointment, id: 'a2', appointment_at: '2026-09-26T02:00:00.000Z', status: 'pending' };
  const otherPatient = { ...patient, id: 'p2', full_name: 'Bea Patient' };
  const repository = { async getAppointments() { return [appointment, future, { ...appointment, id: 'a3', patient: otherPatient, appointment_at: '2026-09-23T02:00:00.000Z', status: 'completed' }]; } };
  const patients = await createDoctorApiService(repository).getRelatedPatients(new Date('2026-09-25T03:00:00.000Z'));
  assert.deepEqual(patients.map((item) => item.patient.id), ['p1', 'p2']);
  assert.equal(patients[0].mostRecentAppointment.id, 'a1');
  assert.equal(patients[0].upcomingAppointment.id, 'a2');
  assert.equal(patients[0].relatedAppointment.id, 'a2');
  assert.equal(patients[1].upcomingAppointment, null);
});

test('Doctor pages use the live Doctor API service and contain no feature mock fallback', async () => {
  for (const file of ['DoctorDashboard.jsx', 'DoctorSchedule.jsx', 'DoctorPatients.jsx', 'DoctorPatientDetail.jsx', 'DoctorAddRecord.jsx', 'DoctorIssueCertificate.jsx']) {
    const source = await readFile(new URL(`../src/pages/doctor/${file}`, import.meta.url), 'utf8');
    assert.match(source, /doctorApiService/); assert.doesNotMatch(source, /doctorDashboardService|doctorPatientService|doctorRecordService|doctorCertificateService|Mock snapshot|mock preview/i);
  }
  const availability = await readFile(new URL('../src/components/scheduling/DoctorAvailabilityManager.jsx', import.meta.url), 'utf8');
  assert.match(availability, /Read-only schedule/);
  assert.match(availability, /Working Hours/);
  assert.match(availability, /Available Booking Dates/);
  assert.match(availability, /Time Off \/ Unavailable/);
  assert.doesNotMatch(availability, /createRecurring|updateRecurring|removeRecurring|Publish Range|Add Block/);
  const detail = await readFile(new URL('../src/pages/doctor/DoctorPatientDetail.jsx', import.meta.url), 'utf8');
  for (const tab of ['Overview', 'Consultation', 'Medical Records', 'Certificates']) assert.match(detail, new RegExp(tab));
  const patients = await readFile(new URL('../src/pages/doctor/DoctorPatients.jsx', import.meta.url), 'utf8');
  assert.match(patients, /getRelatedPatients/);
  assert.match(patients, /No related patients found/);
});
