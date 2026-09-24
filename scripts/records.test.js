import test from 'node:test';
import assert from 'node:assert/strict';
import { medicalRecordService } from '../src/services/medicalRecordService.js';
import { exampleIds } from '../src/mocks/portalData.js';
import { appointmentService } from '../src/services/appointmentService.js';

test('medical record joins preserve dashboard and appointment identity', () => {
  const expected = { id: exampleIds.record, patient_id: exampleIds.patient, doctor_id: '50000000-0000-4000-8000-000000000001', appointment_id: '20000000-0000-4000-8000-000000000002', encounter_at: '2026-09-02T10:00:00+08:00', diagnosis: 'Acute upper respiratory infection', notes: 'Rest and hydration discussed during consultation.', follow_up: null };
  const record = medicalRecordService.get(expected.id);
  for (const key of Object.keys(expected)) assert.equal(record[key], expected[key]);
  const appointment = appointmentService.get(record.appointment_id);
  assert.equal(record.patient_id, appointment.patient_id);
  assert.equal(record.doctor_id, appointment.doctor_id);
  assert.equal(record.encounter_at, appointment.appointment_at);
  assert.ok(record.prescriptions.length > 1);
  assert.ok(record.prescriptions.every(item => item.medical_record_id === record.id));
  assert.ok(record.certificates.every(item => item.medical_record_id === record.id && item.patient_id === record.patient_id));
});

test('search covers doctor, diagnosis and visit type; results are newest first', () => {
  const records = medicalRecordService.list();
  assert.equal(records.length, 4);
  assert.ok(records.every((item, index) => index === 0 || new Date(records[index - 1].encounter_at) >= new Date(item.encounter_at)));
  assert.equal(medicalRecordService.list('  REYES ').length, 1);
  assert.equal(medicalRecordService.list('rhinitis').length, 1);
  assert.equal(medicalRecordService.list('follow-up').length, 1);
  assert.equal(medicalRecordService.list('not a record').length, 0);
});

test('missing IDs and optional data are safe; returned data cannot mutate fixtures', () => {
  assert.equal(medicalRecordService.get('missing'), null);
  const records = medicalRecordService.list();
  const latest = records.find(item => item.prescriptions.length);
  latest.prescriptions[0].medicine = 'Modified';
  latest.diagnosis = 'Modified';
  assert.notEqual(medicalRecordService.get(latest.id).diagnosis, 'Modified');
  assert.notEqual(medicalRecordService.get(latest.id).prescriptions[0].medicine, 'Modified');
  const oldest = records.at(-1);
  assert.deepEqual(oldest.prescriptions, []);
  assert.deepEqual(oldest.certificates, []);
  assert.equal(oldest.notes, null);
});
