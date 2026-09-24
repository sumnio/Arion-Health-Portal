import { availableFutureSlot } from './availableFutureSlot.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingService, bookingWindow, clinicToday, slotRange } from '../src/services/bookingService.js';

test('catalog exposes only the three approved fixed visit types', () => {
  assert.deepEqual(bookingService.getOptions().services, [
    { id: 'general_consultation', name: 'General Consultation' },
    { id: 'follow_up', name: 'Follow-up' },
    { id: 'check_up', name: 'Check-up' },
  ]);
});

test('doctor and date affect fixed mock slots, with occupied slots unavailable', () => {
  const { doctors } = bookingService.getOptions();
  const now = new Date('2026-09-18T00:00:00Z');
  const first = bookingService.getSlots(doctors[0].id, '2026-09-21', now);
  assert.notDeepEqual(first, bookingService.getSlots(doctors[1].id, '2026-09-21', now));
  assert.notDeepEqual(first, bookingService.getSlots(doctors[0].id, '2026-09-22', now));
  assert.ok(first.some(slot => !slot.available));
  assert.deepEqual(bookingService.getSlots(doctors[0].id, '2026-09-20', now), []);
  assert.deepEqual(bookingService.getSlots(doctors[0].id, '2026-02-30', now), []);
});

test('required fields, past dates, unsupported service, and unavailable times are rejected', () => {
  const errors = bookingService.validate({});
  assert.deepEqual(Object.keys(errors).sort(), ['date', 'doctor', 'reason', 'service', 'time']);
  const errors2 = bookingService.validate({ service: 'emergency', doctor: 'unknown', date: '2000-01-01', time: '03:15', reason: '  ' });
  assert.equal(Object.keys(errors2).length, 5);
});

test('confirmation reserves one place per doctor and slot without persistence', () => {
  const { doctors, services } = bookingService.getOptions();
  const { date, doctor, time } = availableFutureSlot();
  const values = { service: services[0].id, doctor, date, time, reason: 'Recurring headache' };
  const result = bookingService.confirm(values).confirmation;
  assert.equal(result.status, 'confirmed');
  assert.equal(result.service, 'General Consultation');
  assert.ok(bookingService.confirm(values).errors.time);
  assert.equal(bookingService.getSlots(doctor, date).find(slot => slot.time === time).available, false);
});

test('14-day window, doctor weekdays, blocked dates and full dates are enforced', () => {
  const doctor = bookingService.getOptions().doctors[0].id;
  const now = new Date('2026-09-18T00:00:00Z');
  assert.deepEqual(bookingWindow(now), { start: '2026-09-18', end: '2026-10-02' });
  assert.equal(bookingService.isDateAvailable(doctor, '2026-10-02', now), true);
  assert.deepEqual(bookingService.getSlots(doctor, '2026-10-03', now), []);
  assert.match(bookingService.validate({ doctor, date: '2026-10-03', time: '09:00', service: 'general_consultation', reason: 'Test' }, now).date, /14 days/);
  for (const date of ['2026-09-17', '2026-09-20', '2026-09-23', '2026-09-24', '2026-09-26']) {
    assert.equal(bookingService.isDateAvailable(doctor, date, now), false, date);
    assert.ok(bookingService.validate({ doctor, date, time: '09:00', service: 'general_consultation', reason: 'Test' }, now).date);
  }
  assert.equal(bookingService.isDateAvailable(bookingService.getOptions().doctors[1].id, '2026-09-24', now), true);
  assert.equal(bookingService.isDateAvailable('', '2026-09-21', now), false);
  const full = bookingService.getSlots(doctor, '2026-09-26', now);
  assert.ok(full.length > 0 && full.every(slot => !slot.available));
});

test('booking slots remain fixed at 30 minutes', () => {
  assert.equal(slotRange('09:00'), '9:00 AM – 9:30 AM');
  assert.equal(slotRange('14:30'), '2:30 PM – 3:00 PM');
});
