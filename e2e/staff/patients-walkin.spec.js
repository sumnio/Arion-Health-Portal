import { Appointment, AuthAccount, Patient } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsStaff } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { browserApi } from '../helpers/browserApi.js';

async function fillWalkIn(page, values) {
  await page.getByLabel('Full name *').fill(values.full_name);
  await page.getByLabel('Date of birth *').fill(values.dob);
  await page.getByLabel('Sex *').selectOption(values.sex ?? 'other');
  await page.getByLabel('Contact number *').fill(values.contact_number);
  if (values.address) await page.getByLabel('Address (optional)').fill(values.address);
  if (values.emergency_contact_name) await page.getByLabel('Emergency contact name (optional)').fill(values.emergency_contact_name);
}

function nextSameDayHalfHour(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const minutes = Math.ceil((Number(parts.hour) * 60 + Number(parts.minute) + 2) / 30) * 30;
  if (minutes >= 24 * 60) return null;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function addMinutes(time, amount) {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + amount;
  return total >= 24 * 60 ? null : `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

test('Staff searches existing Patients by name and contact with a real empty result', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await staffScenario.createPatient({ full_name: `E2E Search ${staffScenario.marker.slice(0, 8)}` });
  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/patients');
  const search = page.getByLabel('Search by patient name or contact number');
  await search.fill(patient.full_name);
  await expect(page.getByRole('heading', { name: patient.full_name })).toBeVisible();
  await search.fill(patient.contact_number);
  await expect(page.getByRole('heading', { name: patient.full_name })).toBeVisible();
  await search.fill(`absent-${staffScenario.marker}`);
  await expect(page.getByRole('heading', { name: 'No patients found' })).toBeVisible();
  assertBrowserClean();
});

test('Staff registers a persistent no-account walk-in and duplicate matching is rejected', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const values = {
    full_name: `E2E Walkin UI ${staffScenario.marker.slice(0, 8)}`,
    dob: '1988-05-12',
    sex: 'other',
    contact_number: `0955${String(Date.now()).slice(-7)}`,
    address: 'E2E clinic district',
    emergency_contact_name: 'E2E Contact',
  };
  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/patients/new');
  await fillWalkIn(page, values);
  await page.getByRole('button', { name: 'Register and continue' }).click();
  await expect(page).toHaveURL(/\/staff\/patients\/[a-f\d]{24}\/walk-in$/);
  await expect(page.getByRole('heading', { name: values.full_name })).toBeVisible();
  const stored = await Patient.findOne({ contact_number: values.contact_number }).lean();
  staffScenario.rememberPatient(stored._id);
  expect(stored.user_profile_id).toBeNull();
  expect(stored.address).toBe(values.address);
  expect(await AuthAccount.exists({ user_profile_id: stored.user_profile_id })).toBeNull();

  await page.goto('/staff/patients');
  await page.getByLabel('Search by patient name or contact number').fill(values.full_name);
  await expect(page.getByRole('heading', { name: values.full_name })).toBeVisible();
  await page.goto('/staff/patients/new');
  await fillWalkIn(page, values);
  await page.getByRole('button', { name: 'Register and continue' }).click();
  await expect(page.getByRole('alert')).toContainText('An existing Patient may match this person.');
  expect(await Patient.countDocuments({ contact_number: values.contact_number })).toBe(1);
  assertBrowserClean();
});

test('Staff walk-in phone inputs ignore malformed input and extra digits while keeping emergency phone optional', async ({ page, seededStaff }) => {
  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/patients/new');
  const contact = page.getByLabel('Contact number *');
  const emergency = page.getByLabel('Emergency contact number (optional)');
  await contact.fill('0917abc4567');
  await expect(contact).toHaveValue('');
  await expect(page.getByText('Invalid phone number.')).toHaveCount(0);
  await contact.fill('0917 123 4567');
  await expect(contact).toHaveValue('09171234567');
  await contact.press('8');
  await expect(contact).toHaveValue('09171234567');
  await expect(page.getByText('Phone number must be 11 digits.')).toHaveCount(0);
  await emergency.fill('');
  await expect(emergency).toHaveValue('');
});

test('Staff creates a same-day walk-in Appointment with its own creator and non-current dates are rejected', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await staffScenario.createGuestPatient();
  const occupiedPatient = await staffScenario.createGuestPatient({ full_name: `E2E Occupied Slot ${staffScenario.marker.slice(0, 8)}` });
  const doctor = await staffScenario.createDoctor();
  const occupiedTime = nextSameDayHalfHour();
  const availableTime = occupiedTime && addMinutes(occupiedTime, 30);
  const endTime = occupiedTime && addMinutes(occupiedTime, 60);
  test.skip(!occupiedTime || !availableTime || !endTime, 'No two future same-day slots remain in Asia/Manila.');
  await staffScenario.createBookableSlot({ doctor, offset: 0, startTime: occupiedTime, endTime });
  await staffScenario.createAppointment({ patient: occupiedPatient, doctor, slot: staffScenario.slotFor(staffScenario.today(), occupiedTime), status: 'confirmed' });
  await loginAsStaff(page, seededStaff);
  await page.goto(`/staff/patients/${patient.patientId}/walk-in`);
  await page.getByLabel('Doctor').selectOption(doctor.doctorId);
  await page.getByLabel('Visit type / service').selectOption('general_consultation');
  const slot = page.getByLabel('Available same-day time');
  const occupiedOption = slot.locator(`option[value="${occupiedTime}"]`);
  await expect(occupiedOption).toContainText('Occupied');
  await expect(occupiedOption).toBeDisabled();
  await expect(slot.locator(`option[value="${availableTime}"]`)).toBeEnabled();
  await slot.selectOption(availableTime);
  await page.getByLabel('Reason for visit').fill('E2E same-day walk-in');
  await page.getByRole('button', { name: 'Create Walk-in Appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Walk-in appointment created' })).toBeVisible();
  const stored = await Appointment.findOne({ patient_id: patient.patientId, doctor_id: doctor.doctorId }).lean();
  expect(stored.status).toBe('confirmed');
  expect(String(stored.created_by)).toBe(seededStaff.profileId);

  await page.getByRole('button', { name: 'Confirm Arrival and Open Queue' }).click();
  await expect(page).toHaveURL('/staff/queue');
  await expect(page.getByText(patient.full_name)).toBeVisible();
  await page.reload();
  await expect(page.getByText(patient.full_name)).toBeVisible();
  expect((await Appointment.findById(stored._id).lean()).check_in_at).not.toBeNull();
  await page.goto('/staff/calendar');
  await expect(page.getByText(patient.full_name)).toBeVisible();

  const rejected = await browserApi(page, `/api/staff/patients/${patient.patientId}/walk-in-appointments`, {
    method: 'POST',
    body: {
      doctor_id: doctor.doctorId,
      appointment_at: `${staffScenario.futureDate(1)}T10:00:00+08:00`,
      visit_type: 'general_consultation',
      reason: 'Invalid future walk-in',
      priority: 'normal',
    },
  });
  expect(rejected.status).toBe(400);
  expect(rejected.body.error.code).toBe('WALK_IN_MUST_BE_TODAY');
  expect(await Appointment.countDocuments({ patient_id: patient.patientId })).toBe(1);
  assertBrowserClean();
});
