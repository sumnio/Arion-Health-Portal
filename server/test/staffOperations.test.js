import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createStaffOperationsModule } from '../src/services/staffOperationsModule.js';
import { createTokenService } from '../src/services/tokenService.js';

const SECRET = 'staff-operations-test-secret-123456789012345';
const NOW = new Date('2026-09-25T02:00:00.000Z');
const ids = {
  staffProfile: '111111111111111111111111', patientProfile: '222222222222222222222222', doctorProfile: '333333333333333333333333', adminProfile: '444444444444444444444444',
  doctor: 'aaaaaaaaaaaaaaaaaaaaaaaa', patient: 'bbbbbbbbbbbbbbbbbbbbbbbb', senior: 'cccccccccccccccccccccccc', pwd: 'dddddddddddddddddddddddd', both: 'eeeeeeeeeeeeeeeeeeeeeeee',
  pending: '100000000000000000000001', confirmed: '100000000000000000000002', urgent: '100000000000000000000003', seniorAppointment: '100000000000000000000004', pwdAppointment: '100000000000000000000005', bothAppointment: '100000000000000000000006', normal: '100000000000000000000007', completed: '100000000000000000000008', cancelled: '100000000000000000000009', noShow: '10000000000000000000000a',
};
function clone(value) { return value == null ? value : structuredClone(value); }

