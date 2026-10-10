import { test, expect } from '../fixtures/test.js';
import { loginAsPatient } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Patient loads, updates, and persists an approved profile field', async ({ page, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  await loginAsPatient(page, seededPatient);
  await page.goto('/patient/profile');

  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Full name *' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Full name *' })).toHaveValue(seededPatient.full_name);
  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await expect(page.getByRole('textbox', { name: 'Full name *' })).toBeEnabled();

  const address = `E2E address ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Address (optional)' }).fill(address);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('status')).toContainText('Changes saved successfully.');
  await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Address (optional)' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Address (optional)' })).toHaveValue(address);
  assertBrowserClean();
});
