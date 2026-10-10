import { test, expect } from '@playwright/test';

test('public login page loads without fatal browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Login to Your Account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Patient registration phone input ignores invalid characters and extra digits without invalidating a valid number', async ({ page }) => {
  await page.goto('/register');
  const phone = page.getByLabel('Phone Number');
  await phone.fill('0917abc4567');
  await expect(phone).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await phone.fill('0917 123 4567');
  await expect(phone).toHaveValue('09171234567');
  await phone.press('8');
  await expect(phone).toHaveValue('09171234567');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Enter an 11-digit Philippine mobile number starting with 09.')).toHaveCount(0);
});
