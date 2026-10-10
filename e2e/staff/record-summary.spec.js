import { Appointment, MedicalRecord } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor, loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { browserApi, e2eBaseUrl } from '../helpers/browserApi.js';

test('Staff sees only non-clinical record metadata, cannot perform clinical actions, and Doctor completion removes the queue entry', async ({ page, browser, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const patient = await staffScenario.createGuestPatient();
  const appointment = await staffScenario.createAppointment({
    patient,
    doctor,
    slot: staffScenario.slotFor(staffScenario.today(), '14:00'),
    status: 'confirmed',
    check_in_at: new Date(),
    reason: 'E2E restricted consultation',
  });
  const record = await staffScenario.createRecord({ patient, doctor, appointment, diagnosis: 'E2E limited diagnosis' });
  for (let offset = -2; offset >= -6; offset -= 1) {
    const historicalAppointment = await staffScenario.createAppointment({ patient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(offset), '09:00'), status: 'completed', check_in_at: new Date(), reason: `E2E record summary ${Math.abs(offset)}` });
    await staffScenario.createRecord({ patient, doctor, appointment: historicalAppointment, diagnosis: `E2E hidden diagnosis ${Math.abs(offset)}`, prescriptions: false });
  }
  await staffScenario.createCertificate({ patient, doctor, record, purpose: 'E2E private certificate purpose' });
  const emptyPatient = await staffScenario.createGuestPatient({ full_name: `E2E Empty History ${staffScenario.marker.slice(0, 6)}` });

  await loginAsStaff(page, seededStaff);
  await page.goto(`/staff/patients/${patient.patientId}/walk-in`);
  await expect(page.getByRole('heading', { name: patient.full_name })).toBeVisible();
  await expect(page.getByText(doctor.display_name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('E2E limited diagnosis')).toHaveCount(0);
  await expect(page.getByText('E2E read-only doctor note')).toHaveCount(0);
  await expect(page.getByText('E2E Cetirizine')).toHaveCount(0);
  await expect(page.getByText('E2E private certificate purpose')).toHaveCount(0);
  await expect(page.getByText('Diagnoses, clinical notes, prescriptions, and certificates are not available to Staff.')).toBeVisible();
  await expect(page.locator('.walkin-queue > li')).toHaveCount(5);
  await expect(page.getByRole('button', { name: /Add Medical Record|Issue Certificate|Complete Consultation|Mark Consultation Completed/i })).toHaveCount(0);

  const createRecord = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, {
    method: 'POST', body: { diagnosis: 'Forbidden', notes: null, follow_up: null, prescriptions: [] },
  });
  expect(createRecord.status).toBe(403);
  const issueCertificate = await browserApi(page, `/api/doctor/records/${record.recordId}/certificates`, {
    method: 'POST', body: { purpose: 'Forbidden', diagnosis_summary: 'Forbidden', date_issued: staffScenario.today(), valid_until: null },
  });
  expect(issueCertificate.status).toBe(403);
  const completeAsStaff = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/complete`, { method: 'PATCH' });
  expect(completeAsStaff.status).toBe(403);
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('confirmed');

  await page.goto(`/staff/patients/${emptyPatient.patientId}/walk-in`);
  await expect(page.getByText('No previous consultations available.')).toBeVisible();

  const doctorContext = await browser.newContext({ baseURL: e2eBaseUrl });
  const doctorPage = await doctorContext.newPage();
  await loginAsDoctor(doctorPage, doctor);
  const completed = await browserApi(doctorPage, `/api/doctor/appointments/${appointment.appointmentId}/complete`, { method: 'PATCH' });
  expect(completed.status).toBe(200);
  await doctorContext.close();
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('completed');
  expect(await MedicalRecord.exists({ _id: record.recordId })).not.toBeNull();

  await page.goto('/staff/queue');
  const waiting = page.locator('section').filter({ has: page.getByRole('heading', { name: /Active Queue/ }) });
  await expect(waiting.getByText(patient.full_name)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Complete|Mark as Completed/i })).toHaveCount(0);
  assertBrowserClean();
});
