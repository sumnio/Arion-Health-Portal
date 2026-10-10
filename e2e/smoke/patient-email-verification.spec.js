import { test, expect } from '../fixtures/test.js';
import { buildTestPatient, cleanupTestPatient } from '../helpers/testData.js';
import { e2eApiUrl } from '../helpers/browserApi.js';

const captureKey = process.env.E2E_EMAIL_CAPTURE_KEY || 'arion-e2e-email-capture-only';

async function registerThroughUi(page, account) {
  await page.goto('/register');
  await page.getByLabel('Full Name').fill(account.display_name);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Phone Number').fill(account.contact_number);
  await page.getByLabel('Date of Birth').fill(account.dob);
  await page.getByLabel('Sex').selectOption(account.sex);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL('/verify-email');
}

async function latestCode(request, email) {
  const response = await request.get(`${e2eApiUrl}/api/e2e/email-capture/latest`, {
    params: { recipient: email },
    headers: { 'x-e2e-capture-key': captureKey },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).code;
}

async function fillCode(page, code) {
  for (let index = 0; index < 6; index += 1) {
    await page.getByLabel(`Verification digit ${index + 1}`).fill(code[index]);
  }
}

test('Patient registers, sees only a masked email, verifies by OTP, then logs in', async ({ page, request }) => {
  const account = buildTestPatient();
  try {
    await registerThroughUi(page, account);
    await expect(page.getByText(account.email, { exact: false })).toHaveCount(0);
    await expect(page.getByText(/We sent a 6-digit code to .*\*.*@example\.invalid/)).toBeVisible();
    const inputs = page.getByLabel(/Verification digit/);
    await expect(inputs).toHaveCount(6);
    await expect(inputs.first()).toHaveAttribute('inputmode', 'numeric');
    await expect(inputs.first()).toHaveAttribute('autocomplete', 'one-time-code');
    await fillCode(page, await latestCode(request, account.email));
    await page.getByRole('button', { name: 'Verify Email' }).click();
    await expect(page.getByRole('heading', { name: 'Email Verified' })).toBeVisible();
    await page.getByRole('link', { name: 'Continue to login' }).click();
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/patient/dashboard');
  } finally { await cleanupTestPatient(account); }
});

test('wrong OTP is rejected and resend invalidates the first code', async ({ page, request }) => {
  const account = buildTestPatient();
  try {
    await registerThroughUi(page, account);
    const firstCode = await latestCode(request, account.email);
    await fillCode(page, firstCode === '999999' ? '888888' : '999999');
    await page.getByRole('button', { name: 'Verify Email' }).click();
    await expect(page.getByRole('alert')).toContainText('incorrect');
    await page.getByRole('button', { name: 'Resend code' }).click();
    await expect(page.getByRole('status')).toContainText('previous code no longer works');
    await fillCode(page, firstCode);
    await page.getByRole('button', { name: 'Verify Email' }).click();
    await expect(page.getByRole('alert')).toContainText(/incorrect|replaced|newest/i);
    await fillCode(page, await latestCode(request, account.email));
    await page.getByRole('button', { name: 'Verify Email' }).click();
    await expect(page.getByRole('heading', { name: 'Email Verified' })).toBeVisible();
  } finally { await cleanupTestPatient(account); }
});

test('unverified Patient login resumes verification and never opens the portal', async ({ page }) => {
  const account = buildTestPatient();
  try {
    await registerThroughUi(page, account);
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/verify-email');
    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();
  } finally { await cleanupTestPatient(account); }
});
