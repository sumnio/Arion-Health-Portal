import { test, expect } from '../fixtures/test.js';
import { loginAsPatient } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Patient uses the session-only Arion Assistant for FAQ and live appointment help', async ({ page, patientScenario, seededPatient, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const slot = await patientScenario.createBookableSlot({ doctor: seededDoctor, offset: 2, startTime: '10:00', endTime: '11:00' });
  await patientScenario.createAppointment({ patient: seededPatient, doctor: seededDoctor, slot, status: 'confirmed' });
  await loginAsPatient(page, seededPatient);

  const launcher = page.getByRole('button', { name: 'Open Arion Assistant' });
  await expect(launcher).toBeVisible();
  await launcher.click();
  const panel = page.getByRole('dialog', { name: 'Arion Assistant' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Arion Assistant provides clinic and portal guidance and does not replace a Doctor.')).toBeVisible();
  await expect(panel.getByText("Hi! I'm Arion Assistant. What can I help you with?")).toBeVisible();
  await panel.getByRole('button', { name: 'My Appointments' }).click();
  await expect(panel.getByRole('button', { name: '← Back to topics' })).toBeVisible();
  await panel.getByRole('button', { name: 'How do I reschedule?' }).click();
  await expect(panel.getByText(/60 minutes/)).toBeVisible();
  await panel.getByRole('button', { name: 'Browse topics' }).click();
  await expect(panel.getByRole('button', { name: 'My Appointments' })).toBeFocused();
  await panel.getByRole('button', { name: 'My Appointments' }).click();
  await panel.getByRole('button', { name: 'When is my next appointment?' }).click();
  await expect(panel.getByText(new RegExp(seededDoctor.display_name))).toBeVisible();

  const input = panel.getByRole('textbox', { name: 'Message Arion Assistant' });
  await input.fill('appointments help me');
  await input.press('Enter');
  await expect(panel.getByText(/explain how to book, reschedule, or cancel/i)).toBeVisible();
  await panel.getByRole('button', { name: 'Browse topics' }).click();
  await panel.getByRole('button', { name: 'Queue & Arrival' }).click();
  await panel.getByRole('button', { name: 'How does the queue work?' }).click();
  await expect(panel.getByText(/Urgent first, then Senior\/PWD, then Normal/)).toBeVisible();
  await input.fill('I have chest pain and need appointment help');
  await input.press('Enter');
  await expect(panel.getByText(/seek urgent medical/)).toBeVisible();
  await panel.getByRole('button', { name: 'Clear chat' }).click();
  await expect(panel.getByText("Hi! I'm Arion Assistant. What can I help you with?")).toBeVisible();
  await expect(panel.getByText(seededDoctor.display_name)).toHaveCount(0);
  await panel.getByRole('button', { name: 'Close Arion Assistant' }).click();
  await expect(launcher).toBeFocused();
  assertBrowserClean();
});

test('Arion Assistant fits a narrow Patient viewport and switches from public to Patient mode after login', async ({ page, seededPatient }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Open Arion Assistant' })).toBeVisible();
  await loginAsPatient(page, seededPatient);
  await page.getByRole('button', { name: 'Open Arion Assistant' }).click();
  const panel = page.getByRole('dialog', { name: 'Arion Assistant' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'My Appointments' })).toBeVisible();
  await panel.getByRole('button', { name: 'About Arion Assistant' }).click();
  await expect(panel.getByRole('button', { name: 'Can you access another Patient?' })).toBeVisible();
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(640);
  await expect(panel.getByRole('textbox', { name: 'Message Arion Assistant' })).toBeVisible();
});

test('Arion Assistant sends a message-only request and presents safe failure states', async ({ page, seededPatient }) => {
  await loginAsPatient(page, seededPatient);
  await page.getByRole('button', { name: 'Open Arion Assistant' }).click();
  const panel = page.getByRole('dialog', { name: 'Arion Assistant' });
  const endpoint = '**/api/patient/assistant/message';
  let requestCount = 0;
  await page.route(endpoint, async route => {
    requestCount += 1;
    expect(route.request().postDataJSON()).toEqual({ message: 'How does the queue work?' });
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Internal detail' } }) });
  });
  await panel.getByRole('button', { name: 'Queue & Arrival' }).click();
  await panel.getByRole('button', { name: 'How does the queue work?' }).click();
  await expect(panel.getByRole('status')).toContainText('thinking');
  await expect(panel.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await expect(panel.getByText("You've sent several messages quickly. Please wait a moment before trying again.")).toBeVisible();
  expect(requestCount).toBe(1);

  await panel.getByRole('button', { name: 'Clear chat' }).click();
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const input = panel.getByRole('textbox', { name: 'Message Arion Assistant' });
  await input.fill('Portal help');
  await input.press('Enter');
  await expect(panel.getByText('Arion Assistant is temporarily unavailable. Please try again, or use the Patient Portal directly.')).toBeVisible();

  await panel.getByRole('button', { name: 'Clear chat' }).click();
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.abort('failed'));
  await input.fill('Account help');
  await input.press('Enter');
  await expect(panel.getByText('Arion Assistant is temporarily unavailable. Please try again, or use the Patient Portal directly.')).toBeVisible();
});
