import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPatientApiRepository } from '../src/repositories/patientApiRepository.js';
import {
  canCancelPatientAppointment,
  canReschedulePatientAppointment,
  createPatientApiService,
  formatPatientVisitReason,
  OTHER_CONCERN_PREFIX,
  paginatePatientAppointments,
  paginatePatientList,
  PATIENT_APPOINTMENTS_PAGE_SIZE,
  PATIENT_LIST_PAGE_SIZE,
  PATIENT_REASON_MAX_LENGTH,
  patientBookingDates,
  patientVisitReasons,
  patientVisitTypes,
} from '../src/services/patientApiService.js';

const patient = { id: 'p1', full_name: 'Alex Patient', dob: '1990-01-15', sex: 'male', contact_number: '09171234567', address: null, emergency_contact_name: null, emergency_contact_number: null, emergency_contact_relationship: null, allergies: ['Penicillin'], is_pwd: false };
const doctor = { id: 'd1', display_name: 'Dr. Maria Santos', specialty: 'General Medicine' };
const appointment = { id: 'a1', patient_id: 'p1', doctor, appointment_at: '2026-09-26T02:00:00.000Z', visit_type: 'general_consultation', reason: 'Headache', status: 'pending', priority: 'normal', check_in_at: null, patient_created: true };
const record = { id: 'r1', patient, doctor, appointment, encounter_at: '2026-09-20T01:00:00.000Z', diagnosis: 'Migraine', notes: 'Rest', follow_up: null, prescriptions: [{ id: 'rx1', medicine: 'Paracetamol', dosage: '500 mg', instructions: 'As needed' }] };
const certificate = { id: 'c1', medical_certificate_number: 'AHC-1', patient_id: 'p1', doctor: { ...doctor, license_number: 'LIC-1', ptr_number: 'PTR-1', signature_available: true }, medical_record_id: 'r1', date_issued: '2026-09-20', purpose: 'Medical leave', diagnosis_summary: 'Migraine', valid_until: null, status: 'issued', clinic: { name: 'Arion Health Clinic', location: 'Clinic address' } };

test('Patient repository uses the approved authenticated API routes and methods', async () => {
  const calls = []; const client = { async request(path, options = {}) { calls.push([path, options]); if (path === '/api/patient/profile') return { patient }; if (path === '/api/patient/doctors') return { doctors: [doctor] }; if (path.includes('available-slots')) return { slots: [] }; if (path === '/api/patient/appointments' && options.method === 'POST') return { appointment }; if (path === '/api/patient/appointments') return { appointments: [appointment] }; if (path.endsWith('/cancel')) return { appointment: { ...appointment, status: 'cancelled' } }; if (path.endsWith('/reschedule')) return { appointment: { ...appointment, appointment_at: options.body.appointment_at } }; if (path === '/api/patient/records') return { medical_records: [record] }; if (path === '/api/patient/certificates') return { medical_certificates: [certificate] }; throw new Error(path); } };
  const repository = createPatientApiRepository(client);
  await repository.getProfile(); await repository.getDoctors(); await repository.getAvailableSlots('d1', '2026-09-26'); await repository.createAppointment({}); await repository.getAppointments(); await repository.cancelAppointment('a1'); await repository.rescheduleAppointment('a1', { appointment_at: '2026-09-27T02:00:00.000Z' }); await repository.getRecords(); await repository.getCertificates();
  assert.deepEqual(calls.map(([path, options]) => [path, options.method ?? 'GET']), [['/api/patient/profile', 'GET'], ['/api/patient/doctors', 'GET'], ['/api/patient/doctors/d1/available-slots?date=2026-09-26', 'GET'], ['/api/patient/appointments', 'POST'], ['/api/patient/appointments', 'GET'], ['/api/patient/appointments/a1/cancel', 'PATCH'], ['/api/patient/appointments/a1/reschedule', 'PATCH'], ['/api/patient/records', 'GET'], ['/api/patient/certificates', 'GET']]);
});

