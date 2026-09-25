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
  DoctorAvailability,
  DoctorBlockedTime,
  DoctorPublishedAvailability,
  Patient,
  UserProfile,
} from '../src/models/index.js';
import { requireAuthSecret } from '../src/services/tokenService.js';
import { addDays, clinicDate, zonedDateTimeToUtc } from '../src/utils/schedulingTime.js';

const config = loadConfig();
const marker = randomUUID().replaceAll('-', '');
const profileIds = [];
let patientId;
let doctorId;
let server;

async function api(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  requireAuthSecret(config.authSecret);
  await connectDatabase(config.mongoUri);
  await Promise.all([Appointment.init(), DoctorAvailability.init(), DoctorPublishedAvailability.init(), DoctorBlockedTime.init()]);
  const password = `Schedule-${marker.slice(0, 18)}!`;
  const passwordHash = await bcrypt.hash(password, 12);
  const patientEmail = `schedule-patient-${marker}@example.invalid`;
  const doctorEmail = `schedule-doctor-${marker}@example.invalid`;

  const patientProfile = await UserProfile.create({ display_name: 'Disposable Scheduling Patient', role: 'patient', contact_number: `09${Date.now().toString().slice(-9)}`, status: 'active' });
  const doctorProfile = await UserProfile.create({ display_name: 'Disposable Scheduling Doctor', role: 'doctor', contact_number: `08${Date.now().toString().slice(-9)}`, status: 'active' });
  profileIds.push(patientProfile._id, doctorProfile._id);
  await AuthAccount.create([
    { user_profile_id: patientProfile._id, email: patientEmail, password_hash: passwordHash },
    { user_profile_id: doctorProfile._id, email: doctorEmail, password_hash: passwordHash },
  ]);
  const patient = await Patient.create({ user_profile_id: patientProfile._id, full_name: 'Disposable Scheduling Patient', contact_number: patientProfile.contact_number, dob: new Date('1990-01-15'), sex: 'other' });
  patientId = patient._id;
  const doctor = await Doctor.create({ user_profile_id: doctorProfile._id, specialty: 'Validation', license_number: `LIC-SCHEDULE-${marker}`, ptr_number: `PTR-SCHEDULE-${marker}` });
  doctorId = doctor._id;

  const timeZone = config.clinicTimeZone || 'Asia/Manila';
  const date = addDays(clinicDate(new Date(), timeZone), 1);
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const app = createApp(config);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await api(baseUrl, '/api/health')).status, 200);

  async function login(email) {
    const response = await api(baseUrl, '/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }
  const doctorCookie = await login(doctorEmail);
  const patientCookie = await login(patientEmail);

  assert.equal((await api(baseUrl, '/api/doctor/availability', { method: 'POST', cookie: doctorCookie, body: { day_of_week: weekday, start_time: '09:00', end_time: '12:00' } })).status, 201);
  assert.equal((await api(baseUrl, '/api/doctor/published-availability', { method: 'POST', cookie: doctorCookie, body: { availability_date: date, start_time: '09:00', end_time: '12:00' } })).status, 201);
  assert.equal((await api(baseUrl, '/api/doctor/blocked-times', { method: 'POST', cookie: doctorCookie, body: { start_at: `${date}T09:30:00+08:00`, end_at: `${date}T10:00:00+08:00`, reason: 'Disposable block' } })).status, 201);

  await Appointment.create({
    patient_id: patientId,
    doctor_id: doctorId,
    appointment_at: zonedDateTimeToUtc(date, '10:00', timeZone),
    status: 'confirmed',
    visit_type: 'general_consultation',
    reason: 'Disposable occupied slot',
    created_by: patientProfile._id,
  });

  const availableResponse = await api(baseUrl, `/api/patient/doctors/${doctorId}/available-slots?date=${date}`, { cookie: patientCookie });
  assert.equal(availableResponse.status, 200);
  const available = (await availableResponse.json()).slots;
  assert.equal(available.some((slot) => slot.start_time === '09:30'), false);
  assert.equal(available.some((slot) => slot.start_time === '10:00'), false);
  assert.equal(available.some((slot) => slot.start_time === '09:00'), true);

  const booked = await api(baseUrl, '/api/patient/appointments', {
    method: 'POST',
    cookie: patientCookie,
    body: {
      doctor_id: String(doctorId),
      appointment_at: zonedDateTimeToUtc(date, '09:00', timeZone).toISOString(),
      visit_type: 'general_consultation',
      reason: 'Disposable valid published booking',
    },
  });
  assert.equal(booked.status, 201);
  const bookedBody = await booked.json();
  const persisted = await Appointment.findById(bookedBody.appointment.id).lean();
  assert.ok(persisted);
  assert.equal(String(persisted.created_by), String(patientProfile._id));

  console.info(JSON.stringify({ mongoConnected: true, health: 200, recurringCreated: true, datePublished: true, partialBlockCreated: true, blockedSlotRemoved: true, occupiedSlotRemoved: true, validPublishedSlotBooked: true, appointmentPersisted: true, cleanup: 'pending' }));
}

try {
  await main();
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (doctorId) {
    await Appointment.deleteMany({ doctor_id: doctorId });
    await DoctorAvailability.deleteMany({ doctor_id: doctorId });
    await DoctorPublishedAvailability.deleteMany({ doctor_id: doctorId });
    await DoctorBlockedTime.deleteMany({ doctor_id: doctorId });
    await Doctor.deleteOne({ _id: doctorId });
  }
  if (patientId) await Patient.deleteOne({ _id: patientId });
  if (profileIds.length) {
    await AuthAccount.deleteMany({ user_profile_id: { $in: profileIds } });
    await UserProfile.deleteMany({ _id: { $in: profileIds } });
  }
  await disconnectDatabase();
  console.info(JSON.stringify({ cleanup: 'complete' }));
}
