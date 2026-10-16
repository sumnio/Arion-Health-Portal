import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { Appointment } from '../src/models/index.js';
import { createClinicalService, doctorHistoryDateRange } from '../src/services/clinicalService.js';
import { createTokenService } from '../src/services/tokenService.js';
import { validateDoctorAppointmentHistoryQuery } from '../src/validation/clinicalValidation.js';

const SECRET = 'doctor-history-test-secret-12345678901234567890';
const ids = {
  doctorProfile: '100000000000000000000001', otherDoctorProfile: '100000000000000000000002',
  inactiveDoctorProfile: '100000000000000000000003', patientProfile: '100000000000000000000004',
  staffProfile: '100000000000000000000005', adminProfile: '100000000000000000000006',
  doctor: '200000000000000000000001', otherDoctor: '200000000000000000000002', inactiveDoctor: '200000000000000000000003',
  alex: '300000000000000000000001', bea: '300000000000000000000002', otherPatient: '300000000000000000000003',
};
const now = new Date('2026-10-16T04:00:00.000Z');
const patientMap = new Map([
  [ids.alex, { _id: ids.alex, full_name: 'Alex Patient' }],
  [ids.bea, { _id: ids.bea, full_name: 'Bea Patient' }],
  [ids.otherPatient, { _id: ids.otherPatient, full_name: 'Other Doctor Patient' }],
]);

function clone(value) { return structuredClone(value); }
function appointment(sequence, { doctorId = ids.doctor, patientId = ids.alex, at, status = 'completed', visitType = 'general_consultation' } = {}) {
  return {
    _id: (400000000000000000000000n + BigInt(sequence)).toString(),
    doctor_id: doctorId,
    patient_id: patientId,
    appointment_at: new Date(at),
    status,
    visit_type: visitType,
    reason: `Reason ${sequence}`,
    check_in_at: status === 'completed' ? new Date(new Date(at).getTime() - 15 * 60 * 1000) : null,
    diagnosis: 'must never be exposed',
    notes: 'must never be exposed',
    prescriptions: ['must never be exposed'],
    supporting_documents: ['must never be exposed'],
    certificate: 'must never be exposed',
    emergency_contact: 'must never be exposed',
  };
}

