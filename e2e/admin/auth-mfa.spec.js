import { AuthAccount } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsPatient, loginThroughUi, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { browserApi } from '../helpers/browserApi.js';
import { currentTotp, invalidTotp } from '../helpers/totp.js';

// Enrollment renders a one-time setup key. Failure artifacts are disabled so it can never enter a trace or screenshot.
test.use({ trace: 'off', screenshot: 'off' });

async function expectNoBrowserTokens(page) {
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storage).toEqual({ local: [], session: [] });
}

test('first-time Admin enrolls real MFA before receiving access, persists its session, and cannot replay the challenge', async ({ page, context, adminScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const admin = await adminScenario.createAdmin();
  await loginThroughUi(page, admin);
  await expect(page.getByRole('heading', { name: 'Set Up Admin Verification' })).toBeVisible();
  await expect(page.getByAltText('Authenticator setup QR code')).toBeVisible();
  expect((await browserApi(page, '/api/auth/me')).status).toBe(401);

  const deniedPage = await context.newPage();
  await deniedPage.goto('/admin/dashboard');
  await expect(deniedPage).toHaveURL(/\/login(?:\?|$)/);
  await deniedPage.close();

  const challenge = (await context.cookies()).find(cookie => cookie.name === 'arion_mfa_challenge');
  expect(challenge?.httpOnly).toBe(true);
  const secret = await adminScenario.pendingMfaSecret(admin.profileId);
  const code = await currentTotp(secret);
  await page.getByLabel('6-digit verification code').fill(code);
  await page.getByRole('button', { name: 'Finish Setup' }).click();
  await expect(page).toHaveURL('/admin/dashboard');
  await expect(page.getByText(`Welcome, ${admin.display_name}.`)).toBeVisible();
  await expectNoBrowserTokens(page);

  const account = await AuthAccount.findOne({ user_profile_id: admin.profileId })
    .select('+mfa_secret_encrypted +mfa_challenge_hash')
    .lean();
  expect(account.mfa_enabled).toBe(true);
  expect(account.mfa_secret_encrypted).not.toBe(secret);
  expect(account.mfa_challenge_hash ?? null).toBeNull();
  await page.reload();
  await expect(page).toHaveURL('/admin/dashboard');

  await context.addCookies([challenge]);
  const replay = await browserApi(page, '/api/auth/mfa/verify-setup', { method: 'POST', body: { code } });
  expect(replay.status).toBe(401);
  expect(replay.body.error.code).toBe('MFA_CHALLENGE_INVALID');
  assertBrowserClean();
});

test('enrolled Admin completes TOTP login, sees real dashboard data, restores the session, and logs out', async ({ page, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await adminScenario.createDoctor();
  const staff = await adminScenario.createStaff();
  await adminScenario.createPatient();
  await loginAsAdmin(page, seededAdmin, () => currentTotp(seededAdmin.mfaSecret));
  await expect(page.getByText(`Welcome, ${seededAdmin.display_name}.`)).toBeVisible();
  await expect(page.getByText(doctor.display_name)).toBeVisible();
  await expect(page.getByText(staff.display_name)).toBeVisible();
  await expect(page.getByText(/mock|demo/i)).toHaveCount(0);
  await expectNoBrowserTokens(page);
  await page.reload();
  await expect(page).toHaveURL('/admin/dashboard');
  await expect(page.getByText(`Welcome, ${seededAdmin.display_name}.`)).toBeVisible();
  await logoutThroughUi(page);
  expect((await browserApi(page, '/api/auth/me')).status).toBe(401);
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  assertBrowserClean();
});

test('invalid and expired Admin MFA challenges fail without creating an authenticated session', async ({ page, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  await loginThroughUi(page, seededAdmin);
  await expect(page.getByRole('heading', { name: 'Admin Verification' })).toBeVisible();
  const valid = await currentTotp(seededAdmin.mfaSecret);
  await page.getByLabel('6-digit verification code').fill(invalidTotp(valid));
  await page.getByRole('button', { name: 'Verify and Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid or expired');
  expect((await browserApi(page, '/api/auth/me')).status).toBe(401);
  expect((await browserApi(page, '/api/admin/doctors')).status).toBe(401);

  await adminScenario.expireMfaChallenge(seededAdmin.profileId);
  await page.getByLabel('6-digit verification code').fill(valid);
  await page.getByRole('button', { name: 'Verify and Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('missing, expired, or already used');
  expect((await browserApi(page, '/api/auth/me')).status).toBe(401);
  assertBrowserClean();
});

test('a non-Admin authenticated role cannot open Admin pages', async ({ page, adminScenario }) => {
  const patient = await adminScenario.createPatient();
  await loginAsPatient(page, patient);
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL('/unauthorized');
});
