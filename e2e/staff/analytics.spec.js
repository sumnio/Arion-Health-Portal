import { test, expect } from '../fixtures/test.js';
import { loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Staff Analytics shows safe aggregate clinic metrics and period controls', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await staffScenario.createPatient({ full_name: 'E2E Hidden Analytics Patient', dob: new Date('1950-01-01T00:00:00.000Z'), is_pwd: true });
  const doctor = await staffScenario.createDoctor();
  await staffScenario.createAppointment({ patient, doctor, slot: staffScenario.slotFor(staffScenario.today(), '09:00'), status: 'completed', reason: 'General health concern' });
  await staffScenario.createAppointment({ patient, doctor, slot: staffScenario.slotFor(staffScenario.today(), '10:00'), status: 'pending', priority: 'urgent', reason: 'E2E private legacy reason' });
  await staffScenario.createAppointment({ patient, doctor, slot: staffScenario.slotFor(staffScenario.today(), '11:00'), status: 'no_show', reason: 'Other concern' });

  await loginAsStaff(page, seededStaff);
  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page).toHaveURL('/staff/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Total Appointments').locator('..').getByText('3', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Doctor Workload' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(doctor.display_name) })).toContainText('3');
  await expect(page.getByText('Other / legacy')).toBeVisible();
  const expectedWeekday = new Date(`${staffScenario.today()}T00:00:00.000Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  await expect(page.getByText(expectedWeekday, { exact: true })).toBeVisible();
  await expect(page.getByText(patient.full_name)).toHaveCount(0);
  await expect(page.getByText('E2E private legacy reason')).toHaveCount(0);
  await expect(page.getByText(/diagnosis|prescription|clinical note/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'This Week' }).click();
  await expect(page.getByRole('button', { name: 'This Week' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Loading clinic analytics…')).toHaveCount(0);
  assertBrowserClean();
});
