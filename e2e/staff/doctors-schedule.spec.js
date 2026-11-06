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
  await expect(page.getByRole('heading', { name: 'Doctor Schedule' })).toBeVisible();
  await expect(page.getByRole('heading', { name: doctor.display_name })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Week navigation' })).toBeVisible();
  await expect(page.getByLabel(/Weekly calendar/)).toBeVisible();
  await page.getByRole('link', { name: '← Back to Doctors' }).click();
  await expect(page).toHaveURL('/staff/doctors');
  assertBrowserClean();
});

test('Staff manages working hours, special availability, and time off in the weekly calendar', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const date = staffScenario.futureDate(1);
  const weekday = weekDays[dateOnlyToUtc(date).getUTCDay()];
  await loginAsStaff(page, seededStaff);
  await page.goto(`/staff/doctors/${doctor.doctorId}/schedule`);

  const originalRange = await page.locator('.week-stepper strong').textContent();
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.locator('.week-stepper strong')).not.toHaveText(originalRange);
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.locator('.week-stepper strong')).toHaveText(originalRange);
  await page.getByRole('button', { name: 'Today' }).click();

  await page.getByRole('button', { name: 'Add Working Hours' }).click();
  let dialog = page.getByRole('dialog', { name: 'Add Working Hours' });
  await dialog.getByLabel('Day').selectOption({ label: weekday });
  await dialog.getByLabel('Start').fill('09:00');
  await dialog.getByLabel('End').fill('17:00');
  await dialog.getByRole('button', { name: 'Add Working Hours', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${weekday} time range added.`);
  let workingBlock = page.getByRole('button', { name: /Working Hours.*9:00 AM to 5:00 PM/ }).first();
  await expect(workingBlock).toBeVisible();
  await workingBlock.click();
  await page.getByRole('dialog', { name: 'Working Hours' }).getByRole('button', { name: 'Edit Working Hours' }).click();
  dialog = page.getByRole('dialog', { name: 'Working Hours' });
  await dialog.getByLabel('End').fill('16:30');
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('status')).toContainText(`${weekday} hours updated.`);
  workingBlock = page.getByRole('button', { name: /Working Hours.*9:00 AM to 4:30 PM/ }).first();
  await workingBlock.click();
  await page.getByRole('dialog', { name: 'Working Hours' }).getByRole('button', { name: 'Edit Working Hours' }).click();
  await page.getByRole('dialog', { name: 'Working Hours' }).getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('button', { name: /Working Hours.*disabled/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Working Hours.*disabled/ }).first().click();
  await page.getByRole('dialog', { name: 'Working Hours' }).getByRole('button', { name: 'Edit Working Hours' }).click();
  await page.getByRole('dialog', { name: 'Working Hours' }).getByRole('button', { name: 'Enable' }).click();

  const today = staffScenario.today();
  if (dateOnlyToUtc(today).getUTCDay() === 6) await page.getByRole('button', { name: 'Next week' }).click();
  await page.getByRole('button', { name: 'Add Special Availability' }).click();
  dialog = page.getByRole('dialog', { name: 'Add Special Availability' });
  await dialog.getByLabel('Date').fill(date);
  await dialog.getByLabel('Start').fill('12:00');
  await dialog.getByLabel('End').fill('13:00');
  await dialog.getByRole('button', { name: 'Add Special Availability', exact: true }).click();
  await expect(page.getByRole('button', { name: /Special Availability.*12:00 PM to 1:00 PM/ })).toBeVisible();

  await page.getByRole('button', { name: 'Add Time Off' }).click();
  dialog = page.getByRole('dialog', { name: 'Add Time Off' });
  await dialog.getByLabel('Date').fill(date);
  await dialog.getByLabel('Start').fill('14:00');
  await dialog.getByLabel('End').fill('15:00');
  await dialog.getByLabel('Operational reason').fill('E2E meeting');
  await dialog.getByRole('button', { name: 'Add Time Off', exact: true }).click();
  const timeOffBlock = page.getByRole('button', { name: /Time Off.*2:00 PM to 3:00 PM/ });
  await expect(timeOffBlock).toBeVisible();
  await timeOffBlock.click();
  await expect(page.getByRole('dialog', { name: 'Time Off' }).getByText('E2E meeting')).toBeVisible();
  await page.getByRole('dialog', { name: 'Time Off' }).getByRole('button', { name: 'Remove Time Off' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Add Working Hours' })).toBeVisible();
  const scrollState = await page.getByLabel(/Weekly calendar/).evaluate(node => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));
  expect(scrollState.scrollWidth).toBeGreaterThan(scrollState.clientWidth);
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
  await page.getByRole('button', { name: 'Add Time Off' }).click();
  const timeOff = page.getByRole('dialog', { name: 'Add Time Off' });
  await timeOff.getByLabel('Date').fill(original.date);
  await timeOff.getByLabel('Whole day').check();
  await timeOff.getByLabel('Operational reason').fill('Private E2E operational note');
  await timeOff.getByRole('button', { name: 'Add Time Off', exact: true }).click();

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
