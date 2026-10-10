import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createPatientAppointmentModule } from '../src/services/patientAppointmentModule.js';
import { createTokenService } from '../src/services/tokenService.js';

const SECRET = 'patient-appointment-test-secret-123456789012345';
const NOW = new Date('2026-09-25T00:00:00.000Z');
const ids = {
  patientProfile: '111111111111111111111111',
  otherPatientProfile: '222222222222222222222222',
  staffProfile: '333333333333333333333333',
  doctorProfile: '444444444444444444444444',
  patient: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  otherPatient: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  doctor: 'cccccccccccccccccccccccc',
  pending: '100000000000000000000001',
  completed: '100000000000000000000002',
  cancelled: '100000000000000000000003',
  noShow: '100000000000000000000004',
  otherAppointment: '100000000000000000000005',
};

function createContext({ currentTime = NOW, notificationTriggers } = {}) {
  const recordedAppointments = new Set();
  const profiles = new Map([
    [ids.patientProfile, { user_profile_id: ids.patientProfile, display_name: 'Alex Patient', role: 'patient', status: 'active' }],
    [ids.otherPatientProfile, { user_profile_id: ids.otherPatientProfile, display_name: 'Other Patient', role: 'patient', status: 'active' }],
    [ids.staffProfile, { user_profile_id: ids.staffProfile, display_name: 'Clinic Staff', role: 'staff', status: 'active' }],
    [ids.doctorProfile, { user_profile_id: ids.doctorProfile, display_name: 'Maria Doctor', role: 'doctor', status: 'active' }],
  ]);
  const patients = new Map([
    [ids.patient, { _id: ids.patient, user_profile_id: ids.patientProfile, full_name: 'Alex Patient', dob: new Date('1990-01-15'), sex: 'male', contact_number: '09171234567', address: null, emergency_contact_name: null, emergency_contact_number: null, emergency_contact_relationship: null, allergies: [], is_pwd: false }],
    [ids.otherPatient, { _id: ids.otherPatient, user_profile_id: ids.otherPatientProfile, full_name: 'Other Patient', dob: new Date('1988-02-10'), sex: 'female', contact_number: '09170000000', address: null, emergency_contact_name: null, emergency_contact_number: null, emergency_contact_relationship: null, allergies: [], is_pwd: false }],
  ]);
  const doctor = { _id: ids.doctor, specialty: 'General Medicine', user_profile_id: { display_name: 'Dr. Maria Santos' } };
  const base = (id, patientId, status, appointmentAt, createdBy = ids.patientProfile) => ({
    _id: id,
    patient_id: patientId,
    doctor_id: doctor,
    appointment_at: new Date(appointmentAt),
    visit_type: 'general_consultation',
    reason: 'Consultation',
    status,
    priority: 'normal',
    check_in_at: null,
    created_by: createdBy,
  });
  const appointments = new Map([
    [ids.pending, base(ids.pending, ids.patient, 'pending', '2026-09-27T10:00:00.000Z')],
    [ids.completed, base(ids.completed, ids.patient, 'completed', '2026-09-20T09:00:00.000Z')],
    [ids.cancelled, base(ids.cancelled, ids.patient, 'cancelled', '2026-09-28T09:00:00.000Z')],
    [ids.noShow, base(ids.noShow, ids.patient, 'no_show', '2026-09-19T09:00:00.000Z')],
    [ids.otherAppointment, base(ids.otherAppointment, ids.otherPatient, 'pending', '2026-09-27T11:00:00.000Z', ids.otherPatientProfile)],
  ]);
  let sequence = 16;

  const patientRepository = {
    async findByUserProfileId(profileId) {
      const found = [...patients.values()].find((item) => item.user_profile_id === profileId);
      return found ? structuredClone(found) : null;
    },
    async updateByUserProfileId(profileId, updates) {
      const found = [...patients.values()].find((item) => item.user_profile_id === profileId);
      if (!found) return null;
      Object.assign(found, updates);
      if (updates.full_name) profiles.get(profileId).display_name = updates.full_name;
      return structuredClone(found);
    },
  };

  function cloneAppointment(item) {
    return item ? structuredClone(item) : null;
  }
  const appointmentRepository = {
    forceDuplicate: false,
    beforeCancel: null,
    beforeReschedule: null,
    lastCancelTime: null,
    forceRescheduleDuplicate: false,
    async listActiveDoctors() { return [structuredClone(doctor)]; },
    async doctorExists(id) { return id === ids.doctor; },
    async create(data) {
      const occupied = [...appointments.values()].some((item) =>
        String(item.doctor_id?._id ?? item.doctor_id) === data.doctor_id &&
        new Date(item.appointment_at).getTime() === data.appointment_at.getTime() &&
        ['pending', 'confirmed', 'completed'].includes(item.status));
      if (this.forceDuplicate || occupied) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const id = (++sequence).toString(16).padStart(24, '0');
      const created = { _id: id, ...data, doctor_id: doctor };
      appointments.set(id, created);
      return cloneAppointment(created);
    },
    async listByPatientId(patientId) {
      return [...appointments.values()].filter((item) => item.patient_id === patientId).map(cloneAppointment);
    },
    async findOwnedById(appointmentId, patientId) {
      const item = appointments.get(appointmentId);
      return item?.patient_id === patientId ? cloneAppointment(item) : null;
    },
    async findById(appointmentId) { return cloneAppointment(appointments.get(appointmentId)); },
    async medicalRecordExists(appointmentId) { return recordedAppointments.has(String(appointmentId)); },
    async listRecordedAppointmentIds(appointmentIds) { return appointmentIds.map(String).filter((id) => recordedAppointments.has(id)); },
    async cancelOwnedEligible(appointmentId, patientId, current, expectedAppointmentAt) {
      this.lastCancelTime = current;
      this.beforeCancel?.({ appointmentId, patientId, current, appointments });
      const item = appointments.get(appointmentId);
      if (!item || item.patient_id !== patientId || !['pending', 'confirmed'].includes(item.status) || item.check_in_at || new Date(item.appointment_at).getTime() !== new Date(expectedAppointmentAt).getTime() || new Date(item.appointment_at) <= current) return null;
      item.status = 'cancelled';
      return cloneAppointment(item);
    },
    async rescheduleOwnedEligible({ appointmentId, patientId, userProfileId, doctorId, expectedAppointmentAt, eligibilityCutoff, appointmentAt }) {
      await this.beforeReschedule?.({ appointmentId, patientId, userProfileId, doctorId, expectedAppointmentAt, eligibilityCutoff, appointmentAt, appointments });
      const item = appointments.get(appointmentId);
      if (!item || item.patient_id !== patientId || String(item.created_by) !== String(userProfileId) || String(item.doctor_id?._id ?? item.doctor_id) !== String(doctorId) || !['pending', 'confirmed'].includes(item.status) || item.check_in_at || new Date(item.appointment_at).getTime() !== new Date(expectedAppointmentAt).getTime() || new Date(item.appointment_at) < eligibilityCutoff) return null;
      const occupied = [...appointments.values()].some((other) => other !== item && String(other.doctor_id?._id ?? other.doctor_id) === String(doctorId) && new Date(other.appointment_at).getTime() === appointmentAt.getTime() && ['pending', 'confirmed', 'completed'].includes(other.status));
      if (this.forceRescheduleDuplicate || occupied) throw Object.assign(new Error('duplicate'), { code: 11000 });
      item.appointment_at = new Date(appointmentAt);
      item.status = 'pending';
      return cloneAppointment(item);
    },
    async confirmPending(appointmentId) {
      const item = appointments.get(appointmentId);
      if (!item || item.status !== 'pending') return null;
      item.status = 'confirmed';
      return cloneAppointment(item);
    },
  };

  const tokens = createTokenService(SECRET);
  const bookingAvailabilityService = {
    timeZone: 'Asia/Manila',
    calls: [],
    unavailable: new Map(),
    async assertBookable(doctorId, appointmentAt) {
      this.calls.push({ doctorId: String(doctorId), appointmentAt: new Date(appointmentAt) });
      const error = this.unavailable.get(new Date(appointmentAt).toISOString());
      if (error) throw error;
    },
  };
  const authService = {
    async getAuthenticatedUser(id) {
      const profile = profiles.get(String(id));
      if (!profile) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'UNAUTHENTICATED' });
      return { ...profile };
    },
    async registerPatient() { throw new Error('not used'); },
    async login() { throw new Error('not used'); },
  };
  const patientAppointmentModule = createPatientAppointmentModule({
    patients: patientRepository,
    appointments: appointmentRepository,
    bookingAvailabilityService,
    notificationTriggers,
    now: () => new Date(currentTime),
  });
  const app = createApp(
    { nodeEnv: 'test', authSecret: SECRET },
    { authModule: { service: authService, tokens }, patientAppointmentModule },
  );
  return {
    app,
    profiles,
    appointments,
    recordedAppointments,
    appointmentRepository,
    bookingAvailabilityService,
    cookie(profileId) { return `arion_auth=${tokens.sign(profileId)}`; },
  };
}

