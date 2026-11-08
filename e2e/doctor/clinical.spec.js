import { createHash } from 'node:crypto';
import { Appointment, ConsultationSupportingDocument, MedicalCertificate, MedicalRecord, Prescription } from '../../server/src/models/index.js';
import { createGridFsPrescriptionAttachmentStorage } from '../../server/src/services/prescriptionAttachmentStorage.js';
import { test, expect } from '../fixtures/test.js';
import { loginAsDoctor, loginAsPatient, logoutThroughUi } from '../helpers/auth.js';
import { observeBrowser } from '../helpers/browserAssertions.js';
import { DEFAULT_E2E_API_URL, loadE2eEnvironment } from '../../server/scripts/e2eEnvironment.js';

loadE2eEnvironment();
const apiURL = process.env.E2E_API_URL || DEFAULT_E2E_API_URL;
const formatBookingDateForTest = (value) => new Date(`${value}T00:00:00+08:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

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
  await patientScenario.createDoctorSignature(seededDoctor);
  const patient = await patientScenario.createPatient();
  const otherPatient = await patientScenario.createPatient();
  const appointment = await patientScenario.createAppointment({
    patient,
    doctor: seededDoctor,
    slot: patientScenario.slotFor(patientScenario.futureDate(1), '10:00'),
    status: 'confirmed',
    check_in_at: new Date(),
    reason: 'Persistent cough',
  });
  const followUpSlot = await patientScenario.createBookableSlot({ doctor: seededDoctor, offset: 3, startTime: '11:00', endTime: '12:00' });
  await loginAsDoctor(page, seededDoctor);
  await page.goto(`/doctor/patients/${patient.patientId}`);
  await expect(page.getByRole('heading', { name: patient.full_name })).toBeVisible();
  await expect(page.getByText('Persistent cough')).toBeVisible();
  await page.getByRole('tab', { name: 'Consultation' }).click();
  await expect(page.getByRole('link', { name: 'Add Medical Record' })).toBeVisible();
  await page.getByRole('link', { name: 'Add Medical Record' }).click();

  await page.getByLabel('Diagnosis *').fill('E2E acute bronchitis');
  await page.getByLabel('Doctor’s notes (optional)').fill('E2E lungs clear on examination.');
  await page.getByLabel('Follow-up required').check();
  await page.getByLabel('Recommended date *').fill(followUpSlot.date);
  await page.getByLabel('Follow-up reason *').fill('Reassessment after treatment.');
  await page.getByRole('button', { name: 'Add Prescription' }).click();
  await page.getByLabel('Medicine *').fill('E2E Salbutamol');
  await page.getByLabel('Dosage *').fill('2 puffs');
  await page.getByLabel('Instructions (optional)', { exact: true }).fill('Use every six hours as needed.');
  await page.getByLabel('Prescription attachment (optional)').setInputFiles({
    name: 'e2e-prescription.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nE2E prescription attachment\n%%EOF'),
  });
  await expect(page.getByText('e2e-prescription.pdf')).toBeVisible();
  await expect(page.locator('iframe[title="Preview of e2e-prescription.pdf"]')).toBeVisible();
  await page.getByRole('button', { name: 'Save Medical Record' }).click();
  await expect(page.getByRole('heading', { name: 'Medical Record Saved' })).toBeVisible();

  const record = await MedicalRecord.findOne({ appointment_id: appointment.appointmentId }).lean();
  expect(record).toMatchObject({ diagnosis: 'E2E acute bronchitis', doctor_id: expect.anything(), patient_id: expect.anything(), follow_up_required: true, follow_up_reason: 'Reassessment after treatment.' });
  const prescription = await Prescription.findOne({ medical_record_id: record._id }).select('+attachment_storage_file_id +attachment_sha256').lean();
  expect(prescription).toMatchObject({ medicine: 'E2E Salbutamol', dosage: '2 puffs' });
  expect(prescription.attachment_original_filename).toBe('e2e-prescription.pdf');
  expect(prescription.attachment_mime_type).toBe('application/pdf');
  expect(prescription.attachment_storage_file_id).toBeTruthy();
  expect(prescription.attachment_sha256).toMatch(/^[a-f0-9]{64}$/);

  const duplicate = await browserApi(page, `/api/doctor/appointments/${appointment.appointmentId}/medical-record`, {
    method: 'POST',
    body: { diagnosis: 'Duplicate diagnosis', notes: null, follow_up: null, prescriptions: [] },
  });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe('MEDICAL_RECORD_EXISTS');
  expect(await MedicalRecord.countDocuments({ appointment_id: appointment.appointmentId })).toBe(1);

  await page.getByRole('link', { name: 'Issue Medical Certificate' }).click();
  await page.getByLabel('Purpose *').selectOption('Fit to Return');
  await page.getByLabel('Recommendation *').fill('May return to regular duties on the date stated.');
  await page.getByLabel('Valid Until *').fill(patientScenario.futureDate(7));
  await expect(page.locator('iframe[title="Draft medical certificate PDF preview"]')).toBeVisible();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('You have unsaved certificate changes. Leave without issuing?');
    await dialog.accept();
  });
  await page.getByRole('link', { name: 'Back to Patient Details' }).click();
  await expect(page.getByRole('tab', { name: 'Consultation' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('link', { name: 'Issue Medical Certificate' })).toBeVisible();
  await page.getByRole('link', { name: 'Issue Medical Certificate' }).click();
  await page.getByLabel('Purpose *').selectOption('Fit to Return');
  await page.getByLabel('Recommendation *').fill('May return to regular duties on the date stated.');
  await page.getByLabel('Valid Until *').fill(patientScenario.futureDate(7));
  await page.getByRole('button', { name: 'Issue Certificate' }).click();
  await expect(page.getByRole('heading', { name: 'Medical Certificate Issued' })).toBeVisible();
  await expect(page.getByText('Successfully issued. This certificate cannot be edited, deleted, or reissued here.')).toBeVisible();
  const issuedPreview = page.locator('iframe[title="Issued medical certificate PDF"]');
  await expect(issuedPreview).toBeVisible();
  await expect(issuedPreview).toHaveAttribute('src', /^blob:/);
  const certificate = await MedicalCertificate.findOne({ medical_record_id: record._id }).lean();
  expect(certificate).toMatchObject({ purpose: 'Fit to Return', purpose_code: 'Fit to Return', recommendation: 'May return to regular duties on the date stated.', status: 'issued' });
  expect(certificate.valid_until.toISOString().slice(0, 10)).toBe(patientScenario.futureDate(7));
  expect(certificate.medical_certificate_number).toBeTruthy();
  const storedPdf = await page.request.get(`${apiURL}/api/doctor/certificates/${certificate._id}/pdf`);
  expect(storedPdf.ok()).toBe(true);
  expect((await storedPdf.body()).toString('latin1')).toContain(`(${seededDoctor.display_name})`);

  const [pdfResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(`/api/doctor/certificates/${certificate._id}/pdf`) && response.request().method() === 'GET'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  expect(pdfResponse.headers()['content-type']).toBe('application/pdf');
  expect(pdfResponse.headers()['content-disposition']).toContain(`Medical-Certificate-${certificate.medical_certificate_number}.pdf`);

  await page.getByRole('link', { name: 'Back to Patient Details' }).click();
  await expect(page.getByRole('tab', { name: 'Consultation' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'View Issued Certificate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Consultation Completed' })).toBeVisible();
  await page.getByRole('tab', { name: 'Medical Records' }).click();
  await expect(page.getByText('E2E acute bronchitis').first()).toBeVisible();
  await page.getByText('View record').click();
  await expect(page.getByText('E2E Salbutamol').first()).toBeVisible();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Prescription attachment preview/ })).toBeVisible();
  await expect(page.locator('iframe[title="Preview of e2e-prescription.pdf"]')).toBeVisible();
  await page.getByRole('button', { name: 'Close prescription preview' }).click();
  const doctorAttachmentDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await doctorAttachmentDownload).suggestedFilename()).toBe('e2e-prescription.pdf');
  await expect(page.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Prescriptions' }).click();
  await expect(page.getByText('Attachment available')).toBeVisible();
  await expect(page.getByText('Issued · Read-only')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Salbutamol' })).toBeVisible();
  await expect(page.getByRole('button', { name: /edit|replace|delete/i })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Certificates' }).click();
  await page.getByText('View Certificate').click();
  await expect(page.locator('iframe[title="Issued medical certificate PDF"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /edit|delete|reissue/i })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Consultation' }).click();
  await page.getByRole('button', { name: 'Mark Consultation Completed' }).click();
  await expect(page.getByText(/Consultation marked completed\./)).toBeVisible();
  expect((await Appointment.findById(appointment.appointmentId).lean()).status).toBe('completed');
  await page.reload();
  await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Consultation Completed' })).toHaveCount(0);
  await logoutThroughUi(page);
  await loginAsPatient(page, patient);
  await page.goto('/patient/records');
  await page.getByRole('tab', { name: 'Prescriptions' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Salbutamol' })).toBeVisible();
  await expect(page.getByText('Attachment available')).toBeVisible();
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Prescription attachment preview/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close prescription preview' }).click();
  const patientHistoryDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await patientHistoryDownload).suggestedFilename()).toBe('e2e-prescription.pdf');
  await page.goto(`/patient/records/${record._id}`);
  await expect(page.getByText('E2E Salbutamol')).toBeVisible();
  const patientAttachmentDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await patientAttachmentDownload).suggestedFilename()).toBe('e2e-prescription.pdf');
  await expect(page.getByText('Reassessment after treatment.')).toBeVisible();
  await expect(page.getByText('Follow-up recommended — Not yet scheduled.')).toBeVisible();
  await page.getByRole('link', { name: 'Schedule Follow-up' }).click();
  await expect(page.getByRole('heading', { name: 'Schedule Follow-up' })).toBeVisible();
  await page.getByRole('button', { name: formatBookingDateForTest(followUpSlot.date) }).click();
  await page.getByRole('radio', { name: /11:00 AM/ }).check();
  await page.getByRole('button', { name: 'Confirm Appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Appointment request created' })).toBeVisible();
  const linked = await Appointment.findOne({ source_medical_record_id: record._id }).lean();
  expect(linked).toMatchObject({ patient_id: expect.anything(), doctor_id: expect.anything(), visit_type: 'follow_up', status: 'pending' });
  expect((await MedicalRecord.findById(record._id).lean()).follow_up_recommended_date.toISOString().slice(0, 10)).toBe(followUpSlot.date);
  await logoutThroughUi(page);
  await loginAsPatient(page, otherPatient);
  const deniedAttachment = await page.request.get(`${apiURL}/api/patient/prescriptions/${prescription._id}/attachment`);
  expect(deniedAttachment.status()).toBe(404);
  assertBrowserClean();
});

test('Doctor and Patient prescription history distinguish digital-only, attachment-only, and empty states', async ({ page, patientScenario, seededDoctor }) => {
  const patient = await patientScenario.createPatient();
  const appointment = await patientScenario.createAppointment({ patient, doctor: seededDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(1), '14:00'), status: 'completed', check_in_at: new Date() });
  const record = await patientScenario.createRecord({ patient, doctor: seededDoctor, appointment, diagnosis: 'Prescription history variants', prescriptions: false });
  await Prescription.create({ medical_record_id: record.recordId, medicine: 'E2E Digital Medicine', dosage: '5 mg', instructions: 'Once daily.' });
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
  const storage = createGridFsPrescriptionAttachmentStorage();
  const stored = await storage.upload({ buffer: bytes, originalname: 'attachment-only.png', mimetype: 'image/png', size: bytes.length });
  await Prescription.create({ medical_record_id: record.recordId, medicine: null, dosage: null, instructions: null, attachment_storage_file_id: stored.storageFileId, attachment_mime_type: 'image/png', attachment_file_size: bytes.length, attachment_original_filename: 'attachment-only.png', attachment_sha256: createHash('sha256').update(bytes).digest('hex'), attachment_uploaded_at: new Date() });
  const emptyPatient = await patientScenario.createPatient();
  await patientScenario.createAppointment({ patient: emptyPatient, doctor: seededDoctor, slot: patientScenario.slotFor(patientScenario.futureDate(2), '14:00'), status: 'confirmed' });

  await loginAsDoctor(page, seededDoctor);
  await page.goto(`/doctor/patients/${patient.patientId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Prescriptions' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Digital Medicine' })).toBeVisible();
  await expect(page.getByText('Attached prescription')).toBeVisible();
  await expect(page.getByText('Attachment available')).toBeVisible();
  await page.goto(`/doctor/patients/${emptyPatient.patientId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Prescriptions' }).click();
  await expect(page.getByText('No prescriptions have been issued for this Patient.')).toBeVisible();

  await logoutThroughUi(page);
  await loginAsPatient(page, patient);
  await page.goto('/patient/records', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Prescriptions' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Digital Medicine' })).toBeVisible();
  await expect(page.getByText('Attached prescription')).toBeVisible();
});

test('Doctor filters Active and Expired certificate history while retaining read-only preview access', async ({ page, patientScenario, seededDoctor }) => {
  const assertBrowserClean = observeBrowser(page);
  const patient = await patientScenario.createPatient();
  const certificates = [];
  for (const [index, purpose, dateIssued, validUntil] of [
    [0, 'Active Doctor history', patientScenario.futureDate(-3), patientScenario.futureDate(3)],
    [1, 'Expired Doctor history', patientScenario.futureDate(-8), patientScenario.futureDate(-1)],
    [2, 'Legacy Doctor history', patientScenario.futureDate(-12), null],
  ]) {
    const appointment = await patientScenario.createAppointment({
      patient,
      doctor: seededDoctor,
      slot: patientScenario.slotFor(patientScenario.futureDate(index + 1), `${10 + index}:00`),
      status: 'completed',
      check_in_at: new Date(),
    });
    const record = await patientScenario.createRecord({ patient, doctor: seededDoctor, appointment, diagnosis: `${purpose} diagnosis`, prescriptions: false });
    certificates.push(await patientScenario.createCertificate({ patient, doctor: seededDoctor, record, purpose, dateIssued, validUntil }));
  }

  await loginAsDoctor(page, seededDoctor);
  await page.goto(`/doctor/patients/${patient.patientId}`);
  await page.getByRole('tab', { name: 'Certificates' }).click();
  await expect(page.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  for (const purpose of ['Active Doctor history', 'Expired Doctor history', 'Legacy Doctor history']) await expect(page.getByText(purpose)).toBeVisible();

  for (const [filter, visible, hidden] of [
    ['Active', 'Active Doctor history', 'Expired Doctor history'],
    ['Expired', 'Expired Doctor history', 'Legacy Doctor history'],
  ]) {
    await page.getByRole('button', { name: filter, exact: true }).click();
    await expect(page.getByRole('button', { name: filter, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(visible)).toBeVisible();
    await expect(page.getByText(hidden)).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByText('No validity date recorded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Legacy', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Expired', exact: true }).click();
  await page.getByText('View Certificate').click();
  await expect(page.locator('iframe[title="Issued medical certificate PDF"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /edit|extend|delete|reissue/i })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const otherDoctor = await patientScenario.createDoctor();
  await page.setViewportSize({ width: 1280, height: 800 });
  await logoutThroughUi(page);
  await loginAsDoctor(page, otherDoctor);
  const denied = await page.request.get(`${apiURL}/api/doctor/certificates/${certificates[1].certificateId}/pdf`);
  expect(denied.status()).toBe(404);
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
