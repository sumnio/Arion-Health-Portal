import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { patientProfileService, ageFromDob, isSenior } from '../src/services/patientProfileService.js';
const form = () => { const value = patientProfileService.get(); return { ...value, allergies: value.allergies.join(', ') }; };
test('senior status is derived at the birthday boundary; invalid and future dates are rejected', () => {
  assert.equal(isSenior('1966-09-18', '2026-09-17'), false);
  assert.equal(isSenior('1966-09-18', '2026-09-18'), true);
  assert.equal(ageFromDob('2000-02-29', '2026-02-28'), 25);
  assert.equal(ageFromDob('2026-02-30', '2026-09-18'), null);
  assert.equal(ageFromDob('2027-01-01', '2026-09-18'), null);
});
test('required and malformed contact fields block save without changing saved data', () => {
  const before = patientProfileService.get();
  const result = patientProfileService.save({ ...form(), fullName: ' ', dob: '', sex: '', contactNumber: 'abc', emergencyNumber: 'bad' });
  assert.deepEqual(Object.keys(result.errors).sort(), ['contactNumber', 'dob', 'emergencyNumber', 'fullName', 'sex']);
  assert.deepEqual(patientProfileService.get(), before);
});
test('save supports blank optional fields, normalizes allergies, and protects account email', () => {
  const original = form();
  const values = { ...original, fullName: ' Test Patient ', email: 'changed@example.com', address: '', emergencyName: '', emergencyNumber: '', relationship: '', allergies: ' Peanuts,\nPenicillin, ', isPwd: true };
  const result = patientProfileService.save(values);
  assert.equal(result.profile.fullName, 'Test Patient');
  assert.equal(result.profile.email, original.email);
  assert.deepEqual(result.profile.allergies, ['Peanuts', 'Penicillin']);
  assert.equal(result.profile.isPwd, undefined);
  result.profile.fullName = 'Unsaved change';
  assert.equal(patientProfileService.get().fullName, 'Test Patient');
  assert.equal('isSenior' in result.profile, false);
  assert.deepEqual(patientProfileService.save({ ...values, allergies: '' }).profile.allergies, []);
  patientProfileService.save(original);
});

test('PWD verification is a separate private status and upload section with no self-declared control', async () => {
  const [page, section, register, walkIn, styles] = await Promise.all([
    readFile(new URL('../src/pages/patient/PatientProfile.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/PwdVerificationSection.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/public/RegisterPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/staff/StaffRegisterWalkIn.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/patient-profile.css', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /<PwdVerificationSection/);
  assert.doesNotMatch(page, /profile-pwd|Person with Disability \(PWD\) status/);
  assert.match(section, /Pending Verification/);
  assert.match(section, /Front of PWD ID/);
  assert.match(section, /Back of PWD ID/);
  assert.match(section, /name printed on the ID must match the name on your Patient profile/);
  assert.doesNotMatch(section, /PWD ID number/);
  assert.doesNotMatch(section, /\.pdf/);
  assert.match(styles, /::file-selector-button/);
  assert.match(styles, /background: #edf4fb/);
  assert.match(section, /maximum 5 MB/);
  assert.match(section, /stored privately/);
  assert.match(section, /Submit Again/);
  assert.match(section, /rejection_reason/);
  assert.match(section, /status === 'rejected'/);
  assert.doesNotMatch(section, /setVerification\([^)]*verified/);
  assert.doesNotMatch(register, /is_pwd|PWD/);
  assert.doesNotMatch(walkIn, /type="checkbox"|values\.is_pwd/);
  assert.match(walkIn, /verified PWD status/);
});
