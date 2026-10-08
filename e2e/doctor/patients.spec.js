import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Doctor Patients lists only related Patients and opens the tabbed detail view', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const related = await patientScenario.createPatient({ display_name: 'E2E Related Patient', full_name: 'E2E Related Patient' });
  const unrelated = await patientScenario.createPatient({ display_name: 'E2E Unrelated Patient', full_name: 'E2E Unrelated Patient' });
  const otherDoctor = await patientScenario.createDoctor();
  await patientScenario.createAppointment({ patient: related, doctor: seededDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(1), '09:00'), status: 'confirmed' });
  await patientScenario.createAppointment({ patient: unrelated, doctor: otherDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(1), '10:00'), status: 'confirmed' });

  await loginAsDoctor(page, seededDoctor);
  await page.getByRole('link', { name: 'Patients', exact: true }).first().click();
  await expect(page).toHaveURL('/doctor/patients');
  await expect(page.getByText(related.full_name)).toBeVisible();
  await expect(page.getByText(unrelated.full_name)).toHaveCount(0);
  await page.getByRole('link', { name: 'View Patient' }).click();
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(related.full_name).first()).toBeVisible();
  for (const name of ['Consultation', 'Medical Records', 'Certificates']) {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  }
  assertBrowserClean();
});

test('Doctor Patients shows empty and safe error states', async ({ page, seededDoctor }) => {
  await loginAsDoctor(page, seededDoctor);
  await page.goto('/doctor/patients');
  await expect(page.getByRole('heading', { name: 'No related patients found.' })).toBeVisible();
  await page.route('**/api/doctor/appointments', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_ERROR', message: 'Test failure' } }) }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Unable to load related patients.');
});
