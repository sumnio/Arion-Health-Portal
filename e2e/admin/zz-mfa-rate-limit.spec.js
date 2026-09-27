import { test, expect } from '../fixtures/test.js';
import { loginThroughUi } from '../helpers/auth.js';
import { browserApi } from '../helpers/browserApi.js';

test('repeated invalid Admin MFA codes are safely rate limited without creating a session', async ({ page, adminScenario, seededAdmin }) => {
  await loginThroughUi(page, seededAdmin);
  await expect(page.getByRole('heading', { name: 'Admin Verification' })).toBeVisible();
  let response;
  for (let attempt = 0; attempt <= adminScenario.runtime.mfaVerifyRateLimitMax + 1; attempt += 1) {
    response = await browserApi(page, '/api/auth/mfa/verify', { method: 'POST', body: { code: '000000' } });
    if (response.status === 429) break;
    expect(response.status).toBe(401);
  }
  expect(response.status).toBe(429);
  expect(response.body.error.code).toBe('RATE_LIMITED');
  expect((await browserApi(page, '/api/auth/me')).status).toBe(401);
});
