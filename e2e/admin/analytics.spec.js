import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { currentTotp } from '../helpers/totp.js';

test('MFA-authenticated Admin can open the same read-only clinic Analytics view', async ({ page, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await adminScenario.createPatient({ full_name: 'E2E Hidden Admin Analytics Patient' });
  const doctor = await adminScenario.createDoctor();
  await adminScenario.createAppointment({ patient, doctor, slot: adminScenario.slotFor(adminScenario.today(), '13:00'), status: 'confirmed', reason: 'General health concern' });

  await loginAsAdmin(page, seededAdmin, () => currentTotp(seededAdmin.mfaSecret));
  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page).toHaveURL('/admin/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Total Appointments').locator('..').getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: doctor.display_name })).toBeVisible();
  await expect(page.getByText(patient.full_name)).toHaveCount(0);
  await expect(page.getByText(/diagnosis|prescription|clinical note/i)).toHaveCount(0);
  assertBrowserClean();
});
