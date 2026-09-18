import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal(result.profile.isPwd, true);
  result.profile.fullName = 'Unsaved change';
  assert.equal(patientProfileService.get().fullName, 'Test Patient');
  assert.equal('isSenior' in result.profile, false);
  assert.deepEqual(patientProfileService.save({ ...values, allergies: '' }).profile.allergies, []);
  patientProfileService.save(original);
});
