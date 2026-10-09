import { test, expect } from '../fixtures/test.js';
import { loginThroughUi } from '../helpers/auth.js';
import { browserApi } from '../helpers/browserApi.js';

// Keep every MFA-focused test in the same artifact-safe worker group so this
// intentionally exhausting case remains last and cannot affect Admin journeys.
test.use({ trace: 'off', screenshot: 'off' });

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
