import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildCertificatePdf,
  certificatePdfFilename,
  downloadCertificatePdf,
} from '../src/services/certificatePdfService.js';

const certificate = {
  medical_certificate_number: 'MC-2026-0001',
  patientName: 'Demo Patient',
  purpose: 'Fit to return to work',
  diagnosis_summary: 'Resolved viral infection',
  date_issued: '2026-09-25',
  valid_until: '2026-09-30',
  status: 'issued',
  doctor: 'Dr. Maria Santos',
  specialty: 'General Medicine',
  license_number: 'LIC-12345',
  ptr_number: 'PTR-67890',
  signature_available: true,
  clinic: { name: 'Arion Health Clinic', location: '123 Health Street' },
};

test('builds an issued certificate as a PDF with the approved display fields', () => {
  const bytes = buildCertificatePdf(certificate);
  const pdf = new TextDecoder().decode(bytes);

  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /Arion Health Clinic/);
  assert.match(pdf, /MC-2026-0001/);
  assert.match(pdf, /Demo Patient/);
  assert.match(pdf, /Dr\. Maria Santos/);
  assert.match(pdf, /License No\. LIC-12345 \| PTR No\. PTR-67890/);
  assert.match(pdf, /%%EOF\n$/);
  assert.equal(certificatePdfFilename(certificate), 'Medical-Certificate-MC-2026-0001.pdf');
});

test('rejects PDF generation for a draft certificate', () => {
  assert.throws(
    () => buildCertificatePdf({ ...certificate, status: 'draft' }),
    /Only an issued medical certificate can be downloaded/,
  );
});

test('downloads through a temporary object URL and revokes it', () => {
  let appended = false;
  let clicked = false;
  let removed = false;
  let revoked = null;
  const anchor = {
    hidden: false,
    click() { clicked = true; },
    remove() { removed = true; },
  };
  const environment = {
    Blob,
    URL: {
      createObjectURL(blob) {
        assert.equal(blob.type, 'application/pdf');
        assert.ok(blob.size > 0);
        return 'blob:certificate';
      },
      revokeObjectURL(url) { revoked = url; },
    },
    document: {
      createElement(tagName) {
        assert.equal(tagName, 'a');
        return anchor;
      },
      body: { appendChild(value) { appended = value === anchor; } },
    },
    setTimeout(callback) { callback(); },
  };

  downloadCertificatePdf(certificate, environment);

  assert.equal(appended, true);
  assert.equal(clicked, true);
  assert.equal(removed, true);
  assert.equal(anchor.download, 'Medical-Certificate-MC-2026-0001.pdf');
  assert.equal(revoked, 'blob:certificate');
});

test('Doctor and Patient certificate screens expose the shared PDF download', async () => {
  const paths = [
    '../src/pages/doctor/DoctorIssueCertificate.jsx',
    '../src/pages/patient/PatientCertificateDetail.jsx',
    '../src/pages/patient/PatientCertificates.jsx',
  ];
  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

  assert.match(sources[0], /CertificatePdfButton/);
  assert.match(sources[1], /CertificatePdfButton/);
  assert.equal(sources.some((source) => source.includes('PDF generation will be added later')), false);
  assert.equal(sources.some((source) => /disabled>Download PDF/.test(source)), false);
});