async function withServer(app, check) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try { await check(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function request(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validBooking = {
  doctor_id: ids.doctor,
  appointment_at: '2026-09-26T10:00:00.000Z',
  visit_type: 'general_consultation',
  reason: 'Headache or dizziness',
};
const validReschedule = { appointment_at: '2026-09-28T10:00:00.000Z' };

test('unauthenticated Patient profile request returns 401', async () => {
  const { app } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/profile')).status, 401));
});

test('wrong role Patient profile request returns 403', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/profile', { cookie: cookie(ids.staffProfile) })).status, 403));
});

test('Patient can read only the profile linked to the authenticated UserProfile', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/profile?patient_id=${ids.otherPatient}`, { cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).patient.id, ids.patient);
  });
});

test('Patient can update approved own profile fields, including documented DOB and sex fields', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/profile', { method: 'PATCH', cookie: cookie(ids.patientProfile), body: { full_name: 'Alex Updated', dob: '1991-02-20', sex: 'male', address: 'Quezon City', is_pwd: true } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.patient.full_name, 'Alex Updated');
    assert.equal(body.patient.dob, '1991-02-20');
    assert.equal(body.patient.is_pwd, true);
  });
});

test('Patient can list only safe active Doctor booking fields', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/doctors', { cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      doctors: [{ id: ids.doctor, display_name: 'Dr. Maria Santos', specialty: 'General Medicine' }],
    });
  });
});

test('Patient cannot update restricted profile fields', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/profile', { method: 'PATCH', cookie: cookie(ids.patientProfile), body: { user_profile_id: ids.otherPatientProfile } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'RESTRICTED_FIELD');
  });
});

test('Patient-created appointment records authenticated creator separately from Patient and Doctor', async () => {
  const { app, cookie, appointments } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: validBooking });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.appointment.status, 'pending');
    assert.equal(body.appointment.patient_id, ids.patient);
    assert.equal(body.appointment.doctor.id, ids.doctor);
    assert.equal('created_by' in body.appointment, false);
    const stored = appointments.get(body.appointment.id);
    assert.equal(stored.patient_id, ids.patient);
    assert.equal(stored.doctor_id._id, ids.doctor);
    assert.equal(stored.created_by, ids.patientProfile);
  });
});

test('Patient cannot provide patient_id or appointment status when booking', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...validBooking, patient_id: ids.otherPatient } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'RESTRICTED_FIELD');
  });
});

test('Patient cannot override created_by with an arbitrary UserProfile ID', async () => {
  const { app, cookie, appointments } = createContext();
  const before = appointments.size;
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/appointments', {
      method: 'POST',
      cookie: cookie(ids.patientProfile),
      body: { ...validBooking, created_by: ids.staffProfile },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'RESTRICTED_FIELD');
    assert.equal(appointments.size, before);
  });
});

test('deactivating a creator preserves the stored created_by history', async () => {
  const { app, cookie, appointments, profiles } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/appointments', {
      method: 'POST',
      cookie: cookie(ids.patientProfile),
      body: validBooking,
    });
    const appointmentId = (await response.json()).appointment.id;
    profiles.get(ids.patientProfile).status = 'inactive';
    assert.equal(appointments.get(appointmentId).created_by, ids.patientProfile);
    assert.ok(appointments.has(appointmentId));
  });
});

test('invalid visit_type is rejected', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...validBooking, visit_type: 'emergency' } })).status, 400));
});

test('Patient profile API validates required and optional Philippine mobile numbers', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    for (const body of [{ contact_number: '0917abc4567' }, { contact_number: '08171234567' }, { emergency_contact_number: '0917123' }]) {
      const response = await request(url, '/api/patient/profile', { method: 'PATCH', cookie: cookie(ids.patientProfile), body });
      assert.equal(response.status, 400);
    }
    const response = await request(url, '/api/patient/profile', { method: 'PATCH', cookie: cookie(ids.patientProfile), body: { contact_number: '0917 555 0123', emergency_contact_number: '' } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.patient.contact_number, '09175550123');
    assert.equal(body.patient.emergency_contact_number, null);
  });
});

test('Patient booking accepts approved reasons and normalizes Other concern text', async () => {
  const { app, cookie, appointments } = createContext();
  await withServer(app, async (url) => {
    const standard = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: validBooking });
    assert.equal(standard.status, 201);
    assert.equal((await standard.json()).appointment.reason, 'Headache or dizziness');
    const other = await request(url, '/api/patient/appointments', {
      method: 'POST',
      cookie: cookie(ids.patientProfile),
      body: { ...validBooking, appointment_at: '2026-09-26T10:30:00.000Z', reason: 'Other concern:   Persistent fatigue   ' },
    });
    assert.equal(other.status, 201);
    const otherId = (await other.json()).appointment.id;
    assert.equal(appointments.get(otherId).reason, 'Other concern: Persistent fatigue');
  });
});

test('Patient booking rejects unapproved, empty Other concern, and oversized reasons', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    for (const reason of ['Recurring headache', 'Other concern:   ', `Other concern: ${'x'.repeat(986)}`]) {
      const response = await request(url, '/api/patient/appointments', {
        method: 'POST',
        cookie: cookie(ids.patientProfile),
        body: { ...validBooking, reason },
      });
      assert.equal(response.status, 400, reason.slice(0, 40));
    }
  });
});

test('past appointment is rejected', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...validBooking, appointment_at: '2026-09-24T10:00:00.000Z' } })).status, 400));
});

test('appointment beyond the approved 14-day Patient window is rejected', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...validBooking, appointment_at: '2026-10-10T10:00:00.000Z' } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'OUTSIDE_BOOKING_WINDOW');
  });
});

test('appointment must use a 30-minute slot boundary', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...validBooking, appointment_at: '2026-09-26T10:15:00.000Z' } })).status, 400));
});

test('duplicate active Doctor slot is rejected with a structured 409', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const first = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: validBooking });
    const second = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: validBooking });
    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.equal((await second.json()).error.code, 'APPOINTMENT_SLOT_CONFLICT');
  });
});

test('database duplicate-key errors are mapped cleanly to 409', async () => {
  const { app, cookie, appointmentRepository } = createContext();
  appointmentRepository.forceDuplicate = true;
  await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: validBooking })).status, 409));
});

test('cancelled appointment does not block the same Doctor slot', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/appointments', { method: 'POST', cookie: cookie(ids.patientProfile), body: { ...validBooking, appointment_at: '2026-09-28T09:00:00.000Z' } });
    assert.equal(response.status, 201);
  });
});

test('Patient appointment list returns only own appointments with upcoming entries first', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, '/api/patient/appointments', { cookie: cookie(ids.patientProfile) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.ok(body.appointments.every((item) => item.patient_id === ids.patient));
    assert.notEqual(body.appointments[0].id, ids.completed);
  });
});

test('Patient can view own appointment detail with safe Doctor display information', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}`, { cookie: cookie(ids.patientProfile) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.appointment.doctor.display_name, 'Dr. Maria Santos');
    assert.equal('created_by' in body.appointment, false);
  });
});

