import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCertificateStatement, certificatePurposeDisplay, CERTIFICATE_PURPOSES } from '../src/services/certificateContent.js';

const expected = {
  'Sick Leave': /recommended period of rest/,
  'School Absence': /advised to rest during the recommended period/,
  'Fit to Return': /may return to regular duties as stated in the recommendation below/,
  'Medical Consultation': /examined and consulted at Arion Health Clinic on the date indicated/,
  'Follow-up Consultation': /seen for follow-up consultation/,
  'Work Clearance': /work-related medical clearance/,
  'Travel / General Purpose': /examined and consulted at Arion Health Clinic on the date indicated/,
};

test('all approved standard purposes produce their neutral controlled statement', () => {
  assert.equal(CERTIFICATE_PURPOSES.length, 8);
  for (const [purposeCode, phrase] of Object.entries(expected)) {
    const statement = buildCertificateStatement({ purposeCode });
    assert.match(statement, phrase);
    assert.match(statement, new RegExp(`for ${purposeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.$`));
  }
  assert.doesNotMatch(buildCertificateStatement({ purposeCode: 'Work Clearance' }), /fully fit|free from disease|cleared for all duties/i);
  assert.doesNotMatch(buildCertificateStatement({ purposeCode: 'Travel / General Purpose' }), /fit to travel/i);
});

test('Other uses the stored safe custom purpose', () => {
  const statement = buildCertificateStatement({ purposeCode: 'Other', customPurpose: 'Insurance documentation' });
  assert.match(statement, /for Insurance documentation\.$/);
  assert.equal(certificatePurposeDisplay({ purposeCode: 'Other', customPurpose: 'Insurance documentation' }), 'Insurance documentation');
});

test('legacy certificates remain readable through a neutral statement', () => {
  const statement = buildCertificateStatement({ legacyPurpose: 'Legacy employer request' });
  assert.match(statement, /examined and consulted/);
  assert.match(statement, /for Legacy employer request\.$/);
});
