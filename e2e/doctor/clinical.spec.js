import { Appointment, ConsultationSupportingDocument, MedicalCertificate, MedicalRecord, Prescription } from '../../server/src/models/index.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor, loginAsPatient, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { DEFAULT_E2E_API_URL, loadE2eEnvironment } from '../../server/scripts/e2eEnvironment.js';

loadE2eEnvironment();
const apiURL = process.env.E2E_API_URL || DEFAULT_E2E_API_URL;

async function browserApi(page, path, { method = 'GET', body } = {}) {
  return page.evaluate(async ({ origin, path: resource, method: verb, body: payload }) => {
    const response = await fetch(`${origin}${resource}`, {
      method: verb,
      credentials: 'include',
      headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  }, { origin: apiURL, path, method, body });
}

test('Doctor completes the assigned record, Prescription, certificate, PDF, and consultation journey', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient();
  const appointment = await patientScenario.createAppointment({
    patient,
    doctor: seededDoctor,
    slot: patientScenario.slotFor(patientScenario.futureDate(1), '10:00'),
    status: 'confirmed',
    check_in_at: new Date(),
    reason: 'Persistent cough',
  });
  await loginAsDoctor(page, seededDoctor);
  await page.goto(`/doctor/patients/${patient.patientId}`);
  await expect(page.getByRole('heading', { name: patient.full_name })).toBeVisible();
  await expect(page.getByText('Persistent cough')).toBeVisible();
  await page.getByRole('tab', { name: 'Consultation' }).click();
  await expect(page.getByRole('link', { name: 'Add Medical Record' })).toBeVisible();
  await page.getByRole('link', { name: 'Add Medical Record' }).click();

  await page.getByLabel('Diagnosis *').fill('E2E acute bronchitis');
  await page.getByLabel('Doctor’s notes (optional)').fill('E2E lungs clear on examination.');
  await page.getByLabel('Follow-up instructions (optional)').fill('Return in seven days if symptoms persist.');
  await page.getByRole('button', { name: 'Add Prescription' }).click();
  await page.getByLabel('Medicine *').fill('E2E Salbutamol');
  await page.getByLabel('Dosage *').fill('2 puffs');
  await page.getByLabel('Instructions (optional)', { exact: true }).fill('Use every six hours as needed.');
  await page.getByRole('button', { name: 'Save Medical Record' }).click();
  await expect(page.getByRole('heading', { name: 'Medical Record Saved' })).toBeVisible();

  const record = await MedicalRecord.findOne({ appointment_id: appointment.appointmentId }).lean();
  expect(record).toMatchObject({ diagnosis: 'E2E acute bronchitis', doctor_id: expect.anything(), patient_id: expect.anything() });
  const prescription = await Prescription.findOne({ medical_record_id: record._id }).lean();
  expect(prescription).toMatchObject({ medicine: 'E2E Salbutamol', dosage: '2 puffs' });

  const duplicate = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, {
    method: 'POST',
    body: { diagnosis: 'Duplicate diagnosis', notes: null, follow_up: null, prescriptions: [] },
  });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe('MEDICAL_RECORD_EXISTS');
  expect(await MedicalRecord.countDocuments({ appointment_id: appointment.appointmentId })).toBe(1);

  await page.getByRole('link', { name: 'Issue Medical Certificate' }).click();
  await page.getByLabel('Purpose *').fill('Return to work');
  await page.getByRole('button', { name: 'Issue Certificate' }).click();
  await expect(page.getByRole('heading', { name: 'Medical Certificate Issued' })).toBeVisible();
  await expect(page.getByText('Successfully issued. This certificate cannot be edited, deleted, or reissued here.')).toBeVisible();
  const certificate = await MedicalCertificate.findOne({ medical_record_id: record._id }).lean();
  expect(certificate).toMatchObject({ purpose: 'Return to work', status: 'issued' });
  expect(certificate.medical_certificate_number).toBeTruthy();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`Medical-Certificate-${certificate.medical_certificate_number}.pdf`);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).subarray(0, 4).toString()).toBe('%PDF');

  await page.getByRole('link', { name: 'Back to Patient Details' }).click();
  await page.getByRole('tab', { name: 'Medical Records' }).click();
  await expect(page.getByText('E2E acute bronchitis').first()).toBeVisible();
  await page.getByText('View record').click();
  await expect(page.getByText('E2E Salbutamol')).toBeVisible();
  await expect(page.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Certificates' }).click();
  await page.getByText('View certificate').click();
  await expect(page.getByText(`Certificate No. ${certificate.medical_certificate_number}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /edit|delete|reissue/i })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Consultation' }).click();
  await page.getByRole('button', { name: 'Mark Consultation Completed' }).click();
  await expect(page.getByText(/Consultation marked completed\./)).toBeVisible();
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('completed');
  await page.reload();
  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Consultation Completed' })).toHaveCount(0);
  assertBrowserClean();
});

test('Doctor completion without a MedicalRecord fails safely and preserves status', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient();
  const appointment = await patientScenario.createAppointment({
    patient,
    doctor: seededDoctor,
    slot: patientScenario.slotFor(patientScenario.futureDate(2), '11:00'),
    status: 'confirmed',
    check_in_at: new Date(),
  });
  await loginAsDoctor(page, seededDoctor);
  const result = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/complete`, { method: 'PATCH' });
  expect(result.status).toBe(409);
  expect(result.body.error.code).toBe('MEDICAL_RECORD_REQUIRED');
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('confirmed');
  assertBrowserClean();
});

