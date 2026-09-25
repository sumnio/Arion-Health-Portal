import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import {
  Appointment,
  AuthAccount,
  Doctor,
  DoctorAvailability,
  DoctorBlockedTime,
  DoctorPublishedAvailability,
  MedicalCertificate,
  MedicalRecord,
  Patient,
  Prescription,
  Staff,
  UserProfile,
} from '../src/models/index.js';

const objectId = () => new mongoose.Types.ObjectId();

function indexByName(model, name) {
  return model.schema.indexes().find(([, options]) => options.name === name);
}

test('all domain models load with their intended collection names', () => {
  assert.deepEqual(
    [
      UserProfile,
      AuthAccount,
      Patient,
      Doctor,
      Staff,
      Appointment,
      DoctorAvailability,
      DoctorPublishedAvailability,
      DoctorBlockedTime,
      MedicalRecord,
      Prescription,
      MedicalCertificate,
    ].map((model) => model.collection.collectionName),
    [
      'user_profiles',
      'auth_accounts',
      'patients',
      'doctors',
      'staff',
      'appointments',
      'doctor_availability',
      'doctor_published_availability',
      'doctor_blocked_times',
      'medical_records',
      'prescriptions',
      'medical_certificates',
    ],
  );
});

test('a complete set of valid related documents passes model validation', async () => {
  const userProfileId = objectId();
  const patientId = objectId();
  const doctorId = objectId();
  const appointmentId = objectId();
  const recordId = objectId();

  const documents = [
    new UserProfile({
      _id: userProfileId,
      display_name: 'Dr. Model Test',
      role: 'doctor',
      contact_number: '09170000000',
    }),
    new Patient({
      _id: patientId,
      full_name: 'Patient Model Test',
      contact_number: '09171111111',
      dob: new Date('1990-01-15'),
      sex: 'Female',
    }),
    new Doctor({
      _id: doctorId,
      user_profile_id: userProfileId,
      specialty: 'General Medicine',
      license_number: 'LIC-MODEL-001',
      ptr_number: 'PTR-MODEL-001',
    }),
    new Staff({ user_profile_id: objectId() }),
    new Appointment({
      _id: appointmentId,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_at: new Date('2026-09-28T13:00:00Z'),
      visit_type: 'general_consultation',
      reason: 'General consultation',
    }),
    new DoctorAvailability({
      doctor_id: doctorId,
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
    }),
    new DoctorPublishedAvailability({
      doctor_id: doctorId,
      availability_date: new Date('2026-09-28'),
      start_time: '09:00',
      end_time: '17:00',
    }),
    new DoctorBlockedTime({
      doctor_id: doctorId,
      start_at: new Date('2026-09-28T16:00:00Z'),
      end_at: new Date('2026-09-28T17:00:00Z'),
      reason: 'Meeting',
    }),
    new MedicalRecord({
      _id: recordId,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId,
      encounter_at: new Date('2026-09-28T13:00:00Z'),
      diagnosis: 'Upper respiratory tract infection',
    }),
    new Prescription({
      medical_record_id: recordId,
      medicine: 'Paracetamol',
      dosage: '500 mg',
    }),
    new MedicalCertificate({
      medical_certificate_number: 'MC-MODEL-001',
      patient_id: patientId,
      doctor_id: doctorId,
      medical_record_id: recordId,
      date_issued: new Date('2026-09-28'),
      purpose: 'Work clearance',
      diagnosis_summary: 'Fit to return to work',
      status: 'issued',
    }),
  ];

  await Promise.all(documents.map((document) => document.validate()));
});

test('UserProfile accepts approved roles and statuses', async () => {
  for (const role of ['patient', 'doctor', 'staff', 'admin']) {
    for (const status of ['active', 'inactive']) {
      await new UserProfile({
        display_name: 'Test Account',
        contact_number: '09170000000',
        role,
        status,
      }).validate();
    }
  }
});

test('UserProfile rejects unapproved roles and statuses', async () => {
  await assert.rejects(
    new UserProfile({
      display_name: 'Test Account',
      contact_number: '09170000000',
      role: 'owner',
      status: 'suspended',
    }).validate(),
    /not a valid enum/i,
  );
});

test('UserProfile contains no password or password hash path', () => {
  assert.equal(UserProfile.schema.path('password'), undefined);
  assert.equal(UserProfile.schema.path('password_hash'), undefined);
});

test('AuthAccount owns credentials and declares unique email and profile indexes', () => {
  assert.equal(AuthAccount.schema.path('password_hash').options.select, false);
  assert.equal(indexByName(AuthAccount, 'unique_auth_account_email')[1].unique, true);
  assert.equal(indexByName(AuthAccount, 'unique_auth_account_profile')[1].unique, true);
});

test('Patient accepts a null UserProfile link for a walk-in', async () => {
  const patient = new Patient({
    user_profile_id: null,
    full_name: 'Walk-in Patient',
    contact_number: '09171111111',
    dob: new Date('1990-01-15'),
    sex: 'Male',
  });

  await patient.validate();
  assert.equal(patient.user_profile_id, null);
  assert.equal(patient.is_pwd, false);
  assert.deepEqual(patient.allergies, []);
});

test('Patient never stores derived senior status', () => {
  assert.equal(Patient.schema.path('is_senior'), undefined);
});

test('Doctor requires a UserProfile link', async () => {
  await assert.rejects(
    new Doctor({
      specialty: 'General Medicine',
      license_number: 'LIC-001',
      ptr_number: 'PTR-001',
    }).validate(),
    /user_profile_id.*required/i,
  );
});

