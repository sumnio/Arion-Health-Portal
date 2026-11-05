import { Appointment, MedicalRecord } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

test('Staff Patients shows linked and walk-in operational details without clinical content', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const portalPatient = await staffScenario.createPatient({ full_name: 'E2E Portal Operations Patient', display_name: 'E2E Portal Operations Patient', address: 'E2E Portal Address', pwd_verified: true });
  const walkInPatient = await staffScenario.createGuestPatient({ full_name: 'E2E Walk-in Operations Patient', address: 'E2E Walk-in Address' });
  const doctor = await staffScenario.createDoctor();
  const latest = await staffScenario.createAppointment({ patient: portalPatient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(-1), '09:00'), status: 'completed', check_in_at: new Date(), reason: 'E2E completed operational visit' });
  await staffScenario.createAppointment({ patient: portalPatient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(1), '10:00'), status: 'confirmed', reason: 'E2E upcoming operational visit', priority: 'urgent' });
  for (let offset = -2; offset >= -5; offset -= 1) await staffScenario.createAppointment({ patient: portalPatient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(offset), '09:00'), status: 'completed', reason: `E2E historical visit ${Math.abs(offset)}` });
  await staffScenario.createRecord({ patient: portalPatient, doctor, appointment: latest, diagnosis: 'E2E private diagnosis' });

  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/patients');
  await page.getByLabel('Search by full name, contact number, or email').fill(portalPatient.full_name);
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('E2E completed operational visit')).toHaveCount(0);
  await expect(page.getByText('E2E private diagnosis')).toHaveCount(0);
  await page.getByRole('link', { name: 'View Patient' }).click();

  await expect(page.getByRole('heading', { name: portalPatient.full_name })).toBeVisible();
  await expect(page.getByText('E2E Portal Address')).toBeVisible();
  await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('E2E completed operational visit', { exact: true })).toBeVisible();
  await expect(page.getByText('E2E upcoming operational visit', { exact: true })).toBeVisible();
  await expect(page.getByText('Urgent', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.badge', { hasText: 'Urgent' })).toHaveCount(0);
  await expect(page.getByText('E2E private diagnosis')).toHaveCount(0);
  await expect(page.getByText(/prescription|clinical note/i)).toHaveCount(0);
  const history = page.locator('.appointment-history');
  await expect(history.locator('ol > li')).toHaveCount(5);
  await expect(history.getByText('Page 1 of 2')).toBeVisible();
  await history.getByRole('button', { name: 'Next' }).click();
  await expect(history.locator('ol > li')).toHaveCount(1);
  await expect(history.getByText('Page 2 of 2')).toBeVisible();

  await page.goto(`/staff/patients/${walkInPatient.patientId}`);
  await expect(page.getByRole('heading', { name: walkInPatient.full_name })).toBeVisible();
  await expect(page.getByText('No Account', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('E2E Walk-in Address')).toBeVisible();
  await expect(page.getByText('No appointment history found.')).toBeVisible();
  assertBrowserClean();
});

test('Staff schedules a recommended follow-up on the nearest available future date without seeing the clinical reason', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await staffScenario.createPatient({ full_name: 'E2E Follow-up Operations Patient' });
  const doctor = await staffScenario.createDoctor();
  const consultation = await staffScenario.createAppointment({ patient, doctor, slot: staffScenario.slotFor(staffScenario.futureDate(-1), '09:00'), status: 'completed', check_in_at: new Date() });
  const record = await staffScenario.createRecord({ patient, doctor, appointment: consultation, prescriptions: false });
  const recommendedDate = staffScenario.futureDate(2);
  const available = await staffScenario.createBookableSlot({ doctor, offset: 3, startTime: '10:00', endTime: '11:00' });
  await MedicalRecord.findByIdAndUpdate(record.recordId, {
    follow_up_required: true,
    follow_up_recommended_date: new Date(`${recommendedDate}T00:00:00.000Z`),
    follow_up_reason: 'E2E private clinical follow-up reason',
  });

  await loginAsStaff(page, seededStaff);
  await page.goto(`/staff/patients/${patient.patientId}`);
  await expect(page.getByRole('heading', { name: 'Follow-up Scheduling' })).toBeVisible();
  await expect(page.getByText('E2E private clinical follow-up reason')).toHaveCount(0);
  await page.getByRole('link', { name: 'Schedule Follow-up' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Follow-up' })).toBeVisible();
  await expect(page.getByLabel('Doctor')).toBeDisabled();
  await expect(page.getByLabel('Visit type / service')).toBeDisabled();
  await expect(page.getByLabel('Reason for visit')).toHaveValue('Follow-up consultation');
  await expect(page.getByText('E2E private clinical follow-up reason')).toHaveCount(0);
  await expect(page.getByLabel('Appointment date')).toHaveValue(available.date);
  await page.getByLabel('Available time').selectOption('10:00');
  await page.getByRole('button', { name: 'Create Follow-up Appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Follow-up appointment created' })).toBeVisible();

  const linked = await Appointment.findOne({ source_medical_record_id: record.recordId }).lean();
  expect(linked).toMatchObject({ status: 'confirmed', visit_type: 'follow_up', reason: 'Follow-up consultation' });
  expect(linked.appointment_at.toISOString()).toBe(available.appointmentAt.toISOString());
  expect((await MedicalRecord.findById(record.recordId).lean()).follow_up_recommended_date.toISOString().slice(0, 10)).toBe(recommendedDate);
  assertBrowserClean();
});
