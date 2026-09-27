import { test, expect } from '../fixtures/test.js';
import { loginAsPatient, logoutThroughUi } from '../helpers/auth.js';

test('Patient can log in, restore the cookie session, and log out', async ({ page, patientAccount }) => {
  await loginAsPatient(page, patientAccount);
  await expect(page.getByRole('heading', { name: `${patientAccount.display_name}!` })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL('/patient/dashboard');
  await expect(page.getByRole('heading', { name: `${patientAccount.display_name}!` })).toBeVisible();

  await logoutThroughUi(page);
  await expect(page.getByRole('heading', { name: 'Login to Your Account' })).toBeVisible();

  await page.goto('/patient/profile');
  await expect(page).toHaveURL(/\/login$/);
});
