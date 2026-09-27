import { Appointment, MedicalCertificate, MedicalRecord, UserProfile } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor, loginAsPatient, loginAsStaff } from '../helpers/auth.js';
import { browserApi, e2eBaseUrl } from '../helpers/browserApi.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { expectSafeRejection } from '../helpers/securityAssertions.js';

test('protected profile fields, role escalation, malformed IDs, scalar abuse, and operator queries fail safely', async ({ page, adminScenario }) => {
  const assertPatientBrowserClean = observeBrowser(page);
  const patient = await adminScenario.createPatient();
  await loginAsPatient(page, patient);
  for (const request of [
    ['/api/patient/profile', { method: 'PATCH', body: { role: 'admin' } }],
    ['/api/patient/profile', { method: 'PATCH', body: { status: 'inactive' } }],
    ['/api/patient/profile', { method: 'PATCH', body: { full_name: { $ne: null } } }],
    ['/api/patient/appointments/not-an-object-id', undefined],
  ]) expectSafeRejection(await browserApi(page, request[0], request[1]), [400, 404]);
  expect((await UserProfile.findById(patient.profileId).lean()).role).toBe('patient');

  const staff = await adminScenario.createStaff();
  const context = await page.context().browser().newContext({ baseURL: e2eBaseUrl });
  const staffPage = await context.newPage();
  const assertStaffBrowserClean = observeBrowser(staffPage);
  await loginAsStaff(staffPage, staff);
  for (const path of ['/api/staff/patients?search=a&search=b', '/api/staff/patients?search[$ne]=x', '/api/staff/appointments?date[$ne]=x']) {
    expectSafeRejection(await browserApi(staffPage, path), [400]);
  }
  assertPatientBrowserClean();
  assertStaffBrowserClean();
  await context.close();
});

test('created_by, certificate number, and bodyless-action spoofing are rejected without mutation', async ({ browser, adminScenario }) => {
  const patient = await adminScenario.createPatient();
  const doctor = await adminScenario.createDoctor();
  const staff = await adminScenario.createStaff();
  const slot = await adminScenario.createBookableSlot({ doctor, offset: 2 });

  const patientContext = await browser.newContext({ baseURL: e2eBaseUrl });
  const patientPage = await patientContext.newPage();
  const assertPatientBrowserClean = observeBrowser(patientPage);
  await loginAsPatient(patientPage, patient);
  expectSafeRejection(await browserApi(patientPage, '/api/patient/appointments', {
    method: 'POST', body: { doctor_id: doctor.doctorId, appointment_at: slot.appointmentAt.toISOString(), visit_type: 'general_consultation', reason: 'Spoof attempt', created_by: staff.profileId },
  }), [400]);
  expect(await Appointment.exists({ reason: 'Spoof attempt' })).toBeNull();
  assertPatientBrowserClean();
  await patientContext.close();

  const staffContext = await browser.newContext({ baseURL: e2eBaseUrl });
  const staffPage = await staffContext.newPage();
  const assertStaffBrowserClean = observeBrowser(staffPage);
  await loginAsStaff(staffPage, staff);
  expectSafeRejection(await browserApi(staffPage, `/api/staff/patients/${patient.patientId}/walk-in-appointments`, {
    method: 'POST', body: { doctor_id: doctor.doctorId, appointment_at: adminScenario.slotFor(adminScenario.today(), '23:30').appointmentAt.toISOString(), visit_type: 'general_consultation', reason: 'Staff spoof', priority: 'normal', created_by: patient.profileId },
  }), [400]);
  const target = await adminScenario.createAppointment({ patient, doctor, slot: adminScenario.slotFor(adminScenario.today(), '15:00'), status: 'confirmed' });
  expectSafeRejection(await browserApi(staffPage, `/api/staff/appointments/${target.appointmentId}/check-in`, { method: 'PATCH', body: { status: 'completed' } }), [400]);
  expect((await Appointment.findById(target.appointmentId).lean()).check_in_at).toBeNull();
  assertStaffBrowserClean();
  await staffContext.close();

  const doctorContext = await browser.newContext({ baseURL: e2eBaseUrl });
  const doctorPage = await doctorContext.newPage();
  const assertDoctorBrowserClean = observeBrowser(doctorPage);
  await loginAsDoctor(doctorPage, doctor);
  const consultation = await adminScenario.createAppointment({ patient, doctor, slot: adminScenario.slotFor(adminScenario.today(), '16:00'), status: 'confirmed', check_in_at: new Date() });
  const record = await adminScenario.createRecord({ patient, doctor, appointment: consultation });
  expectSafeRejection(await browserApi(doctorPage, `/api/doctor/records/${record.recordId}/certificates`, {
    method: 'POST', body: { purpose: 'Spoof', diagnosis_summary: record.diagnosis, date_issued: adminScenario.today(), valid_until: null, medical_certificate_number: 'CLIENT-CONTROLLED' },
  }), [400]);
  expect(await MedicalCertificate.exists({ medical_certificate_number: 'CLIENT-CONTROLLED' })).toBeNull();
  expectSafeRejection(await browserApi(doctorPage, `/api/doctor/appointments/${consultation.appointmentId}/complete`, { method: 'PATCH', body: { doctor_id: 'spoof' } }), [400]);
  expect((await Appointment.findById(consultation.appointmentId).lean()).status).toBe('confirmed');
  expect(await MedicalRecord.exists({ _id: record.recordId })).not.toBeNull();
  assertDoctorBrowserClean();
  await doctorContext.close();
});
