import assert from 'node:assert/strict';
import test from 'node:test';
import { createDoctorUnavailabilityService } from '../src/services/doctorUnavailabilityService.js';
import { createRescheduleSuggestionService } from '../src/services/rescheduleSuggestionService.js';

const ids = {
  appointment: '100000000000000000000001', patient: '200000000000000000000001', doctor: '300000000000000000000001',
  doctorProfile: '400000000000000000000001', block: '500000000000000000000001', record: '600000000000000000000001',
};
const NOW = new Date('2026-11-10T00:00:00.000Z');
const ORIGINAL = new Date('2026-11-10T02:00:00.000Z');

function appointment(overrides = {}) {
  return {
    _id: ids.appointment,
    patient_id: { _id: ids.patient, full_name: 'Safe Patient Name' },
    doctor_id: { _id: ids.doctor, specialty: 'General Medicine', user_profile_id: { _id: ids.doctorProfile, display_name: 'Sample Doctor' } },
    appointment_at: ORIGINAL,
    status: 'confirmed', visit_type: 'follow_up', check_in_at: null,
    source_medical_record_id: ids.record,
    ...overrides,
  };
}

test('nearest alternatives prefer same-day later slots, then closest time on the next valid day', async () => {
  const calls = [];
  const availability = {
    '2026-11-10': [
      { start_time: '09:30', end_time: '10:00', appointment_at: '2026-11-10T01:30:00.000Z', available: true },
      { start_time: '10:30', end_time: '11:00', appointment_at: '2026-11-10T02:30:00.000Z', available: true },
      { start_time: '11:00', end_time: '11:30', appointment_at: '2026-11-10T03:00:00.000Z', available: false },
    ],
    '2026-11-11': [
      { start_time: '09:30', end_time: '10:00', appointment_at: '2026-11-11T01:30:00.000Z', available: true },
      { start_time: '10:00', end_time: '10:30', appointment_at: '2026-11-11T02:00:00.000Z', available: true },
    ],
  };
  const service = createRescheduleSuggestionService({ bookingAvailabilityService: { timeZone: 'Asia/Manila', async getAvailableSlots(_doctor, date) { calls.push(date); return availability[date] ?? []; } }, now: () => NOW });
  const result = await service.suggest(ids.doctor, ORIGINAL);
  assert.deepEqual(result.map((item) => item.appointment_at), ['2026-11-10T02:30:00.000Z', '2026-11-11T02:00:00.000Z', '2026-11-11T01:30:00.000Z']);
  assert.equal(calls.at(-1), '2026-11-24');
});

test('creating Doctor time off flags active overlap without moving it and emits privacy-safe side effects', async () => {
  const stored = appointment();
  const events = [];
  const repository = {
    async flagAppointmentsForDoctorBlock(doctorId, blockId) { assert.equal(String(doctorId), ids.doctor); assert.equal(String(blockId), ids.block); stored.requires_reschedule_due_to_doctor_unavailability = true; return [stored]; },
    async medicalRecordExists() { return false; },
    async findRescheduleEmailRecipient() { return { has_portal_account: true, email: 'patient@example.invalid' }; },
  };
  const service = createDoctorUnavailabilityService({
    repository,
    suggestionService: { timeZone: 'Asia/Manila', async suggest() { return [{ date: '2026-11-11', start_time: '10:00', end_time: '10:30', appointment_at: '2026-11-11T02:00:00.000Z' }]; } },
    appointmentService: {},
    notificationTriggers: { async doctorUnavailable(value) { events.push(['notification', value]); } },
    smsReminders: { async appointmentDoctorUnavailable(value) { events.push(['sms', value]); } },
    email: { async sendAppointmentNeedsRescheduleEmail(value) { events.push(['email', value]); } },
    now: () => NOW,
  });
  const affected = await service.blockedTimeCreated({ _id: ids.block, doctor_id: ids.doctor, start_at: NOW, end_at: new Date('2026-11-10T04:00:00Z'), reason: 'Private absence reason' });
  assert.equal(stored.appointment_at.toISOString(), ORIGINAL.toISOString());
  assert.equal(affected[0].source_medical_record_id, ids.record);
  assert.equal(affected[0].suggested_slots.length, 1);
  assert.equal(JSON.stringify({ affected, events }).includes('Private absence reason'), false);
  assert.deepEqual(events.map(([type]) => type), ['notification', 'sms', 'email']);
});

test('locked affected appointment remains visible for Staff review without suggestions', async () => {
  const service = createDoctorUnavailabilityService({
    repository: { async listAffectedAppointmentsForDoctor() { return [appointment({ check_in_at: NOW })]; }, async medicalRecordExists() { return false; } },
    suggestionService: { async suggest() { throw new Error('must not suggest'); } }, appointmentService: {},
  });
  const [result] = await service.listAffectedForDoctor(ids.doctor);
  assert.equal(result.locked, true);
  assert.deepEqual(result.suggested_slots, []);
});

test('Staff confirmation delegates one validated replacement to the shared reschedule service', async () => {
  const calls = [];
  const service = createDoctorUnavailabilityService({
    repository: {}, suggestionService: { timeZone: 'Asia/Manila' },
    appointmentService: { async rescheduleForStaff(id, input) { calls.push([id, input.appointment_at.toISOString()]); return { id, appointment_at: input.appointment_at }; } },
    now: () => NOW,
  });
  await service.rescheduleForStaff(ids.appointment, { appointment_at: '2026-11-11T02:00:00.000Z' });
  assert.deepEqual(calls, [[ids.appointment, '2026-11-11T02:00:00.000Z']]);
});
