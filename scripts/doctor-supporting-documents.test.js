import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDoctorApiRepository } from '../src/repositories/doctorApiRepository.js';
import { createDoctorSupportingDocumentService } from '../src/services/doctorSupportingDocumentApiService.js';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Doctor repository uses exact appointment-scoped list and download routes', async () => {
  const calls = [];
  const repository = createDoctorApiRepository({ async request(path) { calls.push(['list', path]); return { supporting_documents: [] }; }, async download(path) { calls.push(['download', path]); return { blob: new Blob(['%PDF']) }; } });
  await repository.listSupportingDocuments('appointment/1');
  await repository.downloadSupportingDocument('appointment/1', 'document/1');
  assert.deepEqual(calls, [['list', '/api/doctor/appointments/appointment%2F1/supporting-documents'], ['download', '/api/doctor/appointments/appointment%2F1/supporting-documents/document%2F1']]);
});

test('Doctor service exposes only safe metadata and read-only operations', async () => {
  const service = createDoctorSupportingDocumentService({ async listSupportingDocuments() { return [{ id: 'd1', appointment_id: 'a1', original_filename: 'result.pdf', mime_type: 'application/pdf', file_size: 42, uploaded_at: '2026-10-13T00:00:00.000Z', storage_file_id: 'hidden' }]; }, async downloadSupportingDocument() { return { blob: new Blob(['%PDF']) }; } });
  assert.deepEqual(await service.listSupportingDocuments('a1'), [{ id: 'd1', appointmentId: 'a1', filename: 'result.pdf', mimeType: 'application/pdf', size: 42, uploadedAt: '2026-10-13T00:00:00.000Z' }]);
  assert.deepEqual(Object.keys(service).sort(), ['downloadSupportingDocument', 'listSupportingDocuments']);
});

test('shared list opens an accessible full-screen viewer through a temporary URL with no download or mutation controls', async () => {
  const component = await source('../src/components/documents/SupportingDocumentList.jsx');
  assert.match(component, /documentService = patientSupportingDocumentService/);
  assert.match(component, /documentService\.listSupportingDocuments\(appointmentId\)/);
  assert.match(component, /documentService\.downloadSupportingDocument\(appointmentId, documentItem\.id\)/);
  assert.match(component, /URL\.createObjectURL/);
  assert.match(component, /URL\.revokeObjectURL/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /Close document viewer/);
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /toolbar=0&navpanes=0&scrollbar=1/);
  assert.match(component, /<img src=\{preview\.url\}/);
  assert.doesNotMatch(component, /View \/ Download|anchor\.download|type="file"|uploadSupportingDocuments|deleteSupportingDocument|replaceSupportingDocument|renameSupportingDocument|localStorage|sessionStorage/);
});

test('Consultation places exact-appointment documents in the existing tab and hides them for an existing record', async () => {
  const detail = await source('../src/pages/doctor/DoctorPatientDetail.jsx');
  assert.match(detail, /activeTab === 'consultation'/);
  assert.match(detail, /title="Patient Supporting Documents"/);
  assert.match(detail, /appointmentId=\{appointment\.id\}/);
  assert.match(detail, /documentService=\{doctorSupportingDocumentService\}/);
  assert.match(detail, /!existingRecord && \['pending', 'confirmed'\]\.includes\(appointment\.status\)/);
  assert.doesNotMatch(detail, /\['documents',\s*'Documents'\]|Supporting Documents.*role="tab"/s);
});

test('Add Medical Record shows exact-appointment files and unmounts them immediately after save', async () => {
  const addRecord = await source('../src/pages/doctor/DoctorAddRecord.jsx');
  assert.match(addRecord, /title="Supporting Documents for this Consultation"/);
  assert.match(addRecord, /appointmentId=\{context\.appointment\.id\}/);
  assert.match(addRecord, /documentService=\{doctorSupportingDocumentService\}/);
  assert.ok(addRecord.indexOf('if (saved) return') < addRecord.indexOf('title="Supporting Documents for this Consultation"'));
});

test('Medical Record payload remains clinical form values only', async () => {
  const addRecord = await source('../src/pages/doctor/DoctorAddRecord.jsx');
  assert.match(addRecord, /createMedicalRecord\(context\.appointment\.id, values\)/);
  assert.doesNotMatch(addRecord.match(/async function submit[\s\S]*?if \(loading\)/)?.[0] ?? '', /supporting_documents|documentIds|storage_file_id|fileContents/);
});

test('Doctor pages offer no document mutation, category, or history controls', async () => {
  const combined = `${await source('../src/pages/doctor/DoctorPatientDetail.jsx')}\n${await source('../src/pages/doctor/DoctorAddRecord.jsx')}`;
  assert.doesNotMatch(combined, /type="file"|uploadSupportingDocuments|deleteSupportingDocument|replaceSupportingDocument|renameSupportingDocument|document category|document history/i);
});

test('document styles preserve focus, wrapping, and narrow-screen usability', async () => {
  const styles = await source('../src/styles/supporting-documents.css');
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /background:\s*rgba\(0, 0, 0, 0\.84\)/);
  assert.match(styles, /supporting-document-viewer-content[^}]*overflow:\s*auto/);
  assert.match(styles, /@media \(max-width: 500px\)/);
  assert.match(styles, /width:\s*100%/);
});

test('Staff and Admin pages expose no supporting-document UI', async () => {
  for (const path of ['../src/pages/staff/StaffPatientDetail.jsx', '../src/pages/admin/ManagePatients.jsx']) assert.doesNotMatch(await source(path), /SupportingDocument|supporting document/i);
});

test('Doctor document service has no AI, OCR, public URL, persistence, or mutation coupling', async () => {
  const service = await source('../src/services/doctorSupportingDocumentApiService.js');
  assert.doesNotMatch(service, /assistant|openai|gemini|ollama|ocr|https?:\/\/|localStorage|sessionStorage|uploadSupportingDocuments|deleteSupportingDocument|replaceSupportingDocument/i);
});
