import { DoctorAvailability, DoctorBlockedTime, DoctorPublishedAvailability } from '../../server/src/models/index.js';
import { dateOnlyToUtc } from '../../server/src/utils/schedulingTime.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { formatBookingDate } from '../../src/services/dateTimeService.js';

async function openAvailability(page, doctor) {
  await loginAsDoctor(page, doctor);
  await page.goto('/doctor/schedule');
  await page.getByRole('tab', { name: 'Availability' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly Recurring Availability' })).toBeVisible();
}

async function browserApi(page, path, options = {}) {
  return page.evaluate(async ({ requestPath, requestOptions }) => {
    const response = await fetch(requestPath, {
      method: requestOptions.method ?? 'GET',
      credentials: 'include',
      headers: requestOptions.body ? { 'content-type': 'application/json' } : undefined,
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
    });
    return { status: response.status };
  }, { requestPath: path, requestOptions: options });
}

test('Doctor sees a read-only schedule managed by Staff', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const date = patientScenario.futureDate(3);
  await DoctorAvailability.create({ doctor_id: seededDoctor.doctorId, day_of_week: dateOnlyToUtc(date).getUTCDay(), start_time: '09:00', end_time: '12:00', is_active: true });
  await DoctorPublishedAvailability.create({ doctor_id: seededDoctor.doctorId, availability_date: dateOnlyToUtc(date), start_time: '09:00', end_time: '12:00' });
  await DoctorBlockedTime.create({ doctor_id: seededDoctor.doctorId, start_at: new Date(`${date}T04:00:00.000Z`), end_at: new Date(`${date}T05:00:00.000Z`), reason: 'E2E meeting' });

  await openAvailability(page, seededDoctor);
  await expect(page.getByText('Read-only schedule · Staff manages Doctor availability and blocked time.')).toBeVisible();
  await expect(page.getByText(formatBookingDate(date), { exact: true })).toHaveCount(2);
  await expect(page.getByText('E2E meeting')).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Range|Publish Range|Add Block|Remove/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  assertBrowserClean();
});

test('Doctor mutation endpoints are unavailable while own schedule reads remain available', async ({ page, seededDoctor }) => {
  await loginAsDoctor(page, seededDoctor);
  expect((await browserApi(page, '/api/doctor/availability')).status).toBe(200);
  expect((await browserApi(page, '/api/doctor/availability', { method: 'POST', body: { day_of_week: 1, start_time: '09:00', end_time: '12:00' } })).status).toBe(404);
});
