import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import {
  Appointment,
  AuthAccount,
  Doctor,
  Patient,
  UserProfile,
} from '../src/models/index.js';
import { requireAuthSecret } from '../src/services/tokenService.js';

const config = loadConfig();
const marker = randomUUID().replaceAll('-', '');
const profileIds = [];
let patientId;
let doctorId;
let appointmentId;
let server;

async function api(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  requireAuthSecret(config.authSecret);
  await connectDatabase(config.mongoUri);
  await Appointment.init();

  const password = `PatientApi-${marker.slice(0, 16)}!`;
  const passwordHash = await bcrypt.hash(password, 12);
  const patientProfile = await UserProfile.create({
    display_name: 'Disposable Patient API account',
    role: 'patient',
    contact_number: `09${Date.now().toString().slice(-9)}`,
    status: 'active',
  });
  profileIds.push(patientProfile._id);
  const doctorProfile = await UserProfile.create({
    display_name: 'Disposable Doctor API account',
    role: 'doctor',
    contact_number: `08${Date.now().toString().slice(-9)}`,
    status: 'active',
  });
  profileIds.push(doctorProfile._id);

  const email = `patient-api-${marker}@example.invalid`;
  await AuthAccount.create({ user_profile_id: patientProfile._id, email, password_hash: passwordHash });
  const patient = await Patient.create({
    user_profile_id: patientProfile._id,
    full_name: 'Disposable Patient API account',
    contact_number: patientProfile.contact_number,
    dob: new Date('1990-01-15'),
    sex: 'other',
  });
  patientId = patient._id;
  const doctor = await Doctor.create({
    user_profile_id: doctorProfile._id,
    specialty: 'Validation',
    license_number: `LIC-PATIENT-${marker}`,
    ptr_number: `PTR-PATIENT-${marker}`,
  });
  doctorId = doctor._id;

  const appointmentAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  appointmentAt.setUTCMinutes(appointmentAt.getUTCMinutes() < 30 ? 30 : 0, 0, 0);
  if (appointmentAt.getUTCMinutes() === 0) appointmentAt.setUTCHours(appointmentAt.getUTCHours() + 1);

  const app = createApp(config);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await api(baseUrl, '/api/health')).status, 200);
  const login = await api(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const profile = await api(baseUrl, '/api/patient/profile', { cookie });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).patient.id, String(patientId));

  const updatedProfile = await api(baseUrl, '/api/patient/profile', {
    method: 'PATCH',
    cookie,
    body: { full_name: 'Disposable Patient API updated', address: 'Disposable address' },
  });
  assert.equal(updatedProfile.status, 200);
  assert.equal((await updatedProfile.json()).patient.address, 'Disposable address');
  assert.equal((await Patient.findById(patientId).lean()).full_name, 'Disposable Patient API updated');
  assert.equal(
    (await UserProfile.findById(patientProfile._id).lean()).display_name,
    'Disposable Patient API updated',
  );

  const rejectedOverride = await api(baseUrl, '/api/patient/appointments', {
    method: 'POST',
    cookie,
    body: {
      doctor_id: String(doctorId),
      appointment_at: appointmentAt.toISOString(),
      visit_type: 'general_consultation',
      reason: 'Rejected creator override',
      created_by: String(doctorProfile._id),
    },
  });
  assert.equal(rejectedOverride.status, 400);
  assert.equal(await Appointment.countDocuments({ patient_id: patientId }), 0);

  const created = await api(baseUrl, '/api/patient/appointments', {
    method: 'POST',
    cookie,
    body: {
      doctor_id: String(doctorId),
      appointment_at: appointmentAt.toISOString(),
      visit_type: 'general_consultation',
      reason: 'Disposable API validation',
    },
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  appointmentId = createdBody.appointment.id;
  assert.equal(createdBody.appointment.status, 'pending');
  assert.equal('created_by' in createdBody.appointment, false);

  const persisted = await Appointment.findById(appointmentId).lean();
  assert.ok(persisted);
  assert.equal(String(persisted.patient_id), String(patientId));
  assert.equal(String(persisted.doctor_id), String(doctorId));
  assert.equal(String(persisted.created_by), String(patientProfile._id));

  const list = await api(baseUrl, '/api/patient/appointments', { cookie });
  assert.equal(list.status, 200);
  assert.ok((await list.json()).appointments.some((item) => item.id === appointmentId));

  const detail = await api(baseUrl, `/api/patient/appointments/${appointmentId}`, { cookie });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).appointment.doctor.id, String(doctorId));

  const cancelled = await api(baseUrl, `/api/patient/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    cookie,
  });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).appointment.status, 'cancelled');
  assert.equal((await Appointment.findById(appointmentId).lean()).status, 'cancelled');

  await UserProfile.updateOne({ _id: patientProfile._id }, { status: 'inactive' });
  assert.equal(
    String((await Appointment.findById(appointmentId).lean()).created_by),
    String(patientProfile._id),
  );

  console.info(JSON.stringify({
    mongoConnected: true,
    health: 200,
    profileRead: 200,
    profileUpdate: 200,
    sharedProfileSynchronized: true,
    clientCreatorOverrideRejected: true,
    appointmentCreate: 201,
    persisted: true,
    creatorMatchesAuthenticatedProfile: true,
    creatorPreservedAfterDeactivation: true,
    list: 200,
    detail: 200,
    cancel: 200,
    cancelledPersisted: true,
    cleanup: 'pending',
  }));
}

try {
  await main();
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (appointmentId) await Appointment.deleteOne({ _id: appointmentId });
  if (patientId) await Patient.deleteOne({ _id: patientId });
  if (doctorId) await Doctor.deleteOne({ _id: doctorId });
  if (profileIds.length) {
    await AuthAccount.deleteMany({ user_profile_id: { $in: profileIds } });
    await UserProfile.deleteMany({ _id: { $in: profileIds } });
  }
  await disconnectDatabase();
  console.info(JSON.stringify({ cleanup: 'complete' }));
}