function context() {
  const profiles = new Map([
    [ids.doctorProfile, { user_profile_id: ids.doctorProfile, role: 'doctor', status: 'active' }],
    [ids.otherDoctorProfile, { user_profile_id: ids.otherDoctorProfile, role: 'doctor', status: 'active' }],
    [ids.inactiveDoctorProfile, { user_profile_id: ids.inactiveDoctorProfile, role: 'doctor', status: 'inactive' }],
    [ids.patientProfile, { user_profile_id: ids.patientProfile, role: 'patient', status: 'active' }],
    [ids.staffProfile, { user_profile_id: ids.staffProfile, role: 'staff', status: 'active' }],
    [ids.adminProfile, { user_profile_id: ids.adminProfile, role: 'admin', status: 'active' }],
  ]);
  const doctors = new Map([
    [ids.doctorProfile, { _id: ids.doctor, user_profile_id: ids.doctorProfile }],
    [ids.otherDoctorProfile, { _id: ids.otherDoctor, user_profile_id: ids.otherDoctorProfile }],
    [ids.inactiveDoctorProfile, { _id: ids.inactiveDoctor, user_profile_id: ids.inactiveDoctorProfile }],
  ]);
  const appointments = [];
  const statuses = ['completed', 'cancelled', 'no_show'];
  for (let index = 0; index < 12; index += 1) {
    appointments.push(appointment(index + 1, {
      patientId: index % 2 ? ids.bea : ids.alex,
      at: new Date(Date.UTC(2026, 9, 15 - index, 2, 0)).toISOString(),
      status: statuses[index % statuses.length],
      visitType: index % 2 ? 'follow_up' : 'general_consultation',
    }));
  }
  appointments.push(appointment(20, { at: '2026-10-15T03:00:00.000Z', status: 'pending' }));
  appointments.push(appointment(21, { at: '2026-10-15T04:00:00.000Z', status: 'confirmed' }));
  appointments.push(appointment(22, { at: '2026-10-17T02:00:00.000Z', status: 'cancelled' }));
  appointments.push(appointment(23, { at: '2026-09-01T02:00:00.000Z', status: 'completed' }));
  appointments.push(appointment(24, { doctorId: ids.otherDoctor, patientId: ids.otherPatient, at: '2026-10-15T02:00:00.000Z', status: 'completed' }));
  appointments.push(appointment(31, { at: '2026-10-14T02:00:00.000Z', status: 'completed' }));
  appointments.push(appointment(32, { at: '2026-10-14T02:00:00.000Z', status: 'completed' }));
  const recordAppointmentId = appointments[0]._id;
  const repository = {
    lastHistoryInput: null,
    async findDoctorByUserProfileId(profileId) { return clone(doctors.get(String(profileId)) ?? null); },
    async listDoctorAppointmentHistory(doctorId, input) {
      this.lastHistoryInput = clone(input);
      let items = appointments.filter(item => item.doctor_id === String(doctorId)
        && item.appointment_at >= input.start && item.appointment_at < input.end
        && input.statuses.includes(item.status));
      if (input.visitType) items = items.filter(item => item.visit_type === input.visitType);
      if (input.patientSearch) items = items.filter(item => patientMap.get(item.patient_id).full_name.toLowerCase().includes(input.patientSearch.toLowerCase()));
      items.sort((left, right) => right.appointment_at - left.appointment_at || String(right._id).localeCompare(String(left._id)));
      const total = items.length;
      items = items.slice((input.page - 1) * input.limit, input.page * input.limit)
        .map(item => ({ ...clone(item), patient_id: clone(patientMap.get(item.patient_id)) }));
      return { items, total };
    },
    async listRecordAppointmentIds(appointmentIds) {
      return appointmentIds.map(String).includes(recordAppointmentId)
        ? [{ _id: '500000000000000000000001', appointment_id: recordAppointmentId }]
        : [];
    },
  };
  const clinicalService = createClinicalService({
    repository,
    clinic: { timeZone: 'Asia/Manila', name: 'Arion Health Clinic', location: 'Test Clinic' },
    now: () => new Date(now),
  });
  const tokens = createTokenService(SECRET);
  const authModule = {
    tokens,
    service: {
      async getAuthenticatedUser(profileId) {
        const profile = profiles.get(String(profileId));
        if (!profile) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'UNAUTHENTICATED' });
        return clone(profile);
      },
    },
  };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, clinicalModule: { clinicalService } });
  return {
    app, repository, clinicalService,
    cookie(profileId) { return `arion_auth=${tokens.sign(profileId, { mfaVerified: profiles.get(String(profileId))?.role === 'admin' })}`; },
  };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('history date presets use inclusive Manila calendar starts and stop at current time', () => {
  const expected = {
    today: ['2026-10-15T16:00:00.000Z', '2026-10-16T04:00:00.000Z'],
    last_7_days: ['2026-10-09T16:00:00.000Z', '2026-10-16T04:00:00.000Z'],
    last_30_days: ['2026-09-16T16:00:00.000Z', '2026-10-16T04:00:00.000Z'],
    this_month: ['2026-09-30T16:00:00.000Z', '2026-10-16T04:00:00.000Z'],
  };
  for (const [range, [start, end]] of Object.entries(expected)) {
    const result = doctorHistoryDateRange({ range }, now, 'Asia/Manila');
    assert.equal(result.start.toISOString(), start);
    assert.equal(result.end.toISOString(), end);
  }
  const custom = doctorHistoryDateRange({ range: 'custom', from: '2026-10-01', to: '2026-10-05' }, now, 'Asia/Manila');
  assert.equal(custom.start.toISOString(), '2026-09-30T16:00:00.000Z');
  assert.equal(custom.end.toISOString(), '2026-10-05T16:00:00.000Z');
});

test('history validation allowlists ranges, terminal statuses, visit types, search, custom dates, and page size', () => {
  assert.deepEqual(validateDoctorAppointmentHistoryQuery({}), {
    range: 'last_30_days', from: null, to: null, status: 'all', patient_search: '', visit_type: 'all', page: 1, limit: 10,
  });
  assert.equal(validateDoctorAppointmentHistoryQuery({ range: 'custom', from: '2026-10-01', to: '2026-10-16', status: 'no_show', visit_type: 'check_up', patient_search: ' Alex ', page: '2' }).patient_search, 'Alex');
  for (const query of [
    { range: 'forever' }, { status: 'pending' }, { status: 'confirmed' }, { status: 'deleted' },
    { visit_type: 'surgery' }, { range: 'custom', from: '2026-10-01' },
    { range: 'custom', from: '2026-10-17', to: '2026-10-16' }, { from: '2026-10-01' },
    { page: '0' }, { '$where': 'x' }, { status: { '$ne': 'completed' } },
  ]) assert.throws(() => validateDoctorAppointmentHistoryQuery(query), error => error.status === 400);
});

