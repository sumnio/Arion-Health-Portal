import { Appointment } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsStaff, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Staff session, dashboard, atomic Confirm Arrival, persistence, and logout use live data', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const patient = await staffScenario.createPatient();
  const appointment = await staffScenario.createAppointment({
    patient,
    doctor,
    slot: staffScenario.slotFor(staffScenario.today(), '12:00'),
    status: 'pending',
    reason: 'E2E calendar confirmation',
  });

  await loginAsStaff(page, seededStaff);
  await expect(page.getByRole('heading', { name: `Welcome, ${seededStaff.display_name}` })).toBeVisible();
  await expect(page.getByText(patient.full_name).first()).toBeVisible();
  await expect(page.getByText(/mock|demo/i)).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL('/staff/dashboard');
  await expect(page.getByText(patient.full_name).first()).toBeVisible();

  await page.goto('/staff/calendar');
  await expect(page.getByText(patient.full_name)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(patient.full_name) }).click();
  await expect(page.getByRole('definition').filter({ hasText: doctor.display_name })).toBeVisible();
  await expect(page.locator('.calendar-details').getByText('Pending', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Arrival' }).click();
  await expect(page.getByText('Arrival confirmed. Patient added to the active queue.', { exact: true })).toBeVisible();
  const arrived = await Appointment.findById(appointment.appointmentId).lean();
  expect(arrived.status).toBe('confirmed');
  expect(arrived.check_in_at).not.toBeNull();

  await page.goto('/staff/queue');
  const waiting = page.locator('section').filter({ has: page.getByRole('heading', { name: /Active Queue/ }) });
  await expect(waiting.getByText(patient.full_name)).toBeVisible();

  await page.goto('/staff/calendar');
  await page.reload();
  await expect(page.getByText(patient.full_name)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(patient.full_name) }).click();
  await expect(page.locator('.calendar-details').getByText('Confirmed', { exact: true })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'Arrived / Confirmed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Arrival' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark No-show' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View in Appointment Queue' })).toBeVisible();
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByLabel('Selected date')).toHaveValue(staffScenario.futureDate(1));
  await page.getByLabel('Selected date').fill(staffScenario.futureDate(14));
  await expect(page.getByText('No appointments for this date.')).toBeVisible();

  await logoutThroughUi(page);
  await page.goto('/staff/dashboard');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  assertBrowserClean();
});

test('Staff empty dashboard, calendar, queue, and Patient-search states are honest', async ({ page, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  await loginAsStaff(page, seededStaff);
  await expect(page.getByText('No patients currently waiting.')).toBeVisible();
  await expect(page.getByText('No upcoming appointments.')).toBeVisible();
  await page.goto('/staff/calendar');
  await expect(page.getByText('No appointments for this date.')).toBeVisible();
  await page.goto('/staff/queue');
  await expect(page.getByText('No patients currently waiting.')).toBeVisible();
  await page.goto('/staff/patients');
  await page.getByLabel('Search by patient name or contact number').fill(`missing-${Date.now()}`);
  await expect(page.getByRole('heading', { name: 'No patients found' })).toBeVisible();
  assertBrowserClean();
});
