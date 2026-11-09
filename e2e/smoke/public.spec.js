import { test, expect } from '@playwright/test';

test('landing page keeps the clinic-focused actions, carousel, map, and responsive layout', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Welcome to Arion Health Portal' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Login/ }).first()).toHaveAttribute('href', '/login');
    await expect(page.getByRole('link', { name: 'Register' }).first()).toHaveAttribute('href', '/register');
    await expect(page.getByRole('heading', { name: 'View Medical Records' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contact the Clinic' })).toBeVisible();
    await expect(page.getByTitle('Map showing Arion Medical Surgical Clinic')).toBeVisible();
    await expect(page.getByRole('link', { name: /^Get Directions/ })).toHaveAttribute('href', /google\.com\/maps/);
    await expect(page.getByRole('button', { name: 'Open Arion Assistant' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show clinic photo 1' })).toBeVisible();
    if (viewport.width === 1280) {
      await expect(page.getByRole('img', { name: 'Reception area inside Arion Medical Surgical Clinic' })).toBeVisible({ timeout: 6_500 });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test('public login page loads without fatal browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Login to Your Account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('unknown routes show only a concise not-found action', async ({ page }) => {
  await page.goto('/doctor/dashbdwdoard');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back Home', exact: true })).toBeVisible();
  await expect(page.getByText(/milestone|placeholder|ready for the next/i)).toHaveCount(0);
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