test('Patient cannot access another Patient appointment detail', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, `/api/patient/appointments/${ids.otherAppointment}`, { cookie: cookie(ids.patientProfile) })).status, 404));
});

test('invalid appointment ObjectId is rejected', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, '/api/patient/appointments/not-an-id', { cookie: cookie(ids.patientProfile) })).status, 400));
});

test('Patient can cancel an eligible future pending appointment and the document is preserved', async () => {
  const { app, cookie, appointments, appointmentRepository } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).appointment.status, 'cancelled');
    assert.equal(appointments.get(ids.pending).status, 'cancelled');
    assert.equal(appointmentRepository.lastCancelTime.toISOString(), NOW.toISOString());
  });
});

test('Patient can cancel an eligible future confirmed appointment before check-in', async () => {
  const { app, cookie, appointments } = createContext();
  appointments.get(ids.pending).status = 'confirmed';
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).appointment.status, 'cancelled');
    assert.equal(appointments.get(ids.pending).status, 'cancelled');
  });
});

for (const [label, appointmentAt] of [
  ['at the exact appointment start time', NOW],
  ['after the appointment start time', new Date(NOW.getTime() - 1)],
]) {
  test(`Patient cannot cancel ${label}`, async () => {
    const { app, cookie, appointments } = createContext();
    appointments.get(ids.pending).appointment_at = appointmentAt;
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_IN_FUTURE');
      assert.equal(appointments.get(ids.pending).status, 'pending');
    });
  });
}

