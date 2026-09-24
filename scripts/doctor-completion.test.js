import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorPatientService } from '../src/services/doctorPatientService.js';
import { doctorRecordService } from '../src/services/doctorRecordService.js';
import { doctorDashboardService } from '../src/services/doctorDashboardService.js';
import { staffQueueService, queueActions } from '../src/services/staffQueueService.js';
import { appointmentService } from '../src/services/appointmentService.js';
import { clinicToday } from '../src/services/bookingService.js';

const patientId = '10000000-0000-4000-8000-000000000001';
const appointmentId = '70000000-0000-4000-8000-000000000011';
const now = new Date('2026-09-24T06:00:00Z');
const selection = { appointmentId, date: clinicToday(now) };

test('assigned doctor completes only after saving a record and the shared status reaches every portal', () => {
  assert.match(doctorPatientService.complete(patientId, selection).error, /Save the medical record/);
  assert.throws(() => staffQueueService.act(appointmentId, 'complete', now));
  assert.equal('complete' in queueActions(staffQueueService.getQueue(now).appointments.find(item => item.id === appointmentId), now), false);

  staffQueueService.act(appointmentId, 'checkIn', now);
  const saved = doctorRecordService.save(patientId, selection, {
    diagnosis: 'Routine examination', notes: 'Consultation completed normally.', follow_up: '',
    encounter_at: selection.date + 'T15:30', prescriptions: [],
  }).record;
  assert(saved);
  assert.match(doctorPatientService.complete(patientId, selection, 'different-doctor').error, /assigned/);

  const completed = doctorPatientService.complete(patientId, selection);
  assert.equal(completed.appointment.status, 'completed');
  assert.equal(doctorDashboardService.getDashboard(now).appointments.find(item => item.id === appointmentId).status, 'completed');
  assert.equal(staffQueueService.getQueue(now).waiting.some(item => item.id === appointmentId), false);
  assert.equal(staffQueueService.getQueue(now).finished.find(item => item.id === appointmentId).status, 'completed');
  assert.equal(appointmentService.get(appointmentId).status, 'completed');

  const detail = doctorPatientService.get(patientId, selection);
  assert.equal(detail.canAddRecord, false);
  assert.equal(detail.canComplete, false);
  assert(doctorRecordService.save(patientId, selection, { diagnosis: 'Duplicate', encounter_at: selection.date + 'T15:30', prescriptions: [] }).errors.form);
  assert.match(doctorPatientService.complete(patientId, selection).error, /already completed/);
});

test('cancelled and no-show appointments cannot be completed', () => {
  const cancelled = { appointmentId: '70000000-0000-4000-8000-000000000007', date: '2026-09-23' };
  const noShow = { appointmentId: '70000000-0000-4000-8000-000000000008', date: '2026-09-23' };
  assert.match(doctorPatientService.complete('10000000-0000-4000-8000-000000000003', cancelled).error, /cancelled or no-show/);
  assert.match(doctorPatientService.complete('10000000-0000-4000-8000-000000000005', noShow).error, /cancelled or no-show/);
});
