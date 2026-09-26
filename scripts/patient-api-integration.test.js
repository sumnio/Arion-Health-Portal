import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPatientApiRepository } from '../src/repositories/patientApiRepository.js';
import { canCancelPatientAppointment, createPatientApiService, patientBookingDates, patientVisitTypes } from '../src/services/patientApiService.js';

const patient = { id: 'p1', full_name: 'Alex Patient', dob: '1990-01-15', sex: 'male', contact_number: '09171234567', address: null, emergency_contact_name: null, emergency_contact_number: null, emergency_contact_relationship: null, allergies: ['Penicillin'], is_pwd: false };
const doctor = { id: 'd1', display_name: 'Dr. Maria Santos', specialty: 'General Medicine' };
const appointment = { id: 'a1', patient_id: 'p1', doctor, appointment_at: '2026-09-26T02:00:00.000Z', visit_type: 'general_consultation', reason: 'Headache', status: 'pending', priority: 'normal', check_in_at: null };
const record = { id: 'r1', patient, doctor, appointment, encounter_at: '2026-09-20T01:00:00.000Z', diagnosis: 'Migraine', notes: 'Rest', follow_up: null, prescriptions: [{ id: 'rx1', medicine: 'Paracetamol', dosage: '500 mg', instructions: 'As needed' }] };
const certificate = { id: 'c1', medical_certificate_number: 'AHC-1', patient_id: 'p1', doctor: { ...doctor, license_number: 'LIC-1', ptr_number: 'PTR-1', signature_available: true }, medical_record_id: 'r1', date_issued: '2026-09-20', purpose: 'Medical leave', diagnosis_summary: 'Migraine', valid_until: null, status: 'issued', clinic: { name: 'Arion Health Clinic', location: 'Clinic address' } };

test('Patient repository uses the approved authenticated API routes and methods', async () => {
  const calls = []; const client = { async request(path, options = {}) { calls.push([path, options]); if (path === '/api/patient/profile') return { patient }; if (path === '/api/patient/doctors') return { doctors: [doctor] }; if (path.includes('available-slots')) return { slots: [] }; if (path === '/api/patient/appointments' && options.method === 'POST') return { appointment }; if (path === '/api/patient/appointments') return { appointments: [appointment] }; if (path.endsWith('/cancel')) return { appointment: { ...appointment, status: 'cancelled' } }; if (path === '/api/patient/records') return { medical_records: [record] }; if (path === '/api/patient/certificates') return { medical_certificates: [certificate] }; throw new Error(path); } };
  const repository = createPatientApiRepository(client);
  await repository.getProfile(); await repository.getDoctors(); await repository.getAvailableSlots('d1', '2026-09-26'); await repository.createAppointment({}); await repository.getAppointments(); await repository.cancelAppointment('a1'); await repository.getRecords(); await repository.getCertificates();
  assert.deepEqual(calls.map(([path, options]) => [path, options.method ?? 'GET']), [['/api/patient/profile', 'GET'], ['/api/patient/doctors', 'GET'], ['/api/patient/doctors/d1/available-slots?date=2026-09-26', 'GET'], ['/api/patient/appointments', 'POST'], ['/api/patient/appointments', 'GET'], ['/api/patient/appointments/a1/cancel', 'PATCH'], ['/api/patient/records', 'GET'], ['/api/patient/certificates', 'GET']]);
});

test('Patient API service normalizes live profile, appointments, records, and safe certificate details', async () => {
  const repository = { async getProfile() { return patient; }, async updateProfile() { return patient; }, async getDoctors() { return [doctor]; }, async getAvailableSlots() { return { slots: [{ start_time: '10:00', end_time: '10:30', appointment_at: appointment.appointment_at }] }; }, async createAppointment() { return appointment; }, async getAppointments() { return [appointment]; }, async getAppointment() { return appointment; }, async cancelAppointment() { return { ...appointment, status: 'cancelled' }; }, async getRecords() { return [record]; }, async getRecord() { return record; }, async getCertificates() { return [certificate]; }, async getCertificate() { return certificate; } };
  const service = createPatientApiService(repository);
  assert.equal((await service.getProfile()).fullName, 'Alex Patient');
  assert.equal((await service.getAppointments())[0].service, 'General Consultation');
  assert.equal((await service.getRecord('r1')).prescriptions[0].medicine, 'Paracetamol');
  const item = await service.getCertificate('c1');
  assert.equal(item.medical_certificate_number, 'AHC-1'); assert.equal(item.signature_available, true); assert.equal('signature_path' in item, false);
});

test('Patient booking stays within 14 days and uses the three canonical visit types', () => {
  const dates = patientBookingDates(new Date('2026-09-25T12:00:00Z'));
  assert.equal(dates.length, 15); assert.equal(dates.at(-1), '2026-10-09');
  assert.deepEqual(patientVisitTypes.map(item => item.name), ['General Consultation', 'Follow-up', 'Check-up']);
});

test('Patient cancellation is hidden after check-in, record creation, or completion', () => {
  const future = { ...appointment, status: 'confirmed', appointment_at: '2099-09-26T02:00:00.000Z' };
  assert.equal(canCancelPatientAppointment(future), true);
  assert.equal(canCancelPatientAppointment({ ...future, check_in_at: '2099-09-26T01:45:00.000Z' }), false);
  assert.equal(canCancelPatientAppointment({ ...future, has_medical_record: true }), false);
  assert.equal(canCancelPatientAppointment({ ...future, status: 'completed' }), false);
});

test('Patient pages no longer import feature mock services or advertise mock clinical data', async () => {
  const paths = ['PatientDashboard.jsx', 'PatientProfile.jsx', 'PatientBooking.jsx', 'PatientAppointments.jsx', 'PatientAppointmentDetail.jsx', 'PatientRecords.jsx', 'PatientRecordDetail.jsx', 'PatientCertificates.jsx', 'PatientCertificateDetail.jsx'];
  for (const path of paths) {
    const source = await readFile(new URL(`../src/pages/patient/${path}`, import.meta.url), 'utf8');
    assert.match(source, /patientApiService/);
    assert.doesNotMatch(source, /patientDashboardService|patientProfileService|appointmentService\.js|Mock data only|current mock data|mock clinic/);
  }
});
