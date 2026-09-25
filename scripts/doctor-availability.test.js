import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorAvailabilityService as service } from '../src/services/doctorAvailabilityService.js';
import { doctorScheduleService } from '../src/services/doctorScheduleService.js';
import { bookingService } from '../src/services/bookingService.js';

const demo = '50000000-0000-4000-8000-000000000003';
const maria = '50000000-0000-4000-8000-000000000001';
const now = new Date('2026-09-24T00:00:00Z');

test('recurring availability supports multiple ranges and day enablement', () => {
  const monday = service.get(demo).recurring.filter(item => item.day_of_week === 1);
  assert.deepEqual(monday.map(item => [item.start_time, item.end_time]), [['09:00', '12:00'], ['13:00', '17:00']]);
  assert.equal(service.addRecurring({ day_of_week: 1, start_time: '11:30', end_time: '13:30' }, demo).error, 'Recurring ranges for the same day cannot overlap.');
  const added = service.addRecurring({ day_of_week: 6, start_time: '13:00', end_time: '17:00' }, demo).recurring;
  assert(added);
  service.setDayActive(6, true, demo);
  assert(service.get(demo).recurring.filter(item => item.day_of_week === 6).every(item => item.is_active));
  assert(service.removeRecurring(added.id, demo).recurring);
});

test('published availability is date-specific, bounded to 30 days and not inferred from recurrence', () => {
  assert.deepEqual(service.getSlots(demo, '2026-09-29', now), []);
  const published = service.publish({ date: '2026-09-29', start_time: '09:00', end_time: '12:00' }, demo, now).published;
  assert(published);
  assert.deepEqual(service.getSlots(demo, '2026-09-29', now).map(item => item.time), ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  assert.match(service.publish({ date: '2026-10-25', start_time: '09:00', end_time: '12:00' }, demo, now).error, /30 days/);
  assert.match(service.publish({ date: '2026-09-30', start_time: '09:15', end_time: '12:00' }, demo, now).error, /30-minute/);
});

test('partial and whole-day blocks override publication without removing appointments', () => {
  const partial = service.getSlots(demo, '2026-09-28', now);
  assert.equal(partial.find(item => item.time === '09:30').available, true);
  assert.equal(partial.find(item => item.time === '10:00').blocked, true);
  assert.equal(partial.find(item => item.time === '10:30').blocked, true);
  assert.equal(partial.find(item => item.time === '11:00').available, true);
  const before = doctorScheduleService.getDay('2026-09-24', now).length;
  assert(service.addBlocked({ date: '2026-09-24', whole_day: true, reason: 'Emergency absence' }, demo, now).blocked);
  assert(service.getSlots(demo, '2026-09-24', now).every(item => !item.available && item.blocked));
  assert.equal(doctorScheduleService.getDay('2026-09-24', now).length, before);
});

test('Patient booking consumes published ranges and preserves occupied-slot prevention', () => {
  const patientNow = new Date('2026-09-24T00:00:00Z');
  assert.deepEqual(bookingService.getSlots(maria, '2026-09-20', patientNow), []);
  const values = { service: 'general_consultation', doctor: maria, date: '2026-09-25', time: '08:00', reason: 'Availability integration test' };
  assert.equal(bookingService.getSlots(maria, values.date, patientNow).find(item => item.time === values.time).available, true);
  assert(bookingService.confirm(values, patientNow).confirmation);
  assert.equal(bookingService.getSlots(maria, values.date, patientNow).find(item => item.time === values.time).available, false);
});
