import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import {
  Appointment, AuthAccount, Doctor, MedicalCertificate, MedicalRecord, Patient, Prescription, UserProfile,
} from '../src/models/index.js';
import { requireAuthSecret } from '../src/services/tokenService.js';

const config = loadConfig();
const marker = randomUUID().replaceAll('-', '');
const profileIds = [];
const patientIds = [];
let doctorId;
let appointmentId;
let recordId;
let certificateId;
let server;

async function api(base, path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${base}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
}

async function createAccount(role, label, password) {
  const profile = await UserProfile.create({ display_name: label, role, contact_number: `09${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')}`, status: 'active' });
  profileIds.push(profile._id);
  const email = `clinical-${role}-${marker}-${profileIds.length}@example.invalid`;
  await AuthAccount.create({ user_profile_id: profile._id, email, password_hash: await bcrypt.hash(password, 12) });
  return { profile, email };
}

async function login(base, email, password) {
  const response = await api(base, '/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

async function main() {
  requireAuthSecret(config.authSecret);
  await connectDatabase(config.mongoUri);
  await Promise.all([Appointment.init(), MedicalRecord.init(), MedicalCertificate.init()]);
  const password = `Clinical-${marker.slice(0, 16)}!`;
  const doctorAccount = await createAccount('doctor', 'Disposable Clinical Doctor', password);
  const patientAccount = await createAccount('patient', 'Disposable Clinical Patient', password);
  const otherAccount = await createAccount('patient', 'Disposable Other Patient', password);
  const doctor = await Doctor.create({ user_profile_id: doctorAccount.profile._id, specialty: 'General Medicine', license_number: `LIC-${marker}`, ptr_number: `PTR-${marker}`, signature_path: `protected/${marker}.png` });
  doctorId = doctor._id;
  for (const account of [patientAccount, otherAccount]) {
    const patient = await Patient.create({ user_profile_id: account.profile._id, full_name: account.profile.display_name, contact_number: account.profile.contact_number, dob: new Date('1990-01-15'), sex: 'other' });
    patientIds.push(patient._id);
  }
  const appointment = await Appointment.create({ patient_id: patientIds[0], doctor_id: doctorId, appointment_at: new Date(Date.now() + 3600000), check_in_at: new Date(), status: 'confirmed', visit_type: 'general_consultation', reason: 'Disposable clinical validation', priority: 'normal', created_by: patientAccount.profile._id });
  appointmentId = appointment._id;

  const app = createApp(config);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await api(base, '/api/health')).status, 200);
  const doctorCookie = await login(base, doctorAccount.email, password);
  const patientCookie = await login(base, patientAccount.email, password);
  const otherCookie = await login(base, otherAccount.email, password);

  const recordResponse = await api(base, `/api/doctor/appointments/${appointmentId}/medical-record`, { method: 'POST', cookie: doctorCookie, body: { diagnosis: 'Viral infection', notes: 'Hydration and rest', follow_up: 'Return in seven days', prescriptions: [{ medicine: 'Paracetamol', dosage: '500 mg', instructions: 'As needed' }] } });
  assert.equal(recordResponse.status, 201);
  recordId = (await recordResponse.json()).medical_record.id;
  assert.ok(await MedicalRecord.findById(recordId));
  assert.equal(await Prescription.countDocuments({ medical_record_id: recordId }), 1);

  const certificateResponse = await api(base, `/api/doctor/records/${recordId}/certificates`, { method: 'POST', cookie: doctorCookie, body: { purpose: 'Fit to Work', diagnosis_summary: 'Recovered viral infection', date_issued: new Date().toISOString().slice(0, 10) } });
  assert.equal(certificateResponse.status, 201);
  const certificate = (await certificateResponse.json()).medical_certificate;
  certificateId = certificate.id;
  assert.ok(certificate.medical_certificate_number);
  assert.ok(await MedicalCertificate.findById(certificateId));

  const completed = await api(base, `/api/doctor/appointments/${appointmentId}/complete`, { method: 'PATCH', cookie: doctorCookie });
  assert.equal(completed.status, 200);
  assert.equal((await Appointment.findById(appointmentId).lean()).status, 'completed');

  assert.equal((await api(base, `/api/patient/records/${recordId}`, { cookie: patientCookie })).status, 200);
  assert.equal((await api(base, `/api/patient/certificates/${certificateId}`, { cookie: patientCookie })).status, 200);
  assert.equal((await api(base, `/api/patient/records/${recordId}`, { cookie: otherCookie })).status, 404);
  assert.equal((await api(base, `/api/patient/certificates/${certificateId}`, { cookie: otherCookie })).status, 404);

  console.info(JSON.stringify({ mongoConnected: true, health: 200, recordCreated: true, prescriptionLinked: true, certificateIssued: true, appointmentCompleted: true, patientReads: true, crossPatientDenied: true, cleanup: 'pending' }));
}

try { await main(); } finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (certificateId) await MedicalCertificate.deleteOne({ _id: certificateId });
  if (recordId) { await Prescription.deleteMany({ medical_record_id: recordId }); await MedicalRecord.deleteOne({ _id: recordId }); }
  if (appointmentId) await Appointment.deleteOne({ _id: appointmentId });
  if (patientIds.length) await Patient.deleteMany({ _id: { $in: patientIds } });
  if (doctorId) await Doctor.deleteOne({ _id: doctorId });
  if (profileIds.length) { await AuthAccount.deleteMany({ user_profile_id: { $in: profileIds } }); await UserProfile.deleteMany({ _id: { $in: profileIds } }); }
  await disconnectDatabase();
  console.info(JSON.stringify({ cleanup: 'complete' }));
}
