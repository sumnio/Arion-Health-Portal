import { test, expect } from '../fixtures/test.js';
import { loginAsPatient, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

async function openAssistant(page) {
  await page.getByRole('button', { name: 'Open Arion Assistant' }).click();
  return page.getByRole('dialog', { name: 'Arion Assistant' });
}

async function send(panel, message) {
  const input = panel.getByRole('textbox', { name: 'Message Arion Assistant' });
  await input.fill(message);
  await input.press('Enter');
}

test('public assistant appears only on the approved landing and account-help pages', async ({ page }) => {
  for (const path of ['/', '/login', '/register', '/forgot-password']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Open Arion Assistant' })).toBeVisible();
  }
  for (const path of ['/verify-email', '/reset-password', '/unauthorized']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Open Arion Assistant' })).toHaveCount(0);
  }
});

test('public assistant guides an appointment question through categories and back navigation', async ({ page }) => {
  const assertBrowserClean = observeBrowser(page);
  await page.goto('/');
  const panel = await openAssistant(page);
  await expect(panel.getByText("Hi! I'm Arion Assistant. I can help you learn how to use the Arion Health Portal.")).toBeVisible();
  await panel.getByRole('button', { name: 'Appointments' }).click();
  await expect(panel.getByRole('button', { name: 'How do appointments work?' })).toBeFocused();
  await panel.getByRole('button', { name: '← Back to topics' }).click();
  await expect(panel.getByRole('button', { name: 'Getting Started' })).toBeFocused();
  await panel.getByRole('button', { name: 'Appointments' }).click();
  await panel.getByRole('button', { name: 'How do appointments work?' }).click();
  await expect(panel.getByText(/Patient bookings start as Pending/)).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Browse topics' })).toBeVisible();
  assertBrowserClean();
});

test('public assistant gives sign-in guidance instead of personal appointment data', async ({ page }) => {
  await page.goto('/login');
  const panel = await openAssistant(page);
  await send(panel, 'When is my next appointment?');
  await expect(panel.getByText(/sign in to the Patient Portal and open My Appointments/)).toBeVisible();
  await expect(panel.getByText(/cannot access Patient accounts or appointment data/)).toBeVisible();
});

test('public assistant keeps health and emergency handling deterministic', async ({ page }) => {
  await page.goto('/forgot-password');
  const panel = await openAssistant(page);
  await send(panel, 'I have chest pain. How do I reset my password?');
  await expect(panel.getByText(/seek urgent medical attention immediately/)).toBeVisible();
  await expect(panel.getByText(/Forgot Password on Login/)).toHaveCount(0);
});

test('Login public assistant explains Patient password recovery', async ({ page }) => {
  await page.goto('/login');
  const panel = await openAssistant(page);
  await panel.getByRole('button', { name: 'Account Help' }).click();
  await panel.getByRole('button', { name: 'I forgot my password' }).click();
  await expect(panel.getByText(/select Forgot Password on Login to request an email reset link/i)).toBeVisible();
});

test('login replaces public safe mode with a clean authenticated Patient assistant and logout restores a clean public session', async ({ page, seededPatient }) => {
  await page.goto('/login');
  let panel = await openAssistant(page);
  await send(panel, 'How do I register?');
  await expect(panel.getByText(/New Patient accounts/)).toBeVisible();
  await panel.getByRole('button', { name: 'Close Arion Assistant' }).click();

  await loginAsPatient(page, seededPatient);
  panel = await openAssistant(page);
  await expect(panel.getByText("Hi! I'm Arion Assistant. What can I help you with?")).toBeVisible();
  await expect(panel.getByText(/New Patient accounts/)).toHaveCount(0);
  await panel.getByRole('button', { name: 'Close Arion Assistant' }).click();

  await logoutThroughUi(page);
  panel = await openAssistant(page);
  await expect(panel.getByText(/help you learn how to use the Arion Health Portal/)).toBeVisible();
  await expect(panel.getByText(/What can I help you with/)).toHaveCount(0);
});

test('public assistant sends only the message contract and displays safe failures', async ({ page }) => {
  await page.goto('/');
  const panel = await openAssistant(page);
  let requestCount = 0;
  await page.route('**/api/public/assistant/message', async route => {
    requestCount += 1;
    expect(route.request().postDataJSON()).toEqual({ message: 'How do I register?' });
    await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Hidden detail' } }) });
  });
  await panel.getByRole('button', { name: 'Getting Started' }).click();
  await panel.getByRole('button', { name: 'How do I register?' }).click();
  await expect(panel.getByText("You've sent several messages quickly. Please wait a moment before trying again.")).toBeVisible();
  expect(requestCount).toBe(1);
});

test('public assistant stays usable inside a 320-pixel viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/login');
  const panel = await openAssistant(page);
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await expect(panel.getByRole('textbox', { name: 'Message Arion Assistant' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Getting Started' })).toBeVisible();
  await panel.getByRole('button', { name: 'Queue & Clinic Process' }).click();
  await expect(panel.getByRole('button', { name: 'What does Senior/PWD priority mean?' })).toBeVisible();
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
