import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INPUT_LIMITS,
  boundedText,
  queryInteger,
  queryText,
  validateEmptyBody,
  validateQueryKeys,
} from '../src/validation/inputValidation.js';
import { validateRegistration } from '../src/validation/authValidation.js';
import { validateAppointmentCreate } from '../src/validation/appointmentValidation.js';
import {
  validateDoctorAppointmentQuery,
  validateMedicalRecordCreate,
} from '../src/validation/clinicalValidation.js';
import { validateAdminListQuery } from '../src/validation/adminAccountValidation.js';
import { validateWalkInPatient } from '../src/validation/staffOperationsValidation.js';
import { validateBlockedCreate } from '../src/validation/schedulingValidation.js';
import { validatePatientProfilePatch } from '../src/validation/patientValidation.js';
import { validatePhilippineMobile } from '../src/validation/phoneValidation.js';

const validRegistration = {
  email: 'patient@example.test',
  password: 'ValidPassword123!',
  display_name: 'Patient Name',
  contact_number: '09170000000',
  dob: '1990-01-15',
  sex: 'female',
};

test('shared validation rejects nested objects, oversized text, and unsupported query fields', () => {
  assert.throws(() => boundedText({ $ne: null }, 'name', 120), error => error.status === 400);
  assert.throws(() => boundedText('x'.repeat(121), 'name', 120), error => error.status === 400);
  assert.throws(() => queryText({ $regex: '.*' }, 'search'), error => error.code === 'INVALID_QUERY');
  assert.throws(() => queryInteger('51', 'limit', { max: 50 }), error => error.code === 'INVALID_QUERY');
  assert.throws(() => queryInteger('-1', 'page', { max: 1_000_000 }), error => error.code === 'INVALID_QUERY');
  assert.throws(() => validateQueryKeys({ unexpected: 'value' }, new Set(['search'])), error => error.code === 'INVALID_QUERY');
});

test('bodyless actions reject protected-field injection', () => {
  for (const body of [
    { status: 'completed' },
    { role: 'admin' },
    { patient_id: '507f1f77bcf86cd799439011' },
  ]) {
    assert.throws(() => validateEmptyBody(body), error => error.code === 'UNSUPPORTED_FIELD');
  }
  assert.doesNotThrow(() => validateEmptyBody({}));
});

test('Patient registration rejects server-owned account and identity fields', () => {
  for (const [field, value] of [
    ['role', 'admin'],
    ['status', 'inactive'],
    ['user_profile_id', '507f1f77bcf86cd799439011'],
    ['password_hash', 'plaintext-or-hash'],
  ]) {
    assert.throws(
      () => validateRegistration({ ...validRegistration, [field]: value }),
      error => error.status === 400,
    );
  }
  assert.throws(
    () => validateRegistration({ ...validRegistration, password: 'x'.repeat(INPUT_LIMITS.password + 1) }),
    error => error.code === 'INVALID_INPUT',
  );
  assert.throws(
    () => validateRegistration({ ...validRegistration, dob: [] }),
    error => error.code === 'INVALID_INPUT',
  );
});

test('shared Philippine mobile validation canonicalizes spaces and rejects every invalid shape', () => {
  assert.equal(validatePhilippineMobile('09171234567', 'contact_number'), '09171234567');
  assert.equal(validatePhilippineMobile('0917 123 4567', 'contact_number'), '09171234567');
  assert.equal(validatePhilippineMobile('', 'emergency_contact_number', { optional: true }), null);
  for (const value of ['wdw', '0917123', '091712345678', '12345678901', '08171234567', '0917abc4567', '+639171234567', '0917-123-4567']) {
    assert.throws(() => validatePhilippineMobile(value, 'contact_number'), error => error.status === 400);
  }
});

