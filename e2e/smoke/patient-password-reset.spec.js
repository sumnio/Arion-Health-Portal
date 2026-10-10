import { test, expect } from '../fixtures/test.js';
import { buildTestPatient, cleanupTestPatient } from '../helpers/testData.js';
import { e2eApiUrl } from '../helpers/browserApi.js';
import { connectDatabase, disconnectDatabase } from '../../server/src/config/database.js';
import { AuthAccount, PasswordResetToken } from '../../server/src/models/index.js';
import { getE2eRuntimeConfig } from '../../server/scripts/e2eEnvironment.js';

const captureKey = process.env.E2E_EMAIL_CAPTURE_KEY || 'arion-e2e-email-capture-only';
const genericMessage =
  'If a Patient account exists for that email, password reset instructions have been sent.';

async function requestReset(page, email) {
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(genericMessage, { exact: true })).toBeVisible();
}

async function latestResetUrl(request, email) {
  const response = await request.get(`${e2eApiUrl}/api/e2e/email-capture/latest`, {
    params: { recipient: email, type: 'password_reset' },
    headers: { 'x-e2e-capture-key': captureKey },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).reset_url;
}

async function expectNoResetDelivery(request, email) {
  const response = await request.get(`${e2eApiUrl}/api/e2e/email-capture/latest`, {
    params: { recipient: email, type: 'password_reset' },
    headers: { 'x-e2e-capture-key': captureKey },
  });
  expect(response.status()).toBe(404);
}

async function expireLatestReset(email) {
  await connectDatabase(getE2eRuntimeConfig().mongoUri);
  try {
    const account = await AuthAccount.findOne({ email }).select('_id').lean();
    const reset = await PasswordResetToken.findOne({ account_id: account._id })
      .sort({ created_at: -1 })
      .select('_id')
      .lean();
    await PasswordResetToken.updateOne({ _id: reset._id }, { $set: { expires_at: new Date(0) } });
  } finally {
    await disconnectDatabase();
  }
}

test('Patient resets password through a one-time link and the old session and password stop working', async ({ page, request, patientAccount }) => {
  const replacement = `${patientAccount.password}-reset`;
  await page.goto('/login');
  await page.getByLabel('Email').fill(patientAccount.email);
  await page.getByLabel('Password', { exact: true }).fill(patientAccount.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL('/patient/dashboard');
  const originalAuth = (await page.context().cookies()).find(cookie => cookie.name === 'arion_auth');
  await page.context().clearCookies();

  await requestReset(page, patientAccount.email);
  const resetUrl = await latestResetUrl(request, patientAccount.email);
  await page.goto(resetUrl);
  await expect(page).toHaveURL('/reset-password');
  await expect(page.url()).not.toContain('token=');
  await expect(page.getByRole('heading', { name: 'Create a new password' })).toBeVisible();
  await page.getByLabel('New Password', { exact: true }).fill(replacement);
  await page.getByLabel('Confirm New Password', { exact: true }).fill(replacement);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.getByRole('heading', { name: 'Password reset successful' })).toBeVisible();
  const oldSession = await request.get(`${e2eApiUrl}/api/auth/me`, {
    headers: { cookie: `arion_auth=${originalAuth.value}` },
  });
  expect(oldSession.status()).toBe(401);
  await page.getByRole('link', { name: 'Continue to Login' }).click();

  await page.getByLabel('Email').fill(patientAccount.email);
  await page.getByLabel('Password', { exact: true }).fill(patientAccount.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await page.getByLabel('Password', { exact: true }).fill(replacement);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL('/patient/dashboard');

  await page.context().clearCookies();
  await page.goto(resetUrl);
  await expect(page).toHaveURL('/reset-password');
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
});

test('unknown and Staff emails receive the same confirmation but no reset delivery', async ({ page, request, seededStaff }) => {
  const unknown = `e2e-unknown-${Date.now()}@example.invalid`;
  for (const email of [unknown, seededStaff.email]) {
    await requestReset(page, email);
    await expectNoResetDelivery(request, email);
  }
});

test('expired reset link is rejected with a safe message', async ({ page, request, patientAccount }) => {
  await requestReset(page, patientAccount.email);
  const resetUrl = await latestResetUrl(request, patientAccount.email);
  await expireLatestReset(patientAccount.email);
  await page.goto(resetUrl);
  await expect(page).toHaveURL('/reset-password');
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
  await expect(page.getByText('This password reset link is invalid or has expired.')).toBeVisible();
});

test('unverified Patient stays in email verification after resetting the password', async ({ page, request }) => {
  const account = buildTestPatient();
  const replacement = `${account.password}-reset`;
  try {
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

    await requestReset(page, account.email);
    await page.goto(await latestResetUrl(request, account.email));
    await expect(page).toHaveURL('/reset-password');
    await page.getByLabel('New Password', { exact: true }).fill(replacement);
    await page.getByLabel('Confirm New Password', { exact: true }).fill(replacement);
    await page.getByRole('button', { name: 'Reset Password' }).click();
    await page.getByRole('link', { name: 'Continue to Login' }).click();
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(replacement);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('/verify-email');
    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();
  } finally {
    await cleanupTestPatient(account);
  }
});
