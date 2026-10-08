import { test, expect } from '../fixtures/test.js';
import { loginAsPatient } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { DEFAULT_E2E_API_URL, loadE2eEnvironment } from '../../server/scripts/e2eEnvironment.js';
import { formatBookingDate, formatSlot } from '../../src/services/dateTimeService.js';

loadE2eEnvironment();
const apiURL = process.env.E2E_API_URL || DEFAULT_E2E_API_URL;

async function cancelViaBrowserFetch(page, appointmentId) {
  return page.evaluate(async ({ apiURL: origin, appointmentId: id }) => {
    const response = await fetch(`${origin}/api/patient/appointments/${id}/cancel`, {
      method: 'PATCH',
      credentials: 'include',
    });
    return response.status;
  }, { apiURL, appointmentId });
}

test('Patient cancels an eligible appointment and cancellation persists', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor });
  const appointment = await patientScenario.createAppointment({ patient: seededPatient, doctor, slot });

  await loginAsPatient(page, seededPatient);
  await page.goto(`/patient/appointments/${appointment.appointmentId}`);
  await page.getByRole('button', { name: 'Cancel Appointment' }).click();
  await page.getByRole('button', { name: 'Confirm Cancellation' }).click();
  await expect(page.getByRole('status')).toContainText('Appointment cancelled.');
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel Appointment' })).toHaveCount(0);
  assertBrowserClean();
});

test('Patient reschedules an eligible appointment in place and sees pending status', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor, startTime: '10:00', endTime: '11:00' });
  const appointment = await patientScenario.createAppointment({ patient: seededPatient, doctor, slot, status: 'confirmed', reason: 'Routine health check' });

  await loginAsPatient(page, seededPatient);
  await page.goto(`/patient/appointments/${appointment.appointmentId}`);
  await page.getByRole('button', { name: 'Reschedule Appointment' }).click();
  await expect(page.getByText(doctor.display_name, { exact: true }).last()).toBeVisible();
  await expect(page.getByText('General Consultation', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Routine health check', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: formatBookingDate(slot.date) }).click();
  await page.getByRole('radio', { name: formatSlot('10:30') }).check();
  await page.getByRole('button', { name: 'Confirm New Schedule' }).click();

  await expect(page.getByRole('status')).toContainText('Appointment rescheduled.');
  await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/10:30 AM/).first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/patient/appointments/${appointment.appointmentId}$`));
  await page.reload();
  await expect(page.getByText(/10:30 AM/).first()).toBeVisible();
  assertBrowserClean();
});

test('Patient reschedule refreshes stale availability after a target-slot conflict', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const slot = await patientScenario.createBookableSlot({ doctor, startTime: '10:00', endTime: '11:00' });
  const appointment = await patientScenario.createAppointment({ patient: seededPatient, doctor, slot });
  const competingPatient = await patientScenario.createPatient();
  const target = patientScenario.slotFor(slot.date, '10:30');

  await loginAsPatient(page, seededPatient);
  await page.goto(`/patient/appointments/${appointment.appointmentId}`);
  await page.getByRole('button', { name: 'Reschedule Appointment' }).click();
  await page.getByRole('button', { name: formatBookingDate(slot.date) }).click();
  await page.getByRole('radio', { name: formatSlot(target.time) }).check();
  await patientScenario.createAppointment({ patient: competingPatient, doctor, slot: target });
  await page.getByRole('button', { name: 'Confirm New Schedule' }).click();

  await expect(page.getByRole('alert')).toContainText(/slot.*available/i);
  await expect(page.getByRole('radio', { name: formatSlot(target.time) })).toHaveCount(0);
  assertBrowserClean();
});

test('checked-in, recorded, and completed appointments cannot be cancelled', async ({ page, patientScenario, seededPatient }) => {
  const assertBrowserClean = observeBrowser(page);
  const doctor = await patientScenario.createDoctor();
  const date = patientScenario.futureDate(3);
  const checkedIn = await patientScenario.createAppointment({
    patient: seededPatient,
    doctor,
    slot: patientScenario.slotFor(date, '09:00'),
    status: 'confirmed',
    check_in_at: new Date(),
  });
  const recorded = await patientScenario.createAppointment({
    patient: seededPatient,
    doctor,
    slot: patientScenario.slotFor(date, '10:00'),
    status: 'confirmed',
  });
  await patientScenario.createRecord({ patient: seededPatient, doctor, appointment: recorded, prescriptions: false });
  const completed = await patientScenario.createAppointment({
    patient: seededPatient,
    doctor,
    slot: patientScenario.slotFor(date, '11:00'),
    status: 'completed',
    check_in_at: new Date(),
  });

  await loginAsPatient(page, seededPatient);
  for (const appointment of [checkedIn, recorded, completed]) {
    await page.goto(`/patient/appointments/${appointment.appointmentId}`);
    await expect(page.getByRole('button', { name: 'Cancel Appointment' })).toHaveCount(0);
    expect(await cancelViaBrowserFetch(page, appointment.appointmentId)).toBe(409);
  }
  assertBrowserClean();
});
