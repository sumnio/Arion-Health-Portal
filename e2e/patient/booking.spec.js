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
  await page.getByPlaceholder('Briefly describe your concern').fill(reason);
}

test('Patient books a published slot and appointment/detail persist after refresh', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor });
  const reason = `E2E booking ${Date.now()}`;

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
  await selectBooking(page, doctor, slot, 'E2E conflict check');
  await patientScenario.createAppointment({ patient: occupyingPatient, doctor, slot });
  await page.getByRole('button', { name: 'Confirm Appointment' }).click();

  await expect(page.getByRole('alert')).toContainText(/slot.*not available/i);
  await expect(page.getByRole('radio', { name: formatSlot(slot.time) })).toHaveCount(0);
  assertBrowserClean();
});
