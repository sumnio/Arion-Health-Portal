import { AuditLog } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsDoctor, loginAsPatient, loginAsStaff } from '../helpers/auth.js';
import { currentTotp } from '../helpers/totp.js';

test('MFA-authenticated Admin reviews, filters, searches, and paginates read-only audit logs', async ({ page, adminScenario, seededAdmin }) => {
  await loginAsAdmin(page, seededAdmin, () => currentTotp(seededAdmin.mfaSecret));

  const marker = adminScenario.marker;
  const startedAt = Date.now();
  await AuditLog.insertMany(Array.from({ length: 12 }, (_, index) => ({
    actor_user_id: seededAdmin.profileId,
    actor_role: index % 2 ? 'staff' : 'admin',
    actor_display_name_snapshot: `Audit Actor ${marker} ${index}`,
    category: index % 2 ? 'PWD' : 'AUTH',
    action: index % 2 ? 'PWD_VERIFICATION_APPROVED' : 'AUTH_LOGIN_SUCCESS',
    target_type: index % 2 ? 'Patient' : 'Portal account',
    target_id: `audit-target-${marker}-${index}`,
    target_display_snapshot: `Audit Target ${marker} ${index}`,
    result: index % 3 ? 'success' : 'denied',
    safe_metadata: { operation: 'e2e-ui-check' },
    created_at: new Date(startedAt + index * 1000),
  })));

  await page.getByRole('link', { name: 'Audit Logs' }).click();
  await expect(page).toHaveURL('/admin/audit-logs');
  await expect(page.getByRole('heading', { name: 'Audit Logs', exact: true })).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Search actor or target' });
  await search.fill(marker);
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.locator('tbody tr').first()).toContainText(`Audit Actor ${marker} 11`);
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();

  await page.getByLabel('Role').selectOption('staff');
  await expect(page.locator('tbody tr').first()).toContainText('staff');
  await page.getByLabel('Category').selectOption('PWD');
  await expect(page.locator('tbody tr').first()).toContainText('PWD');
  await page.getByLabel('Result').selectOption('success');
  await expect(page.locator('tbody tr').first()).toContainText('Success');

  await page.getByLabel('Action').selectOption('PWD_VERIFICATION_APPROVED');
  await expect(page.locator('tbody tr').first()).toContainText('PWD verification approved');
  await page.getByLabel('Date From').fill(new Date(startedAt).toISOString().slice(0, 10));
  await page.getByLabel('Date To').fill(new Date(startedAt + 86_400_000).toISOString().slice(0, 10));
  await expect(page.locator('tbody tr').first()).toBeVisible();

  await page.getByLabel('Role').selectOption('');
  await page.getByLabel('Category').selectOption('');
  await page.getByLabel('Action').selectOption('');
  await page.getByLabel('Result').selectOption('');
  await page.getByLabel('Date From').fill('');
  await page.getByLabel('Date To').fill('');
  await search.fill(`Audit Actor ${marker} 7`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText(`Audit Actor ${marker} 7`);
  await search.fill(`Audit Target ${marker} 4`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first()).toContainText(`Audit Target ${marker} 4`);

  for (const name of ['Edit', 'Delete', 'Clear Logs', 'Delete All', 'Export']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByText('e2e-ui-check')).toHaveCount(0);

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Audit Logs', exact: true })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('Audit Logs route remains denied to unauthenticated and non-Admin accounts', async ({ browser, page, adminScenario }) => {
  await page.goto('/admin/audit-logs');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);

  const actors = [
    { account: await adminScenario.createStaff(), login: loginAsStaff },
    { account: await adminScenario.createDoctor(), login: loginAsDoctor },
    { account: await adminScenario.createPatient(), login: loginAsPatient },
  ];
  for (const actor of actors) {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
    const actorPage = await context.newPage();
    await actor.login(actorPage, actor.account);
    await actorPage.goto('/admin/audit-logs');
    await expect(actorPage).toHaveURL('/unauthorized');
    await context.close();
  }
});
