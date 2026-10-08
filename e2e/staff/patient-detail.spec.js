import { test, expect } from '../fixtures/test.js';
import { loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Staff Patients shows linked and walk-in operational details without clinical content', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const portalPatient = await staffScenario.createPatient({ full_name: 'E2E Portal Operations Patient', display_name: 'E2E Portal Operations Patient', address: 'E2E Portal Address', is_pwd: true });
  const walkInPatient = await staffScenario.createGuestPatient({ full_name: 'E2E Walk-in Operations Patient', address: 'E2E Walk-in Address' });
  const doctor = await staffScenario.createDoctor();
  const latest = await staffScenario.createAppointment({ patient: portalPatient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(-1), '09:00'), status: 'completed', check_in_at: new Date(), reason: 'E2E completed operational visit' });
  await staffScenario.createAppointment({ patient: portalPatient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(1), '10:00'), status: 'confirmed', reason: 'E2E upcoming operational visit', priority: 'urgent' });
  await staffScenario.createRecord({ patient: portalPatient, doctor, appointment: latest, diagnosis: 'E2E private diagnosis' });

  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/patients');
  await page.getByLabel('Search by patient name or contact number').fill(portalPatient.full_name);
  await expect(page.getByText('Portal Patient')).toBeVisible();
  await expect(page.getByText('E2E completed operational visit')).toHaveCount(0);
  await expect(page.getByText('E2E private diagnosis')).toHaveCount(0);
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View Patient' }).click();

  await expect(page.getByRole('heading', { name: portalPatient.full_name })).toBeVisible();
  await expect(page.getByText('E2E Portal Address')).toBeVisible();
  await expect(page.getByText('Portal Patient')).toBeVisible();
  await expect(page.getByText('E2E completed operational visit', { exact: true })).toBeVisible();
  await expect(page.getByText('E2E upcoming operational visit', { exact: true })).toBeVisible();
  await expect(page.getByText('Urgent', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'Urgent' })).toHaveCount(0);
  await expect(page.getByText('E2E private diagnosis')).toHaveCount(0);
  await expect(page.getByText(/prescription|clinical note/i)).toHaveCount(0);

  await page.goto(`/staff/patients/${walkInPatient.patientId}`);
  await expect(page.getByRole('heading', { name: walkInPatient.full_name })).toBeVisible();
  await expect(page.getByText('Walk-in / Unlinked')).toBeVisible();
  await expect(page.getByText('E2E Walk-in Address')).toBeVisible();
  await expect(page.getByText('No appointment history found.')).toBeVisible();
  assertBrowserClean();
});
