import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { URGENT_REASON_LABELS } from '../src/models/index.js';
import { createStaffOperationsModule } from '../src/services/staffOperationsModule.js';
import { createTokenService } from '../src/services/tokenService.js';

const SECRET = 'staff-operations-test-secret-123456789012345';
const NOW = new Date('2026-09-25T02:00:00.000Z');
const ids = {
  staffProfile: '111111111111111111111111', inactiveStaffProfile: '111111111111111111111112', patientProfile: '222222222222222222222222', doctorProfile: '333333333333333333333333', adminProfile: '444444444444444444444444',
  doctor: 'aaaaaaaaaaaaaaaaaaaaaaaa', patient: 'bbbbbbbbbbbbbbbbbbbbbbbb', senior: 'cccccccccccccccccccccccc', pwd: 'dddddddddddddddddddddddd', both: 'eeeeeeeeeeeeeeeeeeeeeeee',
  pending: '100000000000000000000001', confirmed: '100000000000000000000002', urgent: '100000000000000000000003', seniorAppointment: '100000000000000000000004', pwdAppointment: '100000000000000000000005', bothAppointment: '100000000000000000000006', normal: '100000000000000000000007', completed: '100000000000000000000008', cancelled: '100000000000000000000009', noShow: '10000000000000000000000a', previous: '10000000000000000000000b', future: '10000000000000000000000c',
};
function clone(value) { return value == null ? value : structuredClone(value); }

