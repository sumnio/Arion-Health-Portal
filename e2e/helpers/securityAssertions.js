import { expect } from '@playwright/test';

export function expectSafeRejection(response, allowedStatuses = [400, 401, 403, 404]) {
  expect(allowedStatuses).toContain(response.status);
  expect(response.status).toBeLessThan(500);
  expect(response.body?.error?.code).toBeTruthy();
  expect(JSON.stringify(response.body)).not.toMatch(/stack|mongodb(?:\+srv)?:\/\/|AUTH_SECRET|password_hash|mfa_secret|signature_path/i);
}

export async function expectEmptyBrowserStorage(page) {
  expect(await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }))).toEqual({ local: [], session: [] });
}

