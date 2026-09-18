import test from 'node:test';
import assert from 'node:assert/strict';
import { certificateService } from '../src/services/certificateService.js';
import { medicalCertificates } from '../src/mocks/certificateData.js';
import { recordCertificates } from '../src/mocks/medicalRecordData.js';

test('patient certificate list contains only issued certificates and hides drafts on direct access', () => {
  const items = certificateService.list();
  assert.equal(items.length, 2);
  assert.ok(items.every(item => item.status === 'issued' && item.date_issued));
  assert.ok(items[0].date_issued > items[1].date_issued);
  assert.equal(certificateService.get(medicalCertificates.find(item => item.status === 'draft').id), null);
  assert.equal(certificateService.get('missing'), null);
});
test('certificate details preserve existing record links and nullable fields', () => {
  const expected = recordCertificates[0];
  const item = certificateService.get(expected.id);
  for (const key of Object.keys(expected)) assert.equal(item[key], expected[key]);
  assert.equal(item.relatedRecord.id, expected.medical_record_id);
  assert.equal(item.patientName, 'Demo Patient');
  assert.equal(item.valid_until, null);
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