test('successful Patient workflow transitions invoke notification triggers once after mutation', async () => {
  const calls = [];
  const notificationTriggers = {
    async patientBooked(value) { calls.push(['booked', structuredClone(value)]); },
    async patientRescheduled(value) { calls.push(['rescheduled', structuredClone(value)]); },
    async patientCancelled(value) { calls.push(['cancelled', structuredClone(value)]); },
    async appointmentConfirmed(value) { calls.push(['confirmed', structuredClone(value)]); },
  };
  const context = createContext({ notificationTriggers });
  await withServer(context.app, async (base) => {
    const booking = await request(base, '/api/patient/appointments', {
      method: 'POST', cookie: context.cookie(ids.patientProfile), body: validBooking,
    });
    assert.equal(booking.status, 201);
    assert.equal((await request(base, '/api/patient/appointments', {
      method: 'POST', cookie: context.cookie(ids.patientProfile), body: validBooking,
    })).status, 409);

    assert.equal((await request(base, `/api/patient/appointments/${ids.pending}/reschedule`, {
      method: 'PATCH', cookie: context.cookie(ids.patientProfile), body: validReschedule,
    })).status, 200);
    assert.equal((await request(base, `/api/patient/appointments/${ids.pending}/reschedule`, {
      method: 'PATCH', cookie: context.cookie(ids.patientProfile), body: validReschedule,
    })).status, 409);

    assert.equal((await request(base, `/api/patient/appointments/${ids.pending}/cancel`, {
      method: 'PATCH', cookie: context.cookie(ids.patientProfile), body: {},
    })).status, 200);
    assert.equal((await request(base, `/api/patient/appointments/${ids.pending}/cancel`, {
      method: 'PATCH', cookie: context.cookie(ids.patientProfile), body: {},
    })).status, 409);
  });
  assert.deepEqual(calls.map(([event]) => event), ['booked', 'rescheduled', 'cancelled']);

  const confirmationCalls = [];
  const confirmation = createContext({
    notificationTriggers: {
      async appointmentConfirmed(value) { confirmationCalls.push(structuredClone(value)); },
    },
  });
  await withServer(confirmation.app, async (base) => {
    assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/confirm`, {
      method: 'PATCH', cookie: confirmation.cookie(ids.staffProfile), body: {},
    })).status, 200);
    assert.equal((await request(base, `/api/staff/appointments/${ids.pending}/confirm`, {
      method: 'PATCH', cookie: confirmation.cookie(ids.staffProfile), body: {},
    })).status, 409);
  });
  assert.equal(confirmationCalls.length, 1);
  assert.equal(confirmationCalls[0].patientId, ids.patient);
});

test('notification trigger failure does not roll back a successful Patient booking', async () => {
  const context = createContext({
    notificationTriggers: {
      async patientBooked() { throw Object.assign(new Error('notification unavailable'), { code: 11000 }); },
    },
  });
  await withServer(context.app, async (base) => {
    const response = await request(base, '/api/patient/appointments', {
      method: 'POST', cookie: context.cookie(ids.patientProfile), body: validBooking,
    });
    assert.equal(response.status, 201);
    const appointment = (await response.json()).appointment;
    assert.equal(context.appointments.get(appointment.id).status, 'pending');
  });
});

test('atomic cancellation rejects stale appointment time state', async () => {
  const { app, cookie, appointments, appointmentRepository } = createContext();
  appointmentRepository.beforeCancel = ({ appointmentId, current }) => {
    appointments.get(appointmentId).appointment_at = new Date(current);
  };
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'INVALID_STATUS_TRANSITION');
    assert.equal(appointments.get(ids.pending).status, 'pending');
  });
});

test('Patient cannot cancel another Patient appointment', async () => {
  const { app, cookie, appointments } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.otherAppointment}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_FOUND');
    assert.equal(appointments.get(ids.otherAppointment).status, 'pending');
  });
});

test('unauthenticated request cannot cancel a Patient appointment', async () => {
  const { app, appointments } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH' });
    assert.equal(response.status, 401);
    assert.equal(appointments.get(ids.pending).status, 'pending');
  });
});

test('wrong-role request cannot cancel a Patient appointment', async () => {
  const { app, cookie, appointments } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.staffProfile) });
    assert.equal(response.status, 403);
    assert.equal(appointments.get(ids.pending).status, 'pending');
  });
});

test('inactive Patient cannot cancel an appointment', async () => {
  const { app, cookie, profiles, appointments } = createContext();
  profiles.get(ids.patientProfile).status = 'inactive';
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 403);
    assert.equal(appointments.get(ids.pending).status, 'pending');
  });
});

test('Patient cannot cancel a checked-in consultation', async () => {
  const { app, cookie, appointments } = createContext();
  appointments.get(ids.pending).status = 'confirmed';
  appointments.get(ids.pending).check_in_at = new Date('2026-09-27T09:45:00.000Z');
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'APPOINTMENT_ALREADY_CHECKED_IN');
    assert.equal(appointments.get(ids.pending).status, 'confirmed');
  });
});

test('Patient cannot cancel after the Doctor saves a MedicalRecord', async () => {
  const { app, cookie, appointments, recordedAppointments } = createContext();
  appointments.get(ids.pending).status = 'confirmed';
  recordedAppointments.add(ids.pending);
  await withServer(app, async (url) => {
    const detail = await request(url, `/api/patient/appointments/${ids.pending}`, { cookie: cookie(ids.patientProfile) });
    assert.equal((await detail.json()).appointment.has_medical_record, true);
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'MEDICAL_RECORD_EXISTS');
    assert.equal(appointments.get(ids.pending).status, 'confirmed');
  });
});

for (const [label, id] of [['completed', ids.completed], ['cancelled', ids.cancelled], ['no_show', ids.noShow]]) {
  test(`${label} appointment cannot be cancelled`, async () => {
    const { app, cookie } = createContext();
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${id}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'INVALID_STATUS_TRANSITION');
    });
  });
}

test('Staff can confirm pending appointment', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: cookie(ids.staffProfile) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).appointment.status, 'confirmed');
  });
});

test('Patient cannot use Staff confirmation endpoint', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: cookie(ids.patientProfile) })).status, 403));
});

test('confirmed appointment cannot be reconfirmed', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    assert.equal((await request(url, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: cookie(ids.staffProfile) })).status, 200);
    assert.equal((await request(url, `/api/staff/appointments/${ids.pending}/confirm`, { method: 'PATCH', cookie: cookie(ids.staffProfile) })).status, 409);
  });
});

test('/api/health still returns 200 with Patient routes mounted', async () => {
  const { app } = createContext();
  await withServer(app, async (url) => assert.equal((await request(url, '/api/health')).status, 200));
});

test('Patient cancellation rejects direct status and ownership fields', async () => {
  const { app, cookie, appointments } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, {
      method: 'PATCH',
      cookie: cookie(ids.patientProfile),
      body: { status: 'completed', patient_id: ids.otherPatient },
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'UNSUPPORTED_FIELD');
    assert.equal(appointments.get(ids.pending).status, 'pending');
  });
});

test('Patient reschedules an eligible pending appointment while preserving identity and immutable fields', async () => {
  const { app, cookie, appointments, bookingAvailabilityService } = createContext();
  const before = structuredClone(appointments.get(ids.pending));
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.appointment.id, ids.pending);
    assert.equal(body.appointment.appointment_at, validReschedule.appointment_at);
    assert.equal(body.appointment.status, 'pending');
    assert.equal(body.appointment.patient_created, true);
    const stored = appointments.get(ids.pending);
    assert.equal(String(stored.doctor_id._id), String(before.doctor_id._id));
    assert.equal(stored.patient_id, before.patient_id);
    assert.equal(stored.visit_type, before.visit_type);
    assert.equal(stored.reason, before.reason);
    assert.equal(stored.priority, before.priority);
    assert.equal(stored.created_by, before.created_by);
    assert.equal(bookingAvailabilityService.calls[0].doctorId, ids.doctor);
  });
});

test('Patient rescheduling resets an eligible unchecked confirmed appointment to pending', async () => {
  const { app, cookie, appointments } = createContext();
  appointments.get(ids.pending).status = 'confirmed';
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).appointment.status, 'pending');
  });
});

for (const [label, offset, expectedStatus] of [
  ['more than 60 minutes before', 60 * 60 * 1000 + 1, 200],
  ['exactly 60 minutes before', 60 * 60 * 1000, 200],
  ['59 minutes 59 seconds before', 60 * 60 * 1000 - 1000, 409],
]) {
  test(`Patient reschedule cutoff: ${label}`, async () => {
    const { app, cookie, appointments } = createContext();
    appointments.get(ids.pending).appointment_at = new Date(NOW.getTime() + offset);
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
      assert.equal(response.status, expectedStatus);
      if (expectedStatus === 409) assert.equal((await response.json()).error.code, 'RESCHEDULE_CUTOFF_PASSED');
    });
  });
}

test('checked-in and recorded appointments cannot be rescheduled', async () => {
  for (const reason of ['checked-in', 'recorded']) {
    const { app, cookie, appointments, recordedAppointments } = createContext();
    appointments.get(ids.pending).status = 'confirmed';
    if (reason === 'checked-in') appointments.get(ids.pending).check_in_at = new Date(NOW);
    else recordedAppointments.add(ids.pending);
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, reason === 'checked-in' ? 'APPOINTMENT_ALREADY_CHECKED_IN' : 'MEDICAL_RECORD_EXISTS');
    });
  }
});

for (const [label, id] of [['completed', ids.completed], ['cancelled', ids.cancelled], ['no-show', ids.noShow]]) {
  test(`${label} appointment cannot be rescheduled`, async () => {
    const { app, cookie } = createContext();
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${id}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'RESCHEDULE_NOT_ALLOWED');
    });
  });
}

test('Patient reschedule preserves safe ownership and role boundaries', async () => {
  const { app, cookie, profiles, appointments } = createContext();
  await withServer(app, async (url) => {
    assert.equal((await request(url, `/api/patient/appointments/${ids.otherAppointment}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule })).status, 404);
    assert.equal((await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', body: validReschedule })).status, 401);
    assert.equal((await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.staffProfile), body: validReschedule })).status, 403);
    profiles.get(ids.patientProfile).status = 'inactive';
    assert.equal((await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule })).status, 403);
    assert.equal(appointments.get(ids.pending).appointment_at.toISOString(), '2026-09-27T10:00:00.000Z');
  });
});

