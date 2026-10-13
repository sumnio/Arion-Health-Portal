import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPatientApiRepository } from '../src/repositories/patientApiRepository.js';
import { createApiClient } from '../src/services/apiClient.js';
import {
  createAppointmentThenUploadDocuments,
  createPatientSupportingDocumentService,
  formatSupportingDocumentSize,
  SUPPORTING_DOCUMENT_MAX_FILE_SIZE,
  SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE,
  supportingDocumentTypeLabel,
  validateSupportingDocumentSelection,
} from '../src/services/patientSupportingDocumentApiService.js';

const file = (name, size = 1024, type = 'application/pdf') => ({ name, size, type });
const appointment = { id: 'appointment-new' };

test('booking supporting documents are optional and approved files validate', () => {
  assert.equal(validateSupportingDocumentSelection([]), '');
  assert.equal(validateSupportingDocumentSelection([file('result.pdf'), file('photo.JPG', 2048, 'image/jpeg'), file('scan.png', 2048, 'image/png')]), '');
  assert.equal(formatSupportingDocumentSize(1887437), '1.8 MB');
  assert.equal(supportingDocumentTypeLabel('photo.jpeg'), 'Image');
});

test('frontend selection blocks unsupported types and mismatched browser types', () => {
  assert.match(validateSupportingDocumentSelection([file('payload.exe', 100, 'application/octet-stream')]), /PDF, JPG, JPEG, or PNG/);
  assert.match(validateSupportingDocumentSelection([file('payload.pdf', 100, 'text/html')]), /PDF, JPG, JPEG, or PNG/);
});

test('frontend selection enforces per-file, count, and combined limits', () => {
  assert.match(validateSupportingDocumentSelection([file('large.pdf', SUPPORTING_DOCUMENT_MAX_FILE_SIZE + 1)]), /5 MB or smaller/);
  assert.match(validateSupportingDocumentSelection(Array.from({ length: 6 }, (_, index) => file(`${index}.pdf`))), /up to 5 files/);
  assert.match(validateSupportingDocumentSelection(Array.from({ length: 5 }, (_, index) => file(`${index}.pdf`, SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE / 5 + 1))), /cannot exceed 25 MB/);
});

test('appointment creation occurs before upload and uses the newly created ID', async () => {
  const calls = [];
  const result = await createAppointmentThenUploadDocuments({ values: { reason: 'test' }, files: [file('result.pdf')], async createAppointment(values) { calls.push(['create', values]); return appointment; }, async uploadSupportingDocuments(id, files) { calls.push(['upload', id, files.length]); return [{ id: 'doc-1' }]; } });
  assert.deepEqual(calls, [['create', { reason: 'test' }], ['upload', appointment.id, 1]]);
  assert.equal(result.uploadStatus, 'uploaded');
});

test('appointment failure prevents upload', async () => {
  let uploadCalls = 0;
  await assert.rejects(createAppointmentThenUploadDocuments({ values: {}, files: [file('result.pdf')], async createAppointment() { throw new Error('booking failed'); }, async uploadSupportingDocuments() { uploadCalls += 1; } }), /booking failed/);
  assert.equal(uploadCalls, 0);
});

test('document upload failure preserves the created appointment without cancellation', async () => {
  let cancellationCalls = 0;
  const result = await createAppointmentThenUploadDocuments({ values: {}, files: [file('result.pdf')], async createAppointment() { return appointment; }, async uploadSupportingDocuments() { throw new Error('upload failed'); }, async cancelAppointment() { cancellationCalls += 1; } });
  assert.equal(result.appointment, appointment); assert.equal(result.uploadStatus, 'failed'); assert.equal(cancellationCalls, 0);
});

test('no selected files completes booking without an upload request', async () => {
  let uploadCalls = 0;
  const result = await createAppointmentThenUploadDocuments({ values: {}, files: [], async createAppointment() { return appointment; }, async uploadSupportingDocuments() { uploadCalls += 1; } });
  assert.equal(result.uploadStatus, 'not-selected'); assert.equal(uploadCalls, 0);
});

