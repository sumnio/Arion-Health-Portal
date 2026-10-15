import assert from 'node:assert/strict';
import test from 'node:test';
import { createFakeSmsProvider } from '../src/services/fakeSmsProvider.js';
import { createSmsReminderService } from '../src/services/smsReminderService.js';
import { createSmsService } from '../src/services/smsService.js';

const BASE = new Date('2026-10-14T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function memoryHarness({ enabled = true, current = BASE } = {}) {
  const reminders = [];
  const contexts = new Map();
  let clock = new Date(current);
  let sequence = 0;
  const repository = {
    async create(data) {
      if (reminders.some(item => item.appointment_id === data.appointment_id
        && item.reminder_type === data.reminder_type && item.schedule_version === data.schedule_version)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      const item = { _id: `reminder-${++sequence}`, ...data };
      reminders.push(item);
      return { ...item };
    },
    async latestScheduleVersion(appointmentId) {
      return reminders.filter(item => item.appointment_id === appointmentId)
        .reduce((maximum, item) => Math.max(maximum, item.schedule_version), 0);
    },
    async invalidateUnsent(appointmentId, at) {
      let count = 0;
      reminders.filter(item => item.appointment_id === appointmentId && ['scheduled', 'processing'].includes(item.status))
        .forEach(item => { Object.assign(item, { status: 'invalidated', invalidated_at: at }); count += 1; });
      return count;
    },
    async claimById(id, at) {
      const item = reminders.find(candidate => candidate._id === id && candidate.status === 'scheduled' && candidate.scheduled_for <= at);
      if (!item) return null;
      Object.assign(item, { status: 'processing', processing_started_at: at });
      return { ...item };
    },
    async claimNextDue(at) {
      const item = reminders.filter(candidate => candidate.status === 'scheduled' && candidate.scheduled_for <= at)
        .sort((left, right) => left.scheduled_for - right.scheduled_for)[0];
      if (!item) return null;
      Object.assign(item, { status: 'processing', processing_started_at: at });
      return { ...item };
    },
    async findDeliveryContext(reminder) { return contexts.get(reminder.appointment_id) ?? null; },
    async markInvalidated(id, at) {
      const item = reminders.find(candidate => candidate._id === id && candidate.status === 'processing');
      if (item) Object.assign(item, { status: 'invalidated', invalidated_at: at });
      return item;
    },
    async markSent(id, result, at) {
      const item = reminders.find(candidate => candidate._id === id && candidate.status === 'processing');
      if (item) Object.assign(item, { status: 'sent', sent_at: at, provider_reference_id: result.provider_reference_id });
      return item;
    },
    async markFailed(id, result, at) {
      const item = reminders.find(candidate => candidate._id === id && candidate.status === 'processing');
      if (item) Object.assign(item, { status: 'failed', failed_at: at, failure_category: result.safe_error_category });
      return item;
    },
    async failStaleProcessing() { return 0; },
  };
  const provider = createFakeSmsProvider();
  const service = createSmsReminderService({
    repository,
    smsService: createSmsService({ enabled, provider }),
    now: () => new Date(clock),
  });
  function setAppointment(appointmentId, appointmentAt, status = 'pending', extra = {}) {
    contexts.set(appointmentId, {
      appointmentAt: new Date(appointmentAt), status, checkedIn: false,
      phoneNumber: '09171234567', doctorName: 'Doctor Santos', ...extra,
    });
  }
  return {
    reminders, contexts, provider, service, setAppointment,
    setNow(value) { clock = new Date(value); },
  };
}

function types(items) {
  return items.map(item => item.reminder_type);
}

test('new booking planner honors exact 24-hour and 1-hour boundaries', async () => {
  const cases = [
    [25 * HOUR, ['reminder_24h', 'reminder_1h']],
    [24 * HOUR, ['booking_immediate', 'reminder_1h']],
    [2 * HOUR, ['booking_immediate', 'reminder_1h']],
    [HOUR, ['booking_immediate']],
    [59 * 60 * 1000, ['booking_immediate']],
    [60 * 1000, ['booking_immediate']],
    [-60 * 1000, []],
  ];
  for (const [offset, expected] of cases) {
    const harness = memoryHarness();
    const appointmentAt = new Date(BASE.getTime() + offset);
    harness.setAppointment('appointment', appointmentAt);
    await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
    assert.deepEqual(types(harness.reminders), expected, `offset ${offset}`);
    assert.equal(harness.provider.deliveries.length, expected.includes('booking_immediate') ? 1 : 0);
  }
});

test('more-than-24-hour booking stores exact 24-hour and 1-hour due instants', async () => {
  const harness = memoryHarness();
  const appointmentAt = new Date('2026-10-15T08:00:00.000Z');
  harness.setAppointment('appointment', appointmentAt);
  await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  assert.deepEqual(
    harness.reminders.map(item => item.scheduled_for.toISOString()),
    ['2026-10-14T08:00:00.000Z', '2026-10-15T07:00:00.000Z'],
  );
});

test('reschedule invalidates the old plan, increments the version, and always sends an immediate future update', async () => {
  const harness = memoryHarness();
  const original = new Date(BASE.getTime() + 30 * HOUR);
  harness.setAppointment('appointment', original);
  await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt: original });
  const moved = new Date(BASE.getTime() + 26 * HOUR);
  harness.setAppointment('appointment', moved);
  await harness.service.appointmentRescheduled({ appointmentId: 'appointment', patientId: 'patient', appointmentAt: moved });
  assert.ok(harness.reminders.filter(item => item.schedule_version === 1).every(item => item.status === 'invalidated'));
  assert.deepEqual(types(harness.reminders.filter(item => item.schedule_version === 2)), ['reschedule_immediate', 'reminder_24h', 'reminder_1h']);
  assert.equal(harness.provider.deliveries.length, 1);

  const movedAgain = new Date(BASE.getTime() + 45 * 60 * 1000);
  harness.setAppointment('appointment', movedAgain);
  await harness.service.appointmentRescheduled({ appointmentId: 'appointment', patientId: 'patient', appointmentAt: movedAgain });
  assert.deepEqual(types(harness.reminders.filter(item => item.schedule_version === 3)), ['reschedule_immediate']);
  assert.equal(harness.provider.deliveries.length, 2);
});