test('Patient API service normalizes live profile, appointments, records, and safe certificate details', async () => {
  const repository = { async getProfile() { return patient; }, async updateProfile() { return patient; }, async getDoctors() { return [doctor]; }, async getAvailableSlots() { return { slots: [{ start_time: '10:00', end_time: '10:30', appointment_at: appointment.appointment_at, available: false, occupied: true }] }; }, async createAppointment() { return appointment; }, async getAppointments() { return [appointment]; }, async getAppointment() { return appointment; }, async cancelAppointment() { return { ...appointment, status: 'cancelled' }; }, async rescheduleAppointment() { return { ...appointment, appointment_at: '2026-09-27T02:00:00.000Z' }; }, async getRecords() { return [record]; }, async getRecord() { return record; }, async getCertificates() { return [certificate]; }, async getCertificate() { return certificate; } };
  const service = createPatientApiService(repository);
  assert.equal((await service.getProfile()).fullName, 'Alex Patient');
  assert.equal((await service.getAppointments())[0].service, 'General Consultation');
  assert.deepEqual(await service.getAvailableSlots('d1', '2026-09-26'), [{ start_time: '10:00', end_time: '10:30', appointment_at: appointment.appointment_at, time: '10:00', available: false, occupied: true }]);
  assert.equal((await service.getRecord('r1')).prescriptions[0].medicine, 'Paracetamol');
  const item = await service.getCertificate('c1');
  assert.equal(item.medical_certificate_number, 'AHC-1'); assert.equal(item.signature_available, true); assert.equal('signature_path' in item, false);
});

test('Patient booking stays within 14 days and uses the three canonical visit types', () => {
  const dates = patientBookingDates(new Date('2026-09-25T12:00:00Z'));
  assert.equal(dates.length, 15); assert.equal(dates.at(-1), '2026-10-09');
  assert.deepEqual(patientVisitTypes.map(item => item.name), ['General Consultation', 'Follow-up', 'Check-up']);
});

test('Patient booking exposes the exact approved visit reasons', () => {
  assert.deepEqual(patientVisitReasons, [
    'General health concern',
    'Fever, cough, or cold symptoms',
    'Headache or dizziness',
    'Stomach pain or digestive concern',
    'Blood pressure concern',
    'Follow-up consultation',
    'Routine health check',
    'Laboratory results discussion',
    'Medical clearance consultation',
    'Other concern',
  ]);
});

test('Patient visit reason formatting preserves standard labels and normalizes Other concern', () => {
  assert.equal(formatPatientVisitReason('Headache or dizziness', 'stale detail'), 'Headache or dizziness');
  assert.equal(formatPatientVisitReason('Other concern', '  Persistent fatigue  '), 'Other concern: Persistent fatigue');
  assert.equal(formatPatientVisitReason('Other concern', '   '), '');
  assert.equal(formatPatientVisitReason('Unapproved reason', 'detail'), '');
  assert.equal(PATIENT_REASON_MAX_LENGTH - OTHER_CONCERN_PREFIX.length, 985);
});

test('Patient appointment creation submits the final approved reason', async () => {
  const payloads = [];
  const repository = {
    async createAppointment(payload) { payloads.push(payload); return { ...appointment, reason: payload.reason }; },
  };
  const service = createPatientApiService(repository);
  const base = { doctor: 'd1', date: '2026-09-26', time: '10:00', service: 'general_consultation' };
  await service.createAppointment({ ...base, reason: 'Routine health check', otherReason: 'stale detail' });
  await service.createAppointment({ ...base, reason: 'Other concern', otherReason: '  Persistent fatigue  ' });
  assert.deepEqual(payloads.map(item => item.reason), ['Routine health check', 'Other concern: Persistent fatigue']);
});

test('Patient cancellation is hidden after check-in, record creation, or completion', () => {
  const future = { ...appointment, status: 'confirmed', appointment_at: '2099-09-26T02:00:00.000Z' };
  assert.equal(canCancelPatientAppointment(future), true);
  assert.equal(canCancelPatientAppointment({ ...future, check_in_at: '2099-09-26T01:45:00.000Z' }), false);
  assert.equal(canCancelPatientAppointment({ ...future, has_medical_record: true }), false);
  assert.equal(canCancelPatientAppointment({ ...future, status: 'completed' }), false);
});

test('Patient reschedule visibility enforces Patient origin, state, record, and exact one-hour cutoff', () => {
  const now = new Date('2026-09-26T01:00:00.000Z');
  const eligible = { ...appointment, appointment_at: '2026-09-26T02:00:00.000Z' };
  assert.equal(canReschedulePatientAppointment(eligible, now), true);
  assert.equal(canReschedulePatientAppointment({ ...eligible, appointment_at: '2026-09-26T01:59:59.000Z' }, now), false);
  assert.equal(canReschedulePatientAppointment({ ...eligible, patient_created: false }, now), false);
  assert.equal(canReschedulePatientAppointment({ ...eligible, check_in_at: now.toISOString() }, now), false);
  assert.equal(canReschedulePatientAppointment({ ...eligible, has_medical_record: true }, now), false);
  assert.equal(canReschedulePatientAppointment({ ...eligible, status: 'completed' }, now), false);
});

