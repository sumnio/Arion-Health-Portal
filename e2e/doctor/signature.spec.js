import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

function signaturePng(width = 400, height = 120) {
  const value = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(value);
  value.writeUInt32BE(13, 8);
  Buffer.from('IHDR').copy(value, 12);
  value.writeUInt32BE(width, 16);
  value.writeUInt32BE(height, 20);
  value[24] = 8;
  value[25] = 6;
  return value;
}

test('Doctor uploads and replaces only their own private certificate signature', async ({ page, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  await loginAsDoctor(page, seededDoctor);
  await page.getByRole('link', { name: 'My Profile' }).click();
  await expect(page).toHaveURL('/doctor/profile');
  await expect(page.getByRole('heading', { name: 'Certificate Signature' })).toBeVisible();
  await expect(page.getByText('No certificate signature uploaded.')).toBeVisible();

  await page.getByLabel('Choose signature').setInputFiles({
    name: 'doctor-signature.png',
    mimeType: 'image/png',
    buffer: signaturePng(),
  });
  await page.getByRole('button', { name: 'Upload Signature' }).click();
  await expect(page.getByRole('status')).toHaveText('Certificate signature saved securely.');
  await expect(page.getByAltText('Your certificate signature preview')).toBeVisible();

  await page.getByLabel('Replace signature').setInputFiles({
    name: 'replacement.png',
    mimeType: 'image/png',
    buffer: signaturePng(500, 150),
  });
  await page.locator('button.primary-action', { hasText: 'Replace Signature' }).click();
  await expect(page.getByText('500×150 pixels')).toBeVisible();
  await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
  assertBrowserClean();
});

test('Doctor signature UI rejects a non-PNG before upload', async ({ page, seededDoctor }) => {
  await loginAsDoctor(page, seededDoctor);
  await page.goto('/doctor/profile');
  await page.getByLabel('Choose signature').setInputFiles({ name: 'not-a-signature.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not png') });
  await expect(page.getByRole('alert')).toHaveText('Only PNG signature images are allowed.');
  await expect(page.getByRole('button', { name: 'Upload Signature' })).toBeDisabled();
});
