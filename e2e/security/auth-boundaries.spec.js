import { UserProfile } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsDoctor, loginAsPatient, loginAsStaff, loginThroughUi } from '../helpers/auth.js';
import { browserApi, e2eBaseUrl } from '../helpers/browserApi.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { expectEmptyBrowserStorage, expectSafeRejection } from '../helpers/securityAssertions.js';
import { currentTotp } from '../helpers/totp.js';

const protectedFamilies = [
  ['/patient/dashboard', '/api/patient/profile'],
  ['/doctor/dashboard', '/api/doctor/appointments'],
  ['/staff/dashboard', '/api/staff/queue'],
  ['/admin/dashboard', '/api/admin/doctors'],
];

test('unauthenticated browser navigation and APIs are denied for every role family', async ({ page }) => {
  const assertBrowserClean = observeBrowser(page);
  await page.goto('/');
  for (const [route, api] of protectedFamilies) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    const response = await browserApi(page, api);
    expectSafeRejection(response, [401]);
  }
  assertBrowserClean();
});

test('active Patient, Doctor, and Staff sessions lose protected access after deactivation', async ({ browser, adminScenario }) => {
  const actors = [
    { account: await adminScenario.createPatient(), login: loginAsPatient, api: '/api/patient/profile', route: '/patient/dashboard' },
    { account: await adminScenario.createDoctor(), login: loginAsDoctor, api: '/api/doctor/appointments', route: '/doctor/dashboard' },
    { account: await adminScenario.createStaff(), login: loginAsStaff, api: '/api/staff/queue', route: '/staff/dashboard' },
  ];
  for (const actor of actors) {
    const context = await browser.newContext({ baseURL: e2eBaseUrl });
    const page = await context.newPage();
    const assertBrowserClean = observeBrowser(page);
    await actor.login(page, actor.account);
    await UserProfile.updateOne({ _id: actor.account.profileId }, { $set: { status: 'inactive' } });
    expectSafeRejection(await browserApi(page, actor.api), [403]);
    await page.goto(actor.route);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    assertBrowserClean();
    await context.close();
  }
});

test('Admin password step alone grants no Admin session or mutation access', async ({ page, context, adminScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const admin = await adminScenario.createAdmin({ enrolled: true });
  const doctor = await adminScenario.createDoctor();
  await loginThroughUi(page, admin);
  await expect(page.getByRole('heading', { name: 'Admin Verification' })).toBeVisible();
  expectSafeRejection(await browserApi(page, '/api/admin/doctors'), [401]);
  expectSafeRejection(await browserApi(page, '/api/admin/staff', {
    method: 'POST', body: { email: 'e2e-denied@example.invalid', password: 'NeverStored!1', display_name: 'Denied', contact_number: '09170000000' },
  }), [401]);
  expectSafeRejection(await browserApi(page, `/api/admin/doctors/${doctor.doctorId}/deactivate`, { method: 'PATCH' }), [401]);
  expect((await UserProfile.findById(doctor.profileId).lean()).status).toBe('active');
  const denied = await context.newPage();
  await denied.goto('/admin/dashboard');
  await expect(denied).toHaveURL(/\/login(?:\?|$)/);
  await denied.close();
  assertBrowserClean();
});

test('wrong-role frontend guards deny every cross-role route and sessions use no browser token storage', async ({ browser, adminScenario }) => {
  const patient = await adminScenario.createPatient();
  const doctor = await adminScenario.createDoctor();
  const staff = await adminScenario.createStaff();
  const admin = await adminScenario.createAdmin({ enrolled: true });
  const actors = [
    { account: patient, login: loginAsPatient, denied: ['/doctor/dashboard', '/staff/dashboard', '/admin/dashboard'] },
    { account: doctor, login: loginAsDoctor, denied: ['/patient/dashboard', '/staff/dashboard', '/admin/dashboard'] },
    { account: staff, login: loginAsStaff, denied: ['/patient/dashboard', '/doctor/dashboard', '/admin/dashboard'] },
    { account: admin, login: (page, value) => loginAsAdmin(page, value, () => currentTotp(value.mfaSecret)), denied: ['/patient/dashboard', '/doctor/dashboard', '/staff/dashboard'] },
  ];
  for (const actor of actors) {
    const context = await browser.newContext({ baseURL: e2eBaseUrl });
    const page = await context.newPage();
    const assertBrowserClean = observeBrowser(page);
    await actor.login(page, actor.account);
    await expectEmptyBrowserStorage(page);
    for (const route of actor.denied) {
      await page.goto(route);
      await expect(page).toHaveURL('/unauthorized');
    }
    assertBrowserClean();
    await context.close();
  }
});