test('Patient reschedule submits only the new appointment time', async () => {
  const calls = [];
  const service = createPatientApiService({
    async rescheduleAppointment(id, payload) { calls.push({ id, payload }); return { ...appointment, appointment_at: payload.appointment_at }; },
  });
  const updated = await service.rescheduleAppointment('a1', '2026-09-27', '10:30');
  assert.deepEqual(calls, [{ id: 'a1', payload: { appointment_at: '2026-09-27T10:30:00+08:00' } }]);
  assert.equal(updated.id, 'a1');
});

test('Patient reschedule form keeps Doctor, visit type, and reason read-only while reusing booking controls', async () => {
  const source = await readFile(new URL('../src/components/appointments/PatientRescheduleForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /BookingCalendar/);
  assert.match(source, /appointment\.doctor/);
  assert.match(source, /appointment\.service/);
  assert.match(source, /appointment\.reason/);
  assert.doesNotMatch(source, /name="(?:doctor|visit_type|reason)"/);
  assert.match(source, /disabled=\{busy \|\| loading\}/);
  assert.match(source, /refreshDate/);
});

test('every Patient appointment tab paginates at five items', async () => {
  assert.equal(PATIENT_APPOINTMENTS_PAGE_SIZE, 5);
  const appointments = Array.from({ length: 12 }, (_, index) => ({ id: `a${index + 1}` }));
  assert.deepEqual(paginatePatientAppointments(appointments, 1).items.map(item => item.id), ['a1', 'a2', 'a3', 'a4', 'a5']);
  assert.deepEqual(paginatePatientAppointments(appointments, 3).items.map(item => item.id), ['a11', 'a12']);
  assert.equal(paginatePatientAppointments(appointments, 3).pageCount, 3);
  const source = await readFile(new URL('../src/pages/patient/PatientAppointments.jsx', import.meta.url), 'utf8');
  for (const tab of ['All Appointments', 'Upcoming', 'Past & Cancelled']) assert.match(source, new RegExp(tab.replace(/[&]/g, '\\&')));
  assert.match(source, /setPage\(1\)/);
  assert.match(source, /aria-label="Appointment pages"/);
});

test('Patient records and certificates paginate at five items', async () => {
  assert.equal(PATIENT_LIST_PAGE_SIZE, 5);
  const items = Array.from({ length: 11 }, (_, index) => ({ id: `item-${index + 1}` }));
  assert.deepEqual(paginatePatientList(items, 1).items.map(item => item.id), ['item-1', 'item-2', 'item-3', 'item-4', 'item-5']);
  assert.deepEqual(paginatePatientList(items, 3).items.map(item => item.id), ['item-11']);
  assert.equal(paginatePatientList(items, 3).pageCount, 3);
  const recordsSource = await readFile(new URL('../src/pages/patient/PatientRecords.jsx', import.meta.url), 'utf8');
  const certificatesSource = await readFile(new URL('../src/pages/patient/PatientCertificates.jsx', import.meta.url), 'utf8');
  assert.match(recordsSource, /aria-label="Medical record pages"/);
  assert.match(recordsSource, /setPage\(1\)/);
  assert.match(certificatesSource, /aria-label="Medical certificate pages"/);
});

test('Patient profile starts read-only, requires Edit Profile, and shows save feedback near its actions', async () => {
  const source = await readFile(new URL('../src/pages/patient/PatientProfile.jsx', import.meta.url), 'utf8');
  assert.match(source, /useState\(false\)/);
  assert.match(source, />Edit Profile</);
  assert.match(source, /disabled=\{!editing\}/);
  assert.match(source, /Changes saved successfully\./);
  assert.match(source, /currently visible only in your Patient profile/);
  assert.match(source, /visible to your related Doctor/);
});

test('Patient pages no longer import feature mock services or advertise mock clinical data', async () => {
  const paths = ['PatientDashboard.jsx', 'PatientProfile.jsx', 'PatientBooking.jsx', 'PatientAppointments.jsx', 'PatientAppointmentDetail.jsx', 'PatientRecords.jsx', 'PatientRecordDetail.jsx', 'PatientCertificates.jsx', 'PatientCertificateDetail.jsx'];
  for (const path of paths) {
    const source = await readFile(new URL(`../src/pages/patient/${path}`, import.meta.url), 'utf8');
    assert.match(source, /patientApiService/);
    assert.doesNotMatch(source, /patientDashboardService|patientProfileService|appointmentService\.js|Mock data only|current mock data|mock clinic/);
  }
});
