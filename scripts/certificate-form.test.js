import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { certificateDraftStatement, certificatePurposeLabel, certificatePurposeOptions } from '../src/services/certificateContent.js';

test('certificate purpose options and draft statements follow the approved controlled content', () => {
  assert.deepEqual(certificatePurposeOptions, [
    'Sick Leave', 'School Absence', 'Fit to Return', 'Medical Consultation',
    'Follow-up Consultation', 'Work Clearance', 'Travel / General Purpose', 'Other',
  ]);
  assert.match(certificateDraftStatement('Fit to Return'), /may return to regular duties as stated in the recommendation below/);
  assert.match(certificateDraftStatement('Other', 'Insurance documentation'), /for Insurance documentation\.$/);
  assert.equal(certificatePurposeLabel('Other', '  Insurance documentation  '), 'Insurance documentation');
});

test('Doctor certificate form uses a dropdown, conditional Other field, and server PDF preview', async () => {
  const source = await readFile(new URL('../src/pages/doctor/DoctorIssueCertificate.jsx', import.meta.url), 'utf8');
  assert.match(source, /<select id="purpose"/);
  assert.match(source, /<option value="">Select purpose<\/option>/);
  assert.match(source, /values\.purpose === 'Other'/);
  assert.match(source, /Specify Purpose \*/);
  assert.match(source, /custom_purpose: purpose === 'Other' \? previous\.custom_purpose : ''/);
  assert.match(source, /Recommendation \*/);
  assert.match(source, /CertificatePdfPreview/);
  assert.match(source, /The final issue date is assigned by the server/);
  assert.match(source, /useUnsavedChangesWarning\(hasUnsavedChanges && !issued && !submitting\)/);
  assert.match(source, /setHasUnsavedChanges\(false\)/);
  assert.match(source, /appointmentId: record\.appointment_id, tab: 'consultation'/);
  assert.doesNotMatch(source, /name="purpose" label="Purpose/);
  assert.doesNotMatch(source, /Prescription|Doctor notes|supporting document/i);
});

test('unfinished certificate input warns before leaving without storing sensitive drafts', async () => {
  const source = await readFile(new URL('../src/hooks/useUnsavedChangesWarning.js', import.meta.url), 'utf8');
  assert.match(source, /You have unsaved certificate changes\. Leave without issuing\?/);
  assert.match(source, /beforeunload/);
  assert.match(source, /document\.addEventListener\('click'/);
  assert.match(source, /window\.confirm/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('Doctor PDF preview is authenticated, debounced, race-safe, and cleans Blob URLs', async () => {
  const source = await readFile(new URL('../src/components/certificates/CertificatePdfPreview.jsx', import.meta.url), 'utf8');
  assert.match(source, /previewCertificatePdf/);
  assert.match(source, /PREVIEW_DEBOUNCE_MS = 600/);
  assert.match(source, /AbortController/);
  assert.match(source, /requestId !== requestRef\.current/);
  assert.match(source, /URL\.createObjectURL/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /Updating certificate preview\.\.\./);
  assert.match(source, /Certificate preview could not be generated\./);
  assert.match(source, /<iframe/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|CertificatePreview/);
});

test('shared issued preview includes the generated statement and recommendation', async () => {
  const source = await readFile(new URL('../src/components/certificates/CertificatePreview.jsx', import.meta.url), 'utf8');
  assert.match(source, /Certification statement/);
  assert.match(source, /certificate\.statement/);
  assert.match(source, /Recommendation/);
  assert.match(source, /certificate\.recommendation/);
});
