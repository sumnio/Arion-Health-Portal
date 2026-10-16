import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Doctor reviews, filters, and paginates only their terminal appointment history', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient({
    display_name: 'E2E History Patient',
    full_name: 'E2E History Patient',
  });
  const otherPatient = await patientScenario.createPatient({
    display_name: 'E2E Other History Patient',
    full_name: 'E2E Other History Patient',
  });
  const otherDoctor = await patientScenario.createDoctor();
  const appointments = [];

  for (let index = 1; index <= 11; index += 1) {
    appointments.push(await patientScenario.createAppointment({
      patient,
      doctor: seededDoctor,
      slot: patientScenario.slotFor(patientScenario.futureDate(-index), '09:00'),
      status: index % 3 === 0 ? 'cancelled' : index % 3 === 1 ? 'completed' : 'no_show',
      visit_type: index % 2 === 0 ? 'follow_up' : 'general_consultation',
      reason: `E2E history visit ${index}`,
      check_in_at: index % 3 === 1 ? new Date() : null,
    }));
  }
  await patientScenario.createRecord({ patient, doctor: seededDoctor, appointment: appointments[0], prescriptions: false });
  await patientScenario.createAppointment({ patient, doctor: seededDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(-12), '10:00'), status: 'pending', reason: 'Must stay outside history' });
  await patientScenario.createAppointment({ patient, doctor: seededDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(1), '10:00'), status: 'completed', reason: 'Future terminal must stay outside history' });
  await patientScenario.createAppointment({ patient: otherPatient, doctor: otherDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(-1), '11:00'), status: 'completed', reason: 'Other Doctor private history' });

  await loginAsDoctor(page, seededDoctor);
  await page.goto('/doctor/schedule');
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('status').filter({ hasText: '11 appointments found' })).toBeVisible();
  await expect(page.getByText(/E2E history visit 1$/)).toBeVisible();
  await expect(page.getByText(/E2E history visit 10$/)).toBeVisible();
  await expect(page.getByText(/E2E history visit 11$/)).toHaveCount(0);
  await expect(page.getByText('Must stay outside history')).toHaveCount(0);
  await expect(page.getByText('Future terminal must stay outside history')).toHaveCount(0);
  await expect(page.getByText('Other Doctor private history')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View Medical Record' })).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(/E2E history visit 11$/)).toBeVisible();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByLabel('Status').selectOption('cancelled');
  await expect(page.getByRole('status').filter({ hasText: '3 appointments found' })).toBeVisible();
  await expect(page.locator('.history-list .status-cancelled')).toHaveCount(3);

  await page.getByLabel('Status').selectOption('all');
  await page.getByLabel('Visit Type').selectOption('follow_up');
  await expect(page.getByRole('status').filter({ hasText: '5 appointments found' })).toBeVisible();
  await page.getByLabel('Patient Search').fill('E2E History Patient');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('status').filter({ hasText: '5 appointments found' })).toBeVisible();

  await page.getByLabel('Date Range').selectOption('custom');
  await expect(page.getByRole('alert')).toContainText('Choose both From and To dates.');
  await page.getByLabel('Date Range').selectOption('last_30_days');
  await page.getByLabel('Visit Type').selectOption('all');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByRole('status').filter({ hasText: '11 appointments found' })).toBeVisible();

  await page.getByRole('link', { name: 'View Medical Record' }).click();
  await expect(page).toHaveURL(`/doctor/patients/${patient.patientId}`);
  await expect(page.getByRole('tab', { name: 'Medical Records' })).toHaveAttribute('aria-selected', 'true');

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/doctor/schedule');
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByLabel('Date Range')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Patient' }).first()).toBeVisible();
  assertBrowserClean();
});