test('Doctor history is own-only, terminal-only, past-only, newest-first, paginated, and privacy-minimized', async () => {
  const c = context();
  const first = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, {});
  assert.equal(first.limit, 10);
  assert.equal(first.page, 1);
  assert.equal(first.total, 14);
  assert.equal(first.items.length, 10);
  assert.ok(first.items.every(item => ['completed', 'cancelled', 'no_show'].includes(item.status)));
  assert.ok(first.items.every(item => new Date(item.appointment_at) < now));
  assert.ok(first.items.every(item => item.patient.id !== ids.otherPatient));
  assert.deepEqual(first.items.map(item => item.appointment_at), [...first.items.map(item => item.appointment_at)].sort().reverse());
  const serialized = JSON.stringify(first);
  for (const excluded of ['diagnosis', 'prescriptions', 'notes', 'supporting_documents', 'certificate', 'emergency_contact']) assert.equal(serialized.includes(excluded), false);
  assert.equal(first.items[0].medical_record_id, '500000000000000000000001');
  assert.equal(first.items[1].medical_record_id, null);
  const second = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { page: '2' });
  assert.equal(second.items.length, 4);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 14);
  const tied = first.items.filter(item => item.appointment_at === '2026-10-14T02:00:00.000Z');
  assert.deepEqual(tied.map(item => item.id), [...tied.map(item => item.id)].sort().reverse());
});

test('status, Patient name, visit type, date, and combined filters remain inside Doctor ownership', async () => {
  const c = context();
  const completed = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { status: 'completed' });
  assert.ok(completed.items.every(item => item.status === 'completed'));
  const cancelled = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { status: 'cancelled' });
  assert.ok(cancelled.items.every(item => item.status === 'cancelled'));
  const noShow = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { status: 'no_show' });
  assert.ok(noShow.items.every(item => item.status === 'no_show'));
  const searched = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { patient_search: 'bea' });
  assert.ok(searched.items.length > 0 && searched.items.every(item => item.patient.full_name === 'Bea Patient'));
  const otherDoctorPatient = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { patient_search: 'Other Doctor' });
  assert.equal(otherDoctorPatient.total, 0);
  const visit = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { visit_type: 'follow_up' });
  assert.ok(visit.items.length > 0 && visit.items.every(item => item.visit_type === 'follow_up'));
  const combined = await c.clinicalService.listDoctorAppointmentHistory(ids.doctorProfile, { range: 'custom', from: '2026-10-10', to: '2026-10-15', status: 'cancelled', visit_type: 'follow_up', patient_search: 'Bea' });
  assert.ok(combined.items.every(item => item.status === 'cancelled' && item.visit_type === 'follow_up' && item.patient.full_name === 'Bea Patient'));
});

test('Doctor history endpoint enforces authentication, active Doctor role, and server-derived ownership', async () => {
  const c = context();
  await withServer(c.app, async base => {
    const allowed = await fetch(`${base}/api/doctor/appointments/history`, { headers: { cookie: c.cookie(ids.doctorProfile) } });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.equal(body.history.items.some(item => item.patient.id === ids.otherPatient), false);
    assert.equal((await fetch(`${base}/api/doctor/appointments/history`)).status, 401);
    assert.equal((await fetch(`${base}/api/doctor/appointments/history`, { headers: { cookie: c.cookie(ids.inactiveDoctorProfile) } })).status, 403);
    for (const profileId of [ids.patientProfile, ids.staffProfile, ids.adminProfile]) {
      assert.equal((await fetch(`${base}/api/doctor/appointments/history`, { headers: { cookie: c.cookie(profileId) } })).status, 403);
    }
    assert.equal((await fetch(`${base}/api/doctor/appointments/history?status=pending`, { headers: { cookie: c.cookie(ids.doctorProfile) } })).status, 400);
  });
});

test('Appointment model has one minimal Doctor history index', () => {
  const indexes = Appointment.schema.indexes();
  const history = indexes.find(([, options]) => options.name === 'doctor_appointment_history');
  assert.deepEqual(history?.[0], { doctor_id: 1, status: 1, appointment_at: -1, _id: -1 });
});
