import { test, expect } from '../fixtures/test.js';
import { loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Staff reviews, filters, paginates, and navigates clinic-wide terminal appointment history', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const marker = Date.now().toString(36);
  const patientName = 'E2E Staff History ' + marker;
  const otherPatientName = 'E2E Other Staff ' + marker;
  const reason = index => 'E2E Staff history ' + marker + ' visit ' + index;
  const patient = await staffScenario.createPatient({ display_name: patientName, full_name: patientName });
  const otherPatient = await staffScenario.createPatient({ display_name: otherPatientName, full_name: otherPatientName });
  const doctor = await staffScenario.createDoctor();
  const otherDoctor = await staffScenario.createDoctor();

  for (let index = 1; index <= 11; index += 1) {
    await staffScenario.createAppointment({
      patient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(-index), '09:00'),
      status: index % 3 === 0 ? 'cancelled' : index % 3 === 1 ? 'completed' : 'no_show',
      visit_type: index % 2 === 0 ? 'follow_up' : 'general_consultation',
      reason: reason(index),
      check_in_at: index % 3 === 1 ? new Date() : null,
    });
  }
  await staffScenario.createAppointment({ patient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(-12), '10:00'), status: 'pending', reason: 'Pending ' + marker });
  await staffScenario.createAppointment({ patient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(1), '10:00'), status: 'completed', reason: 'Future terminal ' + marker });
  await staffScenario.createAppointment({ patient: otherPatient, doctor: otherDoctor, slot: staffScenario.slotFor(staffScenario.futureDate(-1), '11:00'), status: 'completed', reason: 'Other Doctor ' + marker });

  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/queue');
  await page.getByRole('button', { name: 'Appointment History' }).click();
  await expect(page.getByRole('button', { name: 'Appointment History' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Patient Search').fill(patientName);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('status').filter({ hasText: '11 appointments found' })).toBeVisible();
  await expect(page.getByText(reason(1), { exact: true })).toBeVisible();
  await expect(page.getByText(reason(10), { exact: true })).toBeVisible();
  await expect(page.getByText(reason(11), { exact: true })).toHaveCount(0);
  await expect(page.getByText('Pending ' + marker)).toHaveCount(0);
  await expect(page.getByText('Future terminal ' + marker)).toHaveCount(0);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText(reason(11), { exact: true })).toBeVisible();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByLabel('Status').selectOption('cancelled');
  await expect(page.locator('.history-list .status-cancelled')).toHaveCount(3);

  await page.getByLabel('Status').selectOption('all');
  await page.getByLabel('Doctor').selectOption(doctor.doctorId);
  await expect(page.getByRole('status').filter({ hasText: '11 appointments found' })).toBeVisible();
  await expect(page.getByText('Other Doctor ' + marker)).toHaveCount(0);
  await page.getByLabel('Visit Type').selectOption('follow_up');
  await expect(page.getByRole('status').filter({ hasText: '5 appointments found' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '5 appointments found' })).toBeVisible();

  await page.getByLabel('Date Range').selectOption('custom');
  await expect(page.getByRole('alert')).toContainText('Choose both From and To dates.');
  await page.getByLabel('Date Range').selectOption('last_30_days');
  await page.getByLabel('Visit Type').selectOption('all');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByRole('status').filter({ hasText: '11 appointments found' })).toBeVisible();
  await page.getByLabel('Doctor').selectOption('all');
  await page.getByLabel('Patient Search').fill(otherPatientName);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 appointment found' })).toBeVisible();
  await expect(page.getByText('Other Doctor ' + marker)).toBeVisible();
  await page.getByLabel('Patient Search').fill(patientName);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('link', { name: 'View Patient Details' }).first().click();
  await expect(page).toHaveURL(`/staff/patients/${patient.patientId}`);

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/staff/queue');
  await page.getByRole('button', { name: 'Appointment History' }).click();
  await expect(page.getByLabel('Date Range')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Patient Details' }).first()).toBeVisible();
  assertBrowserClean();
});
