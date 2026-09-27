import { AuthAccount, Staff, UserProfile } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsStaff, loginThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { browserApi, e2eBaseUrl } from '../helpers/browserApi.js';
import { currentTotp } from '../helpers/totp.js';

test('Admin provisions, updates, deactivates, and reactivates a real Staff account without changing its identity', async ({ page, browser, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  const suffix = adminScenario.marker.slice(0, 8);
  const values = {
    email: `e2e-staff-ui-${adminScenario.marker}@example.invalid`,
    password: `E2e!StaffUi-${adminScenario.marker}`,
    name: `E2E Provisioned Staff ${suffix}`,
    contact: `0920${String(Date.now()).slice(-7)}`,
  };
  await loginAsAdmin(page, seededAdmin, () => currentTotp(seededAdmin.mfaSecret));
  await page.goto('/admin/staff');
  await page.getByRole('button', { name: 'Add Staff' }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(values.email);
  await page.getByRole('textbox', { name: 'Temporary password', exact: true }).fill(values.password);
  await page.getByRole('textbox', { name: 'Staff name', exact: true }).fill(values.name);
  await page.getByRole('textbox', { name: 'Contact number', exact: true }).fill(values.contact);
  await page.getByRole('button', { name: 'Save Staff' }).click();
  await expect(page.getByText('Staff account provisioned successfully.')).toBeVisible();

  const created = await adminScenario.rememberProvisionedAccount(values.email, 'staff');
  const profile = await UserProfile.findById(created.profileId).lean();
  const account = await AuthAccount.findOne({ email: values.email }).select('+password_hash').lean();
  expect(profile.role).toBe('staff');
  expect(account.password_hash).not.toBe(values.password);
  expect(await Staff.exists({ _id: created.roleProfileId })).not.toBeNull();
  expect(await page.getByText(account.password_hash).count()).toBe(0);

  await page.reload();
  await page.getByLabel(/Search by staff name/).fill(values.name);
  await expect(page.getByRole('heading', { name: values.name })).toBeVisible();
  await page.getByRole('button', { name: `Edit ${values.name}` }).click();
  const updatedName = `${values.name} Updated`;
  const updatedContact = `0930${String(Date.now()).slice(-7)}`;
  await page.getByRole('textbox', { name: 'Staff name', exact: true }).fill(updatedName);
  await page.getByRole('textbox', { name: 'Contact number', exact: true }).fill(updatedContact);
  await page.getByRole('button', { name: 'Save Staff' }).click();
  await expect(page.getByText('Staff account updated successfully.')).toBeVisible();
  const updatedProfile = await UserProfile.findById(created.profileId).lean();
  expect(updatedProfile.display_name).toBe(updatedName);
  expect(updatedProfile.contact_number).toBe(updatedContact);

  const protectedUpdate = await browserApi(page, `/api/admin/staff/${created.roleProfileId}`, {
    method: 'PATCH', body: { role: 'admin', password_hash: 'forbidden', user_profile_id: seededAdmin.profileId },
  });
  expect(protectedUpdate.status).toBe(400);
  expect((await UserProfile.findById(created.profileId).lean()).role).toBe('staff');

  const panel = page.locator('section[aria-labelledby="staff-panel-title"]');
  await panel.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText(`${updatedName}'s account is now inactive.`)).toBeVisible();
  const staffContext = await browser.newContext({ baseURL: e2eBaseUrl });
  const staffPage = await staffContext.newPage();
  await loginThroughUi(staffPage, values);
  await expect(staffPage.getByRole('alert')).toContainText('Invalid email or password.');

  await panel.getByRole('button', { name: 'Reactivate' }).click();
  await expect(page.getByText(`${updatedName}'s account is now active.`)).toBeVisible();
  await loginAsStaff(staffPage, values);
  await expect(staffPage).toHaveURL('/staff/dashboard');
  await staffContext.close();
  expect(String((await Staff.findById(created.roleProfileId).lean())._id)).toBe(created.roleProfileId);
  assertBrowserClean();
});