function createContext({ now = NOW, notificationTriggers } = {}) {
  const profiles = new Map([
    [ids.staffProfile, { user_profile_id: ids.staffProfile, display_name: 'Demo Staff', role: 'staff', status: 'active' }],
    [ids.inactiveStaffProfile, { user_profile_id: ids.inactiveStaffProfile, display_name: 'Inactive Staff', role: 'staff', status: 'inactive' }],
    [ids.patientProfile, { user_profile_id: ids.patientProfile, display_name: 'Patient', role: 'patient', status: 'active' }],
    [ids.doctorProfile, { user_profile_id: ids.doctorProfile, display_name: 'Doctor', role: 'doctor', status: 'active' }],
    [ids.adminProfile, { user_profile_id: ids.adminProfile, display_name: 'Admin', role: 'admin', status: 'active' }],
  ]);
  const patient = (id, name, dob, isPwd = false, contact = '09170000000') => ({ _id: id, user_profile_id: null, full_name: name, contact_number: contact, dob: new Date(`${dob}T00:00:00Z`), sex: 'other', address: null, emergency_contact_name: null, emergency_contact_number: null, emergency_contact_relationship: null, allergies: [], is_pwd: isPwd });
  const patients = new Map([
    [ids.patient, patient(ids.patient, 'Alex Patient', '1990-01-15', false, '09171234567')],
    [ids.senior, patient(ids.senior, 'Senior Patient', '1950-01-01')],
    [ids.pwd, patient(ids.pwd, 'PWD Patient', '1995-01-01', true)],
    [ids.both, patient(ids.both, 'Senior PWD Patient', '1950-01-01', true)],
  ]);
  const doctor = { _id: ids.doctor, specialty: 'General Medicine', user_profile_id: { _id: ids.doctorProfile, display_name: 'Dr. Maria Santos' } };
  const appointment = (id, patientId, status, time, checked, priority = 'normal') => ({ _id: id, patient_id: patientId, doctor_id: ids.doctor, appointment_at: new Date(`2026-09-25T${time}:00.000Z`), status, visit_type: 'general_consultation', reason: 'Consultation', priority, check_in_at: checked ? new Date(checked) : null, created_by: ids.staffProfile });
  const appointments = new Map([
    [ids.pending, appointment(ids.pending, ids.patient, 'pending', '01:00', null)],
    [ids.confirmed, appointment(ids.confirmed, ids.patient, 'confirmed', '01:30', null)],
    [ids.urgent, appointment(ids.urgent, ids.patient, 'confirmed', '01:00', '2026-09-25T01:50:00Z', 'urgent')],
    [ids.seniorAppointment, appointment(ids.seniorAppointment, ids.senior, 'confirmed', '01:00', '2026-09-25T01:40:00Z')],
    [ids.pwdAppointment, appointment(ids.pwdAppointment, ids.pwd, 'confirmed', '01:00', '2026-09-25T01:30:00Z')],
    [ids.bothAppointment, appointment(ids.bothAppointment, ids.both, 'confirmed', '01:00', '2026-09-25T01:45:00Z')],
    [ids.normal, appointment(ids.normal, ids.patient, 'confirmed', '01:00', '2026-09-25T01:20:00Z')],
    [ids.completed, appointment(ids.completed, ids.patient, 'completed', '01:00', '2026-09-25T01:10:00Z')],
    [ids.cancelled, appointment(ids.cancelled, ids.patient, 'cancelled', '01:00', null)],
    [ids.noShow, appointment(ids.noShow, ids.patient, 'no_show', '01:00', null)],
    [ids.previous, { ...appointment(ids.previous, ids.patient, 'pending', '01:00', null), appointment_at: new Date('2026-09-24T01:00:00Z') }],
    [ids.future, { ...appointment(ids.future, ids.patient, 'pending', '01:00', null), appointment_at: new Date('2026-09-26T01:00:00Z') }],
  ]);
  const records = [{ _id: '900000000000000000000001', patient_id: { _id: ids.patient, full_name: 'Alex Patient' }, doctor_id: doctor, encounter_at: new Date('2026-09-20T02:00:00Z'), diagnosis: 'Viral infection', notes: 'Secret detailed notes', prescriptions: [{ medicine: 'Hidden' }], certificate: { purpose: 'Hidden' } }];
  const priorityAudits = [];
  let sequence = 100;
  const nextId = () => (++sequence).toString(16).padStart(24, '0');
  const populated = (item) => item ? { ...clone(item), patient_id: clone(patients.get(String(item.patient_id?._id ?? item.patient_id))), doctor_id: clone(doctor) } : null;
  const repository = {
    failPriorityAudit: false,
    beforeConfirmArrival: null,
    beforeNoShow: null,
    async listAppointmentsBetween(start, end) { return [...appointments.values()].filter((item) => item.appointment_at >= start && item.appointment_at < end).map(populated); },
    async listActiveDoctors() { return [clone(doctor)]; },
    async searchPatients(search) { const q = search.toLowerCase(); return [...patients.values()].filter((item) => !q || item.full_name.toLowerCase().includes(q) || item.contact_number.includes(search)).map(clone); },
    async listAppointmentsForPatients(patientIds) { const allowed = new Set(patientIds.map(String)); return [...appointments.values()].filter((item) => allowed.has(String(item.patient_id))).map(populated); },
    async listAppointmentsForPatient(patientId) { return [...appointments.values()].filter((item) => String(item.patient_id) === String(patientId)).map(populated); },
    async findPotentialDuplicate(input) { return clone([...patients.values()].find((item) => item.contact_number === input.contact_number || (item.full_name.toLowerCase() === input.full_name.toLowerCase() && item.dob.getTime() === input.dob.getTime()))); },
    async createPatient(data) { const value = { _id: nextId(), allergies: [], ...clone(data) }; patients.set(value._id, value); return clone(value); },
    async findPatientById(id) { return clone(patients.get(String(id))); },
    async doctorExists(id) { return String(id) === ids.doctor; },
    async createAppointment(data) { if ([...appointments.values()].some((item) => item.doctor_id === String(data.doctor_id) && item.appointment_at.getTime() === data.appointment_at.getTime() && ['pending', 'confirmed', 'completed'].includes(item.status))) throw Object.assign(new Error('duplicate'), { code: 11000 }); const value = { _id: nextId(), ...clone(data), patient_id: String(data.patient_id), doctor_id: String(data.doctor_id) }; appointments.set(value._id, value); return clone(value); },
    async findAppointmentById(id) { return clone(appointments.get(String(id))); },
    async confirmArrivalEligible(id, timestamp, start, end, expectedAppointmentAt) { await this.beforeConfirmArrival?.({ id, expectedAppointmentAt, appointments }); const item = appointments.get(String(id)); if (!item || !['pending', 'confirmed'].includes(item.status) || item.check_in_at || item.appointment_at.getTime() !== new Date(expectedAppointmentAt).getTime() || item.appointment_at < start || item.appointment_at >= end) return null; item.status = 'confirmed'; item.check_in_at = new Date(timestamp); return populated(item); },
    async changePriorityWithAudit(id, previousPriority, input, staffActorId) { const item = appointments.get(String(id)); if (!item || item.status !== 'confirmed' || !item.check_in_at || item.priority !== previousPriority) return null; const original = item.priority; item.priority = input.priority; try { if (this.failPriorityAudit) throw new Error('audit write failed'); const audit = { _id: nextId(), appointment_id: String(id), previous_priority: previousPriority, new_priority: input.priority, urgency_reason: input.urgency_reason, explanation: input.explanation, correction_reason: input.correction_reason, staff_actor_user_profile_id: String(staffActorId), created_at: new Date(now) }; priorityAudits.push(audit); return { appointment: populated(item), audit: clone(audit) }; } catch (error) { item.priority = original; throw error; } },
    async listPriorityHistory(id) { return priorityAudits.filter((item) => item.appointment_id === String(id)).map((item) => ({ ...clone(item), staff_actor_user_profile_id: { _id: item.staff_actor_user_profile_id, display_name: profiles.get(item.staff_actor_user_profile_id)?.display_name } })); },
    async markNoShowEligible(id, cutoff, expectedAppointmentAt) { await this.beforeNoShow?.({ id, expectedAppointmentAt, appointments }); const item = appointments.get(String(id)); if (!item || !['pending', 'confirmed'].includes(item.status) || item.check_in_at || item.appointment_at.getTime() !== new Date(expectedAppointmentAt).getTime() || item.appointment_at > cutoff) return null; item.status = 'no_show'; return populated(item); },
    async cancelEligible(id) { const item = appointments.get(String(id)); if (!item || !['pending', 'confirmed'].includes(item.status) || item.check_in_at) return null; item.status = 'cancelled'; return populated(item); },
    async listWaitingBetween(start, end) { return [...appointments.values()].filter((item) => item.status === 'confirmed' && item.check_in_at && item.appointment_at >= start && item.appointment_at < end).map(populated); },
    async listRecordSummaries(patientId) { return records.filter((item) => String(item.patient_id._id) === String(patientId)).map(clone); },
  };
  const tokens = createTokenService(SECRET);
  const authModule = { tokens, service: { async getAuthenticatedUser(id) { const found = profiles.get(String(id)); if (!found) throw Object.assign(new Error('Authentication required'), { status: 401, code: 'UNAUTHENTICATED' }); return clone(found); } } };
  const staffOperationsModule = createStaffOperationsModule({ repository, clinic: { timeZone: 'Asia/Manila' }, notificationTriggers, now: () => new Date(now) });
  const patientAppointmentModule = { patientService: {}, appointmentService: { async confirmForStaff(id) { const item = appointments.get(String(id)); if (!item) throw Object.assign(new Error('Not found'), { status: 404, code: 'APPOINTMENT_NOT_FOUND' }); if (item.status !== 'pending') throw Object.assign(new Error('Only pending'), { status: 409, code: 'INVALID_STATUS_TRANSITION' }); item.status = 'confirmed'; return { id: item._id, status: item.status }; } } };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, staffOperationsModule, patientAppointmentModule });
  return { app, patients, appointments, records, priorityAudits, repository, cookie: (profile) => `arion_auth=${tokens.sign(profile, { mfaVerified: profiles.get(String(profile))?.role === 'admin' })}` };
}
async function withServer(app, callback) { const server = app.listen(0, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); }); try { await callback(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); } }
function request(base, path, { method = 'GET', cookie, body } = {}) { return fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
const walkInBody = { full_name: 'New Walk-in', contact_number: '09998887777', dob: '1985-04-12', sex: 'female', address: null, emergency_contact_name: 'Family Contact', emergency_contact_number: '09112223333', emergency_contact_relationship: 'Sibling', is_pwd: false };
const walkInAppointment = { doctor_id: ids.doctor, appointment_at: '2026-09-25T03:00:00.000Z', visit_type: 'general_consultation', reason: 'Walk-in concern', priority: 'normal' };

test('successful Staff workflow transitions invoke only their approved notification triggers', async () => {
  const calls = [];
  const c = createContext({
    notificationTriggers: {
      async staffAppointmentCreated(value) { calls.push(['assigned', clone(value)]); },
      async appointmentConfirmed(value) { calls.push(['confirmed', clone(value)]); },
      async patientArrived(value) { calls.push(['arrived', clone(value)]); },
      async appointmentMarkedUrgent(value) { calls.push(['urgent', clone(value)]); },
      async staffCancelled(value) { calls.push(['cancelled', clone(value)]); },
    },
  });
  await withServer(c.app, async (base) => {
    assert.equal((await request(base, `/api/staff/patients/${ids.patient}/walk-in-appointments`, {
      method: 'POST', cookie: c.cookie(ids.staffProfile), body: walkInAppointment,
    })).status, 201);
    assert.equal((await request(base, `/api/staff/patients/${ids.patient}/walk-in-appointments`, {
      method: 'POST', cookie: c.cookie(ids.staffProfile), body: walkInAppointment,
    })).status, 409);

    assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/check-in`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {},
    })).status, 200);
    assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/check-in`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {},
    })).status, 409);
    assert.equal((await request(base, `/api/staff/appointments/${ids.previous}/check-in`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {},
    })).status, 409);

    assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile),
      body: { priority: 'urgent', urgency_reason: 'Other urgent concern', explanation: 'Sensitive custom explanation.' },
    })).status, 200);
    assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile),
      body: { priority: 'urgent', urgency_reason: 'Severe pain or discomfort' },
    })).status, 409);
    assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile),
      body: { priority: 'normal', correction_reason: 'Corrected operational priority.' },
    })).status, 200);

    assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/cancel`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {},
    })).status, 200);
    assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/cancel`, {
      method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {},
    })).status, 409);
  });
  assert.deepEqual(calls.map(([event]) => event), ['assigned', 'confirmed', 'arrived', 'urgent', 'cancelled']);
  assert.deepEqual(calls.at(-1), ['cancelled', {
    appointmentId: ids.confirmed,
    patientId: ids.patient,
    doctorId: ids.doctor,
  }]);
  assert.equal(JSON.stringify(calls).includes('Sensitive custom explanation.'), false);
});

