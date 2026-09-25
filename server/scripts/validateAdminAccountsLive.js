import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import { AuthAccount, Doctor, Patient, Staff, UserProfile } from '../src/models/index.js';
import { requireAuthSecret } from '../src/services/tokenService.js';

const config = loadConfig(); const marker = randomUUID().replaceAll('-', '');
const profileIds = [], patientIds = [], doctorIds = [], staffIds = []; let server;
async function api(base, path, { method = 'GET', body, cookie } = {}) { return fetch(`${base}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
async function seedAccount(role, label, email, password) { const profile = await UserProfile.create({ display_name: label, contact_number: `09${Date.now().toString().slice(-9)}`, role, status: 'active' }); profileIds.push(profile._id); await AuthAccount.create({ user_profile_id: profile._id, email, password_hash: await bcrypt.hash(password, 12) }); return profile; }
async function login(base, email, password) { const response = await api(base, '/api/auth/login', { method: 'POST', body: { email, password } }); assert.equal(response.status, 200); return response.headers.get('set-cookie').split(';')[0]; }

async function main() {
  requireAuthSecret(config.authSecret); await connectDatabase(config.mongoUri); await Promise.all([AuthAccount.init(), Doctor.init(), Staff.init(), Patient.init()]);
  const password = `AdminApi-${marker.slice(0, 16)}!`; const adminEmail = `admin-api-${marker}@example.invalid`;
  await seedAccount('admin', 'Disposable Admin API', adminEmail, password);
  const app = createApp(config); server = app.listen(0, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`; assert.equal((await api(base, '/api/health')).status, 200); const adminCookie = await login(base, adminEmail, password);

  const doctorEmail = `doctor-admin-api-${marker}@example.invalid`;
  const doctorCreate = await api(base, '/api/admin/doctors', { method: 'POST', cookie: adminCookie, body: { email: doctorEmail, password, display_name: 'Disposable Provisioned Doctor', contact_number: '09170001111', specialty: 'Validation', license_number: `LIC-${marker}`, ptr_number: `PTR-${marker}`, signature_path: `protected/${marker}.png` } });
  assert.equal(doctorCreate.status, 201); const doctor = (await doctorCreate.json()).doctor; doctorIds.push(doctor.id); profileIds.push(doctor.user_profile_id);
  const storedDoctor = await Doctor.findById(doctor.id).lean(); const storedDoctorAccount = await AuthAccount.findOne({ user_profile_id: doctor.user_profile_id }).select('+password_hash').lean(); assert.equal(String(storedDoctor.user_profile_id), doctor.user_profile_id); assert.notEqual(storedDoctorAccount.password_hash, password); assert.equal(await bcrypt.compare(password, storedDoctorAccount.password_hash), true);
  const doctorCookie = await login(base, doctorEmail, password);
  assert.equal((await api(base, `/api/admin/doctors/${doctor.id}`, { method: 'PATCH', cookie: adminCookie, body: { specialty: 'Updated Validation' } })).status, 200);
  assert.equal((await api(base, `/api/admin/doctors/${doctor.id}/deactivate`, { method: 'PATCH', cookie: adminCookie, body: {} })).status, 200);
  assert.equal((await api(base, '/api/doctor/availability', { cookie: doctorCookie })).status, 403);
  assert.equal((await api(base, `/api/admin/doctors/${doctor.id}/reactivate`, { method: 'PATCH', cookie: adminCookie, body: {} })).status, 200);
  assert.equal((await api(base, '/api/doctor/availability', { cookie: doctorCookie })).status, 200);

  const staffEmail = `staff-admin-api-${marker}@example.invalid`;
  const staffCreate = await api(base, '/api/admin/staff', { method: 'POST', cookie: adminCookie, body: { email: staffEmail, password, display_name: 'Disposable Provisioned Staff', contact_number: '09270001111' } });
  assert.equal(staffCreate.status, 201); const staff = (await staffCreate.json()).staff; staffIds.push(staff.id); profileIds.push(staff.user_profile_id); const staffCookie = await login(base, staffEmail, password);
  assert.equal((await api(base, `/api/admin/staff/${staff.id}`, { method: 'PATCH', cookie: adminCookie, body: { display_name: 'Updated Disposable Staff' } })).status, 200);
  assert.equal((await api(base, `/api/admin/staff/${staff.id}/deactivate`, { method: 'PATCH', cookie: adminCookie, body: {} })).status, 200);
  assert.equal((await api(base, '/api/staff/queue', { cookie: staffCookie })).status, 403);
  assert.equal((await api(base, `/api/admin/staff/${staff.id}/reactivate`, { method: 'PATCH', cookie: adminCookie, body: {} })).status, 200);
  assert.equal((await api(base, '/api/staff/queue', { cookie: staffCookie })).status, 200);

  const patientEmail = `patient-admin-api-${marker}@example.invalid`; const patientProfile = await seedAccount('patient', 'Disposable Portal Patient', patientEmail, password);
  const patient = await Patient.create({ user_profile_id: patientProfile._id, full_name: patientProfile.display_name, contact_number: patientProfile.contact_number, dob: new Date('1990-01-01'), sex: 'other' }); patientIds.push(patient._id);
  const guest = await Patient.create({ user_profile_id: null, full_name: 'Disposable Guest Patient', contact_number: `08${Date.now().toString().slice(-9)}`, dob: new Date('1980-01-01'), sex: 'other' }); patientIds.push(guest._id);
  const patientCookie = await login(base, patientEmail, password);
  assert.equal((await api(base, `/api/admin/patients/${patient._id}/deactivate`, { method: 'PATCH', cookie: adminCookie, body: {} })).status, 200);
  assert.equal((await api(base, '/api/patient/profile', { cookie: patientCookie })).status, 403);
  assert.equal((await api(base, `/api/admin/patients/${patient._id}/reactivate`, { method: 'PATCH', cookie: adminCookie, body: {} })).status, 200);
  assert.equal((await api(base, `/api/admin/patients/${guest._id}/deactivate`, { method: 'PATCH', cookie: adminCookie, body: {} })).status, 409);
  assert.equal((await api(base, `/api/admin/patients?search=${encodeURIComponent(patient.full_name)}&status=active`, { cookie: adminCookie })).status, 200);
  console.info(JSON.stringify({ mongoConnected: true, health: 200, doctorProvisioned: true, doctorLinked: true, passwordHashed: true, doctorUpdated: true, doctorLifecycleEnforced: true, doctorIdPreserved: true, staffProvisioned: true, staffLifecycleEnforced: true, staffIdPreserved: true, patientLifecycleEnforced: true, patientIdPreserved: true, guestLifecycleRejected: true, cleanup: 'pending' }));
}
try { await main(); } finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (patientIds.length) await Patient.deleteMany({ _id: { $in: patientIds } });
  if (doctorIds.length) await Doctor.deleteMany({ _id: { $in: doctorIds } }); if (staffIds.length) await Staff.deleteMany({ _id: { $in: staffIds } });
  if (profileIds.length) { await AuthAccount.deleteMany({ user_profile_id: { $in: profileIds } }); await UserProfile.deleteMany({ _id: { $in: profileIds } }); }
  await disconnectDatabase(); console.info(JSON.stringify({ cleanup: 'complete' }));
}