test('Staff-created appointment is not Patient-reschedulable', async () => {
  const { app, cookie, appointments } = createContext();
  appointments.get(ids.pending).created_by = ids.staffProfile;
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'RESCHEDULE_NOT_ALLOWED');
  });
});

for (const field of ['doctor_id', 'patient_id', 'status', 'priority', 'check_in_at', 'created_by', 'visit_type', 'reason']) {
  test(`Patient cannot supply ${field} when rescheduling`, async () => {
    const { app, cookie } = createContext();
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: { ...validReschedule, [field]: 'forged' } });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'RESTRICTED_FIELD');
    });
  });
}

for (const [label, body, code] of [
  ['empty body', {}, 'INVALID_INPUT'],
  ['malformed target timestamp', { appointment_at: 'not-a-time' }, 'INVALID_APPOINTMENT_TIME'],
  ['past target slot', { appointment_at: '2026-09-24T10:00:00.000Z' }, 'APPOINTMENT_IN_PAST'],
  ['non-30-minute target slot', { appointment_at: '2026-09-28T10:15:00.000Z' }, 'INVALID_APPOINTMENT_TIME'],
  ['target outside 14-day horizon', { appointment_at: '2026-10-10T10:00:00.000Z' }, 'OUTSIDE_BOOKING_WINDOW'],
]) {
  test(`Patient reschedule rejects ${label}`, async () => {
    const { app, cookie } = createContext();
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, code);
    });
  });
}