test('Staff searches Patients by name and contact with basic projection', async () => { const c = createContext(); await withServer(c.app, async (base) => { for (const query of ['Alex', '1234567']) { const response = await request(base, `/api/staff/patients?search=${query}`, { cookie: c.cookie(ids.staffProfile) }); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.patients[0].full_name, 'Alex Patient'); assert.equal('allergies' in body.patients[0], false); } }); });
test('Staff reads a date-filtered operational calendar and active Doctor directory', async () => { const c = createContext(); await withServer(c.app, async (base) => { const appointmentsResponse = await request(base, '/api/staff/appointments?date=2026-09-25', { cookie: c.cookie(ids.staffProfile) }); const body = await appointmentsResponse.json(); assert.equal(appointmentsResponse.status, 200); assert.equal(body.appointments.length, 10); assert.deepEqual(Object.keys(body.appointments[0]).sort(), ['appointment_at','check_in_at','doctor','id','patient','priority','reason','status','visit_type']); assert.equal(JSON.stringify(body).includes('allergies'), false); const doctors = await (await request(base, '/api/staff/doctors', { cookie: c.cookie(ids.staffProfile) })).json(); assert.deepEqual(doctors.doctors, [{ id: ids.doctor, display_name: 'Dr. Maria Santos', specialty: 'General Medicine' }]); }); });
test('Staff reads one basic Patient and can cancel only an unchecked active Appointment', async () => { const c = createContext(); await withServer(c.app, async (base) => { const patient = await (await request(base, `/api/staff/patients/${ids.patient}`, { cookie: c.cookie(ids.staffProfile) })).json(); assert.equal(patient.patient.full_name, 'Alex Patient'); const cancelled = await request(base, `/api/staff/appointments/${ids.confirmed}/cancel`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(cancelled.status, 200); assert.equal(c.appointments.get(ids.confirmed).status, 'cancelled'); assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/cancel`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409); }); });
test('Staff Patient detail returns demographics and newest-first operational appointment history only', async () => { const c = createContext(); c.patients.get(ids.patient).user_profile_id = ids.patientProfile; c.appointments.get(ids.future).created_by = ids.patientProfile; await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/patients/${ids.patient}`, { cookie: c.cookie(ids.staffProfile) }); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.patient.address, null); assert.equal(body.patient.has_portal_account, true); assert.equal(body.appointments[0].id, ids.future); assert.equal(body.appointments[0].origin, 'patient'); assert.equal(body.appointments[0].queue_priority, 'normal'); const serialized = JSON.stringify(body); for (const clinical of ['Viral infection', 'Secret detailed notes', 'prescriptions', 'diagnosis']) assert.ok(!serialized.includes(clinical)); }); });
test('Staff Patient detail validates identifiers and enforces active Staff role', async () => { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, '/api/staff/patients/not-an-id', { cookie: c.cookie(ids.staffProfile) })).status, 400); assert.equal((await request(base, '/api/staff/patients/ffffffffffffffffffffffff', { cookie: c.cookie(ids.staffProfile) })).status, 404); assert.equal((await request(base, `/api/staff/patients/${ids.patient}`)).status, 401); assert.equal((await request(base, `/api/staff/patients/${ids.patient}`, { cookie: c.cookie(ids.inactiveStaffProfile) })).status, 403); for (const profile of [ids.patientProfile, ids.doctorProfile, ids.adminProfile]) assert.equal((await request(base, `/api/staff/patients/${ids.patient}`, { cookie: c.cookie(profile) })).status, 403); }); });
for (const [role, profile] of [['Patient', ids.patientProfile], ['Doctor', ids.doctorProfile], ['Admin', ids.adminProfile]]) test(`${role} cannot use Staff Patient search`, async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, '/api/staff/patients', { cookie: c.cookie(profile) })).status, 403)); });

