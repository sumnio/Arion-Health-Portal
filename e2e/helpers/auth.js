import { expect } from '@playwright/test';

const dashboards = Object.freeze({
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
});

export async function loginThroughUi(page, account) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Login' }).click();
}

async function loginRole(page, account, role) {
  await loginThroughUi(page, account);
  await expect(page).toHaveURL(dashboards[role]);
}

export const loginAsPatient = (page, account) => loginRole(page, account, 'patient');
export const loginAsDoctor = (page, account) => loginRole(page, account, 'doctor');
export const loginAsStaff = (page, account) => loginRole(page, account, 'staff');

export async function loginAsAdmin(page, account, getTotpCode) {
  await loginThroughUi(page, account);
  await expect(page.getByRole('heading', { name: /Admin Verification|Set Up Admin Verification/ })).toBeVisible();
  const code = await getTotpCode();
  await page.getByLabel('6-digit verification code').fill(code);
  await page.getByRole('button', { name: /Verify and Continue|Finish Setup/ }).click();
  await expect(page).toHaveURL(dashboards.admin);
}

export async function logoutThroughUi(page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/login');
}
