import { MedicalRecord, Patient, UserProfile } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsAdmin, loginAsPatient, loginThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { browserApi, e2eBaseUrl } from '../helpers/browserApi.js';
import { currentTotp } from '../helpers/totp.js';

test('Admin searches and paginates real Patients while a no-account walk-in has no lifecycle control', async ({ page, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  const patients = [];
  for (let index = 0; index < 6; index += 1) {
    patients.push(await adminScenario.createPatient({ full_name: `E2E Admin Patient ${index} ${adminScenario.marker.slice(0, 6)}` }));
  }
  const walkIn = await adminScenario.createGuestPatient({ full_name: `E2E No Portal ${adminScenario.marker.slice(0, 6)}` });
  await loginAsAdmin(page, seededAdmin, () => currentTotp(seededAdmin.mfaSecret));
  await page.goto('/admin/patients');
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();

  const search = page.getByLabel('Search by patient name or contact number');
  await search.fill(patients[2].full_name);
  await expect(page.getByRole('heading', { name: patients[2].full_name })).toBeVisible();
  await search.fill(patients[2].contact_number);
  await expect(page.getByRole('heading', { name: patients[2].full_name })).toBeVisible();

  await search.fill('');
  await page.getByLabel('Account status').selectOption('no_account');
  const walkInRow = page.locator('li').filter({ has: page.getByRole('heading', { name: walkIn.full_name }) });
  await expect(walkInRow).toBeVisible();
  await expect(walkInRow.getByText('No portal account', { exact: true })).toBeVisible();
  await expect(walkInRow.getByRole('button', { name: /Deactivate|Reactivate/ })).toHaveCount(0);
  expect((await Patient.findById(walkIn.patientId).lean()).user_profile_id).toBeNull();
  assertBrowserClean();
});

test('Admin deactivates and reactivates Patient portal access while clinical history remains protected and intact', async ({ page, browser, adminScenario, seededAdmin }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await adminScenario.createPatient({ full_name: `E2E Lifecycle Patient ${adminScenario.marker.slice(0, 6)}` });
  const doctor = await adminScenario.createDoctor();
  const appointment = await adminScenario.createAppointment({
    patient,
    doctor,
    slot: adminScenario.slotFor(adminScenario.today(), '15:00'),
    status: 'confirmed',
    check_in_at: new Date(),
  });
  const record = await adminScenario.createRecord({ patient, doctor, appointment, diagnosis: 'E2E preserved diagnosis' });

  await loginAsAdmin(page, seededAdmin, () => currentTotp(seededAdmin.mfaSecret));
  await page.goto('/admin/patients');
  await page.getByLabel('Search by patient name or contact number').fill(patient.full_name);
  const row = page.locator('li').filter({ has: page.getByRole('heading', { name: patient.full_name }) });
  await expect(row).toBeVisible();
  await expect(page.getByText('E2E preserved diagnosis')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Medical Record|Certificate|Complete Consultation/i })).toHaveCount(0);
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText(`${patient.full_name}'s portal account is now inactive.`)).toBeVisible();
  expect((await UserProfile.findById(patient.profileId).lean()).status).toBe('inactive');
  expect(await Patient.exists({ _id: patient.patientId })).not.toBeNull();
  expect(await MedicalRecord.exists({ _id: record.recordId })).not.toBeNull();

  const patientContext = await browser.newContext({ baseURL: e2eBaseUrl });
  const patientPage = await patientContext.newPage();
  await loginThroughUi(patientPage, patient);
  await expect(patientPage.getByRole('alert')).toContainText('Invalid email or password.');

  const createRecord = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, {
    method: 'POST', body: { diagnosis: 'Forbidden', notes: null, follow_up: null, prescriptions: [] },
  });
  const issueCertificate = await browserApi(page, `/api/doctor/records/${record.recordId}/certificates`, {
    method: 'POST', body: { purpose: 'Forbidden', diagnosis_summary: 'Forbidden', date_issued: adminScenario.today(), valid_until: null },
  });
  const complete = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/complete`, { method: 'PATCH' });
  expect([createRecord.status, issueCertificate.status, complete.status]).toEqual([403, 403, 403]);

  await row.getByRole('button', { name: 'Reactivate' }).click();
  await expect(page.getByText(`${patient.full_name}'s portal account is now active.`)).toBeVisible();
  await loginAsPatient(patientPage, patient);
  await expect(patientPage).toHaveURL('/patient/dashboard');
  await patientContext.close();
  expect(await MedicalRecord.exists({ _id: record.recordId })).not.toBeNull();

  await page.goto(`/doctor/patients/${patient.patientId}`);
  await expect(page).toHaveURL('/unauthorized');
  assertBrowserClean();
});