test('Staff registers a walk-in without UserProfile or AuthAccount creation', async () => { const c = createContext(); const before = c.patients.size; await withServer(c.app, async (base) => { const response = await request(base, '/api/staff/patients/walk-in', { method: 'POST', cookie: c.cookie(ids.staffProfile), body: walkInBody }); const body = await response.json(); assert.equal(response.status, 201); assert.equal(c.patients.size, before + 1); const stored = c.patients.get(body.patient.id); assert.equal(stored.user_profile_id, null); assert.equal(body.patient.has_portal_account, false); assert.equal('is_senior' in stored, false); }); });
test('clear duplicate walk-in match is rejected without name-only matching', async () => { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, '/api/staff/patients/walk-in', { method: 'POST', cookie: c.cookie(ids.staffProfile), body: { ...walkInBody, contact_number: '09171234567' } })).status, 409); const allowed = await request(base, '/api/staff/patients/walk-in', { method: 'POST', cookie: c.cookie(ids.staffProfile), body: { ...walkInBody, full_name: 'Alex Patient' } }); assert.equal(allowed.status, 201); }); });

test('Staff creates a same-day confirmed walk-in using stable Patient ID and Staff creator', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/patients/${ids.patient}/walk-in-appointments`, { method: 'POST', cookie: c.cookie(ids.staffProfile), body: walkInAppointment }); const body = await response.json(); assert.equal(response.status, 201); assert.equal(body.appointment.patient_id, ids.patient); assert.equal(body.appointment.status, 'confirmed'); assert.equal(c.appointments.get(body.appointment.id).created_by, ids.staffProfile); }); });
test('non-same-day, invalid visit type, missing Patient, and missing Doctor are rejected', async () => { const c = createContext(); await withServer(c.app, async (base) => { const cases = [
  [`/api/staff/patients/${ids.patient}/walk-in-appointments`, { ...walkInAppointment, appointment_at: '2026-09-26T03:00:00Z' }, 400],
  [`/api/staff/patients/${ids.patient}/walk-in-appointments`, { ...walkInAppointment, visit_type: 'emergency' }, 400],
  [`/api/staff/patients/${ids.patient}/walk-in-appointments`, { ...walkInAppointment, priority: 'urgent' }, 400],
  ['/api/staff/patients/ffffffffffffffffffffffff/walk-in-appointments', walkInAppointment, 404],
  [`/api/staff/patients/${ids.patient}/walk-in-appointments`, { ...walkInAppointment, doctor_id: 'ffffffffffffffffffffffff' }, 404],
]; for (const [path, body, status] of cases) assert.equal((await request(base, path, { method: 'POST', cookie: c.cookie(ids.staffProfile), body })).status, status); }); });

test('existing Staff confirmation remains pending to confirmed only', async () => { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile) })).status, 200); assert.equal(c.appointments.get(ids.pending).status, 'confirmed'); assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile) })).status, 409); }); });
test('Confirm Arrival atomically confirms a pending appointment and records trusted server time', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(response.status, 200); const stored = c.appointments.get(ids.pending); assert.equal(stored.status, 'confirmed'); assert.equal(stored.check_in_at.toISOString(), NOW.toISOString()); const body = await response.json(); assert.equal(body.queue_entry.status, 'confirmed'); assert.equal(body.queue_entry.check_in_at, NOW.toISOString()); }); });
test('Confirm Arrival checks in an already-confirmed walk-in without changing its status', async () => { const c = createContext(); await withServer(c.app, async (base) => { const first = await request(base, `/api/staff/appointments/${ids.confirmed}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(first.status, 200); assert.equal(c.appointments.get(ids.confirmed).status, 'confirmed'); assert.equal(c.appointments.get(ids.confirmed).check_in_at.toISOString(), NOW.toISOString()); assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409); }); });
test('simultaneous Confirm Arrival requests allow exactly one transition and preserve its timestamp', async () => { const c = createContext(); await withServer(c.app, async (base) => { const responses = await Promise.all([1, 2].map(() => request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }))); assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]); assert.equal(c.appointments.get(ids.pending).status, 'confirmed'); assert.equal(c.appointments.get(ids.pending).check_in_at.toISOString(), NOW.toISOString()); }); });
test('stale Confirm Arrival fails after a reschedule changes the appointment time', async () => { const c = createContext(); c.repository.beforeConfirmArrival = ({ id, appointments }) => { appointments.get(String(id)).appointment_at = new Date('2026-09-25T01:30:00.000Z'); }; await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(response.status, 409); assert.equal(c.appointments.get(ids.pending).check_in_at, null); }); });
test('Confirm Arrival racing with no-show permits exactly one terminal decision', async () => { const c = createContext(); await withServer(c.app, async (base) => { const responses = await Promise.all([
  request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }),
  request(base, `/api/staff/appointments/${ids.pending}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }),
]); assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]); const stored = c.appointments.get(ids.pending); assert.ok(stored.status === 'no_show' && !stored.check_in_at || stored.status === 'confirmed' && stored.check_in_at?.toISOString() === NOW.toISOString()); }); });
test('late same-day arrival succeeds while previous and future clinic dates are rejected', async () => { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 200); for (const appointmentId of [ids.previous, ids.future]) assert.equal((await request(base, `/api/staff/appointments/${appointmentId}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409); }); });
for (const appointmentId of [ids.completed, ids.cancelled, ids.noShow]) test(`${appointmentId} cannot confirm arrival`, async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, `/api/staff/appointments/${appointmentId}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409)); });
test('Confirm Arrival rejects malformed IDs, protected fields, unauthenticated callers, and wrong roles', async () => { const c = createContext(); await withServer(c.app, async (base) => {
  assert.equal((await request(base, '/api/staff/appointments/not-an-id/check-in', { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 400);
  assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { status: 'confirmed', check_in_at: NOW.toISOString() } })).status, 400);
  assert.equal(c.appointments.get(ids.pending).status, 'pending'); assert.equal(c.appointments.get(ids.pending).check_in_at, null);
  assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', body: {} })).status, 401);
  for (const profile of [ids.patientProfile, ids.doctorProfile, ids.adminProfile]) assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/check-in`, { method: 'PATCH', cookie: c.cookie(profile), body: {} })).status, 403);
}); });

