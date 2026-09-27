import { test, expect } from '@playwright/test';

test('public login page loads without fatal browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Login to Your Account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
