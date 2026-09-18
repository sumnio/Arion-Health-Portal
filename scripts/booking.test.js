import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingService, clinicToday } from '../src/services/bookingService.js';

test('doctor and date affect fixed mock slots, with occupied slots unavailable', () => {
  const { doctors } = bookingService.getOptions();
  const now = new Date('2026-09-01T00:00:00Z');
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
  const future = new Date(clinicToday() + 'T00:00:00Z');
  future.setUTCDate(future.getUTCDate() + 2);
  if (future.getUTCDay() === 0) future.setUTCDate(future.getUTCDate() + 1);
  const date = future.toISOString().slice(0, 10);
  const doctor = doctors[0].id;
  const time = bookingService.getSlots(doctor, date).find(slot => slot.available).time;
  const values = { service: services[0].id, doctor, date, time, reason: 'Routine check-up' };
  assert.equal(bookingService.confirm(values).confirmation.status, 'confirmed');
  assert.ok(bookingService.confirm(values).errors.time);
  assert.equal(bookingService.getSlots(doctor, date).find(slot => slot.time === time).available, false);
});