test('queue orders Urgent then Senior/PWD then Normal and same tier by check-in', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, '/api/staff/queue', { cookie: c.cookie(ids.staffProfile) }); const queue = (await response.json()).queue; assert.deepEqual(queue.map((item) => item.appointment_id), [ids.urgent, ids.pwdAppointment, ids.seniorAppointment, ids.bothAppointment, ids.normal]); assert.deepEqual(queue.map((item) => item.queue_priority), ['urgent', 'senior_pwd', 'senior_pwd', 'senior_pwd', 'normal']); }); });
for (const reason of URGENT_REASON_LABELS) test(`checked-in appointment accepts approved Urgent reason: ${reason}`, async () => { const c = createContext(); await withServer(c.app, async (base) => { const body = { priority: 'urgent', urgency_reason: reason, ...(reason === 'Other urgent concern' ? { explanation: 'Patient needs prompt operational review.' } : {}) }; const response = await request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body }); assert.equal(response.status, 200); assert.equal(c.appointments.get(ids.normal).priority, 'urgent'); assert.equal(c.priorityAudits.length, 1); assert.equal(c.priorityAudits[0].staff_actor_user_profile_id, ids.staffProfile); assert.equal(c.priorityAudits[0].created_at.toISOString(), NOW.toISOString()); assert.equal(c.priorityAudits[0].urgency_reason, reason); }); });
test('Urgent rejects pending, unchecked, and terminal appointments without audit records', async () => { const c = createContext(); await withServer(c.app, async (base) => { for (const appointmentId of [ids.pending, ids.confirmed, ids.cancelled, ids.completed, ids.noShow]) { const response = await request(base, `/api/staff/appointments/${appointmentId}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'urgent', urgency_reason: 'Severe pain or discomfort' } }); assert.equal(response.status, 409); } assert.equal(c.priorityAudits.length, 0); }); });
test('Urgent reason validation rejects unknown, missing, empty Other, oversized, and mismatched inputs', async () => { const cases = [
  { priority: 'urgent' },
  { priority: 'urgent', urgency_reason: 'VIP request' },
  { priority: 'urgent', urgency_reason: 'Other urgent concern' },
  { priority: 'urgent', urgency_reason: 'Other urgent concern', explanation: '   ' },
  { priority: 'urgent', urgency_reason: 'Other urgent concern', explanation: 'x'.repeat(201) },
  { priority: 'urgent', urgency_reason: 'Severe pain or discomfort', explanation: 'Not allowed' },
  { priority: 'vip', urgency_reason: 'Severe pain or discomfort' },
]; for (const body of cases) { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body })).status, 400); assert.equal(c.appointments.get(ids.normal).priority, 'normal'); assert.equal(c.priorityAudits.length, 0); }); } });
test('Urgent to Normal requires a bounded correction and appends rather than rewrites history', async () => { const c = createContext(); const original = { _id: '800000000000000000000001', appointment_id: ids.urgent, previous_priority: 'normal', new_priority: 'urgent', urgency_reason: 'Doctor-directed priority', explanation: null, correction_reason: null, staff_actor_user_profile_id: ids.staffProfile, created_at: new Date('2026-09-25T01:55:00Z') }; c.priorityAudits.push(original); await withServer(c.app, async (base) => { for (const correction_reason of [undefined, '   ', 'x'.repeat(201)]) { const response = await request(base, `/api/staff/appointments/${ids.urgent}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'normal', ...(correction_reason == null ? {} : { correction_reason }) } }); assert.equal(response.status, 400); } const response = await request(base, `/api/staff/appointments/${ids.urgent}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'normal', correction_reason: 'Urgency was selected for the wrong appointment.' } }); assert.equal(response.status, 200); assert.equal(c.appointments.get(ids.urgent).priority, 'normal'); assert.equal(c.priorityAudits.length, 2); assert.deepEqual(c.priorityAudits[0], original); assert.equal(c.priorityAudits[1].correction_reason, 'Urgency was selected for the wrong appointment.'); }); });
test('priority mutation derives actor/time and rejects client-forged protected fields', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'urgent', urgency_reason: 'Severe pain or discomfort', staff_actor_user_profile_id: ids.adminProfile, created_at: '2020-01-01T00:00:00Z' } }); assert.equal(response.status, 400); assert.equal(c.appointments.get(ids.normal).priority, 'normal'); assert.equal(c.priorityAudits.length, 0); }); });
test('priority mutation rejects invalid IDs, unauthenticated callers, and wrong roles', async () => { const c = createContext(); const body = { priority: 'urgent', urgency_reason: 'Severe pain or discomfort' }; await withServer(c.app, async (base) => { assert.equal((await request(base, '/api/staff/appointments/not-an-id/priority', { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body })).status, 400); assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', body })).status, 401); for (const profile of [ids.patientProfile, ids.doctorProfile, ids.adminProfile]) assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', cookie: c.cookie(profile), body })).status, 403); assert.equal(c.appointments.get(ids.normal).priority, 'normal'); assert.equal(c.priorityAudits.length, 0); }); });
test('audit failure rolls back priority and creates no orphan history', async () => { const c = createContext(); c.repository.failPriorityAudit = true; await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'urgent', urgency_reason: 'Severe pain or discomfort' } }); assert.equal(response.status, 500); assert.equal(c.appointments.get(ids.normal).priority, 'normal'); assert.equal(c.priorityAudits.length, 0); }); });
test('simultaneous Urgent changes create exactly one priority event', async () => { const c = createContext(); await withServer(c.app, async (base) => { const responses = await Promise.all([1, 2].map(() => request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'urgent', urgency_reason: 'Severe pain or discomfort' } }))); assert.deepEqual(responses.map(item => item.status).sort(), [200, 409]); assert.equal(c.priorityAudits.length, 1); }); });
test('Staff reads safe priority history while unauthenticated and wrong-role callers are denied', async () => { const c = createContext(); await withServer(c.app, async (base) => { await request(base, `/api/staff/appointments/${ids.normal}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'urgent', urgency_reason: 'Other urgent concern', explanation: 'Needs immediate operational attention.' } }); const response = await request(base, `/api/staff/appointments/${ids.normal}/priority-history`, { cookie: c.cookie(ids.staffProfile) }); const body = await response.json(); assert.equal(response.status, 200); assert.deepEqual(Object.keys(body.priority_history[0]).sort(), ['appointment_id','changed_at','correction_reason','explanation','id','new_priority','previous_priority','staff_actor','urgency_reason']); assert.equal(JSON.stringify(body).includes('Consultation'), false); assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority-history`)).status, 401); for (const profile of [ids.patientProfile, ids.doctorProfile, ids.adminProfile]) assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/priority-history`, { cookie: c.cookie(profile) })).status, 403); }); });

