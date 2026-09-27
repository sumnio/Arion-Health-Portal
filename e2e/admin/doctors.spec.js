import { AuthAccount, Doctor, UserProfile } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsDoctor, loginThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { browserApi, e2eBaseUrl } from '../helpers/browserApi.js';
import { currentTotp } from '../helpers/totp.js';

test('Admin provisions, updates, deactivates, and reactivates a real Doctor account without changing its identity', async ({ page, browser, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  const suffix = adminScenario.marker.slice(0, 8);
  const values = {
    email: `e2e-doctor-ui-${adminScenario.marker}@example.invalid`,
    password: `E2e!DoctorUi-${adminScenario.marker}`,
    name: `E2E Provisioned Doctor ${suffix}`,
    contact: `0918${String(Date.now()).slice(-7)}`,
    specialty: 'Family Medicine',
    license: `LIC-UI-${adminScenario.marker}`,
    ptr: `PTR-UI-${adminScenario.marker}`,
  };
  await loginAsAdmin(page, seededAdmin, () => currentTotp(seededAdmin.mfaSecret));
  await page.goto('/admin/doctors');
  await page.getByRole('button', { name: 'Add Doctor' }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(values.email);
  await page.getByRole('textbox', { name: 'Temporary password', exact: true }).fill(values.password);
  await page.getByRole('textbox', { name: 'Doctor name', exact: true }).fill(values.name);
  await page.getByRole('textbox', { name: 'Contact number', exact: true }).fill(values.contact);
  await page.getByRole('textbox', { name: 'Specialty', exact: true }).fill(values.specialty);
  await page.getByRole('textbox', { name: 'License number', exact: true }).fill(values.license);
  await page.getByRole('textbox', { name: 'PTR number', exact: true }).fill(values.ptr);
  await page.getByRole('button', { name: 'Save Doctor' }).click();
  await expect(page.getByText('Doctor account provisioned successfully.')).toBeVisible();

  const created = await adminScenario.rememberProvisionedAccount(values.email, 'doctor');
  const profile = await UserProfile.findById(created.profileId).lean();
  const account = await AuthAccount.findOne({ email: values.email }).select('+password_hash').lean();
  expect(profile.role).toBe('doctor');
  expect(profile.status).toBe('active');
  expect(account.password_hash).not.toBe(values.password);
  expect(await Doctor.exists({ _id: created.roleProfileId })).not.toBeNull();
  expect(await page.getByText(account.password_hash).count()).toBe(0);

  await page.reload();
  await page.getByLabel(/Search by name/).fill(values.name);
  await expect(page.getByRole('heading', { name: values.name })).toBeVisible();
  await page.getByRole('button', { name: `Edit ${values.name}` }).click();
  const updatedName = `${values.name} Updated`;
  await page.getByRole('textbox', { name: 'Doctor name', exact: true }).fill(updatedName);
  await page.getByRole('textbox', { name: 'Specialty', exact: true }).fill('General Medicine');
  await page.getByRole('button', { name: 'Save Doctor' }).click();
  await expect(page.getByText('Doctor profile updated successfully.')).toBeVisible();
  expect((await UserProfile.findById(created.profileId).lean()).display_name).toBe(updatedName);
  expect((await Doctor.findById(created.roleProfileId).lean()).specialty).toBe('General Medicine');

  const protectedUpdate = await browserApi(page, `/api/admin/doctors/${created.roleProfileId}`, {
    method: 'PATCH', body: { role: 'admin', password_hash: 'forbidden', user_profile_id: seededAdmin.profileId },
  });
  expect(protectedUpdate.status).toBe(400);
  expect((await UserProfile.findById(created.profileId).lean()).role).toBe('doctor');

  const panel = page.locator('section[aria-labelledby="doctor-panel-title"]');
  await panel.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText(`${updatedName}'s account is now inactive.`)).toBeVisible();
  expect((await UserProfile.findById(created.profileId).lean()).status).toBe('inactive');

  const doctorContext = await browser.newContext({ baseURL: e2eBaseUrl });
  const doctorPage = await doctorContext.newPage();
  await loginThroughUi(doctorPage, values);
  await expect(doctorPage.getByRole('alert')).toContainText('Invalid email or password.');
  await expect(doctorPage).toHaveURL('/login');

  await panel.getByRole('button', { name: 'Reactivate' }).click();
  await expect(page.getByText(`${updatedName}'s account is now active.`)).toBeVisible();
  expect((await UserProfile.findById(created.profileId).lean()).status).toBe('active');
  await loginAsDoctor(doctorPage, values);
  await expect(doctorPage).toHaveURL('/doctor/dashboard');
  await doctorContext.close();
  expect(String((await Doctor.findById(created.roleProfileId).lean())._id)).toBe(created.roleProfileId);
  assertBrowserClean();
});
