import { Appointment } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsStaff, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

function checkedInAt(scenario, time) {
  return scenario.slotFor(scenario.today(), time).appointmentAt;
}

test('Staff Dashboard shows accurate operational counts and preserves active-queue order', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const urgent = await staffScenario.createGuestPatient({ full_name: `E2E Dashboard Urgent ${staffScenario.marker.slice(0, 6)}` });
  const senior = await staffScenario.createGuestPatient({ full_name: `E2E Dashboard Senior ${staffScenario.marker.slice(0, 6)}`, dob: new Date('1950-01-01T00:00:00Z') });
  const normal = await staffScenario.createGuestPatient({ full_name: `E2E Dashboard Normal ${staffScenario.marker.slice(0, 6)}` });
  const scheduled = await staffScenario.createGuestPatient({ full_name: `E2E Dashboard Scheduled ${staffScenario.marker.slice(0, 6)}` });
  const completed = await staffScenario.createGuestPatient({ full_name: `E2E Dashboard Completed ${staffScenario.marker.slice(0, 6)}` });
  await staffScenario.createAppointment({ patient: urgent, doctor, slot: staffScenario.slotFor(staffScenario.today(), '09:00'), status: 'confirmed', check_in_at: checkedInAt(staffScenario, '08:30'), priority: 'urgent' });
  await staffScenario.createAppointment({ patient: senior, doctor, slot: staffScenario.slotFor(staffScenario.today(), '09:30'), status: 'confirmed', check_in_at: checkedInAt(staffScenario, '08:31') });
  await staffScenario.createAppointment({ patient: normal, doctor, slot: staffScenario.slotFor(staffScenario.today(), '10:00'), status: 'confirmed', check_in_at: checkedInAt(staffScenario, '08:00') });
  await staffScenario.createAppointment({ patient: scheduled, doctor, slot: staffScenario.slotFor(staffScenario.today(), '10:30'), status: 'pending' });
  await staffScenario.createAppointment({ patient: completed, doctor, slot: staffScenario.slotFor(staffScenario.today(), '11:00'), status: 'completed', check_in_at: checkedInAt(staffScenario, '10:45') });

  await loginAsStaff(page, seededStaff);
  const cardCount = async label => Number(await page.locator('.staff-counts section').filter({ hasText: label }).locator('strong').textContent());
  expect(await cardCount('Today’s Appointments')).toBe(5);
  expect(await cardCount('Active Queue')).toBe(3);
  expect(await cardCount('Urgent')).toBe(1);
  expect(await cardCount('Completed Today')).toBe(1);

  const activeQueue = page.locator('.dashboard-card').filter({ has: page.getByRole('heading', { name: 'Today’s Active Queue' }) });
  const rows = await activeQueue.locator('li').allTextContents();
  expect(rows).toHaveLength(3);
  expect(rows[0]).toContain(urgent.full_name);
  expect(rows[1]).toContain(senior.full_name);
  expect(rows[2]).toContain(normal.full_name);
  await expect(activeQueue).not.toContainText(scheduled.full_name);
  await expect(activeQueue.getByRole('link', { name: 'View Appointment Queue' })).toHaveAttribute('href', '/staff/queue');

  const upcoming = page.locator('.dashboard-card').filter({ has: page.getByRole('heading', { name: 'Upcoming Appointments' }) });
  await expect(upcoming).toContainText(scheduled.full_name);
  await expect(upcoming).toContainText('Scheduled / Pending');
  await expect(page.getByRole('heading', { name: 'Quick Staff Tasks' })).toHaveCount(0);
  await expect(upcoming.getByRole('link', { name: 'View Full Calendar' })).toHaveAttribute('href', '/staff/calendar');
  assertBrowserClean();
});

test('Staff session, dashboard, atomic Confirm Arrival, persistence, and logout use live data', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const patient = await staffScenario.createPatient();
  const appointment = await staffScenario.createAppointment({
    patient,
    doctor,
    slot: staffScenario.slotFor(staffScenario.today(), '12:00'),
    status: 'pending',
    reason: 'E2E calendar confirmation',
  });

  await loginAsStaff(page, seededStaff);
  await expect(page.getByRole('heading', { name: `Welcome, ${seededStaff.display_name}` })).toBeVisible();
  await expect(page.getByText(patient.full_name).first()).toBeVisible();
  await expect(page.getByText(/mock|demo/i)).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL('/staff/dashboard');
  await expect(page.getByText(patient.full_name).first()).toBeVisible();

  await page.goto('/staff/calendar');
  await expect(page.getByText(patient.full_name)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(patient.full_name) }).click();
  await expect(page.getByRole('definition').filter({ hasText: doctor.display_name })).toBeVisible();
  await expect(page.locator('.calendar-details').getByText('Pending', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Arrival' }).click();
  await expect(page.getByText('Arrival confirmed. Patient added to the active queue.', { exact: true })).toBeVisible();
  const arrived = await Appointment.findById(appointment.appointmentId).lean();
  expect(arrived.status).toBe('confirmed');
  expect(arrived.check_in_at).not.toBeNull();

  await page.goto('/staff/queue');
  const waiting = page.locator('section').filter({ has: page.getByRole('heading', { name: /Active Queue/ }) });
  await expect(waiting.getByText(patient.full_name)).toBeVisible();

  await page.goto('/staff/calendar');
  await page.reload();
  await expect(page.getByText(patient.full_name)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(patient.full_name) }).click();
  await expect(page.locator('.calendar-details').getByText('Confirmed', { exact: true })).toBeVisible();
  await expect(page.getByRole('definition').filter({ hasText: 'Arrived / Confirmed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm Arrival' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark No-show' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View in Appointment Queue' })).toBeVisible();
  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page.getByLabel('Selected date')).toHaveValue(staffScenario.futureDate(1));
  await page.getByLabel('Selected date').fill(staffScenario.futureDate(14));
  await expect(page.getByText('No appointments for this date.')).toBeVisible();

  await logoutThroughUi(page);
  await page.goto('/staff/dashboard');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  assertBrowserClean();
});

test('Staff empty dashboard, calendar, queue, and Patient-search states are honest', async ({ page, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  await loginAsStaff(page, seededStaff);
  await expect(page.getByText('No patients are currently in the active queue.')).toBeVisible();
  await expect(page.getByText('No upcoming appointments found.')).toBeVisible();
  await page.goto('/staff/calendar');
  await expect(page.getByText('No appointments for this date.')).toBeVisible();
  await page.goto('/staff/queue');
  await expect(page.getByText('No patients currently waiting.')).toBeVisible();
  await page.goto('/staff/patients');
  await page.getByLabel('Search by patient name or contact number').fill(`missing-${Date.now()}`);
  await expect(page.getByRole('heading', { name: 'No patients found' })).toBeVisible();
  assertBrowserClean();
});