test('Patient reschedule rejects the current slot as a no-op', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: { appointment_at: '2026-09-27T10:00:00.000Z' } });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'RESCHEDULE_NO_CHANGE');
  });
});

for (const label of ['unpublished', 'Doctor-blocked', 'otherwise unavailable']) {
  test(`${label} target slot is rejected by shared availability validation`, async () => {
    const { app, cookie, bookingAvailabilityService } = createContext();
    bookingAvailabilityService.unavailable.set(validReschedule.appointment_at, Object.assign(new Error('That appointment slot is not available.'), { status: 409, code: 'APPOINTMENT_SLOT_UNAVAILABLE' }));
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');
    });
  });
}

test('occupied target and duplicate-key target races map to safe slot conflicts', async () => {
  for (const mode of ['occupied', 'duplicate']) {
    const { app, cookie, appointments, appointmentRepository } = createContext();
    if (mode === 'occupied') {
      appointments.set('100000000000000000000099', { ...structuredClone(appointments.get(ids.pending)), _id: '100000000000000000000099', patient_id: ids.otherPatient, appointment_at: new Date(validReschedule.appointment_at) });
    } else appointmentRepository.forceRescheduleDuplicate = true;
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'APPOINTMENT_SLOT_CONFLICT');
      assert.equal(appointments.get(ids.pending).appointment_at.toISOString(), '2026-09-27T10:00:00.000Z');
    });
  }
});