test('repository uses appointment-scoped authenticated upload, list, and download routes', async () => {
  const calls = [];
  const client = { async upload(path, formData, options) { calls.push(['upload', path, options.method, [...formData.keys()]]); return { supporting_documents: [] }; }, async request(path) { calls.push(['list', path]); return { supporting_documents: [] }; }, async download(path) { calls.push(['download', path]); return { blob: new Blob(['%PDF']) }; } };
  const repository = createPatientApiRepository(client);
  const uploadFile = new File(['%PDF-'], 'result.pdf', { type: 'application/pdf' });
  await repository.uploadSupportingDocuments('appointment/1', [uploadFile]); await repository.listSupportingDocuments('appointment/1'); await repository.downloadSupportingDocument('appointment/1', 'document/1');
  assert.deepEqual(calls, [['upload', '/api/patient/appointments/appointment%2F1/supporting-documents', 'POST', ['files']], ['list', '/api/patient/appointments/appointment%2F1/supporting-documents'], ['download', '/api/patient/appointments/appointment%2F1/supporting-documents/document%2F1']]);
});

test('API client keeps multipart boundaries browser-owned and downloads private blobs', async () => {
  const calls = [];
  const client = createApiClient({ baseUrl: 'https://clinic.test', async fetchImpl(url, options) {
    calls.push({ url, options });
    if (url.endsWith('/download')) return new Response(new Blob(['%PDF'], { type: 'application/pdf' }), { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="result.pdf"' } });
    return new Response(JSON.stringify({ supporting_documents: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const formData = new FormData(); formData.append('files', new File(['%PDF'], 'result.pdf', { type: 'application/pdf' }));
  await client.upload('/upload', formData, { method: 'POST' });
  const download = await client.download('/download');
  assert.equal(calls[0].options.body, formData); assert.equal(calls[0].options.credentials, 'include'); assert.equal('Content-Type' in calls[0].options.headers, false);
  assert.equal(calls[1].options.credentials, 'include'); assert.equal(download.blob.type, 'application/pdf'); assert.match(download.contentDisposition, /result\.pdf/);
});

test('service normalizes only Patient-safe document metadata', async () => {
  const service = createPatientSupportingDocumentService({ async listSupportingDocuments() { return [{ id: 'd1', appointment_id: 'a1', original_filename: '<img>.png', mime_type: 'image/png', file_size: 12, uploaded_at: '2026-10-13T00:00:00.000Z', storage_file_id: 'hidden' }]; } });
  const [item] = await service.listSupportingDocuments('a1');
  assert.deepEqual(item, { id: 'd1', appointmentId: 'a1', filename: '<img>.png', mimeType: 'image/png', size: 12, uploadedAt: '2026-10-13T00:00:00.000Z' }); assert.equal('storage_file_id' in item, false);
});

test('booking UI has optional multi-file selection, removal, no categories, and partial-success copy', async () => {
  const source = await readFile(new URL('../src/pages/patient/PatientBooking.jsx', import.meta.url), 'utf8');
  assert.match(source, /Supporting Documents \(Optional\)/); assert.match(source, /type="file" multiple/); assert.match(source, /accept="\.pdf,\.jpg,\.jpeg,\.png/); assert.match(source, /aria-label=\{`Remove \$\{file\.name\}`\}/); assert.match(source, /createAppointmentThenUploadDocuments/); assert.match(source, /appointment was booked successfully, but/); assert.doesNotMatch(source, /document (?:category|type)<\/label>|cancelAppointment|deleteAppointment|dangerouslySetInnerHTML/i);
});

test('appointment and Medical Record details use exact appointment-scoped secure document component', async () => {
  const appointmentSource = await readFile(new URL('../src/pages/patient/PatientAppointmentDetail.jsx', import.meta.url), 'utf8'); const recordSource = await readFile(new URL('../src/pages/patient/PatientRecordDetail.jsx', import.meta.url), 'utf8'); const componentSource = await readFile(new URL('../src/components/documents/SupportingDocumentList.jsx', import.meta.url), 'utf8');
  assert.match(appointmentSource, /appointmentId=\{item\.id\}/); assert.match(recordSource, /appointmentId=\{record\.appointment_id\}/); assert.match(recordSource, /Supporting Documents from this Visit/); assert.match(componentSource, /downloadSupportingDocument\(appointmentId, documentItem\.id\)/); assert.match(componentSource, /URL\.createObjectURL/); assert.match(componentSource, /URL\.revokeObjectURL/); assert.doesNotMatch(componentSource, /localStorage|sessionStorage|dangerouslySetInnerHTML|https?:\/\//);
});

test('supporting-document UI remains absent from Staff and Admin pages', async () => {
  const paths = ['../src/pages/staff/StaffPatientDetail.jsx', '../src/pages/admin/ManagePatients.jsx'];
  for (const path of paths) assert.doesNotMatch(await readFile(new URL(path, import.meta.url), 'utf8'), /SupportingDocument|supporting document/i);
});
