import { Appointment, AppointmentPriorityAudit } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor, loginAsStaff, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { browserApi } from '../helpers/browserApi.js';

function checkedInAt(scenario, time) {
  return scenario.slotFor(scenario.today(), time).appointmentAt;
}

test('Staff confirms arrival once and the waiting queue persists without duplicate entries', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const patient = await staffScenario.createGuestPatient();
  const appointment = await staffScenario.createAppointment({
    patient,
    doctor,
    slot: staffScenario.slotFor(staffScenario.today(), '13:00'),
    status: 'confirmed',
  });
  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/queue');
  await page.getByRole('button', { name: new RegExp(patient.full_name) }).click();
  await page.getByRole('button', { name: 'Confirm Arrival' }).click();
  await expect(page.getByText(`${patient.full_name} arrival confirmed.`)).toBeVisible();
  const checkedIn = await Appointment.findById(appointment.appointmentId).lean();
  expect(checkedIn.check_in_at).not.toBeNull();
  await page.reload();
  const waiting = page.locator('section').filter({ has: page.getByRole('heading', { name: /Active Queue/ }) });
  await expect(waiting.getByText(patient.full_name)).toBeVisible();
  await expect(waiting.getByText(patient.full_name)).toHaveCount(1);

  const rejected = await browserApi(page, `/api/staff/appointments/${appointment.appointmentId}/check-in`, { method: 'PATCH' });
  expect(rejected.status).toBe(409);
  expect(rejected.body.error.code).toBe('CHECK_IN_NOT_ALLOWED');
  expect((await Appointment.findById(appointment.appointmentId).lean()).check_in_at.toISOString()).toBe(checkedIn.check_in_at.toISOString());
  assertBrowserClean();
});

