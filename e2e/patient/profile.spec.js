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

test('Patient profile validates Philippine mobile fields only in Edit mode', async ({ page, seededPatient }) => {
  await loginAsPatient(page, seededPatient);
  await page.goto('/patient/profile');
  const contact = page.getByRole('textbox', { name: 'Contact number *' });
  const emergency = page.getByRole('textbox', { name: 'Emergency contact number' });
  await expect(contact).toBeDisabled();
  await expect(emergency).toBeDisabled();
  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await contact.fill('0917abc4567');
  await expect(contact).toHaveValue(seededPatient.contact_number);
  await expect(page.getByText('Invalid phone number.')).toHaveCount(0);
  await contact.fill('0999 123 4567');
  await contact.press('8');
  await expect(contact).toHaveValue('09991234567');
  await expect(page.getByText('Phone number must be 11 digits.')).toHaveCount(0);
  await emergency.fill('0917123');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Phone number must be 11 digits.')).toBeVisible();
  await emergency.fill('');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('status')).toContainText('Changes saved successfully.');
  await expect(contact).toHaveValue('09991234567');
});
