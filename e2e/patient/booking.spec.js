import { test, expect } from '../fixtures/test.js';
import { loginAsPatient } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { formatBookingDate, formatSlot } from '../../src/services/dateTimeService.js';

async function selectBooking(page, doctor, slot, reason) {
  await page.goto('/patient/book');
  await page.getByLabel('Visit type / service').selectOption('general_consultation');
  await page.getByLabel('Doctor').selectOption(doctor.doctorId);
  const dateButton = page.getByRole('button', { name: formatBookingDate(slot.date) });
  await expect(dateButton).toBeEnabled({ timeout: 20_000 });
  await dateButton.click();
  await page.getByRole('radio', { name: formatSlot(slot.time) }).check();
  await page.getByLabel('Specific reason for visit').selectOption(reason);
}

test('Patient books a published slot and appointment/detail persist after refresh', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor });
  const reason = 'General health concern';

  await loginAsPatient(page, seededPatient);
  await selectBooking(page, doctor, slot, reason);
  await page.getByRole('button', { name: 'Confirm Appointment' }).click();

  await expect(page.getByRole('heading', { name: 'Appointment request created' })).toBeVisible();
  await page.getByRole('link', { name: 'View My Appointments' }).click();
  await expect(page.getByText(reason)).toBeVisible();
  await page.reload();
  await expect(page.getByText(reason)).toBeVisible();

  await page.getByRole('link', { name: 'View Details' }).first().click();
  await expect(page.getByRole('heading', { name: 'Appointment Details' })).toBeVisible();
  await expect(page.getByText(doctor.display_name)).toBeVisible();
  await expect(page.getByText('General Consultation')).toBeVisible();
  await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();
  await page.reload();
  await expect(page.getByText(reason)).toBeVisible();
  assertBrowserClean();
});

test('Patient receives a safe conflict when a displayed slot becomes occupied', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor });
  const occupyingPatient = await patientScenario.createPatient();

  await loginAsPatient(page, seededPatient);
  await selectBooking(page, doctor, slot, 'Follow-up consultation');
  await patientScenario.createAppointment({ patient: occupyingPatient, doctor, slot });
  await page.getByRole('button', { name: 'Confirm Appointment' }).click();

  await expect(page.getByRole('alert')).toContainText(/slot.*(?:not|no longer) available/i);
  const occupiedSlot = page.getByRole('radio', { name: new RegExp(`${formatSlot(slot.time)}\\s+Occupied`, 'i') });
  await expect(occupiedSlot).toBeVisible();
  await expect(occupiedSlot).toBeDisabled();
  assertBrowserClean();
});

test('Patient reason dropdown uses approved options and requires Other concern details', async ({ page, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  await loginAsPatient(page, seededPatient);
  await page.goto('/patient/book');
  const reason = page.getByLabel('Specific reason for visit');
  await expect(reason.locator('option')).toHaveText([
    'Select reason for visit',
    'General health concern',
    'Fever, cough, or cold symptoms',
    'Headache or dizziness',
    'Stomach pain or digestive concern',
    'Blood pressure concern',
    'Follow-up consultation',
    'Routine health check',
    'Laboratory results discussion',
    'Medical clearance consultation',
    'Other concern',
  ]);
  await reason.selectOption('Other concern');
  const detail = page.getByLabel('Describe your other concern');
  await expect(detail).toBeVisible();
  await detail.fill('  Persistent fatigue  ');
  await expect(page.locator('.booking-summary')).toContainText('Other concern: Persistent fatigue');
  await reason.selectOption('Routine health check');
  await expect(detail).toHaveCount(0);
  await expect(page.locator('.booking-summary')).toContainText('Routine health check');
  assertBrowserClean();
});

test('Patient books first, uploads a synthetic PDF, and sees it only on that appointment', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor });
  await loginAsPatient(page, seededPatient);
  await selectBooking(page, doctor, slot, 'Laboratory results discussion');
  await page.getByLabel('Choose supporting documents').setInputFiles({ name: 'e2e-lab-result.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
  await expect(page.getByText('e2e-lab-result.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Appointment' }).click();
  await expect(page.getByText('Appointment booked successfully. Your supporting documents were also uploaded.')).toBeVisible();
  await page.getByRole('link', { name: 'View My Appointments' }).click();
  await page.getByRole('link', { name: 'View Details' }).first().click();
  await expect(page.getByRole('heading', { name: 'Supporting Documents', exact: true })).toBeVisible();
  await expect(page.getByText('e2e-lab-result.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'View' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'e2e-lab-result.pdf' })).toBeVisible();
  await expect(page.locator('.supporting-document-viewer-content object')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  assertBrowserClean();
});

test('Patient can remove a local image and sees limits on a 320px viewport', async ({ page, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await loginAsPatient(page, seededPatient);
  await page.goto('/patient/book');
  const picker = page.getByLabel('Choose supporting documents');
  await picker.setInputFiles({ name: 'visible-concern.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]) });
  await expect(page.getByText('visible-concern.png')).toBeVisible();
  await page.getByRole('button', { name: 'Remove visible-concern.png' }).click();
  await expect(page.getByText('visible-concern.png')).toHaveCount(0);
  await picker.setInputFiles(Array.from({ length: 6 }, (_, index) => ({ name: `file-${index}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-') })));
  await expect(page.getByRole('alert')).toContainText('You can upload up to 5 files.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  assertBrowserClean();
});

test('appointment stays booked when supporting-document upload fails', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page, { allowedStatuses: [503] });
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor });
  const reason = 'Medical clearance consultation';
  await loginAsPatient(page, seededPatient);
  await selectBooking(page, doctor, slot, reason);
  await page.getByLabel('Choose supporting documents').setInputFiles({ name: 'e2e-upload-failure.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.route('**/api/patient/appointments/*/supporting-documents', async route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SUPPORTING_DOCUMENT_UPLOAD_UNAVAILABLE', message: 'Upload unavailable.' } }) }));
  await page.getByRole('button', { name: 'Confirm Appointment' }).click();
  await expect(page.getByText(/appointment was booked successfully, but/i)).toBeVisible();
  await page.getByRole('link', { name: 'View My Appointments' }).click();
  await expect(page.getByText(reason)).toBeVisible();
  assertBrowserClean();
});
