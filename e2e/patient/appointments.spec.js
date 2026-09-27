import { test, expect } from '../fixtures/test.js';
import { loginAsPatient } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { DEFAULT_E2E_API_URL, loadE2eEnvironment } from '../../server/scripts/e2eEnvironment.js';

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
