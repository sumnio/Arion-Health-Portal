import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateService } from '../src/services/certificateService.js';
import { medicalCertificates } from '../src/mocks/certificateData.js';
import { clinicConfig } from '../src/config/clinicConfig.js';
import { readFile } from 'node:fs/promises';

test('patient certificate list contains only issued certificates and hides drafts on direct access', () => {
  const items = certificateService.list();
  assert.equal(items.length, 2);
  assert.ok(items.every(item => item.status === 'issued' && item.date_issued));
  assert.ok(items.every(item => item.medical_certificate_number));
  assert.equal(new Set(medicalCertificates.map(item => item.medical_certificate_number)).size, medicalCertificates.length);
  assert.ok(items[0].date_issued > items[1].date_issued);
  assert.equal(certificateService.get(medicalCertificates.find(item => item.status === 'draft').id), null);
  assert.equal(certificateService.get('missing'), null);
});
test('certificate details preserve existing record links and nullable fields', () => {
  const expected = medicalCertificates[0];
  const item = certificateService.get(expected.id);
  for (const key of Object.keys(expected)) assert.equal(item[key], expected[key]);
  assert.equal(item.relatedRecord.id, expected.medical_record_id);
  assert.equal(item.patientName, 'Demo Patient');
  assert.equal(item.valid_until, null);
  assert.equal(item.license_number, 'PRC-0123456');
  assert.equal(item.ptr_number, 'PTR-2026-1001');
  assert.equal(item.signature_available, true);
  assert.equal(item.signature_path, undefined);
  assert.deepEqual(item.clinic, clinicConfig);
  const unlinked = certificateService.list().find(item => !item.medical_record_id);
  assert.equal(unlinked.relatedRecord, null);
  assert.ok(unlinked.valid_until);
});
test('other patients are excluded and returned previews cannot mutate fixtures', () => {
  const fixture = medicalCertificates[1];
  const originalPatient = fixture.patient_id;
  try {
    fixture.patient_id = 'another-patient';
    assert.equal(certificateService.get(fixture.id), null);
    assert.ok(!certificateService.list().some(item => item.id === fixture.id));
  } finally { fixture.patient_id = originalPatient; }
  const item = certificateService.get(fixture.id);
  item.purpose = 'Changed';
  item.clinic.name = 'Changed';
  assert.notEqual(certificateService.get(fixture.id).purpose, 'Changed');
  assert.equal(certificateService.get(fixture.id).clinic.name, 'Arion Health Clinic');
});
test('patient certificate presentation is read-only and uses shared legitimacy sources', async () => {
  assert.equal(certificateService.update, undefined);
  assert.equal(certificateService.delete, undefined);
  const preview = await readFile(new URL('../src/components/certificates/CertificatePreview.jsx', import.meta.url), 'utf8');
  const facts = await readFile(new URL('../src/components/certificates/CertificateFacts.jsx', import.meta.url), 'utf8');
  const doctorPage = await readFile(new URL('../src/pages/doctor/DoctorIssueCertificate.jsx', import.meta.url), 'utf8');
  const fixtureSource = await readFile(new URL('../src/mocks/certificateData.js', import.meta.url), 'utf8');
  assert.match(preview, /medical_certificate_number/);
  assert.match(preview, /license_number/);
  assert.match(preview, /ptr_number/);
  assert.match(preview, /signature_available/);
  assert.match(facts, /Certificate number/);
  assert.match(doctorPage, /context\.clinic\.name/);
  assert.doesNotMatch(doctorPage, /Arion Health Clinic|Quezon City/);
  assert.doesNotMatch(fixtureSource, /Arion Health Clinic|Wellness Avenue/);
  assert.doesNotMatch(preview + facts, />Edit|>Delete|>Reissue/);
});
