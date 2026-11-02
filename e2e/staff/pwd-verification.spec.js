import { test, expect } from '../fixtures/test.js';
import { PwdVerification } from '../../server/src/models/index.js';
import { browserApi, e2eApiUrl } from '../helpers/browserApi.js';
import { loginAsDoctor, loginAsPatient, loginAsStaff, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';

async function submitPwd(page, idNumber) {
  await page.goto('/patient/profile');
  await page.getByLabel('PWD ID number *').fill(idNumber);
  await page.getByLabel('PWD verification document *').setInputFiles({
    name: 'pwd-verification.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nE2E private PWD verification'),
  });
  await page.getByRole('button', { name: /Submit for Verification|Submit Again/ }).click();
  await expect(page.getByText('Pending Verification')).toBeVisible();
}

async function documentStatus(page, verificationId) {
  return page.evaluate(async ({ origin, id }) => {
    const response = await fetch(`${origin}/api/staff/pwd-verifications/${id}/document`, { credentials: 'include' });
    return response.status;
  }, { origin: e2eApiUrl, id: verificationId });
}

test('Patient submission is privately verified by Staff, notifies Patient, and activates PWD queue priority', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await staffScenario.createPatient();
  const doctor = await staffScenario.createDoctor();
  await staffScenario.createAppointment({ patient, doctor, slot: { appointmentAt: new Date() }, status: 'confirmed', check_in_at: new Date(Date.now() - 60_000) });

  await loginAsPatient(page, patient);
  await submitPwd(page, 'E2E-PWD-VERIFY-001');
  const verification = await PwdVerification.findOne({ patient_id: patient.patientId }).lean();
  expect(await documentStatus(page, String(verification._id))).toBe(403);
  await logoutThroughUi(page);

  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/patients');
  await page.getByRole('button', { name: 'PWD Verification' }).click();
  await expect(page.getByText(patient.full_name)).toBeVisible();
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByText('E2E-PWD-VERIFY-001')).toBeVisible();
  const documentFrame = page.getByTitle(`${patient.full_name} PWD verification document`);
  await expect(documentFrame).toBeVisible();
  await expect(documentFrame).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Verify PWD' }).click();
  await expect(page.getByText('PWD status verified. The Patient has been notified.')).toBeVisible();
  await expect(page.getByText(patient.full_name)).toHaveCount(0);
  const queue = await browserApi(page, '/api/staff/queue');
  expect(queue.status).toBe(200);
  expect(queue.body.queue.find(item => item.patient.id === patient.patientId).queue_priority).toBe('senior_pwd');
  await logoutThroughUi(page);

  await loginAsPatient(page, patient);
  await page.goto('/patient/notifications');
  await expect(page.getByText('Your PWD status has been verified. PWD queue priority is now active on eligible visits.')).toBeVisible();
  await page.goto('/patient/profile');
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Again' })).toHaveCount(0);
  assertBrowserClean();
});

test('Staff rejection notifies Patient, shows a safe reason, and permits one corrected resubmission', async ({ page, staffScenario, seededStaff }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await staffScenario.createPatient();
  const doctor = await staffScenario.createDoctor();
  await loginAsPatient(page, patient);
  await submitPwd(page, 'E2E-PWD-REJECT-001');
  const verification = await PwdVerification.findOne({ patient_id: patient.patientId }).lean();
  expect(await documentStatus(page, String(verification._id))).toBe(403);
  await logoutThroughUi(page);

  await loginAsDoctor(page, doctor);
  expect(await documentStatus(page, String(verification._id))).toBe(403);
  await logoutThroughUi(page);

  await loginAsStaff(page, seededStaff);
  await page.goto('/staff/patients');
  await page.getByRole('button', { name: 'PWD Verification' }).click();
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a rejection reason.');
  await page.getByLabel('Rejection reason').fill('The uploaded document is unreadable.');
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText('PWD verification rejected. The Patient has been notified.')).toBeVisible();
  await logoutThroughUi(page);

  await loginAsPatient(page, patient);
  await page.goto('/patient/notifications');
  await expect(page.getByText('Your PWD verification could not be approved. Please review your information and submit again.')).toBeVisible();
  await page.goto('/patient/profile');
  await expect(page.getByText('Rejected', { exact: true })).toBeVisible();
  await expect(page.getByText('The uploaded document is unreadable.')).toBeVisible();
  await page.getByLabel('PWD ID number *').fill('E2E-PWD-CORRECTED-002');
  await page.getByLabel('PWD verification document *').setInputFiles({
    name: 'pwd-corrected.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\ncorrected private document'),
  });
  await page.getByRole('button', { name: 'Submit Again' }).click();
  await expect(page.getByText('Pending Verification')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Again' })).toHaveCount(0);
  assertBrowserClean();
});
