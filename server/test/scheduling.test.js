import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createPatientAppointmentModule } from '../src/services/patientAppointmentModule.js';
import { createSchedulingModule } from '../src/services/schedulingModule.js';
import { createTokenService } from '../src/services/tokenService.js';

const SECRET = 'scheduling-test-secret-12345678901234567890';
const NOW = new Date('2026-09-24T00:00:00.000Z');
const ids = {
  doctorProfile: '411111111111111111111111', otherDoctorProfile: '422222222222222222222222',
  patientProfile: '433333333333333333333333', doctor: '511111111111111111111111',
  otherDoctor: '522222222222222222222222', patient: '611111111111111111111111',
  recurring: '711111111111111111111111', otherRecurring: '722222222222222222222222',
};

function createContext({ clinic } = {}) {
  const profiles = new Map([
    [ids.doctorProfile, { user_profile_id: ids.doctorProfile, display_name: 'Doctor One', role: 'doctor', status: 'active' }],
    [ids.otherDoctorProfile, { user_profile_id: ids.otherDoctorProfile, display_name: 'Doctor Two', role: 'doctor', status: 'active' }],
    [ids.patientProfile, { user_profile_id: ids.patientProfile, display_name: 'Patient One', role: 'patient', status: 'active' }],
  ]);
  const doctors = [
    { _id: ids.doctor, user_profile_id: ids.doctorProfile },
    { _id: ids.otherDoctor, user_profile_id: ids.otherDoctorProfile },
  ];
  const patients = [{ _id: ids.patient, user_profile_id: ids.patientProfile, full_name: 'Patient One', dob: new Date('1990-01-01'), sex: 'other', contact_number: '09170000000', allergies: [], is_pwd: false }];
  const recurring = [
    { _id: ids.recurring, doctor_id: ids.doctor, day_of_week: 5, start_time: '09:00', end_time: '12:00', is_active: true },
    { _id: ids.otherRecurring, doctor_id: ids.otherDoctor, day_of_week: 5, start_time: '09:00', end_time: '12:00', is_active: true },
  ];
  const published = [];
  const blocked = [];
  const appointments = [];
  let sequence = 0x800;
  const nextId = () => (++sequence).toString(16).padStart(24, '0');
  const clone = (value) => structuredClone(value);
  const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
  const overlap = (start, end, otherStart, otherEnd) => start < otherEnd && end > otherStart;

  const schedulingRepository = {
    async findDoctorByUserProfileId(profileId) { return clone(doctors.find((item) => item.user_profile_id === profileId) ?? null); },
    async doctorExists(doctorId) { return doctors.some((item) => item._id === doctorId); },
    async listRecurring(doctorId) { return recurring.filter((item) => item.doctor_id === doctorId).map(clone); },
    async findRecurringOwned(id, doctorId) { return clone(recurring.find((item) => item._id === id && item.doctor_id === doctorId) ?? null); },
    async recurringOverlaps(doctorId, day, start, end, excludeId) { return recurring.some((item) => item.doctor_id === doctorId && item.day_of_week === day && item._id !== excludeId && overlap(start, end, item.start_time, item.end_time)); },
    async createRecurring(data) { const item = { _id: nextId(), ...data }; recurring.push(item); return clone(item); },
    async updateRecurringOwned(id, doctorId, changes) { const item = recurring.find((entry) => entry._id === id && entry.doctor_id === doctorId); if (!item) return null; Object.assign(item, changes); return clone(item); },
    async deleteRecurringOwned(id, doctorId) { const index = recurring.findIndex((item) => item._id === id && item.doctor_id === doctorId); return index < 0 ? null : clone(recurring.splice(index, 1)[0]); },
    async listPublished(doctorId) { return published.filter((item) => item.doctor_id === doctorId).map(clone); },
    async publishedOverlaps(doctorId, date, start, end) { return published.some((item) => item.doctor_id === doctorId && dateKey(item.availability_date) === dateKey(date) && overlap(start, end, item.start_time, item.end_time)); },
    async createPublished(data) { const item = { _id: nextId(), ...data }; published.push(item); return clone(item); },
    async deletePublishedOwned(id, doctorId) { const index = published.findIndex((item) => item._id === id && item.doctor_id === doctorId); return index < 0 ? null : clone(published.splice(index, 1)[0]); },
    async listPublishedForDate(doctorId, date) { return published.filter((item) => item.doctor_id === doctorId && dateKey(item.availability_date) === dateKey(date)).map(clone); },
    async listBlocked(doctorId) { return blocked.filter((item) => item.doctor_id === doctorId).map(clone); },
    async createBlocked(data) { const item = { _id: nextId(), ...data }; blocked.push(item); return clone(item); },
    async deleteBlockedOwned(id, doctorId) { const index = blocked.findIndex((item) => item._id === id && item.doctor_id === doctorId); return index < 0 ? null : clone(blocked.splice(index, 1)[0]); },
    async listBlocksOverlapping(doctorId, start, end) { return blocked.filter((item) => item.doctor_id === doctorId && new Date(item.start_at) < end && new Date(item.end_at) > start).map(clone); },
    async hasActiveAppointmentOverlap(doctorId, start, end) { return appointments.some((item) => item.doctor_id === doctorId && ['pending', 'confirmed', 'completed'].includes(item.status) && new Date(item.appointment_at) < end && new Date(item.appointment_at).getTime() + 1800000 > start.getTime()); },
    async listActiveAppointmentsBetween(doctorId, start, end) { return appointments.filter((item) => item.doctor_id === doctorId && ['pending', 'confirmed', 'completed'].includes(item.status) && new Date(item.appointment_at) >= start && new Date(item.appointment_at) < end).map(clone); },
  };
  const appointmentRepository = {
    async doctorExists(doctorId) { return schedulingRepository.doctorExists(doctorId); },
    async create(data) {
      if (appointments.some((item) => item.doctor_id === data.doctor_id && new Date(item.appointment_at).getTime() === data.appointment_at.getTime() && ['pending', 'confirmed', 'completed'].includes(item.status))) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const item = { _id: nextId(), ...data };
      appointments.push(item);
      return clone(item);
    },
    async findOwnedById(id, patientId) { const item = appointments.find((entry) => entry._id === id && entry.patient_id === patientId); return item ? clone({ ...item, doctor_id: { _id: item.doctor_id, specialty: 'General', user_profile_id: { display_name: 'Doctor' } } }) : null; },
    async listByPatientId(patientId) { return appointments.filter((item) => item.patient_id === patientId).map(clone); },
    async findById(id) { return clone(appointments.find((item) => item._id === id) ?? null); },
    async cancelOwnedEligible() { return null; }, async confirmPending() { return null; },
  };
  const patientRepository = {
    async findByUserProfileId(profileId) { return clone(patients.find((item) => item.user_profile_id === profileId) ?? null); },
    async updateByUserProfileId() { return null; },
  };
  const schedulingModule = createSchedulingModule({ repository: schedulingRepository, clinic: clinic ?? { timeZone: 'Asia/Manila' }, now: () => new Date(NOW) });
  const patientAppointmentModule = createPatientAppointmentModule({ patients: patientRepository, appointments: appointmentRepository, bookingAvailabilityService: schedulingModule.bookingAvailabilityService, now: () => new Date(NOW) });
  const tokens = createTokenService(SECRET);
  const authService = { async getAuthenticatedUser(id) { const profile = profiles.get(String(id)); if (!profile) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'UNAUTHENTICATED' }); return { ...profile }; }, async registerPatient() {}, async login() {} };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule: { service: authService, tokens }, schedulingModule, patientAppointmentModule });
  return { app, recurring, published, blocked, appointments, cookie: (profileId) => `arion_auth=${tokens.sign(profileId)}` };
}

