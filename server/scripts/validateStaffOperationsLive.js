import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import { Appointment, AuthAccount, Doctor, MedicalRecord, Patient, Prescription, Staff, UserProfile } from '../src/models/index.js';
import { requireAuthSecret } from '../src/services/tokenService.js';
import { appointmentLocalParts, clinicDate, timeFromMinutes, zonedDateTimeToUtc } from '../src/utils/schedulingTime.js';

const config = loadConfig();
const marker = randomUUID().replaceAll('-', '');
const profileIds = [], patientIds = [], appointmentIds = [], recordIds = [];
let doctorId, staffId, server;
async function api(base, path, { method = 'GET', body, cookie } = {}) { return fetch(`${base}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
async function account(role, label, password) { const profile = await UserProfile.create({ display_name: label, role, contact_number: `09${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')}`, status: 'active' }); profileIds.push(profile._id); const email = `staff-api-${role}-${marker}@example.invalid`; await AuthAccount.create({ user_profile_id: profile._id, email, password_hash: await bcrypt.hash(password, 12) }); return { profile, email }; }
async function login(base, email, password) { const response = await api(base, '/api/auth/login', { method: 'POST', body: { email, password } }); assert.equal(response.status, 200); return response.headers.get('set-cookie').split(';')[0]; }

async function main() {
  requireAuthSecret(config.authSecret); await connectDatabase(config.mongoUri); await Appointment.init();
  const password = `StaffOps-${marker.slice(0, 16)}!`;
  const staffAccount = await account('staff', 'Disposable Staff Operator', password);
  const doctorAccount = await account('doctor', 'Disposable Staff Validation Doctor', password);
  staffId = (await Staff.create({ user_profile_id: staffAccount.profile._id }))._id;
  doctorId = (await Doctor.create({ user_profile_id: doctorAccount.profile._id, specialty: 'Validation', license_number: `LIC-${marker}`, ptr_number: `PTR-${marker}` }))._id;
  const app = createApp(config); server = app.listen(0, '127.0.0.1'); await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`; assert.equal((await api(base, '/api/health')).status, 200);
  const staffCookie = await login(base, staffAccount.email, password); const doctorCookie = await login(base, doctorAccount.email, password);
  const now = new Date(); const timeZone = config.clinicTimeZone || 'Asia/Manila'; const local = appointmentLocalParts(now, timeZone); const [hour, minute] = local.time.split(':').map(Number); const nextMinutes = Math.ceil((hour * 60 + minute + 1) / 30) * 30;
  if (nextMinutes >= 24 * 60) throw new Error('Live Staff validation needs a future 30-minute slot remaining in the current clinic day.');
  const appointmentAt = zonedDateTimeToUtc(local.date, timeFromMinutes(nextMinutes), timeZone);

  const registration = await api(base, '/api/staff/patients/walk-in', { method: 'POST', cookie: staffCookie, body: { full_name: `Disposable Walk-in ${marker.slice(0, 6)}`, contact_number: `08${Date.now().toString().slice(-9)}`, dob: '1985-04-12', sex: 'other', is_pwd: false } });
  assert.equal(registration.status, 201); const patient = (await registration.json()).patient; patientIds.push(patient.id); assert.equal(patient.has_portal_account, false);
  const search = await api(base, `/api/staff/patients?search=${encodeURIComponent(patient.full_name)}`, { cookie: staffCookie }); assert.ok((await search.json()).patients.some((item) => item.id === patient.id));
  const walkIn = await api(base, `/api/staff/patients/${patient.id}/walk-in-appointments`, { method: 'POST', cookie: staffCookie, body: { doctor_id: String(doctorId), appointment_at: appointmentAt.toISOString(), visit_type: 'general_consultation', reason: 'Disposable walk-in validation', priority: 'normal' } });
  assert.equal(walkIn.status, 201); const appointment = (await walkIn.json()).appointment; appointmentIds.push(appointment.id); assert.equal(appointment.status, 'confirmed'); assert.equal(String((await Appointment.findById(appointment.id).lean()).created_by), String(staffAccount.profile._id));
  const checkedIn = await api(base, `/api/staff/appointments/${appointment.id}/check-in`, { method: 'PATCH', cookie: staffCookie, body: {} }); assert.equal(checkedIn.status, 200);
  const queue = await api(base, '/api/staff/queue', { cookie: staffCookie }); assert.ok((await queue.json()).queue.some((item) => item.appointment_id === appointment.id));

  const reservedTimes = new Set([timeFromMinutes(nextMinutes), timeFromMinutes(Math.floor((hour * 60 + minute) / 30) * 30)]);
  const tierTimes = Array.from({ length: 48 }, (_, index) => timeFromMinutes(index * 30)).filter((time) => !reservedTimes.has(time)).slice(0, 3);
  const tierPatients = [
    { full_name: 'Disposable Urgent', dob: '1990-01-01', is_pwd: false, priority: 'urgent' },
    { full_name: 'Disposable Senior', dob: '1950-01-01', is_pwd: false, priority: 'normal' },
    { full_name: 'Disposable Normal', dob: '1990-01-01', is_pwd: false, priority: 'normal' },
  ];
  const tierAppointmentIds = [];
  for (let index = 0; index < tierPatients.length; index += 1) {
    const input = tierPatients[index];
    const tierPatient = await Patient.create({ user_profile_id: null, full_name: input.full_name, contact_number: `06${Date.now().toString().slice(-7)}${index}`, dob: new Date(input.dob), sex: 'other', is_pwd: input.is_pwd });
    patientIds.push(tierPatient._id);
    const tierAppointment = await Appointment.create({ patient_id: tierPatient._id, doctor_id: doctorId, appointment_at: zonedDateTimeToUtc(local.date, tierTimes[index], timeZone), check_in_at: new Date(now.getTime() - (index + 1) * 60000), status: 'confirmed', visit_type: 'general_consultation', reason: 'Queue tier validation', priority: input.priority, created_by: staffAccount.profile._id });
    appointmentIds.push(tierAppointment._id); tierAppointmentIds.push(String(tierAppointment._id));
  }
  const tierQueue = (await (await api(base, '/api/staff/queue', { cookie: staffCookie })).json()).queue.filter((item) => tierAppointmentIds.includes(item.appointment_id));
  assert.deepEqual(tierQueue.map((item) => item.queue_priority), ['urgent', 'senior_pwd', 'normal']);

  const noShowPatient = await Patient.create({ user_profile_id: null, full_name: 'Disposable No-show', contact_number: `07${Date.now().toString().slice(-9)}`, dob: new Date('1995-01-01'), sex: 'other' }); patientIds.push(noShowPatient._id);
  const noShowAppointment = await Appointment.create({ patient_id: noShowPatient._id, doctor_id: doctorId, appointment_at: zonedDateTimeToUtc(local.date, timeFromMinutes(Math.floor((hour * 60 + minute) / 30) * 30), timeZone), status: 'pending', visit_type: 'check_up', reason: 'No-show validation', priority: 'normal', created_by: staffAccount.profile._id }); appointmentIds.push(noShowAppointment._id);
  assert.equal((await api(base, `/api/staff/appointments/${noShowAppointment._id}/no-show`, { method: 'PATCH', cookie: staffCookie, body: {} })).status, 200);

  const recordResponse = await api(base, `/api/doctor/appointments/${appointment.id}/medical-record`, { method: 'POST', cookie: doctorCookie, body: { diagnosis: 'Disposable diagnosis', notes: 'Must remain hidden from Staff', prescriptions: [{ medicine: 'Hidden medicine', dosage: '500 mg' }] } });
  assert.equal(recordResponse.status, 201); const recordId = (await recordResponse.json()).medical_record.id; recordIds.push(recordId);
  assert.equal((await api(base, `/api/doctor/appointments/${appointment.id}/complete`, { method: 'PATCH', cookie: doctorCookie })).status, 200);
  const queueAfter = await api(base, '/api/staff/queue', { cookie: staffCookie }); const entries = (await queueAfter.json()).queue; assert.ok(!entries.some((item) => [appointment.id, String(noShowAppointment._id)].includes(item.appointment_id)));
  const summaryResponse = await api(base, `/api/staff/patients/${patient.id}/record-summary`, { cookie: staffCookie }); const summary = (await summaryResponse.json()).medical_record_summaries[0]; assert.equal(summary.diagnosis_summary, 'Disposable diagnosis'); assert.equal('notes' in summary, false); assert.equal('prescriptions' in summary, false);
  console.info(JSON.stringify({ mongoConnected: true, health: 200, patientSearch: true, walkInRegistered: true, noPortalAccount: true, sameDayAppointment: true, staffCreatorStored: true, checkIn: true, queueEntry: true, priorityOrdering: ['urgent', 'senior_pwd', 'normal'], noShowRemoved: true, doctorCompletionRemoved: true, limitedSummary: true, cleanup: 'pending' }));
}
try { await main(); } finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (recordIds.length) { await Prescription.deleteMany({ medical_record_id: { $in: recordIds } }); await MedicalRecord.deleteMany({ _id: { $in: recordIds } }); }
  if (appointmentIds.length) await Appointment.deleteMany({ _id: { $in: appointmentIds } });
  if (patientIds.length) await Patient.deleteMany({ _id: { $in: patientIds } });
  if (doctorId) await Doctor.deleteOne({ _id: doctorId }); if (staffId) await Staff.deleteOne({ _id: staffId });
  if (profileIds.length) { await AuthAccount.deleteMany({ user_profile_id: { $in: profileIds } }); await UserProfile.deleteMany({ _id: { $in: profileIds } }); }
  await disconnectDatabase(); console.info(JSON.stringify({ cleanup: 'complete' }));
}
