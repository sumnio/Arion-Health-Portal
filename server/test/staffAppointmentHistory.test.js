import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { Appointment } from '../src/models/index.js';
import { createStaffOperationsService } from '../src/services/staffOperationsService.js';
import { createTokenService } from '../src/services/tokenService.js';
import { appointmentHistoryDateRange } from '../src/utils/appointmentHistory.js';
import { validateStaffAppointmentHistoryQuery } from '../src/validation/staffOperationsValidation.js';

const SECRET = 'staff-history-test-secret-12345678901234567890';
const now = new Date('2026-10-16T04:00:00.000Z');
const ids = {
  staff: '100000000000000000000001', inactiveStaff: '100000000000000000000002',
  patientProfile: '100000000000000000000003', doctorProfile: '100000000000000000000004', adminProfile: '100000000000000000000005',
  patient: '200000000000000000000001', secondPatient: '200000000000000000000002',
  doctor: '300000000000000000000001', secondDoctor: '300000000000000000000002',
};
const patients = new Map([
  [ids.patient, { _id: ids.patient, user_profile_id: '400000000000000000000001', full_name: 'Alex Patient', dob: new Date('1990-01-01'), is_pwd: false }],
  [ids.secondPatient, { _id: ids.secondPatient, user_profile_id: '400000000000000000000002', full_name: 'Bea Patient', dob: new Date('1950-01-01'), is_pwd: false }],
]);
const doctors = new Map([
  [ids.doctor, { _id: ids.doctor, specialty: 'General Doctor', user_profile_id: { _id: ids.doctorProfile, display_name: 'Doctor One' } }],
  [ids.secondDoctor, { _id: ids.secondDoctor, specialty: 'General Doctor', user_profile_id: { _id: '100000000000000000000006', display_name: 'Doctor Two' } }],
]);
function appointment(sequence, values = {}) {
  const patientId = values.patientId ?? ids.patient;
  return {
    _id: (500000000000000000000000n + BigInt(sequence)).toString(), patient_id: patientId,
    doctor_id: values.doctorId ?? ids.doctor, created_by: values.patientCreated ? patients.get(patientId).user_profile_id : ids.staff,
    appointment_at: new Date(values.at ?? `2026-10-${String(15 - sequence).padStart(2, '0')}T02:00:00.000Z`),
    status: values.status ?? ['completed', 'cancelled', 'no_show'][sequence % 3],
    visit_type: values.visitType ?? (sequence % 2 ? 'follow_up' : 'general_consultation'),
    reason: `History reason ${sequence}`, priority: sequence === 1 ? 'urgent' : 'normal',
    check_in_at: sequence % 3 === 0 ? null : new Date('2026-10-01T01:45:00.000Z'),
    diagnosis: 'private', notes: 'private', prescriptions: ['private'], supporting_documents: ['private'],
  };
}
function context() {
  const appointments = Array.from({ length: 12 }, (_, index) => appointment(index + 1, { patientId: index % 2 ? ids.secondPatient : ids.patient, patientCreated: index === 0 }));
  appointments.push(appointment(20, { status: 'pending', at: '2026-10-15T03:00:00.000Z' }));
  appointments.push(appointment(21, { status: 'confirmed', at: '2026-10-15T04:00:00.000Z' }));
  appointments.push(appointment(22, { status: 'completed', at: '2026-10-17T02:00:00.000Z' }));
  appointments.push(appointment(23, { status: 'completed', at: '2026-09-01T02:00:00.000Z' }));
  appointments.push(appointment(31, { status: 'completed', at: '2026-10-14T02:00:00.000Z' }));
  appointments.push(appointment(32, { status: 'completed', at: '2026-10-14T02:00:00.000Z' }));
  const repository = {
    lastInput: null,
    async listAppointmentHistory(input) {
      this.lastInput = structuredClone(input);
      let items = appointments.filter(item => item.appointment_at >= input.start && item.appointment_at < input.end && input.statuses.includes(item.status));
      if (input.doctorId) items = items.filter(item => item.doctor_id === input.doctorId);
      if (input.visitType) items = items.filter(item => item.visit_type === input.visitType);
      if (input.patientSearch) items = items.filter(item => patients.get(item.patient_id).full_name.toLowerCase().includes(input.patientSearch.toLowerCase()));
      items.sort((left, right) => right.appointment_at - left.appointment_at || String(right._id).localeCompare(String(left._id)));
      const total = items.length;
      items = items.slice((input.page - 1) * input.limit, input.page * input.limit).map(item => ({ ...structuredClone(item), patient_id: structuredClone(patients.get(item.patient_id)), doctor_id: structuredClone(doctors.get(item.doctor_id)), created_by: { _id: item.created_by } }));
      return { items, total };
    },
  };
  const service = createStaffOperationsService({ repository, clinic: { timeZone: 'Asia/Manila' }, now: () => new Date(now) });
  return { appointments, repository, service };
}

test('Staff history defaults and date presets use authoritative Manila boundaries', () => {
  assert.deepEqual(validateStaffAppointmentHistoryQuery({}), { range: 'last_30_days', from: null, to: null, status: 'all', doctor_id: null, patient_search: '', visit_type: 'all', page: 1, limit: 10 });
  assert.equal(appointmentHistoryDateRange({ range: 'today' }, now, 'Asia/Manila').start.toISOString(), '2026-10-15T16:00:00.000Z');
  assert.equal(appointmentHistoryDateRange({ range: 'last_7_days' }, now, 'Asia/Manila').start.toISOString(), '2026-10-09T16:00:00.000Z');
  assert.equal(appointmentHistoryDateRange({ range: 'last_30_days' }, now, 'Asia/Manila').start.toISOString(), '2026-09-16T16:00:00.000Z');
  assert.equal(appointmentHistoryDateRange({ range: 'this_month' }, now, 'Asia/Manila').start.toISOString(), '2026-09-30T16:00:00.000Z');
});