function createContext() {
  const profiles = new Map([
    [ids.staffProfile, { user_profile_id: ids.staffProfile, display_name: 'Demo Staff', role: 'staff', status: 'active' }],
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
  ]);
  const records = [{ _id: '900000000000000000000001', patient_id: { _id: ids.patient, full_name: 'Alex Patient' }, doctor_id: doctor, encounter_at: new Date('2026-09-20T02:00:00Z'), diagnosis: 'Viral infection', notes: 'Secret detailed notes', prescriptions: [{ medicine: 'Hidden' }], certificate: { purpose: 'Hidden' } }];
  let sequence = 100;
  const nextId = () => (++sequence).toString(16).padStart(24, '0');
  const populated = (item) => item ? { ...clone(item), patient_id: clone(patients.get(String(item.patient_id?._id ?? item.patient_id))), doctor_id: clone(doctor) } : null;
  const repository = {
    async listAppointmentsBetween(start, end) { return [...appointments.values()].filter((item) => item.appointment_at >= start && item.appointment_at < end).map(populated); },
    async listActiveDoctors() { return [clone(doctor)]; },
    async searchPatients(search) { const q = search.toLowerCase(); return [...patients.values()].filter((item) => !q || item.full_name.toLowerCase().includes(q) || item.contact_number.includes(search)).map(clone); },
    async findPotentialDuplicate(input) { return clone([...patients.values()].find((item) => item.contact_number === input.contact_number || (item.full_name.toLowerCase() === input.full_name.toLowerCase() && item.dob.getTime() === input.dob.getTime()))); },
    async createPatient(data) { const value = { _id: nextId(), allergies: [], ...clone(data) }; patients.set(value._id, value); return clone(value); },
    async findPatientById(id) { return clone(patients.get(String(id))); },
    async doctorExists(id) { return String(id) === ids.doctor; },
    async createAppointment(data) { if ([...appointments.values()].some((item) => item.doctor_id === String(data.doctor_id) && item.appointment_at.getTime() === data.appointment_at.getTime() && ['pending', 'confirmed', 'completed'].includes(item.status))) throw Object.assign(new Error('duplicate'), { code: 11000 }); const value = { _id: nextId(), ...clone(data), patient_id: String(data.patient_id), doctor_id: String(data.doctor_id) }; appointments.set(value._id, value); return clone(value); },
    async findAppointmentById(id) { return clone(appointments.get(String(id))); },
    async checkInConfirmed(id, timestamp) { const item = appointments.get(String(id)); if (!item || item.status !== 'confirmed' || item.check_in_at) return null; item.check_in_at = timestamp; return populated(item); },
    async updatePriorityEligible(id, priority) { const item = appointments.get(String(id)); if (!item || !['pending', 'confirmed'].includes(item.status)) return null; item.priority = priority; return populated(item); },
    async markNoShowEligible(id, now) { const item = appointments.get(String(id)); if (!item || !['pending', 'confirmed'].includes(item.status) || item.check_in_at || item.appointment_at > now) return null; item.status = 'no_show'; return populated(item); },
    async cancelEligible(id) { const item = appointments.get(String(id)); if (!item || !['pending', 'confirmed'].includes(item.status) || item.check_in_at) return null; item.status = 'cancelled'; return populated(item); },
    async listWaitingBetween(start, end) { return [...appointments.values()].filter((item) => item.status === 'confirmed' && item.check_in_at && item.appointment_at >= start && item.appointment_at < end).map(populated); },
    async listRecordSummaries(patientId) { return records.filter((item) => String(item.patient_id._id) === String(patientId)).map(clone); },
  };
  const tokens = createTokenService(SECRET);
  const authModule = { tokens, service: { async getAuthenticatedUser(id) { const found = profiles.get(String(id)); if (!found) throw Object.assign(new Error('Authentication required'), { status: 401, code: 'UNAUTHENTICATED' }); return clone(found); } } };
  const staffOperationsModule = createStaffOperationsModule({ repository, clinic: { timeZone: 'Asia/Manila' }, now: () => new Date(NOW) });
  const patientAppointmentModule = { patientService: {}, appointmentService: { async confirmForStaff(id) { const item = appointments.get(String(id)); if (!item) throw Object.assign(new Error('Not found'), { status: 404, code: 'APPOINTMENT_NOT_FOUND' }); if (item.status !== 'pending') throw Object.assign(new Error('Only pending'), { status: 409, code: 'INVALID_STATUS_TRANSITION' }); item.status = 'confirmed'; return { id: item._id, status: item.status }; } } };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, staffOperationsModule, patientAppointmentModule });
  return { app, patients, appointments, records, cookie: (profile) => `arion_auth=${tokens.sign(profile, { mfaVerified: profiles.get(String(profile))?.role === 'admin' })}` };
}
async function withServer(app, callback) { const server = app.listen(0, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); }); try { await callback(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); } }
function request(base, path, { method = 'GET', cookie, body } = {}) { return fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
const walkInBody = { full_name: 'New Walk-in', contact_number: '09998887777', dob: '1985-04-12', sex: 'female', address: null, emergency_contact_name: 'Family Contact', emergency_contact_number: '09112223333', emergency_contact_relationship: 'Sibling', is_pwd: false };
const walkInAppointment = { doctor_id: ids.doctor, appointment_at: '2026-09-25T03:00:00.000Z', visit_type: 'general_consultation', reason: 'Walk-in concern', priority: 'normal' };

test('Staff searches Patients by name and contact with basic projection', async () => { const c = createContext(); await withServer(c.app, async (base) => { for (const query of ['Alex', '1234567']) { const response = await request(base, `/api/staff/patients?search=${query}`, { cookie: c.cookie(ids.staffProfile) }); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.patients[0].full_name, 'Alex Patient'); assert.equal('allergies' in body.patients[0], false); } }); });
test('Staff reads a date-filtered operational calendar and active Doctor directory', async () => { const c = createContext(); await withServer(c.app, async (base) => { const appointmentsResponse = await request(base, '/api/staff/appointments?date=2026-09-25', { cookie: c.cookie(ids.staffProfile) }); const body = await appointmentsResponse.json(); assert.equal(appointmentsResponse.status, 200); assert.equal(body.appointments.length, 10); assert.deepEqual(Object.keys(body.appointments[0]).sort(), ['appointment_at','check_in_at','doctor','id','patient','priority','reason','status','visit_type']); assert.equal(JSON.stringify(body).includes('allergies'), false); const doctors = await (await request(base, '/api/staff/doctors', { cookie: c.cookie(ids.staffProfile) })).json(); assert.deepEqual(doctors.doctors, [{ id: ids.doctor, display_name: 'Dr. Maria Santos', specialty: 'General Medicine' }]); }); });
test('Staff reads one basic Patient and can cancel only an unchecked active Appointment', async () => { const c = createContext(); await withServer(c.app, async (base) => { const patient = await (await request(base, `/api/staff/patients/${ids.patient}`, { cookie: c.cookie(ids.staffProfile) })).json(); assert.equal(patient.patient.full_name, 'Alex Patient'); const cancelled = await request(base, `/api/staff/appointments/${ids.confirmed}/cancel`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(cancelled.status, 200); assert.equal(c.appointments.get(ids.confirmed).status, 'cancelled'); assert.equal((await request(base, `/api/staff/appointments/${ids.normal}/cancel`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409); }); });
for (const [role, profile] of [['Patient', ids.patientProfile], ['Doctor', ids.doctorProfile], ['Admin', ids.adminProfile]]) test(`${role} cannot use Staff Patient search`, async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, '/api/staff/patients', { cookie: c.cookie(profile) })).status, 403)); });

test('Staff registers a walk-in without UserProfile or AuthAccount creation', async () => { const c = createContext(); const before = c.patients.size; await withServer(c.app, async (base) => { const response = await request(base, '/api/staff/patients/walk-in', { method: 'POST', cookie: c.cookie(ids.staffProfile), body: walkInBody }); const body = await response.json(); assert.equal(response.status, 201); assert.equal(c.patients.size, before + 1); const stored = c.patients.get(body.patient.id); assert.equal(stored.user_profile_id, null); assert.equal(body.patient.has_portal_account, false); assert.equal('is_senior' in stored, false); }); });
test('clear duplicate walk-in match is rejected without name-only matching', async () => { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, '/api/staff/patients/walk-in', { method: 'POST', cookie: c.cookie(ids.staffProfile), body: { ...walkInBody, contact_number: '09171234567' } })).status, 409); const allowed = await request(base, '/api/staff/patients/walk-in', { method: 'POST', cookie: c.cookie(ids.staffProfile), body: { ...walkInBody, full_name: 'Alex Patient' } }); assert.equal(allowed.status, 201); }); });

