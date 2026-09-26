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

function createContext() {
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
  const base = (id, patientId, status, appointmentAt) => ({
    _id: id,
    patient_id: patientId,
    doctor_id: doctor,
    appointment_at: new Date(appointmentAt),
    visit_type: 'general_consultation',
    reason: 'Consultation',
    status,
    priority: 'normal',
    check_in_at: null,
  });
  const appointments = new Map([
    [ids.pending, base(ids.pending, ids.patient, 'pending', '2026-09-27T10:00:00.000Z')],
    [ids.completed, base(ids.completed, ids.patient, 'completed', '2026-09-20T09:00:00.000Z')],
    [ids.cancelled, base(ids.cancelled, ids.patient, 'cancelled', '2026-09-28T09:00:00.000Z')],
    [ids.noShow, base(ids.noShow, ids.patient, 'no_show', '2026-09-19T09:00:00.000Z')],
    [ids.otherAppointment, base(ids.otherAppointment, ids.otherPatient, 'pending', '2026-09-27T11:00:00.000Z')],
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
    async cancelOwnedEligible(appointmentId, patientId) {
      const item = appointments.get(appointmentId);
      if (!item || item.patient_id !== patientId || !['pending', 'confirmed'].includes(item.status) || item.check_in_at) return null;
      item.status = 'cancelled';
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
    now: () => new Date(NOW),
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
  reason: 'Recurring headache',
};

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

test('Patient can cancel an eligible own appointment and the document is preserved', async () => {
  const { app, cookie, appointments } = createContext();
  await withServer(app, async (url) => {
    const response = await request(url, `/api/patient/appointments/${ids.pending}/cancel`, { method: 'PATCH', cookie: cookie(ids.patientProfile) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).appointment.status, 'cancelled');
    assert.equal(appointments.get(ids.pending).status, 'cancelled');
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
