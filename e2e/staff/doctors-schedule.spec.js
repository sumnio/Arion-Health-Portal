import { Appointment, DoctorAvailability, DoctorPublishedAvailability } from '../../server/src/models/index.js';
import { dateOnlyToUtc } from '../../server/src/utils/schedulingTime.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

test('Staff Doctors lists active Doctors with today schedule facts and dedicated navigation', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const inactive = await staffScenario.createDoctor({ profile: { status: 'inactive', display_name: `Inactive Doctor ${staffScenario.marker.slice(0, 8)}` } });
  const patient = await staffScenario.createPatient();
  const today = staffScenario.today();
  await DoctorAvailability.create({ doctor_id: doctor.doctorId, day_of_week: dateOnlyToUtc(today).getUTCDay(), start_time: '00:00', end_time: '23:30', is_active: true });
  await DoctorPublishedAvailability.create({ doctor_id: doctor.doctorId, availability_date: dateOnlyToUtc(today), start_time: '00:00', end_time: '23:30' });
  await Appointment.create({ patient_id: patient.patientId, doctor_id: doctor.doctorId, appointment_at: new Date(`${today}T10:00:00+08:00`), visit_type: 'check_up', reason: 'General health concern', status: 'pending', priority: 'normal', created_by: patient.profileId });

  await loginAsStaff(page, seededStaff);
  await expect(page.getByRole('link', { name: 'Doctors', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Doctors', exact: true }).click();
  await expect(page).toHaveURL('/staff/doctors');
  const card = page.locator('.staff-doctor-card').filter({ has: page.getByRole('heading', { name: doctor.display_name }) });
  await expect(card.getByText(doctor.specialty)).toBeVisible();
  await expect(card.getByText('1', { exact: true })).toBeVisible();
  await expect(card.getByText('Yes', { exact: true })).toBeVisible();
  await expect(page.getByText(inactive.display_name)).toHaveCount(0);
  await card.getByRole('link', { name: 'Manage Schedule' }).click();
  await expect(page).toHaveURL(`/staff/doctors/${doctor.doctorId}/schedule`);
  await expect(page.getByRole('heading', { name: doctor.display_name })).toBeVisible();
  await page.getByRole('link', { name: '← Back to Doctors' }).click();
  await expect(page).toHaveURL('/staff/doctors');
  assertBrowserClean();
});

test('Staff manages working hours, booking dates, and time off through the simplified page', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const date = staffScenario.futureDate(4);
  const weekday = weekDays[dateOnlyToUtc(date).getUTCDay()];
  await loginAsStaff(page, seededStaff);
  await page.goto(`/staff/doctors/${doctor.doctorId}/schedule`);

  const day = page.locator('.working-day').filter({ has: page.getByRole('heading', { name: weekday }) });
  const addRange = day.locator('.add-range');
  await addRange.getByLabel('Start').fill('09:00');
  await addRange.getByLabel('End').fill('12:00');
  await addRange.getByRole('button', { name: 'Add Time Range' }).click();
  await expect(page.getByRole('status')).toContainText(`${weekday} time range added.`);
  await expect(day.getByText(/9:00 AM – 12:00 PM · Enabled/)).toBeVisible();

  const range = day.locator('li').first();
  await range.getByRole('button', { name: 'Edit' }).click();
  await range.getByLabel('End').fill('11:30');
  await range.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText(`${weekday} hours updated.`);
  await day.getByRole('button', { name: 'Disable' }).click();
  await expect(day.getByText(/Disabled/)).toBeVisible();
  await day.getByRole('button', { name: 'Enable' }).click();

  const booking = page.locator('.staff-schedule-section').filter({ has: page.getByRole('heading', { name: 'Available Booking Dates' }) });
  await booking.getByLabel('Date').fill(date);
  await booking.getByLabel('Start').fill('09:00');
  await booking.getByLabel('End').fill('11:00');
  await booking.getByRole('button', { name: 'Add Booking Date' }).click();
  await expect(booking.locator('.schedule-records')).toContainText('9:00 AM – 11:00 AM');

  const timeOff = page.locator('.staff-schedule-section').filter({ has: page.getByRole('heading', { name: 'Time Off / Unavailable' }) });
  await timeOff.getByLabel('Date').fill(date);
  await timeOff.getByLabel('Start').fill('14:00');
  await timeOff.getByLabel('End').fill('15:00');
  await timeOff.getByLabel('Reason').fill('E2E meeting');
  await timeOff.getByRole('button', { name: 'Add Time Off' }).click();
  await expect(timeOff.getByText('E2E meeting')).toBeVisible();

  await addRange.getByRole('button', { name: 'Add Time Range' }).click();
  await expect(page.getByRole('alert')).toContainText('Recurring availability ranges cannot overlap.');
  await booking.getByRole('button', { name: 'Remove' }).click();
  await expect(booking.getByText('No active booking dates.')).toBeVisible();
  await timeOff.getByRole('button', { name: 'Remove' }).click();
  await expect(timeOff.getByText('No current or future time off.')).toBeVisible();
  await day.getByRole('button', { name: 'Delete' }).click();
  await expect(day.getByText('No working hours set.')).toBeVisible();
  assertBrowserClean();
});
