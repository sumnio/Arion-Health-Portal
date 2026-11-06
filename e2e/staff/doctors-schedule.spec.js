import { Appointment, DoctorAvailability, DoctorPublishedAvailability } from '../../server/src/models/index.js';
import { dateOnlyToUtc, zonedDateTimeToUtc } from '../../server/src/utils/schedulingTime.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsPatient, loginAsStaff, logoutThroughUi } from '../helpers/auth.js';
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
  const scheduleStillActive = zonedDateTimeToUtc(today, '23:30', 'Asia/Manila') > new Date();
  await expect(card.getByText(scheduleStillActive ? 'Yes' : 'No', { exact: true })).toBeVisible();
  await expect(page.getByText(inactive.display_name)).toHaveCount(0);
  await card.getByRole('link', { name: 'Manage Schedule' }).click();
  await expect(page).toHaveURL(`/staff/doctors/${doctor.doctorId}/schedule`);
  await expect(page.getByRole('heading', { name: doctor.display_name })).toBeVisible();
  const clinicClock = page.getByLabel('Clinic date and time');
  await expect(clinicClock).toContainText('Philippine time');
  await expect(clinicClock.locator('time')).toBeVisible();
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
  await expect(day.locator('.schedule-time-value').filter({ hasText: '9:00 AM – 12:00 PM' })).toBeVisible();
  await expect(day.locator('.schedule-status', { hasText: 'Enabled' })).toBeVisible();

  const range = day.locator('li').first();
  const actions = range.locator('.row-actions');
  await expect(actions).toHaveCSS('flex-wrap', 'nowrap');
  let actionBoxes = await actions.getByRole('button').evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return { top: box.y, height: box.height }; }));
  const tops = actionBoxes.map(box => box.top); const heights = actionBoxes.map(box => box.height);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(2);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
  const statusBox = await range.locator('.schedule-status').boundingBox();
  const contentBox = await range.locator('.schedule-range-content').boundingBox();
  expect(statusBox.width).toBeLessThan(contentBox.width / 2);
  let timeBox = await range.locator('.schedule-time-value').boundingBox();
  expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(timeBox.y);
  expect(Math.abs(timeBox.height - actionBoxes[0].height)).toBeLessThan(2);

  await page.setViewportSize({ width: 1000, height: 885 });
  timeBox = await range.locator('.schedule-time-value').boundingBox();
  actionBoxes = await actions.getByRole('button').evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return { top: box.y, height: box.height }; }));
  expect(Math.min(...actionBoxes.map(box => box.top))).toBeGreaterThanOrEqual(timeBox.y + timeBox.height);
  await page.setViewportSize({ width: 1280, height: 720 });
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

test('Doctor time off flags an appointment without moving it and the Patient confirms a suggested replacement', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const patient = await staffScenario.createPatient();
  const original = await staffScenario.createBookableSlot({ doctor, offset: 4, startTime: '10:00', endTime: '11:00' });
  await staffScenario.createBookableSlot({ doctor, offset: 5, startTime: '09:30', endTime: '10:30' });
  const appointment = await staffScenario.createAppointment({ patient, doctor, slot: original, status: 'confirmed' });
  const originalTime = new Date(appointment.appointment_at).toISOString();

  await loginAsStaff(page, seededStaff);
  await page.goto(`/staff/doctors/${doctor.doctorId}/schedule`);
  const timeOff = page.locator('.staff-schedule-section').filter({ has: page.getByRole('heading', { name: 'Time Off / Unavailable' }) });
  await timeOff.getByLabel('Date').fill(original.date);
  await timeOff.getByLabel('Whole day').check();
  await timeOff.getByLabel('Reason').fill('Private E2E operational note');
  await timeOff.getByRole('button', { name: 'Add Time Off' }).click();

  const affected = page.locator('.staff-schedule-section').filter({ has: page.getByRole('heading', { name: 'Appointments needing reschedule: 1' }) });
  await expect(affected.getByText(patient.full_name)).toBeVisible();
  await expect(affected.getByText('Suggested replacement slots')).toBeVisible();
  const flagged = await Appointment.findById(appointment.appointmentId).lean();
  expect(flagged.appointment_at.toISOString()).toBe(originalTime);
  expect(flagged.requires_reschedule_due_to_doctor_unavailability).toBe(true);

  await logoutThroughUi(page);
  await loginAsPatient(page, patient);
  await page.goto(`/patient/appointments/${appointment.appointmentId}`);
  await expect(page.getByRole('heading', { name: 'Doctor unavailable' })).toBeVisible();
  await expect(page.getByText('Private E2E operational note')).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose New Schedule' }).click();
  await expect(page.getByText('Suggested replacements')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm New Schedule' }).click();
  await expect(page.getByRole('status')).toContainText('Appointment rescheduled.');

  const moved = await Appointment.findById(appointment.appointmentId).lean();
  expect(moved.appointment_at.toISOString()).not.toBe(originalTime);
  expect(moved.requires_reschedule_due_to_doctor_unavailability).toBe(false);
  expect(moved.doctor_unavailability_block_ids).toHaveLength(0);
  assertBrowserClean();
});