test('Staff creates a same-day confirmed walk-in using stable Patient ID and Staff creator', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/patients/${ids.patient}/walk-in-appointments`, { method: 'POST', cookie: c.cookie(ids.staffProfile), body: walkInAppointment }); const body = await response.json(); assert.equal(response.status, 201); assert.equal(body.appointment.patient_id, ids.patient); assert.equal(body.appointment.status, 'confirmed'); assert.equal(c.appointments.get(body.appointment.id).created_by, ids.staffProfile); }); });
test('non-same-day, invalid visit type, missing Patient, and missing Doctor are rejected', async () => { const c = createContext(); await withServer(c.app, async (base) => { const cases = [
  [`/api/staff/patients/${ids.patient}/walk-in-appointments`, { ...walkInAppointment, appointment_at: '2026-09-26T03:00:00Z' }, 400],
  [`/api/staff/patients/${ids.patient}/walk-in-appointments`, { ...walkInAppointment, visit_type: 'emergency' }, 400],
  ['/api/staff/patients/ffffffffffffffffffffffff/walk-in-appointments', walkInAppointment, 404],
  [`/api/staff/patients/${ids.patient}/walk-in-appointments`, { ...walkInAppointment, doctor_id: 'ffffffffffffffffffffffff' }, 404],
]; for (const [path, body, status] of cases) assert.equal((await request(base, path, { method: 'POST', cookie: c.cookie(ids.staffProfile), body })).status, status); }); });

test('existing Staff confirmation remains pending to confirmed only', async () => { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile) })).status, 200); assert.equal(c.appointments.get(ids.pending).status, 'confirmed'); assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile) })).status, 409); }); });
test('Staff checks in confirmed appointment with server time and duplicate check-in is rejected', async () => { const c = createContext(); await withServer(c.app, async (base) => { const first = await request(base, `/api/staff/appointments/${ids.confirmed}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { } }); assert.equal(first.status, 200); assert.equal(c.appointments.get(ids.confirmed).check_in_at.toISOString(), NOW.toISOString()); assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409); }); });
for (const appointmentId of [ids.pending, ids.completed, ids.cancelled, ids.noShow]) test(`${appointmentId} cannot be checked in`, async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, `/api/staff/appointments/${appointmentId}/check-in`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409)); });

test('queue orders Urgent then Senior/PWD then Normal and same tier by check-in', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, '/api/staff/queue', { cookie: c.cookie(ids.staffProfile) }); const queue = (await response.json()).queue; assert.deepEqual(queue.map((item) => item.appointment_id), [ids.urgent, ids.pwdAppointment, ids.seniorAppointment, ids.bothAppointment, ids.normal]); assert.deepEqual(queue.map((item) => item.queue_priority), ['urgent', 'senior_pwd', 'senior_pwd', 'senior_pwd', 'normal']); }); });
test('canonical priority update supports urgent and normal only', async () => { const c = createContext(); await withServer(c.app, async (base) => { assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'urgent' } })).status, 200); assert.equal(c.appointments.get(ids.confirmed).priority, 'urgent'); assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/priority`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: { priority: 'vip' } })).status, 400); }); });

test('Staff marks eligible appointment no-show and it stays preserved outside queue', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/appointments/${ids.confirmed}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} }); assert.equal(response.status, 200); assert.equal(c.appointments.get(ids.confirmed).status, 'no_show'); const queue = (await (await request(base, '/api/staff/queue', { cookie: c.cookie(ids.staffProfile) })).json()).queue; assert.ok(!queue.some((item) => item.appointment_id === ids.confirmed)); }); });
for (const appointmentId of [ids.completed, ids.cancelled, ids.noShow, ids.normal]) test(`${appointmentId} cannot be marked no-show`, async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, `/api/staff/appointments/${appointmentId}/no-show`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 409)); });

test('Doctor-completed appointment is absent from Staff queue and Staff has no completion endpoint', async () => { const c = createContext(); await withServer(c.app, async (base) => { const queue = (await (await request(base, '/api/staff/queue', { cookie: c.cookie(ids.staffProfile) })).json()).queue; assert.ok(!queue.some((item) => item.appointment_id === ids.completed)); assert.equal((await request(base, `/api/staff/appointments/${ids.confirmed}/complete`, { method: 'PATCH', cookie: c.cookie(ids.staffProfile), body: {} })).status, 404); }); });
test('limited record summary excludes notes, prescriptions and certificate contents', async () => { const c = createContext(); await withServer(c.app, async (base) => { const response = await request(base, `/api/staff/patients/${ids.patient}/record-summary`, { cookie: c.cookie(ids.staffProfile) }); const summary = (await response.json()).medical_record_summaries[0]; assert.equal(response.status, 200); assert.deepEqual(Object.keys(summary).sort(), ['attending_doctor', 'diagnosis_summary', 'encounter_at', 'id', 'patient_name']); const serialized = JSON.stringify(summary); for (const secret of ['Secret detailed notes', 'Hidden', 'prescriptions', 'certificate']) assert.ok(!serialized.includes(secret)); }); });
test('/api/health remains 200 with Staff operations mounted', async () => { const c = createContext(); await withServer(c.app, async (base) => assert.equal((await request(base, '/api/health')).status, 200)); });
