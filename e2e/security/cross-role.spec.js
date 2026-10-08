import { Appointment, DoctorAvailability, MedicalCertificate, MedicalRecord, UserProfile } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsDoctor, loginAsPatient, loginAsStaff } from '../helpers/auth.js';
import { browserApi } from '../helpers/browserApi.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { expectSafeRejection } from '../helpers/securityAssertions.js';
import { currentTotp } from '../helpers/totp.js';

const recordBody = { diagnosis: 'Forbidden mutation', notes: null, follow_up: null, prescriptions: [] };
const certificateBody = date => ({ purpose: 'Forbidden', diagnosis_summary: 'Forbidden', date_issued: date, valid_until: null });

async function expectAllDenied(page, attempts) {
  for (const attempt of attempts) expectSafeRejection(await browserApi(page, attempt.path, attempt.options), [403]);
}

test('Patient cannot invoke Doctor, Staff, or Admin operations', async ({ page, adminScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await adminScenario.createPatient();
  const doctor = await adminScenario.createDoctor();
  const staff = await adminScenario.createStaff();
  const appointment = await adminScenario.createAppointment({ patient, doctor, slot: adminScenario.slotFor(adminScenario.today(), '10:00'), status: 'confirmed' });
  const record = await adminScenario.createRecord({ patient, doctor, appointment });
  await loginAsPatient(page, patient);
  await expectAllDenied(page, [
    { path: '/api/doctor/availability', options: { method: 'POST', body: { day_of_week: 1, start_time: '09:00', end_time: '10:00' } } },
    { path: '/api/doctor/published-availability', options: { method: 'POST', body: { availability_date: adminScenario.today(), start_time: '09:00', end_time: '10:00' } } },
    { path: '/api/doctor/blocked-times', options: { method: 'POST', body: { start_at: new Date().toISOString(), end_at: new Date(Date.now() + 1800000).toISOString(), reason: 'No' } } },
    { path: `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, options: { method: 'POST', body: recordBody } },
    { path: `/api/doctor/records/${record.recordId}/certificates`, options: { method: 'POST', body: certificateBody(adminScenario.today()) } },
    { path: `/api/doctor/appointments/${appointment.appointmentId}/complete`, options: { method: 'PATCH' } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/confirm`, options: { method: 'PATCH' } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/check-in`, options: { method: 'PATCH' } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/priority`, options: { method: 'PATCH', body: { priority: 'urgent' } } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/no-show`, options: { method: 'PATCH' } },
    { path: '/api/admin/staff', options: { method: 'POST', body: { email: 'denied@example.invalid', password: 'Denied!123', display_name: 'Denied', contact_number: '09170000000' } } },
    { path: `/api/admin/staff/${staff.staffId}/deactivate`, options: { method: 'PATCH' } },
  ]);
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('confirmed');
  expect(await MedicalRecord.countDocuments({ appointment_id: appointment.appointmentId })).toBe(1);
  expect((await UserProfile.findById(staff.profileId).lean()).status).toBe('active');
  assertBrowserClean();
});

test('Doctor cannot use Staff/Admin operations or another Doctor clinical resources', async ({ page, adminScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctorA = await adminScenario.createDoctor();
  const doctorB = await adminScenario.createDoctor();
  const patient = await adminScenario.createPatient();
  const staff = await adminScenario.createStaff();
  const appointment = await adminScenario.createAppointment({ patient, doctor: doctorB, slot: adminScenario.slotFor(adminScenario.today(), '11:00'), status: 'confirmed', check_in_at: new Date() });
  const record = await adminScenario.createRecord({ patient, doctor: doctorB, appointment });
  const certificate = await adminScenario.createCertificate({ patient, doctor: doctorB, record });
  await adminScenario.createBookableSlot({ doctor: doctorB, offset: 2 });
  const otherAvailability = await DoctorAvailability.findOne({ doctor_id: doctorB.doctorId }).lean();
  await loginAsDoctor(page, doctorA);
  await expectAllDenied(page, [
    { path: `/api/staff/appointments/${appointment.appointmentId}/check-in`, options: { method: 'PATCH' } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/priority`, options: { method: 'PATCH', body: { priority: 'urgent' } } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/no-show`, options: { method: 'PATCH' } },
    { path: '/api/admin/doctors', options: { method: 'POST', body: {} } },
    { path: `/api/admin/staff/${staff.staffId}/deactivate`, options: { method: 'PATCH' } },
  ]);
  expectSafeRejection(await browserApi(page, `/api/doctor/availability/${otherAvailability._id}`, { method: 'DELETE' }), [404]);
  expect(await DoctorAvailability.exists({ _id: otherAvailability._id })).not.toBeNull();
  for (const response of [
    await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, { method: 'POST', body: recordBody }),
    await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/complete`, { method: 'PATCH' }),
    await browserApi(page, `/api/doctor/records/${record.recordId}`),
    await browserApi(page, `/api/doctor/certificates/${certificate.certificateId}`),
  ]) expectSafeRejection(response, [403, 404]);
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('confirmed');
  expect(await MedicalRecord.countDocuments({ appointment_id: appointment.appointmentId })).toBe(1);
  assertBrowserClean();
});

test('Staff receives only the limited record projection and cannot invoke clinical/Admin operations', async ({ page, adminScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const staff = await adminScenario.createStaff();
  const doctor = await adminScenario.createDoctor();
  const patient = await adminScenario.createGuestPatient();
  const appointment = await adminScenario.createAppointment({ patient, doctor, slot: adminScenario.slotFor(adminScenario.today(), '12:00'), status: 'confirmed', check_in_at: new Date() });
  const record = await adminScenario.createRecord({ patient, doctor, appointment, diagnosis: 'Limited diagnosis' });
  const certificate = await adminScenario.createCertificate({ patient, doctor, record, purpose: 'Private purpose' });
  await loginAsStaff(page, staff);
  const summary = await browserApi(page, `/api/staff/patients/${patient.patientId}/record-summary`);
  expect(summary.status).toBe(200);
  expect(summary.body.medical_record_summaries[0]).toEqual(expect.objectContaining({ patient_name: patient.full_name, attending_doctor: doctor.display_name }));
  expect(JSON.stringify(summary.body)).not.toMatch(/Limited diagnosis|read-only doctor note|Cetirizine|Private purpose|diagnosis|prescription|certificate/i);
  for (const response of [
    await browserApi(page, `/api/doctor/records/${record.recordId}`),
    await browserApi(page, `/api/patient/records/${record.recordId}`),
    await browserApi(page, `/api/doctor/certificates/${certificate.certificateId}`),
    await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, { method: 'POST', body: recordBody }),
    await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/complete`, { method: 'PATCH' }),
    await browserApi(page, '/api/admin/doctors'),
  ]) expectSafeRejection(response, [403]);
  assertBrowserClean();
});

test('MFA-authenticated Admin can manage accounts but is not a clinical, scheduling, or queue superuser', async ({ page, adminScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const admin = await adminScenario.createAdmin({ enrolled: true });
  const doctor = await adminScenario.createDoctor();
  const patient = await adminScenario.createPatient();
  const appointment = await adminScenario.createAppointment({ patient, doctor, slot: adminScenario.slotFor(adminScenario.today(), '13:00'), status: 'confirmed', check_in_at: new Date() });
  await loginAsAdmin(page, admin, () => currentTotp(admin.mfaSecret));
  const doctors = await browserApi(page, '/api/admin/doctors');
  expect(doctors.status).toBe(200);
  expect(JSON.stringify(doctors.body)).not.toMatch(/password_hash|mfa_secret|AUTH_SECRET|mongodb(?:\+srv)?:\/\//i);
  await expectAllDenied(page, [
    { path: '/api/doctor/availability', options: { method: 'POST', body: { day_of_week: 1, start_time: '09:00', end_time: '10:00' } } },
    { path: `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, options: { method: 'POST', body: recordBody } },
    { path: `/api/doctor/appointments/${appointment.appointmentId}/complete`, options: { method: 'PATCH' } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/check-in`, options: { method: 'PATCH' } },
    { path: `/api/staff/appointments/${appointment.appointmentId}/priority`, options: { method: 'PATCH', body: { priority: 'urgent' } } },
  ]);
  expect(await MedicalRecord.exists({ appointment_id: appointment.appointmentId })).toBeNull();
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('confirmed');
  expect(await MedicalCertificate.countDocuments({ patient_id: patient.patientId })).toBe(0);
  assertBrowserClean();
});