test('Staff history query rejects non-terminal statuses, unknown fields, bad Doctors, dates, and pages', () => {
  const valid = validateStaffAppointmentHistoryQuery({ range: 'custom', from: '2026-10-01', to: '2026-10-16', status: 'no_show', doctor_id: ids.doctor, patient_search: ' Alex ', visit_type: 'check_up', page: '2' });
  assert.equal(valid.patient_search, 'Alex');
  for (const query of [{ status: 'pending' }, { status: 'confirmed' }, { range: 'forever' }, { doctor_id: 'bad' }, { visit_type: 'surgery' }, { range: 'custom', from: '2026-10-01' }, { range: 'custom', from: '2026-10-17', to: '2026-10-16' }, { from: '2026-10-01' }, { page: '0' }, { '$where': 'x' }, { status: { '$ne': 'completed' } }]) {
    assert.throws(() => validateStaffAppointmentHistoryQuery(query), error => error.status === 400);
  }
});

test('Staff history is terminal-only, past-only, newest-first, stable, paginated, and privacy-minimized', async () => {
  const c = context();
  const first = await c.service.appointmentHistory(validateStaffAppointmentHistoryQuery({}));
  assert.equal(first.limit, 10); assert.equal(first.page, 1); assert.equal(first.items.length, 10); assert.ok(first.total > 10);
  assert.ok(first.items.every(item => ['completed', 'cancelled', 'no_show'].includes(item.status) && new Date(item.appointment_at) < now));
  assert.deepEqual(first.items.map(item => item.appointment_at), [...first.items.map(item => item.appointment_at)].sort().reverse());
  const second = await c.service.appointmentHistory(validateStaffAppointmentHistoryQuery({ page: '2' }));
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, first.total);
  const tied = first.items.filter(item => item.appointment_at === '2026-10-14T02:00:00.000Z');
  assert.deepEqual(tied.map(item => item.id), [...tied.map(item => item.id)].sort().reverse());
  const serialized = JSON.stringify(first);
  for (const value of ['diagnosis', 'notes', 'prescriptions', 'supporting_documents', 'certificate', 'signature', 'allergies', 'emergency_contact']) assert.equal(serialized.includes(value), false);
});

test('Staff history supports status, Doctor, Patient, visit-type, date, and combined filters', async () => {
  const c = context();
  for (const status of ['completed', 'cancelled', 'no_show']) {
    const result = await c.service.appointmentHistory(validateStaffAppointmentHistoryQuery({ status }));
    assert.ok(result.items.every(item => item.status === status));
  }
  const result = await c.service.appointmentHistory(validateStaffAppointmentHistoryQuery({ status: 'cancelled', doctor_id: ids.doctor, patient_search: 'Bea', visit_type: 'follow_up', range: 'custom', from: '2026-10-01', to: '2026-10-16' }));
  assert.ok(result.items.every(item => item.status === 'cancelled' && item.doctor.id === ids.doctor && item.patient.full_name === 'Bea Patient' && item.visit_type === 'follow_up'));
  const empty = await c.service.appointmentHistory(validateStaffAppointmentHistoryQuery({ patient_search: 'Missing Patient' }));
  assert.equal(empty.total, 0); assert.deepEqual(empty.items, []);
});

test('Staff history endpoint requires active Staff and denies Patient, Doctor, Admin, and unauthenticated users', async () => {
  const profiles = new Map([
    [ids.staff, { user_profile_id: ids.staff, role: 'staff', status: 'active' }],
    [ids.inactiveStaff, { user_profile_id: ids.inactiveStaff, role: 'staff', status: 'inactive' }],
    [ids.patientProfile, { user_profile_id: ids.patientProfile, role: 'patient', status: 'active' }],
    [ids.doctorProfile, { user_profile_id: ids.doctorProfile, role: 'doctor', status: 'active' }],
    [ids.adminProfile, { user_profile_id: ids.adminProfile, role: 'admin', status: 'active' }],
  ]);
  const tokens = createTokenService(SECRET);
  const authModule = { tokens, service: { async getAuthenticatedUser(profileId) { return structuredClone(profiles.get(String(profileId))); } } };
  const staffOperationsModule = { staffOperationsService: { async appointmentHistory() { return { items: [], page: 1, limit: 10, total: 0, page_count: 1 }; } } };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, staffOperationsModule });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = profile => ({ cookie: `arion_auth=${tokens.sign(profile, { mfaVerified: profiles.get(profile)?.role === 'admin' })}` });
  try {
    assert.equal((await fetch(`${base}/api/staff/appointments/history`, { headers: cookie(ids.staff) })).status, 200);
    assert.equal((await fetch(`${base}/api/staff/appointments/history`)).status, 401);
    assert.equal((await fetch(`${base}/api/staff/appointments/history`, { headers: cookie(ids.inactiveStaff) })).status, 403);
    for (const role of [ids.patientProfile, ids.doctorProfile, ids.adminProfile]) assert.equal((await fetch(`${base}/api/staff/appointments/history`, { headers: cookie(role) })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Appointment model includes a dedicated Staff history index without changing Doctor history', () => {
  const indexes = Appointment.schema.indexes();
  assert.deepEqual(indexes.find(([, options]) => options.name === 'staff_appointment_history')?.[0], { status: 1, appointment_at: -1, _id: -1, doctor_id: 1 });
  assert.deepEqual(indexes.find(([, options]) => options.name === 'doctor_appointment_history')?.[0], { doctor_id: 1, status: 1, appointment_at: -1, _id: -1 });
});