test('Doctor reviews only current consultation documents until the Medical Record is saved while Patient access remains', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient();
  const currentAppointment = await patientScenario.createAppointment({ patient, doctor: seededDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(1), '09:00'), status: 'confirmed', check_in_at: new Date(), reason: 'Current consultation' });
  const otherAppointment = await patientScenario.createAppointment({ patient, doctor: seededDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(2), '10:00'), status: 'confirmed', reason: 'Other consultation' });

  await loginAsPatient(page, patient);
  let currentDocumentId;
  for (const [appointment, filename] of [[currentAppointment, 'current-consultation.pdf'], [otherAppointment, 'other-consultation.pdf']]) {
    const response = await page.request.post(`${apiURL}/api/patient/appointments/${appointment.appointmentId}/supporting-documents`, { multipart: { files: { name: filename, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') } } });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    if (appointment === currentAppointment) currentDocumentId = body.supporting_documents[0].id;
  }
  await logoutThroughUi(page);

  await loginAsDoctor(page, seededDoctor);
  await page.goto(`/doctor/patients/${patient.patientId}`);
  await page.getByRole('tab', { name: 'Consultation' }).click();
  await expect(page.getByRole('heading', { name: 'Patient Supporting Documents' })).toBeVisible();
  await expect(page.getByText('current-consultation.pdf')).toBeVisible();
  await expect(page.getByText('other-consultation.pdf')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View' })).toBeVisible();
  await expect(page.getByLabel(/upload/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'View' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'current-consultation.pdf' })).toBeVisible();
  await expect(page.locator('.supporting-document-viewer-content object')).toBeVisible();
  await page.getByRole('button', { name: 'Close document viewer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const download = await page.request.get(`${apiURL}/api/doctor/appointments/${currentAppointment.appointmentId}/supporting-documents/${currentDocumentId}`);
  expect(download.ok()).toBe(true);
  expect(download.headers()['content-type']).toBe('application/pdf');
  expect(download.headers()['content-disposition']).toContain('current-consultation.pdf');
  expect(download.headers()['cache-control']).toBe('private, no-store');
  expect(download.headers()['x-content-type-options']).toBe('nosniff');
  expect((await download.body()).subarray(0, 4).toString()).toBe('%PDF');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'View' })).toBeVisible();
  await page.getByRole('link', { name: 'Add Medical Record' }).click();
  await expect(page.getByRole('heading', { name: 'Supporting Documents for this Consultation' })).toBeVisible();
  await expect(page.getByText('current-consultation.pdf')).toBeVisible();
  await expect(page.getByText('other-consultation.pdf')).toHaveCount(0);
  await page.getByLabel('Diagnosis *').fill('E2E document-supported consultation');
  await page.getByRole('button', { name: 'Save Medical Record' }).click();
  await expect(page.getByRole('heading', { name: 'Medical Record Saved' })).toBeVisible();
  await expect(page.getByText('current-consultation.pdf')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Supporting Documents for this Consultation' })).toHaveCount(0);

  const record = await MedicalRecord.findOne({ appointment_id: currentAppointment.appointmentId }).lean();
  expect(record).toBeTruthy();
  expect(record).not.toHaveProperty('supporting_documents');
  expect(await ConsultationSupportingDocument.countDocuments({ appointment_id: currentAppointment.appointmentId })).toBe(1);
  expect((await page.request.get(`${apiURL}/api/doctor/appointments/${currentAppointment.appointmentId}/supporting-documents/${currentDocumentId}`)).status()).toBe(403);

  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutThroughUi(page);
  await loginAsPatient(page, patient);
  await page.goto(`/patient/records/${record._id}`);
  await expect(page.getByRole('heading', { name: 'Supporting Documents from this Visit' })).toBeVisible();
  await expect(page.getByText('current-consultation.pdf')).toBeVisible();
  await expect(page.getByText('other-consultation.pdf')).toHaveCount(0);
  assertBrowserClean();
});

test('A different Doctor cannot view or mutate another Doctor’s consultation', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const owner = await patientScenario.createDoctor();
  const patient = await patientScenario.createPatient();
  const appointment = await patientScenario.createAppointment({
    patient,
    doctor: owner,
    slot: patientScenario.slotFor(patientScenario.futureDate(2), '14:00'),
    status: 'confirmed',
    check_in_at: new Date(),
  });
  await loginAsDoctor(page, seededDoctor);
  await page.goto(`/doctor/patients/${patient.patientId}`);
  await expect(page.getByRole('heading', { name: 'Patient or appointment not found' })).toBeVisible();
  await expect(page.getByText(patient.full_name)).toHaveCount(0);

  const recordAttempt = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, {
    method: 'POST',
    body: { diagnosis: 'Forbidden mutation', notes: null, follow_up: null, prescriptions: [] },
  });
  expect(recordAttempt.status).toBe(403);
  expect(recordAttempt.body.error.code).toBe('FORBIDDEN');
  const completionAttempt = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/complete`, { method: 'PATCH' });
  expect(completionAttempt.status).toBe(403);
  expect(await MedicalRecord.exists({ appointment_id: appointment.appointmentId })).toBeNull();
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('confirmed');
  assertBrowserClean();
});
