import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsDoctor, loginAsPatient, loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { currentTotp } from '../helpers/totp.js';

async function expectSharedNotificationJourney(page, { role, title }) {
  const bell = page.getByRole('button', { name: 'Notifications, 1 unread' });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toHaveCount(0);
  await bell.click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View All Notifications' }).click();
  await expect(page).toHaveURL(`/${role}/notifications`);
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Mark ${title} as read` }).click();
  await expect(page.getByText('1 notification · Newest first')).toBeVisible();
  await expect(page.getByRole('button', { name: `Mark ${title} as read` })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Notification filters' }).getByRole('button', { name: /^Unread/ }).click();
  await expect(page.getByRole('heading', { name: 'You have no unread notifications.' })).toBeVisible();
}

test('Patient notification bell, page, read action, and unread filter use the real API', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  await patientScenario.createNotification({ recipient: { ...seededPatient, role: 'patient' }, title: 'Patient schedule update', message: 'Your appointment schedule was updated.' });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Notifications/ })).toHaveCount(0);
  await loginAsPatient(page, seededPatient);
  await expectSharedNotificationJourney(page, { role: 'patient', title: 'Patient schedule update' });
  assertBrowserClean();
});

test('Patient notification page paginates 20 items and marks all unread items read', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  for (let index = 1; index <= 21; index += 1) {
    await patientScenario.createNotification({
      recipient: { ...seededPatient, role: 'patient' },
      title: `Patient notification ${index}`,
      message: `Synthetic appointment update ${index}.`,
    });
  }
  await loginAsPatient(page, seededPatient);
  await expect(page.getByRole('button', { name: 'Notifications, 21 unread' })).toBeVisible();
  await page.goto('/patient/notifications');
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await expect(page.locator('.notification-item').first()).toContainText('Patient notification 21');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Notification filters' }).getByRole('button', { name: /^Unread/ }).click();
  await expect(page.getByRole('heading', { name: 'You have no unread notifications.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
  assertBrowserClean();
});

test('Staff notification bell and page use the Staff recipient inbox', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  await staffScenario.createNotification({ recipient: { ...seededStaff, role: 'staff' }, title: 'Staff appointment update', message: 'An appointment was updated.' });
  await loginAsStaff(page, seededStaff);
  await expectSharedNotificationJourney(page, { role: 'staff', title: 'Staff appointment update' });
  assertBrowserClean();
});

test('Doctor notification bell and page use the Doctor recipient inbox', async ({ page, patientScenario }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  await patientScenario.createNotification({ recipient: { ...doctor, role: 'doctor' }, title: 'Doctor appointment update', message: 'An assigned appointment was updated.' });
  await loginAsDoctor(page, doctor);
  await expectSharedNotificationJourney(page, { role: 'doctor', title: 'Doctor appointment update' });
  assertBrowserClean();
});

test('Admin notification UI appears only after real MFA establishes the Admin session', async ({ page, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  await adminScenario.createNotification({ recipient: { ...seededAdmin, role: 'admin' }, title: 'Admin account update', message: 'An account update is available.' });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(seededAdmin.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(seededAdmin.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('button', { name: /Notifications/ })).toHaveCount(0);
  await page.getByLabel('6-digit verification code').fill(await currentTotp(seededAdmin.mfaSecret));
  await page.getByRole('button', { name: 'Verify and Continue' }).click();
  await expect(page).toHaveURL('/admin/dashboard');
  await expectSharedNotificationJourney(page, { role: 'admin', title: 'Admin account update' });
  assertBrowserClean();
});