test('Staff requires a UserProfile link and stores no username', async () => {
  await assert.rejects(new Staff({}).validate(), /user_profile_id.*required/i);
  assert.equal(Staff.schema.path('username'), undefined);
});

test('Appointment rejects an invalid status', async () => {
  await assert.rejects(
    new Appointment({
      patient_id: objectId(),
      doctor_id: objectId(),
      appointment_at: new Date(),
      status: 'waiting',
      visit_type: 'general_consultation',
      reason: 'Consultation',
    }).validate(),
    /status.*not a valid enum/i,
  );
});

test('Appointment rejects an invalid visit type and priority', async () => {
  await assert.rejects(
    new Appointment({
      patient_id: objectId(),
      doctor_id: objectId(),
      appointment_at: new Date(),
      visit_type: 'routine_checkup',
      reason: 'Consultation',
      priority: 'senior_pwd',
    }).validate(),
    /not a valid enum/i,
  );
});

test('recurring availability rejects an unordered time range', async () => {
  await assert.rejects(
    new DoctorAvailability({
      doctor_id: objectId(),
      day_of_week: 1,
      start_time: '13:00',
      end_time: '12:30',
    }).validate(),
    /end_time must be later/i,
  );
});

test('published availability accepts a valid ordered range', async () => {
  await new DoctorPublishedAvailability({
    doctor_id: objectId(),
    availability_date: new Date('2026-09-28'),
    start_time: '09:00',
    end_time: '12:30',
  }).validate();
});

test('blocked time rejects start_at equal to or later than end_at', async () => {
  await assert.rejects(
    new DoctorBlockedTime({
      doctor_id: objectId(),
      start_at: new Date('2026-09-28T13:00:00Z'),
      end_at: new Date('2026-09-28T13:00:00Z'),
      reason: 'Meeting',
    }).validate(),
    /end_at must be later/i,
  );
});

test('MedicalRecord supports a null appointment for an exceptional manual record', async () => {
  const record = new MedicalRecord({
    patient_id: objectId(),
    doctor_id: objectId(),
    appointment_id: null,
    encounter_at: new Date(),
    diagnosis: 'Seasonal allergic rhinitis',
  });
  await record.validate();
  assert.equal(record.appointment_id, null);
});

test('Prescription requires its MedicalRecord relation, medicine, and dosage', async () => {
  await assert.rejects(
    new Prescription({ instructions: 'After meals' }).validate(),
    /required/i,
  );
});

test('MedicalCertificate rejects valid_until before date_issued', async () => {
  await assert.rejects(
    new MedicalCertificate({
      medical_certificate_number: 'MC-TEST-001',
      patient_id: objectId(),
      doctor_id: objectId(),
      date_issued: new Date('2026-09-25'),
      valid_until: new Date('2026-09-24'),
      purpose: 'Work clearance',
      diagnosis_summary: 'Fit to return to work',
      status: 'issued',
    }).validate(),
    /valid_until cannot be earlier/i,
  );
});

test('Doctor and Staff declare one-profile unique constraints', () => {
  assert.equal(indexByName(Doctor, 'unique_doctor_profile')[1].unique, true);
  assert.equal(indexByName(Staff, 'unique_staff_profile')[1].unique, true);
});

test('critical identity and clinical uniqueness indexes are declared', () => {
  assert.equal(indexByName(Patient, 'unique_patient_portal_profile')[1].unique, true);
  assert.equal(indexByName(Doctor, 'unique_doctor_license')[1].unique, true);
  assert.equal(indexByName(Doctor, 'unique_doctor_ptr')[1].unique, true);
  assert.equal(indexByName(MedicalRecord, 'unique_record_per_appointment')[1].unique, true);
  assert.equal(
    indexByName(MedicalCertificate, 'unique_medical_certificate_number')[1].unique,
    true,
  );
});

test('active same-doctor slot constraint excludes cancelled and no-show statuses', () => {
  const [, options] = indexByName(Appointment, 'unique_blocking_doctor_slot');
  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression.status.$in, [
    'pending',
    'confirmed',
    'completed',
  ]);
});

test('Appointment created_by is a nullable UserProfile reference', async () => {
  const path = Appointment.schema.path('created_by');
  assert.equal(path.options.ref, 'UserProfile');
  assert.equal(path.options.default, null);

  const appointment = new Appointment({
    patient_id: objectId(),
    doctor_id: objectId(),
    appointment_at: new Date('2026-09-28T13:00:00Z'),
    visit_type: 'general_consultation',
    reason: 'Imported appointment',
  });
  await appointment.validate();
  assert.equal(appointment.created_by, null);
});

test('relationship and scheduling lookup indexes are declared', () => {
  assert.ok(indexByName(Patient, 'patient_contact_lookup'));
  assert.ok(indexByName(Appointment, 'patient_appointment_history'));
  assert.ok(indexByName(DoctorAvailability, 'doctor_weekly_availability_lookup'));
  assert.ok(
    indexByName(DoctorPublishedAvailability, 'doctor_published_availability_lookup'),
  );
  assert.ok(indexByName(DoctorBlockedTime, 'doctor_blocked_time_lookup'));
  assert.ok(indexByName(MedicalRecord, 'patient_medical_record_history'));
  assert.ok(indexByName(Prescription, 'medical_record_prescription_lookup'));
});