test('registration, Patient profile, and Staff walk-in validators share canonical phone rules', () => {
  const registration = validateRegistration({ ...validRegistration, contact_number: '0917 123 4567', emergency_contact_number: '0999 888 7777' });
  assert.equal(registration.contact_number, '09171234567');
  assert.equal(registration.emergency_contact_number, '09998887777');
  assert.equal(validatePatientProfilePatch({ contact_number: '0917 123 4567' }).contact_number, '09171234567');
  assert.equal(validatePatientProfilePatch({ emergency_contact_number: '' }).emergency_contact_number, null);
  const walkIn = validateWalkInPatient({ full_name: 'Walk-in Patient', dob: '1985-02-10', sex: 'female', contact_number: '0917 555 0123', emergency_contact_number: '' });
  assert.equal(walkIn.contact_number, '09175550123');
  assert.equal(walkIn.emergency_contact_number, null);
  for (const contact_number of ['0917123', '091712345678', '08171234567', '0917abc4567']) {
    assert.throws(() => validateRegistration({ ...validRegistration, contact_number }), error => error.code === 'INVALID_INPUT');
    assert.throws(() => validatePatientProfilePatch({ contact_number }), error => error.code === 'INVALID_INPUT');
    assert.throws(() => validateWalkInPatient({ full_name: 'Walk-in Patient', dob: '1985-02-10', sex: 'female', contact_number }), error => error.status === 400);
  }
});

test('date/time inputs reject arrays and objects before Date coercion', () => {
  assert.throws(
    () => validateAppointmentCreate({
      doctor_id: '507f1f77bcf86cd799439011',
      appointment_at: [],
      visit_type: 'general_consultation',
      reason: 'General health concern',
    }),
    error => error.code === 'INVALID_APPOINTMENT_TIME',
  );
  assert.throws(
    () => validateBlockedCreate({ start_at: {}, end_at: [], reason: 'Meeting' }),
    error => error.code === 'INVALID_DATE_TIME',
  );
});

test('medical-record input is bounded and prescriptions use an approved nested shape', () => {
  const prescription = { medicine: 'Amoxicillin', dosage: '500 mg', instructions: 'Twice daily' };
  assert.throws(
    () => validateMedicalRecordCreate({
      diagnosis: 'Diagnosis',
      prescriptions: Array.from({ length: INPUT_LIMITS.prescriptions + 1 }, () => prescription),
    }),
    error => error.status === 400,
  );
  assert.throws(
    () => validateMedicalRecordCreate({
      diagnosis: 'Diagnosis',
      prescriptions: [{ ...prescription, patient_id: '507f1f77bcf86cd799439011' }],
    }),
    error => error.code === 'UNSUPPORTED_FIELD',
  );
  assert.throws(
    () => validateMedicalRecordCreate({ diagnosis: 'Diagnosis', notes: { $ne: null } }),
    error => error.status === 400,
  );
});

test('list and clinical queries reject operator-style and invalid pagination input', () => {
  assert.throws(
    () => validateDoctorAppointmentQuery({ 'patient_id[$ne]': 'x' }),
    error => error.code === 'INVALID_QUERY',
  );
  assert.throws(
    () => validateAdminListQuery({ search: { $ne: null } }),
    error => error.code === 'INVALID_QUERY',
  );
  assert.throws(
    () => validateAdminListQuery({ limit: 500 }),
    error => error.code === 'INVALID_QUERY',
  );
});

test('walk-in Patient validation accepts approved allergies and enforces collection limits', () => {
  const patient = validateWalkInPatient({
    full_name: 'Walk-in Patient',
    dob: '1985-02-10',
    sex: 'female',
    contact_number: '09175550123',
    allergies: ['Penicillin'],
    is_pwd: false,
  });
  assert.deepEqual(patient.allergies, ['Penicillin']);
  assert.equal(patient.user_profile_id, null);

  assert.throws(
    () => validateWalkInPatient({
      full_name: 'Walk-in Patient',
      dob: '1985-02-10',
      sex: 'female',
      contact_number: '09175550123',
      allergies: Array.from({ length: INPUT_LIMITS.allergies + 1 }, () => 'None'),
      is_pwd: false,
    }),
    error => error.status === 400,
  );
});
