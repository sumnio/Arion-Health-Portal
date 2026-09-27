import { test, expect } from '../fixtures/test.js';
import { loginAsPatient } from '../helpers/auth.js';
import { browserApi } from '../helpers/browserApi.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { expectSafeRejection } from '../helpers/securityAssertions.js';

test('Patient A cannot read Patient B appointment, record, or certificate through pages or APIs', async ({ page, adminScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const patientA = await adminScenario.createPatient();
  const patientB = await adminScenario.createPatient();
  const doctor = await adminScenario.createDoctor();
  const appointment = await adminScenario.createAppointment({ patient: patientB, doctor, slot: adminScenario.slotFor(adminScenario.futureDate(2), '14:00'), status: 'confirmed' });
  const record = await adminScenario.createRecord({ patient: patientB, doctor, appointment, diagnosis: 'Patient B private diagnosis' });
  const certificate = await adminScenario.createCertificate({ patient: patientB, doctor, record, purpose: 'Patient B private certificate' });
  await loginAsPatient(page, patientA);
  for (const [route, text] of [
    [`/patient/appointments/${appointment.appointmentId}`, 'Patient B private'],
    [`/patient/records/${record.recordId}`, 'Patient B private diagnosis'],
    [`/patient/certificates/${certificate.certificateId}`, 'Patient B private certificate'],
  ]) {
    await page.goto(route);
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }
  for (const path of [
    `/api/patient/appointments/${appointment.appointmentId}`,
    `/api/patient/records/${record.recordId}`,
    `/api/patient/certificates/${certificate.certificateId}`,
  ]) expectSafeRejection(await browserApi(page, path), [404]);
  assertBrowserClean();
});
