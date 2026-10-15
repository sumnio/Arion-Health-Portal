import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentService, canManageAppointment } from '../src/services/appointmentService.js';
import { bookingService, clinicToday } from '../src/services/bookingService.js';
import { appointmentListPage, newestAppointmentsFirst, RECENT_APPOINTMENT_LIMIT } from '../src/services/dateTimeService.js';

import { availableFutureSlot as futureSlot } from './availableFutureSlot.js';

test('recent appointment lists are newest-first, capped at ten, and do not mutate API data', () => {
  const items = Array.from({ length: 12 }, (_, index) => ({ id: String(index + 1), appointment_at: `2026-10-15T${String(index).padStart(2, '0')}:00:00.000Z` }));
  const ordered = newestAppointmentsFirst(items, RECENT_APPOINTMENT_LIMIT);
  assert.equal(RECENT_APPOINTMENT_LIMIT, 10);
  assert.deepEqual(ordered.map((item) => item.id), ['12', '11', '10', '9', '8', '7', '6', '5', '4', '3']);
  assert.deepEqual(appointmentListPage(items, 2).items.map((item) => item.id), ['2', '1']);
  assert.deepEqual(appointmentListPage(items, 2), { items: [items[1], items[0]], page: 2, pageCount: 2, total: 12, start: 10 });
  assert.deepEqual(items.map((item) => item.id), Array.from({ length: 12 }, (_, index) => String(index + 1)));
});

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
test('booking, rescheduling, and cancellation share occupancy and preserve appointment identity', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-18T00:00:00.000Z') });
  const values = { ...futureSlot(), service: 'general_consultation', reason: 'Session test' };
  bookingService.confirm(values);
  const item = appointmentService.list().find(item => item.reason === values.reason);
  assert.ok(item);
  assert.ok(appointmentService.reschedule(item.id, values.date, values.time).error);
  assert.ok(appointmentService.reschedule(item.id, '', '').error);
  const next = futureSlot(5);
  assert.equal(appointmentService.reschedule(item.id, next.date, next.time).appointment.id, item.id);
  assert.equal(bookingService.getSlots(values.doctor, values.date).find(slot => slot.time === values.time).available, true);
  assert.equal(bookingService.getSlots(next.doctor, next.date).find(slot => slot.time === next.time).available, false);
  assert.equal(appointmentService.cancel(item.id).appointment.status, 'cancelled');
  assert.equal(bookingService.getSlots(next.doctor, next.date).find(slot => slot.time === next.time).available, true);
  assert.ok(appointmentService.reschedule(item.id, next.date, next.time).error);
});
