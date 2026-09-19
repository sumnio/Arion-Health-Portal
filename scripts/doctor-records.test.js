import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorRecordService as service } from '../src/services/doctorRecordService.js';
import { doctorPatientService } from '../src/services/doctorPatientService.js';
import { clinicToday } from '../src/services/bookingService.js';
import { shiftScheduleDate } from '../src/services/doctorScheduleService.js';
const patient = n => '10000000-0000-4000-8000-00000000000' + n;
const selection = (n, offset = 0) => ({ appointmentId: '70000000-0000-4000-8000-00000000000' + n, date: shiftScheduleDate(clinicToday(), offset) });
const values = { diagnosis: 'Routine examination', notes: '', follow_up: '', encounter_at: clinicToday() + 'T13:00', prescriptions: [] };
test('missing, mismatched, cancelled, no-show, pending and completed contexts cannot save', () => {
  for (const [id, context] of [[patient(3), null], ['missing', selection(3)], [patient(3), selection(5)], [patient(3), selection(7,-1)], [patient(5), selection(8,-1)], [patient(4), selection(4)], [patient(1), selection(1)]]) assert(service.save(id,context,values).errors.form);
});
test('required fields and prescription rows are validated before writing', () => {
  const result = service.save(patient(3), selection(3), { ...values, diagnosis: ' ', encounter_at: '', prescriptions: [{medicine:'',dosage:''}] });
  for (const key of ['diagnosis','encounter_at','medicine-0','dosage-0']) assert(result.errors[key]);
  assert(doctorPatientService.get(patient(3),selection(3)).canAddRecord);
});
test('save links prescriptions, preserves optional fields, updates consultation and prevents duplicates', () => {
  const result = service.save(patient(3), selection(3), {...values,prescriptions:[{medicine:'Mock medicine',dosage:'As directed',instructions:''}]});
  assert.equal(result.record.appointment_id,selection(3).appointmentId);
  assert.equal(result.record.prescriptions[0].medical_record_id,result.record.id);
  assert.equal(result.record.notes,null);
  assert.equal(doctorPatientService.get(patient(3),selection(3)).existingRecord.id,result.record.id);
  assert.equal(doctorPatientService.get(patient(3),selection(3)).canAddRecord,false);
  assert(service.save(patient(3),selection(3),values).errors.form);
  assert.equal(service.save(patient(5),selection(5),values).record.prescriptions.length,0);
});
