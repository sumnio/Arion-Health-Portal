import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Doctor login restores its session, shows assigned dashboard data, and logout protects routes', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient();
  const appointment = await patientScenario.createAppointment({
    patient,
    doctor: seededDoctor,
    slot: patientScenario.slotFor(patientScenario.today(), '10:00'),
    status: 'confirmed',
    reason: 'E2E dashboard consultation',
  });

  await loginAsDoctor(page, seededDoctor);
  await expect(page.getByRole('heading', { name: seededDoctor.display_name })).toBeVisible();
  await expect(page.getByText(patient.full_name).first()).toBeVisible();
  await expect(page.getByText('E2E dashboard consultation').first()).toBeVisible();
  const status = page.locator('.dashboard-status').first();
  await expect(status).toHaveCSS('align-items', 'center');
  await expect(status).toHaveCSS('justify-content', 'center');
  await expect(status).toHaveCSS('text-align', 'center');

  await page.reload();
  await expect(page).toHaveURL('/doctor/dashboard');
  await expect(page.getByText(patient.full_name).first()).toBeVisible();
  await page.goto('/doctor/schedule');
  await expect(page.getByText(patient.full_name)).toBeVisible();
  await page.getByRole('link', { name: new RegExp(patient.full_name) }).click();
  await expect(page).toHaveURL(`/doctor/patients/${patient.patientId}`);
  await expect(page.getByText(appointment.reason)).toBeVisible();

  await logoutThroughUi(page);
  await page.goto('/doctor/schedule');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  assertBrowserClean();
});

test('Doctor sees real empty schedule and empty clinical history states', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient();
  await patientScenario.createAppointment({
    patient,
    doctor: seededDoctor,
    slot: patientScenario.slotFor(patientScenario.futureDate(1), '09:00'),
    status: 'confirmed',
  });

  await loginAsDoctor(page, seededDoctor);
  await page.goto('/doctor/schedule');
  await expect(page.getByRole('heading', { name: 'No appointments for this day' })).toBeVisible();
  await page.goto(`/doctor/patients/${patient.patientId}`);
  await page.getByRole('tab', { name: 'Medical Records' }).click();
  await expect(page.getByText('No medical records found.')).toBeVisible();
  await page.getByRole('tab', { name: 'Certificates' }).click();
  await expect(page.getByText('No medical certificates found.')).toBeVisible();
  assertBrowserClean();
});

test('Doctor Patients keeps View Patient usable on a smaller screen', async ({ page, patientScenario, seededDoctor }) => {
  const patient = await patientScenario.createPatient();
  await patientScenario.createAppointment({
    patient,
    doctor: seededDoctor,
    slot: patientScenario.slotFor(patientScenario.today(), '10:00'),
    status: 'cancelled',
  });

  await page.setViewportSize({ width: 815, height: 885 });
  await loginAsDoctor(page, seededDoctor);
  await page.goto('/doctor/patients');

  const link = page.getByRole('link', { name: 'View Patient' });
  await expect(link).toBeVisible();
  await expect(link).toHaveCSS('white-space', 'nowrap');
  const box = await link.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(815);
  await link.click();
  await expect(page).toHaveURL(`/doctor/patients/${patient.patientId}`);
});