test('Staff marks eligible appointment no-show and it stays preserved outside queue', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(response.status, 200); assert.equal(c.appointments.get(ids.confirmed).status, 'no_show'); const queue = (await (await request(base, '/api/staff/queue', { cookie: c.cookie(ids.staffProfile) })).json()).queue; assert.ok(!queue.some((item) => item.appointment_id === ids.confirmed)); }); });
for (const [label, now] of [
  ['before appointment start', '2026-09-25T01:29:59.000Z'],
  ['at appointment start', '2026-09-25T01:30:00.000Z'],
  ['at four minutes fifty-nine seconds', '2026-09-25T01:34:59.000Z'],
]) test(`No-show is rejected ${label}`, async () => { const c = createContext({ now }); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); const body = await response.json(); assert.equal(response.status, 409); assert.equal(body.error.code, 'NO_SHOW_GRACE_PERIOD'); assert.equal(c.appointments.get(ids.confirmed).status, 'confirmed'); }); });
test('No-show is allowed exactly five minutes after appointment start', async () => { const c = createContext({ now: '2026-09-25T01:35:00.000Z' }); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(response.status, 200); assert.equal(c.appointments.get(ids.confirmed).status, 'no_show'); }); });
test('No-show is allowed after five minutes for a pending unchecked appointment', async () => { const c = createContext({ now: '2026-09-25T01:06:00.000Z' }); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.pending}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(response.status, 200); assert.equal(c.appointments.get(ids.pending).status, 'no_show'); }); });
test('duplicate No-show requests allow exactly one transition', async () => { const c = createContext(); await withServer(c.app, async (base) => { const responses = await Promise.all([1, 2].map(() => request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }))); assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]); assert.equal(c.appointments.get(ids.confirmed).status, 'no_show'); }); });
test('stale No-show fails after a reschedule changes the appointment time', async () => { const c = createContext(); c.repository.beforeNoShow = ({ id, appointments }) => { appointments.get(String(id)).appointment_at = new Date('2026-09-25T01:30:00.000Z'); }; await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.pending}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(response.status, 409); assert.equal(c.appointments.get(ids.pending).status, 'pending'); }); });
for (const appointmentId of [ids.completed, ids.cancelled, ids.noShow, ids.normal]) test(`${appointmentId} cannot be marked no-show`, async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, `/api/staff/appointments/${appointmentId}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409)); });
test('No-show rejects malformed IDs, protected fields, unauthenticated callers, and wrong roles', async () => { const c = createContext(); await withServer(c.app, async (base) => {
  assert.equal((await request(base, '/api/staff/appointments/not-an-id/no-show', { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 400);
  assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { status: 'no_show', appointment_at: '2020-01-01T00:00:00.000Z' } })).status, 400);
  assert.equal(c.appointments.get(ids.confirmed).status, 'confirmed');
  assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', body: {} })).status, 401);
  for (const profile of [ids.patientProfile, ids.doctorProfile, ids.adminProfile]) assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', cookie: c.cookie(profile), body: {} })).status, 403);
}); });

test('Doctor-completed appointment is absent from Staff queue and Staff has no completion endpoint', async () => { const c = createContext(); await withServer(c.app, async (base) => { const queue = (await (await request(base, '/api/staff/queue', { cookie: c.cookie(ids.staffProfile) })).json()).queue; assert.ok(!queue.some((item) => item.appointment_id === ids.completed)); assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/complete`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 404); }); });
test('record metadata excludes diagnosis, notes, prescriptions and certificate contents', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/patients/${ids.patient}/record-summary`, { cookie: c.cookie(ids.staffProfile) }); const summary = (await response.json()).medical_record_summaries[0]; assert.equal(response.status, 200); assert.deepEqual(Object.keys(summary).sort(), ['attending_doctor', 'encounter_at', 'id', 'patient_name']); const serialized = JSON.stringify(summary); for (const secret of ['Viral infection', 'Secret detailed notes', 'Hidden', 'diagnosis', 'prescriptions', 'certificate']) assert.ok(!serialized.includes(secret)); }); });
test('/api/health remains 200 with Staff operations mounted', async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, '/api/health')).status, 200)); });
