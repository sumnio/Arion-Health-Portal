import { test, expect } from '../fixtures/test.js';
import { loginAsPatient } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

async function clinicalScenario(patientScenario, patient) {
  const doctor = await patientScenario.createDoctor();
  const appointment = await patientScenario.createAppointment({
    patient,
    doctor,
    slot: patientScenario.slotFor(patientScenario.futureDate(1), '13:00'),
    status: 'completed',
    check_in_at: new Date(),
  });
  const record = await patientScenario.createRecord({ patient, doctor, appointment });
  return { doctor, appointment, record };
}

test('Patient views persistent read-only record and Prescription details', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const { doctor, record } = await clinicalScenario(patientScenario, seededPatient);
  await loginAsPatient(page, seededPatient);
  await page.goto('/patient/records');

  await expect(page.getByText(record.diagnosis)).toBeVisible();
  await page.getByRole('link', { name: 'View Record →' }).click();
  await expect(page.getByRole('heading', { name: 'Medical Record Details' })).toBeVisible();
  await expect(page.getByText(record.diagnosis)).toBeVisible();
  await expect(page.getByText(doctor.display_name)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Cetirizine' })).toBeVisible();
  await expect(page.getByText('10 mg')).toBeVisible();
  await expect(page.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(record.diagnosis)).toBeVisible();
  assertBrowserClean();
});

test('Patient views an issued certificate and downloads its generated PDF', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const { doctor, record } = await clinicalScenario(patientScenario, seededPatient);
  const certificate = await patientScenario.createCertificate({ patient: seededPatient, doctor, record });
  await loginAsPatient(page, seededPatient);
  await page.goto('/patient/certificates');

  await expect(page.getByText(certificate.purpose)).toBeVisible();
  await page.getByRole('link', { name: 'View Certificate →' }).click();
  await expect(page.getByText(certificate.medical_certificate_number, { exact: true })).toBeVisible();
  await expect(page.getByText(doctor.display_name).first()).toBeVisible();
  await expect(page.getByText(doctor.license_number).first()).toBeVisible();
  await expect(page.getByText(doctor.ptr_number).first()).toBeVisible();
  await expect(page.getByLabel('Medical certificate preview')).toContainText(/Arion Health Clinic/);
  await expect(page.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`Medical-Certificate-${certificate.medical_certificate_number}.pdf`);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF');
  assertBrowserClean();
});

test('Patient records and certificates show five items per page', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const date = patientScenario.futureDate(2);

  for (let index = 0; index < 6; index += 1) {
    const appointment = await patientScenario.createAppointment({
      patient: seededPatient,
      doctor,
      slot: patientScenario.slotFor(date, `${String(8 + index).padStart(2, '0')}:00`),
      status: 'completed',
      check_in_at: new Date(),
    });
    const record = await patientScenario.createRecord({
      patient: seededPatient,
      doctor,
      appointment,
      diagnosis: `Pagination diagnosis ${index + 1}`,
      prescriptions: false,
    });
    await patientScenario.createCertificate({
      patient: seededPatient,
      doctor,
      record,
      purpose: `Pagination certificate ${index + 1}`,
    });
  }

  await loginAsPatient(page, seededPatient);
  await page.goto('/patient/records');
  await expect(page.locator('.record-list-item')).toHaveCount(5);
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.record-list-item')).toHaveCount(1);
  await expect(page.getByText('Page 2 of 2')).toBeVisible();

  await page.goto('/patient/certificates');
  await expect(page.locator('.certificate-list-item')).toHaveCount(5);
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.certificate-list-item')).toHaveCount(1);
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  assertBrowserClean();
});

test('Patient sees real empty appointment, record, and certificate states', async ({ page, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  await loginAsPatient(page, seededPatient);

  await page.goto('/patient/appointments');
  await expect(page.getByText('You do not have any appointments yet.')).toBeVisible();
  await page.goto('/patient/records');
  await expect(page.getByRole('heading', { name: 'No medical records yet' })).toBeVisible();
  await page.goto('/patient/certificates');
  await expect(page.getByRole('heading', { name: 'No issued certificates yet' })).toBeVisible();
  await expect(page.getByText(/mock|demo/i)).toHaveCount(0);
  assertBrowserClean();
});

test('Patient cannot open another Patient medical record in the browser', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const otherPatient = await patientScenario.createPatient();
  const { record } = await clinicalScenario(patientScenario, otherPatient);
  await loginAsPatient(page, seededPatient);

  await page.goto(`/patient/records/${record.recordId}`);
  await expect(page.getByRole('heading', { name: 'Medical record not found' })).toBeVisible();
  await expect(page.getByText(record.diagnosis)).toHaveCount(0);
  assertBrowserClean();
});
