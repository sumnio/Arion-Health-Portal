import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentService, canManageAppointment } from '../src/services/appointmentService.js';
import { bookingService, clinicToday } from '../src/services/bookingService.js';

function futureSlot(offset = 10) {
  const date = new Date(clinicToday() + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  const day = date.toISOString().slice(0, 10);
  const doctor = bookingService.getOptions().doctors[0].id;
  return { date: day, doctor, time: bookingService.getSlots(doctor, day).find(slot => slot.available).time };
}
test('fixtures cover schema statuses; unknown details are handled', () => {
  assert.deepEqual(new Set(appointmentService.list().map(item => item.status)), new Set(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']));
  assert.equal(appointmentService.get('missing'), null);
});
test('only future, active appointments without check-in are manageable', () => {
  const item = { status: 'confirmed', appointment_at: '2030-01-01T10:00:00+08:00' };
  const now = new Date('2026-01-01');
  assert.equal(canManageAppointment(item, now), true);
  for (const status of ['completed', 'cancelled', 'no_show']) assert.equal(canManageAppointment({ ...item, status }, now), false);
  assert.equal(canManageAppointment({ ...item, check_in_at: '2026-01-01' }, now), false);
  assert.equal(canManageAppointment(item, new Date('2031-01-01')), false);
  assert.ok(appointmentService.cancel('missing').error);
  const completed = appointmentService.list().find(item => item.status === 'completed');
  assert.ok(appointmentService.cancel(completed.id).error);
  assert.ok(appointmentService.reschedule(completed.id, '2030-01-01', '10:00').error);
});
test('booking, rescheduling, and cancellation share occupancy and preserve appointment identity', () => {
  const values = { ...futureSlot(), service: 'consultation', reason: 'Session test' };
  bookingService.confirm(values);
  const item = appointmentService.list().find(item => item.reason === values.reason);
  assert.ok(item);
  assert.ok(appointmentService.reschedule(item.id, values.date, values.time).error);
  assert.ok(appointmentService.reschedule(item.id, '', '').error);
  const next = futureSlot(15);
  assert.equal(appointmentService.reschedule(item.id, next.date, next.time).appointment.id, item.id);
  assert.equal(bookingService.getSlots(values.doctor, values.date).find(slot => slot.time === values.time).available, true);
  assert.equal(bookingService.getSlots(next.doctor, next.date).find(slot => slot.time === next.time).available, false);
  assert.equal(appointmentService.cancel(item.id).appointment.status, 'cancelled');
  assert.equal(bookingService.getSlots(next.doctor, next.date).find(slot => slot.time === next.time).available, true);
  assert.ok(appointmentService.reschedule(item.id, next.date, next.time).error);
});