test('stale original appointment time fails atomic rescheduling safely', async () => {
  const { app, cookie, appointments, appointmentRepository } = createContext();
  appointmentRepository.beforeReschedule = ({ appointmentId }) => { appointments.get(appointmentId).appointment_at = new Date('2026-09-27T10:30:00.000Z'); };
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'RESCHEDULE_CONFLICT');
  });
});

test('concurrent reschedules allow only one stale-state transition', async () => {
  const { app, cookie, appointments, appointmentRepository } = createContext();
  let reached = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  appointmentRepository.beforeReschedule = async () => {
    reached += 1;
    if (reached === 2) release();
    await gate;
  };
  await withServer(app, async (url) => {
    const responses = await Promise.all([
      request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule }),
      request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: { appointment_at: '2026-09-28T10:30:00.000Z' } }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.ok(['2026-09-28T10:00:00.000Z', '2026-09-28T10:30:00.000Z'].includes(appointments.get(ids.pending).appointment_at.toISOString()));
  });
});

test('two appointments racing for one target slot cannot both succeed', async () => {
  const secondId = '100000000000000000000098';
  const { app, cookie, appointments } = createContext();
  appointments.set(secondId, { ...structuredClone(appointments.get(ids.pending)), _id: secondId, appointment_at: new Date('2026-09-27T11:30:00.000Z') });
  await withServer(app, async (url) => {
    const responses = await Promise.all([
      request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule }),
      request(url, `/api/patient/appointments/${secondId}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal([...appointments.values()].filter((item) => ['pending', 'confirmed', 'completed'].includes(item.status) && new Date(item.appointment_at).toISOString() === validReschedule.appointment_at).length, 1);
  });
});

test('Confirm Arrival, No-show, and cancellation winning first block rescheduling', async () => {
  for (const winner of ['arrival', 'no-show', 'cancellation']) {
    const { app, cookie, appointments, appointmentRepository } = createContext();
    appointmentRepository.beforeReschedule = ({ appointmentId }) => {
      const item = appointments.get(appointmentId);
      if (winner === 'arrival') { item.status = 'confirmed'; item.check_in_at = new Date(NOW); }
      if (winner === 'no-show') item.status = 'no_show';
      if (winner === 'cancellation') item.status = 'cancelled';
    };
    await withServer(app, async (url) => {
      const response = await request(url, `/api/patient/appointments/${ids.pending}/reschedule`, { method: 'PATCH', cookie: cookie(ids.patientProfile), body: validReschedule });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'RESCHEDULE_CONFLICT');
    });
  }
});