test('reschedule timing plan covers the within-24-hour tiers', async () => {
  for (const [offset, expected] of [
    [24 * HOUR, ['reschedule_immediate', 'reminder_1h']],
    [2 * HOUR, ['reschedule_immediate', 'reminder_1h']],
    [HOUR, ['reschedule_immediate']],
    [59 * 60 * 1000, ['reschedule_immediate']],
  ]) {
    const harness = memoryHarness();
    const appointmentAt = new Date(BASE.getTime() + offset);
    harness.setAppointment('appointment', appointmentAt);
    await harness.service.appointmentRescheduled({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
    assert.deepEqual(types(harness.reminders), expected);
  }
});

test('cancellation invalidates reminders and sends one privacy-safe cancellation message', async () => {
  const harness = memoryHarness();
  const appointmentAt = new Date(BASE.getTime() + 30 * HOUR);
  harness.setAppointment('appointment', appointmentAt);
  await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  harness.setAppointment('appointment', appointmentAt, 'cancelled');
  await harness.service.appointmentCancelled({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  assert.ok(harness.reminders.filter(item => item.reminder_type !== 'cancellation_immediate').every(item => item.status === 'invalidated'));
  assert.equal(harness.provider.deliveries.length, 1);
  assert.match(harness.provider.deliveries[0].content, /cancelled/i);
  assert.doesNotMatch(harness.provider.deliveries[0].content, /reason|diagnosis|visit/i);
});

test('arrival, no-show, and completion invalidate unsent reminders without sending SMS', async () => {
  for (const method of ['appointmentArrived', 'appointmentNoShow', 'appointmentCompleted']) {
    const harness = memoryHarness();
    const appointmentAt = new Date(BASE.getTime() + 30 * HOUR);
    harness.setAppointment('appointment', appointmentAt);
    await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
    await harness.service[method]({ appointmentId: 'appointment' });
    assert.ok(harness.reminders.every(item => item.status === 'invalidated'));
    assert.equal(harness.provider.deliveries.length, 0);
  }
});

test('due processing is inclusive and duplicate scheduler runs do not resend', async () => {
  const harness = memoryHarness();
  const appointmentAt = new Date(BASE.getTime() + 25 * HOUR);
  harness.setAppointment('appointment', appointmentAt);
  await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  harness.setNow(new Date(BASE.getTime() + HOUR + 3 * 60 * 1000));
  assert.deepEqual(await harness.service.runDueReminders(), { processed: 1, sent: 1, failed: 0, invalidated: 0, skipped: 0 });
  assert.deepEqual(await harness.service.runDueReminders(), { processed: 0, sent: 0, failed: 0, invalidated: 0, skipped: 0 });
  assert.equal(harness.provider.deliveries.length, 1);
});

test('current-state revalidation blocks confirmed, checked-in, moved, old-version, missing, and stale reminders', async () => {
  const scenarios = [
    context => ({ ...context, status: 'confirmed' }),
    context => ({ ...context, checkedIn: true }),
    context => ({ ...context, status: 'cancelled' }),
    context => ({ ...context, status: 'completed' }),
    context => ({ ...context, status: 'no_show' }),
    context => ({ ...context, appointmentAt: new Date(context.appointmentAt.getTime() + HOUR) }),
    () => null,
  ];
  for (const mutate of scenarios) {
    const harness = memoryHarness();
    const appointmentAt = new Date(BASE.getTime() + 25 * HOUR);
    harness.setAppointment('appointment', appointmentAt);
    await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
    const current = harness.contexts.get('appointment');
    harness.contexts.set('appointment', mutate(current));
    harness.setNow(new Date(BASE.getTime() + HOUR));
    const result = await harness.service.runDueReminders();
    assert.equal(result.invalidated, 1);
    assert.equal(harness.provider.deliveries.length, 0);
  }

  const stale = memoryHarness();
  const appointmentAt = new Date(BASE.getTime() + 25 * HOUR);
  stale.setAppointment('appointment', appointmentAt);
  await stale.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  stale.setNow(new Date(appointmentAt.getTime() - 30 * 60 * 1000));
  assert.equal((await stale.service.runDueReminders()).invalidated, 1);
  assert.equal(stale.provider.deliveries.length, 1);
});

test('disabled mode creates no new reminders, calls no provider, but preserves lifecycle invalidation', async () => {
  const harness = memoryHarness({ enabled: false });
  const appointmentAt = new Date(BASE.getTime() + 25 * HOUR);
  harness.setAppointment('appointment', appointmentAt);
  await harness.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  assert.equal(harness.reminders.length, 0);
  harness.reminders.push({
    _id: 'legacy', appointment_id: 'appointment', patient_id: 'patient', reminder_type: 'reminder_1h',
    appointment_at: appointmentAt, scheduled_for: BASE, schedule_version: 1, status: 'scheduled',
  });
  await harness.service.appointmentCancelled({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  assert.equal(harness.reminders[0].status, 'invalidated');
  assert.equal(harness.provider.deliveries.length, 0);
});

test('old schedule versions and one-hour reminders at or after appointment start fail closed', async () => {
  const oldVersion = memoryHarness();
  const appointmentAt = new Date(BASE.getTime() + 25 * HOUR);
  oldVersion.setAppointment('appointment', appointmentAt);
  await oldVersion.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt });
  oldVersion.reminders.push({
    _id: 'newer-version', appointment_id: 'appointment', patient_id: 'patient',
    reminder_type: 'booking_immediate', appointment_at: appointmentAt,
    scheduled_for: BASE, schedule_version: 2, status: 'sent',
  });
  oldVersion.setNow(new Date(BASE.getTime() + HOUR));
  assert.equal((await oldVersion.service.runDueReminders()).invalidated, 1);
  assert.equal(oldVersion.provider.deliveries.length, 0);

  const started = memoryHarness();
  const soon = new Date(BASE.getTime() + HOUR);
  started.setAppointment('appointment', soon);
  await started.service.appointmentBooked({ appointmentId: 'appointment', patientId: 'patient', appointmentAt: soon });
  started.setNow(soon);
  assert.equal((await started.service.runDueReminders()).processed, 0);
  assert.equal(started.provider.deliveries.length, 1);
  const late = memoryHarness();
  late.setAppointment('appointment', soon);
  late.reminders.push({
    _id: 'late-one-hour', appointment_id: 'appointment', patient_id: 'patient',
    reminder_type: 'reminder_1h', appointment_at: soon,
    scheduled_for: BASE, schedule_version: 1, status: 'scheduled',
  });
  late.setNow(soon);
  assert.equal((await late.service.runDueReminders()).invalidated, 1);
  assert.equal(late.provider.deliveries.length, 0);
});
