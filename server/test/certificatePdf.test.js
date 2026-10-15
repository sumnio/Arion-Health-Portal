import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import test from 'node:test';
import { buildCertificatePdf, CERTIFICATE_PDF_RENDER_VERSION } from '../src/services/certificatePdfService.js';

function chunk(type, data = Buffer.alloc(0)) {
  const result = Buffer.alloc(12 + data.length); result.writeUInt32BE(data.length, 0); result.write(type, 4, 4, 'ascii'); data.copy(result, 8); return result;
}
function signaturePng(width = 400, height = 120) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = []; for (let y = 0; y < height; y += 1) { const row = Buffer.alloc(1 + width * 4, 255); row[0] = 0; for (let x = 0; x < width; x += 1) { const position = 1 + x * 4; row[position] = 16; row[position + 1] = 78; row[position + 2] = 139; row[position + 3] = x > 30 && x < width - 30 && y > 30 && y < 85 ? 255 : 0; } rows.push(row); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND')]);
}

const certificate = {
  medical_certificate_number: 'AHC-MC-2026-0001', date_issued: '2026-10-15', consultation_date: '2026-10-13', valid_until: '2026-10-18',
  patient_name: 'Synthetic Patient', patient_dob: '1995-02-01', patient_sex: 'male', purpose: 'Sick Leave',
  statement: 'This is to certify that the above-named patient was examined and consulted at Arion Health Clinic.',
  diagnosis_summary: 'Acute upper respiratory tract infection.', recommendation: 'Rest for two days and return for follow-up if symptoms persist.',
  doctor_name: 'Dr. Synthetic Physician', doctor_specialty: 'General Medicine', license_number: 'PRC-TEST-100', ptr_number: 'PTR-TEST-200',
  clinic: { name: 'Arion Health Clinic', location: 'Quezon City, Metro Manila', contact_number: '(02) 8123 4567', email: 'clinic@example.test' },
};

test('professional A4 PDF renders trusted certificate content and embedded signature', () => {
  const pdf = buildCertificatePdf(certificate, { signatureBuffer: signaturePng() }); const source = pdf.toString('binary');
  assert.match(source, /^%PDF-1\.4/); assert.match(source, /Arion Health Clinic/); assert.match(source, /MEDICAL CERTIFICATE/);
  for (const value of ['AHC-MC-2026-0001', 'Synthetic Patient', 'Sick Leave', 'DIAGNOSIS SUMMARY', 'RECOMMENDATION', 'Dr. Synthetic Physician', 'PRC License No. PRC-TEST-100', 'PTR No. PTR-TEST-200']) assert.ok(source.includes(value));
  assert.match(source, /\/MediaBox \[0 0 595\.28 841\.89\]/); assert.match(source, /\/Logo Do/); assert.match(source, /\/FlateDecode/); assert.match(source, /\/SMask/); assert.match(source, /\/Sig Do/);
  assert.doesNotMatch(source, /Primary Care|Family Medicine|Wellness|prescription|supporting.document|storage_file_id|GridFS/iu);
  assert.equal(CERTIFICATE_PDF_RENDER_VERSION, 'arion-certificate-v2');
});

test('renderer bundles the actual Arion logo locally without a public image URL or generic cross', async () => {
  const [renderer, logo] = await Promise.all([
    readFile(new URL('../src/services/certificatePdfService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/assets/arion-medical-logo.png', import.meta.url)),
  ]);
  assert.deepEqual([...logo.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(renderer, /arion-medical-logo\.png/);
  assert.doesNotMatch(renderer, /https?:\/\/|top - 34, 34, 34|top - 29, 10, 24/);
});

test('certificate issuance loads the trusted Doctor display name for preview and final rendering', async () => {
  const repository = await readFile(new URL('../src/repositories/clinicalRepository.js', import.meta.url), 'utf8');
  assert.match(repository, /findDoctorByUserProfileId[\s\S]*?populate\(\{ path: 'user_profile_id', select: 'display_name' \}\)[\s\S]*?\.lean\(\)/);
});

test('draft preview uses the same renderer with a safe missing-signature state', () => {
  const pdf = buildCertificatePdf({ ...certificate, medical_certificate_number: 'DRAFT PREVIEW' }, { signatureMissingText: 'Signature not configured - preview only' });
  const source = pdf.toString('binary');
  assert.match(source, /DRAFT PREVIEW/);
  assert.match(source, /Signature not configured - preview only/);
  assert.match(source, /\/Logo Do/);
  assert.doesNotMatch(source, /Legacy certificate - signature not archived/);
});

test('long content continues safely and legacy rendering does not inject a signature', () => {
  const long = 'Detailed synthetic certificate content '.repeat(40);
  const pdf = buildCertificatePdf({ ...certificate, patient_name: 'A Very Long Synthetic Patient Name That Must Wrap Safely', purpose: long, diagnosis_summary: long, recommendation: long }, { signatureBuffer: null });
  const source = pdf.toString('binary'); assert.match(source, /\/Count [2-9]/); assert.match(source, /Legacy certificate - signature not archived/); assert.doesNotMatch(source, /\/Sig Do/);
});
