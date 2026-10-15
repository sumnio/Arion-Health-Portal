import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { certificatePdfFilename, downloadCertificatePdf } from '../src/services/certificatePdfService.js';

const certificate = { id: 'certificate-1', medical_certificate_number: 'MC-2026-0001', status: 'issued' };

test('uses the authoritative certificate number for the PDF filename', () => {
  assert.equal(certificatePdfFilename(certificate), 'Medical-Certificate-MC-2026-0001.pdf');
});

test('downloads the authenticated immutable PDF and revokes its object URL', async () => {
  let requestedId; let appended = false; let clicked = false; let removed = false; let revoked = null;
  const anchor = { hidden: false, click() { clicked = true; }, remove() { removed = true; } };
  const environment = {
    Blob,
    URL: { createObjectURL(blob) { assert.equal(blob.type, 'application/pdf'); return 'blob:certificate'; }, revokeObjectURL(url) { revoked = url; } },
    document: { createElement(tagName) { assert.equal(tagName, 'a'); return anchor; }, body: { appendChild(value) { appended = value === anchor; } } },
    setTimeout(callback) { callback(); },
  };
  await downloadCertificatePdf(certificate, async id => { requestedId = id; return new Blob(['%PDF-1.4'], { type: 'application/pdf' }); }, environment);
  assert.equal(requestedId, certificate.id); assert.equal(appended, true); assert.equal(clicked, true); assert.equal(removed, true);
  assert.equal(anchor.download, 'Medical-Certificate-MC-2026-0001.pdf'); assert.equal(revoked, 'blob:certificate');
});

test('Doctor and Patient certificate screens use the authenticated shared PDF download', async () => {
  const sources = await Promise.all([
    '../src/pages/doctor/DoctorIssueCertificate.jsx', '../src/pages/patient/PatientCertificateDetail.jsx',
    '../src/components/certificates/CertificatePdfButton.jsx',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')));
  assert.match(sources[0], /CertificatePdfButton/); assert.match(sources[1], /CertificatePdfButton/);
  assert.match(sources[2], /downloadCertificatePdf/); assert.match(sources[2], /doctorApiService/); assert.match(sources[2], /patientApiService/);
  assert.equal(sources.some(source => /signature_path|storage_file_id|public_url/.test(source)), false);
});

test('Patient certificate preview renders the same authenticated immutable server PDF', async () => {
  const source = await readFile(new URL('../src/pages/patient/PatientCertificateDetail.jsx', import.meta.url), 'utf8');
  assert.match(source, /CertificatePdfPreview/);
  assert.match(source, /service=\{patientApiService\}/);
  assert.match(source, /certificateId=\{certificate\.id\}/);
  assert.doesNotMatch(source, /<CertificatePreview/);
});