test('Queue order is Urgent then one Senior/PWD tier then Normal, and priority updates persist', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const urgent = await staffScenario.createGuestPatient({ full_name: `E2E Urgent ${staffScenario.marker.slice(0, 6)}` });
  const senior = await staffScenario.createGuestPatient({ full_name: `E2E Senior ${staffScenario.marker.slice(0, 6)}`, dob: new Date('1950-01-01T00:00:00Z') });
  const pwd = await staffScenario.createGuestPatient({ full_name: `E2E PWD ${staffScenario.marker.slice(0, 6)}`, is_pwd: true });
  const both = await staffScenario.createGuestPatient({ full_name: `E2E Both ${staffScenario.marker.slice(0, 6)}`, dob: new Date('1950-01-01T00:00:00Z'), is_pwd: true });
  const normal = await staffScenario.createGuestPatient({ full_name: `E2E Normal ${staffScenario.marker.slice(0, 6)}` });
  const entries = [
    [urgent, '09:00', '08:30', 'urgent'],
    [senior, '09:30', '08:31', 'normal'],
    [pwd, '10:00', '08:32', 'normal'],
    [both, '10:30', '08:33', 'normal'],
    [normal, '11:00', '08:00', 'normal'],
  ];
  const appointments = [];
  for (const [patient, appointmentTime, checkInTime, priority] of entries) {
    appointments.push(await staffScenario.createAppointment({
      patient,
      doctor,
      slot: staffScenario.slotFor(staffScenario.today(), appointmentTime),
      status: 'confirmed',
      check_in_at: checkedInAt(staffScenario, checkInTime),
      reason: 'E2E queue order',
      priority,
    }));
  }

  await loginAsStaff(page, seededStaff);
  expect(await Appointment.countDocuments({ _id: { $in: appointments.map(item => item.appointmentId) } })).toBe(5);
  const queueResponse = await browserApi(page, '/api/staff/queue');
  expect(queueResponse.status).toBe(200);
  expect(queueResponse.body.queue).toHaveLength(5);
  await page.goto('/staff/queue');
  const waiting = page.locator('section').filter({ has: page.getByRole('heading', { name: /Active Queue/ }) });
  await expect(waiting.locator('.queue-patient')).toHaveCount(5);
  const rows = await waiting.locator('.queue-patient').allTextContents();
  const position = name => rows.findIndex(text => text.includes(name));
  expect(position(urgent.full_name)).toBeLessThan(position(senior.full_name));
  expect(position(senior.full_name)).toBeLessThan(position(pwd.full_name));
  expect(position(pwd.full_name)).toBeLessThan(position(both.full_name));
  expect(position(both.full_name)).toBeLessThan(position(normal.full_name));
  for (const patient of [senior, pwd, both]) {
    await expect(waiting.getByRole('button', { name: new RegExp(patient.full_name) })).toContainText('Senior / PWD');
  }

  await waiting.getByRole('button', { name: new RegExp(normal.full_name) }).click();
  await page.getByRole('button', { name: 'Mark Urgent' }).click();
  await expect(page.getByRole('button', { name: 'Confirm Urgent' })).toBeDisabled();
  await page.getByLabel('Urgent reason').selectOption('Severe pain or discomfort');
  await page.getByRole('button', { name: 'Confirm Urgent' }).click();
  await expect(page.getByText('Queue priority updated and audit history recorded.')).toBeVisible();
  expect((await Appointment.findById(appointments[4].appointmentId).lean()).priority).toBe('urgent');
  let audits = await AppointmentPriorityAudit.find({ appointment_id: appointments[4].appointmentId }).sort({ created_at: 1 }).lean();
  expect(audits).toHaveLength(1);
  expect(audits[0].urgency_reason).toBe('Severe pain or discomfort');
  expect(String(audits[0].staff_actor_user_profile_id)).toBe(seededStaff.profileId);
  await page.reload();
  const refreshedWaiting = page.locator('section').filter({ has: page.getByRole('heading', { name: /Active Queue/ }) });
  await expect(refreshedWaiting.locator('.queue-patient')).toHaveCount(5);
  const refreshedRows = await refreshedWaiting.locator('.queue-patient').allTextContents();
  expect(refreshedRows[0]).toContain(normal.full_name);
  expect(refreshedRows.findIndex(text => text.includes(urgent.full_name))).toBeLessThan(refreshedRows.findIndex(text => text.includes(senior.full_name)));
  await refreshedWaiting.getByRole('button', { name: new RegExp(normal.full_name) }).click();
  await page.getByRole('button', { name: 'Set Normal' }).click();
  await expect(page.getByRole('button', { name: 'Confirm Normal' })).toBeDisabled();
  await page.getByLabel('Correction reason').fill('Urgent priority was selected for the wrong patient.');
  await page.getByRole('button', { name: 'Confirm Normal' }).click();
  await expect(page.getByText('Queue priority updated and audit history recorded.')).toBeVisible();
  audits = await AppointmentPriorityAudit.find({ appointment_id: appointments[4].appointmentId }).sort({ created_at: 1 }).lean();
  expect(audits).toHaveLength(2);
  expect(audits[0].urgency_reason).toBe('Severe pain or discomfort');
  expect(audits[1].correction_reason).toBe('Urgent priority was selected for the wrong patient.');
  await logoutThroughUi(page);
  await loginAsDoctor(page, doctor);
  await page.goto(`/doctor/patients/${normal.patientId}`);
  await expect(page.getByRole('heading', { name: 'Urgency History' })).toBeVisible();
  await expect(page.getByText('Severe pain or discomfort')).toBeVisible();
  await expect(page.getByText('Urgent priority was selected for the wrong patient.')).toBeVisible();
  assertBrowserClean();
});

test('Staff marks an eligible appointment no-show and terminal states reject repetition', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await staffScenario.createDoctor();
  const patients = await Promise.all([0, 1, 2, 3].map(index => staffScenario.createGuestPatient({ full_name: `E2E NoShow ${index} ${staffScenario.marker.slice(0, 6)}` })));
  const statuses = ['confirmed', 'completed', 'cancelled', 'no_show'];
  const appointments = [];
  for (let index = 0; index < statuses.length; index += 1) {
    appointments.push(await staffScenario.createAppointment({
      patient: patients[index],
      doctor,
      slot: staffScenario.slotFor(staffScenario.today(), `0${index}:00`),
      status: statuses[index],
    }));
  }
  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/queue');
  await page.getByRole('button', { name: new RegExp(patients[0].full_name) }).click();
  await page.getByRole('button', { name: 'Mark No-show' }).click();
  await page.getByRole('button', { name: 'Confirm no-show' }).click();
  await expect(page.getByText(`${patients[0].full_name} marked no-show.`)).toBeVisible();
  expect((await Appointment.findById(appointments[0].appointmentId).lean()).status).toBe('no_show');
  await page.reload();
  await expect(page.getByText(patients[0].full_name)).toBeVisible();

  for (const appointment of appointments.slice(1)) {
    const rejected = await browserApi(page, `/api/staff/appointments/${appointment.appointmentId}/no-show`, { method: 'PATCH' });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('NO_SHOW_NOT_ALLOWED');
  }
  await page.getByRole('button', { name: new RegExp(patients[1].full_name) }).click();
  await expect(page.getByRole('button', { name: 'Mark No-show' })).toHaveCount(0);
  assertBrowserClean();
});
