import { DoctorAvailability, DoctorBlockedTime, DoctorPublishedAvailability, Appointment } from '../../server/src/models/index.js';
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

function weekdayFor(date) {
  return dateOnlyToUtc(date).getUTCDay();
}

test('Doctor creates, persists, updates, and deletes recurring availability', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const date = patientScenario.futureDate(3);
  const day = weekdayFor(date);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
  await openAvailability(page, seededDoctor);

  const dayCard = page.locator('.availability-day').filter({ has: page.getByRole('heading', { name: weekday }) });
  await dayCard.getByLabel('Start').fill('09:00');
  await dayCard.getByLabel('End').fill('12:00');
  await dayCard.getByRole('button', { name: 'Add Range' }).click();
  await expect(page.getByRole('status')).toContainText(`${weekday} recurring range added.`);
  let stored = await DoctorAvailability.findOne({ doctor_id: seededDoctor.doctorId, day_of_week: day }).lean();
  expect(stored).toMatchObject({ start_time: '09:00', end_time: '12:00', is_active: true });

  await page.reload();
  await page.getByRole('tab', { name: 'Availability' }).click();
  const persistedCard = page.locator('.availability-day').filter({ has: page.getByRole('heading', { name: weekday }) });
  await expect(persistedCard.getByText(/9:00 AM–12:00 PM · Active/)).toBeVisible();
  await persistedCard.getByRole('checkbox', { name: 'Day enabled' }).click();
  await expect(page.getByRole('status')).toContainText(`${weekday} disabled.`);
  stored = await DoctorAvailability.findById(stored._id).lean();
  expect(stored.is_active).toBe(false);

  await page.reload();
  await page.getByRole('tab', { name: 'Availability' }).click();
  const reloadedCard = page.locator('.availability-day').filter({ has: page.getByRole('heading', { name: weekday }) });
  await expect(reloadedCard.getByText(/Inactive/)).toBeVisible();
  await reloadedCard.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status')).toContainText(`${weekday} range removed.`);
  expect(await DoctorAvailability.exists({ _id: stored._id })).toBeNull();
  assertBrowserClean();
});

test('Doctor publishes only inside recurring availability and deletion persists', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const date = patientScenario.futureDate(4);
  await DoctorAvailability.create({
    doctor_id: seededDoctor.doctorId,
    day_of_week: weekdayFor(date),
    start_time: '09:00',
    end_time: '12:00',
    is_active: true,
  });
  await openAvailability(page, seededDoctor);
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Published Availability' }) });
  await section.getByLabel('Date').fill(date);
  await section.getByLabel('Start').fill('09:00');
  await section.getByLabel('End').fill('11:00');
  await section.getByRole('button', { name: 'Publish Range' }).click();
  await expect(page.getByRole('status')).toContainText(`Availability published for ${formatBookingDate(date)}.`);
  const stored = await DoctorPublishedAvailability.findOne({ doctor_id: seededDoctor.doctorId }).lean();
  expect(stored).not.toBeNull();

  await page.reload();
  await page.getByRole('tab', { name: 'Availability' }).click();
  const persistedSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Published Availability' }) });
  await expect(persistedSection.getByText(formatBookingDate(date), { exact: true })).toBeVisible();
  await persistedSection.getByLabel('Start').fill('13:00');
  await persistedSection.getByLabel('End').fill('14:00');
  const [rejectedPublication] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/doctor/published-availability') && response.request().method() === 'POST'),
    persistedSection.getByRole('button', { name: 'Publish Range' }).click(),
  ]);
  expect(rejectedPublication.status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('Published availability must fit within an active recurring range.');
  expect(await DoctorPublishedAvailability.countDocuments({ doctor_id: seededDoctor.doctorId })).toBe(1);

  await persistedSection.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status')).toContainText('Published range removed.');
  expect(await DoctorPublishedAvailability.exists({ _id: stored._id })).toBeNull();
  assertBrowserClean();
});

test('Doctor manages blocked time and an appointment overlap returns 409 without mutation', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient();
  const date = patientScenario.futureDate(5);
  const appointment = await patientScenario.createAppointment({
    patient,
    doctor: seededDoctor,
    slot: patientScenario.slotFor(date, '10:00'),
    status: 'confirmed',
  });
  await openAvailability(page, seededDoctor);
  let section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Blocked Time' }) });
  await section.getByLabel('Date').fill(date);
  await section.getByLabel('Start').fill('14:00');
  await section.getByLabel('End').fill('15:00');
  await section.getByLabel('Reason').fill('E2E meeting');
  await section.getByRole('button', { name: 'Add Block' }).click();
  await expect(page.getByRole('status')).toContainText(`Blocked time added for ${formatBookingDate(date)}.`);
  const stored = await DoctorBlockedTime.findOne({ doctor_id: seededDoctor.doctorId }).lean();
  expect(stored.reason).toBe('E2E meeting');

  await page.reload();
  await page.getByRole('tab', { name: 'Availability' }).click();
  section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Blocked Time' }) });
  await expect(section.getByText('E2E meeting')).toBeVisible();
  await section.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status')).toContainText('Blocked time removed.');
  expect(await DoctorBlockedTime.exists({ _id: stored._id })).toBeNull();

  await section.getByLabel('Date').fill(date);
  await section.getByLabel('Start').fill('09:30');
  await section.getByLabel('End').fill('10:30');
  await section.getByLabel('Reason').fill('E2E conflict');
  const [rejectedBlock] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/doctor/blocked-times') && response.request().method() === 'POST'),
    section.getByRole('button', { name: 'Add Block' }).click(),
  ]);
  expect(rejectedBlock.status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('Blocked time overlaps an existing active appointment.');
  expect(await DoctorBlockedTime.countDocuments({ doctor_id: seededDoctor.doctorId })).toBe(0);
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('confirmed');
  assertBrowserClean();
});