async function withServer(app, check) { const server = app.listen(0, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); }); try { await check(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); } }
function request(url, path, { method = 'GET', body, cookie } = {}) { return fetch(`${url}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
const publish = (url, cookie, doctorProfile = ids.doctorProfile) => request(url, '/api/doctor/published-availability', { method: 'POST', cookie: cookie(doctorProfile), body: { availability_date: '2026-09-25', start_time: '09:00', end_time: '12:00' } });
const slots = (url, cookie, doctor = ids.doctor, date = '2026-09-25') => request(url, `/api/patient/doctors/${doctor}/available-slots?date=${date}`, { cookie: cookie(ids.patientProfile) });
const booking = (doctor = ids.doctor, time = '09:00') => ({ doctor_id: doctor, appointment_at: `2026-09-25T${String(Number(time.slice(0,2))-8).padStart(2,'0')}:${time.slice(3)}:00.000Z`, visit_type: 'general_consultation', reason: 'Scheduling test' });

test('Doctor reads only own recurring availability', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { const body = await (await request(url, '/api/doctor/availability', { cookie: cookie(ids.doctorProfile) })).json(); assert.deepEqual(body.availability.map((item) => item.id), [ids.recurring]); }); });
test('Doctor cannot modify another Doctor recurring availability', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, `/api/doctor/availability/${ids.otherRecurring}`, { method: 'DELETE', cookie: cookie(ids.doctorProfile) })).status, 404)); });
test('Doctor can create multiple non-overlapping ranges on one day', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/availability', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { day_of_week: 5, start_time: '13:00', end_time: '17:00' } })).status, 201)); });
test('Doctor can update and disable an owned recurring range', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { const response = await request(url, `/api/doctor/availability/${ids.recurring}`, { method: 'PATCH', cookie: cookie(ids.doctorProfile), body: { is_active: false } }); assert.equal(response.status, 200); assert.equal((await response.json()).availability.is_active, false); }); });
test('invalid recurring start greater than or equal to end is rejected', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/availability', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { day_of_week: 5, start_time: '12:00', end_time: '09:00' } })).status, 400)); });
test('Patient cannot modify Doctor availability', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/availability', { method: 'POST', cookie: cookie(ids.patientProfile), body: { day_of_week: 5, start_time: '13:00', end_time: '17:00' } })).status, 403)); });
test('Doctor publishes a specific date within the recurring template', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await publish(url, cookie)).status, 201)); });
test('publication beyond 30 days is rejected', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/published-availability', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { availability_date: '2026-10-25', start_time: '09:00', end_time: '12:00' } })).status, 400)); });
test('publication outside active recurring template is rejected', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/published-availability', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { availability_date: '2026-09-25', start_time: '13:00', end_time: '15:00' } })).status, 409)); });
test('overlapping published ranges are rejected', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { assert.equal((await publish(url, cookie)).status, 201); assert.equal((await request(url, '/api/doctor/published-availability', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { availability_date: '2026-09-25', start_time: '10:00', end_time: '11:00' } })).status, 409); }); });
test('Doctor creates a partial-day block', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/blocked-times', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { start_at: '2026-09-25T09:30:00+08:00', end_at: '2026-09-25T10:30:00+08:00', reason: 'Meeting' } })).status, 201)); });
test('Doctor creates a whole-day block using clinic-local day boundaries', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/blocked-times', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { start_at: '2026-09-25T00:00:00+08:00', end_at: '2026-09-26T00:00:00+08:00', reason: 'Leave' } })).status, 201)); });
test('blocked time overrides published slots', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { await publish(url, cookie); await request(url, '/api/doctor/blocked-times', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { start_at: '2026-09-25T09:30:00+08:00', end_at: '2026-09-25T10:30:00+08:00', reason: 'Meeting' } }); const body = await (await slots(url, cookie)).json(); assert.deepEqual(body.slots.map((item) => item.start_time), ['09:00','10:30','11:00','11:30']); }); });
test('booked appointment removes its slot', async () => { const { app, cookie, appointments } = createContext(); appointments.push({ _id: '900000000000000000000001', patient_id: ids.patient, doctor_id: ids.doctor, appointment_at: new Date('2026-09-25T01:00:00.000Z'), status: 'confirmed' }); await withServer(app, async (url) => { await publish(url, cookie); const body = await (await slots(url, cookie)).json(); assert.equal(body.slots.some((item) => item.start_time === '09:00'), false); }); });
test('unpublished recurring availability is not bookable', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.deepEqual((await (await slots(url, cookie)).json()).slots, [])); });
test('Patient cannot see slots beyond 14 days', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.deepEqual((await (await slots(url, cookie, ids.doctor, '2026-10-10')).json()).slots, [])); });
test('Patient cannot book an unpublished slot', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking() })).status, 409)); });
test('Patient cannot book a blocked slot', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { await publish(url, cookie); await request(url, '/api/doctor/blocked-times', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { start_at: '2026-09-25T09:00:00+08:00', end_at: '2026-09-25T09:30:00+08:00', reason: 'Break' } }); assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking() })).status, 409); }); });
test('Patient cannot book an occupied slot', async () => { const { app, cookie, appointments } = createContext(); appointments.push({ _id: '900000000000000000000002', patient_id: ids.patient, doctor_id: ids.doctor, appointment_at: new Date('2026-09-25T01:00:00.000Z'), status: 'confirmed' }); await withServer(app, async (url) => { await publish(url, cookie); assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking() })).status, 409); }); });
test('Patient can book a valid explicitly published slot', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { await publish(url, cookie); const response = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking() }); assert.equal(response.status, 201); assert.equal((await response.json()).appointment.status, 'pending'); }); });
test('same Doctor cannot be double-booked', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { await publish(url, cookie); assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking() })).status, 201); assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking() })).status, 409); }); });
test('different Doctors may be booked at the same time', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => { await publish(url, cookie); await publish(url, cookie, ids.otherDoctorProfile); assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking(ids.doctor) })).status, 201); assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking(ids.otherDoctor) })).status, 201); }); });
test('past slot is rejected', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...booking(), appointment_at: '2026-09-23T01:00:00.000Z' } })).status, 400)); });
test('invalid 30-minute boundary is rejected', async () => { const { app, cookie } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...booking(), appointment_at: '2026-09-25T01:15:00.000Z' } })).status, 400)); });
test('availability deletion preserves existing appointments and overlapping blocks are rejected', async () => { const { app, cookie, appointments } = createContext(); await withServer(app, async (url) => { const publication = await (await publish(url, cookie)).json(); assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: booking() })).status, 201); assert.equal((await request(url, `/api/doctor/published-availability/${publication.published_availability.id}`, { method: 'DELETE', cookie: cookie(ids.doctorProfile) })).status, 200); assert.equal(appointments.length, 1); assert.equal((await request(url, '/api/doctor/blocked-times', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { start_at: '2026-09-25T09:00:00+08:00', end_at: '2026-09-25T10:00:00+08:00', reason: 'Conflict' } })).status, 409); assert.equal(appointments.length, 1); }); });
test('configured clinic hours constrain recurring availability', async () => { const { app, cookie } = createContext({ clinic: { timeZone: 'Asia/Manila', openTime: '09:00', closeTime: '17:00' } }); await withServer(app, async (url) => assert.equal((await request(url, '/api/doctor/availability', { method: 'POST', cookie: cookie(ids.doctorProfile), body: { day_of_week: 6, start_time: '08:30', end_time: '10:00' } })).status, 400)); });
test('/api/health remains available with scheduling routes mounted', async () => { const { app } = createContext(); await withServer(app, async (url) => assert.equal((await request(url, '/api/health')).status, 200)); });
