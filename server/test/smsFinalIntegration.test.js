import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createSmsModule } from '../src/services/smsModule.js';

const CRON_SECRET = 'integration-cron-secret-with-at-least-32-characters';
const HOUR = 60 * 60 * 1000;

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function createRepository(context) {
  const reminders = [];
  let sequence = 0;
  return {
    reminders,
    async create(data) {
      const item = { _id: `reminder-${sequence += 1}`, ...data };
      reminders.push(item);
      return item;
    },
    async failStaleProcessing() { return 0; },
    async claimNextDue(now) {
      const item = reminders.find(candidate => candidate.status === 'scheduled' && candidate.scheduled_for <= now);
      if (!item) return null;
      Object.assign(item, { status: 'processing', processing_started_at: now });
      return { ...item };
    },
    async claimById(id, now) {
      const item = reminders.find(candidate => candidate._id === id
        && candidate.status === 'scheduled' && candidate.scheduled_for <= now);
      if (!item) return null;
      Object.assign(item, { status: 'processing', processing_started_at: now });
      return { ...item };
    },
    async latestScheduleVersion(appointmentId) {
      return reminders.filter(item => item.appointment_id === appointmentId)
        .reduce((latest, item) => Math.max(latest, item.schedule_version), 0);
    },
    async invalidateUnsent(appointmentId, now) {
      let count = 0;
      for (const item of reminders) {
        if (item.appointment_id === appointmentId && ['scheduled', 'processing'].includes(item.status)) {
          Object.assign(item, { status: 'invalidated', invalidated_at: now });
          count += 1;
        }
      }
      return count;
    },
    async markInvalidated(id, now) {
      const item = reminders.find(candidate => candidate._id === id && candidate.status === 'processing');
      if (item) Object.assign(item, { status: 'invalidated', invalidated_at: now });
      return item;
    },
    async findDeliveryContext() { return { ...context }; },
    async markSent(id, result, now) {
      const item = reminders.find(candidate => candidate._id === id && candidate.status === 'processing');
      if (item) Object.assign(item, {
        status: 'sent', sent_at: now, provider: result.provider,
        provider_reference_id: result.provider_reference_id,
      });
      return item;
    },
    async markFailed(id, result, now) {
      const item = reminders.find(candidate => candidate._id === id && candidate.status === 'processing');
      if (item) Object.assign(item, {
        status: 'failed', failed_at: now, failure_category: result.safe_error_category,
      });
      return item;
    },
  };
}

test('fake Pending booking flows through the authenticated scheduler exactly once', async () => {
  let clock = new Date('2026-10-14T00:00:00.000Z');
  const appointmentAt = new Date(clock.getTime() + (25 * HOUR));
  const context = {
    status: 'pending', checkedIn: false, appointmentAt,
    phoneNumber: '09171234567', doctorName: 'Doctor Santos',
  };
  const repository = createRepository(context);
  let uniSmsCalls = 0;
  const smsModule = createSmsModule(
    {
      smsEnabled: true, smsProvider: 'fake', clinicTimeZone: 'Asia/Manila',
      uniSmsApiKey: 'must-not-be-used', uniSmsSenderId: 'must-not-be-used',
    },
    {
      repository,
      now: () => new Date(clock),
      fetchImpl: async () => { uniSmsCalls += 1; throw new Error('UniSMS must not be called in fake mode.'); },
    },
  );

  const plan = await smsModule.smsReminderService.appointmentBooked({
    appointmentId: 'appointment-1', patientId: 'patient-1', appointmentAt,
  });
  assert.deepEqual(plan.map(item => item.reminder_type), ['reminder_24h', 'reminder_1h']);
  assert.equal(smsModule.provider.deliveries.length, 0);

  clock = new Date(appointmentAt.getTime() - (24 * HOUR));
  const app = createApp(
    { nodeEnv: 'test', authSecret: 'test-secret', cronReminderSecret: CRON_SECRET },
    { smsModule },
  );
  await withServer(app, async baseUrl => {
    const options = { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } };
    const first = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, options);
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), {
      processed: 1, sent: 1, failed: 0, invalidated: 0, skipped: 0,
    });

    const second = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, options);
    assert.equal(second.status, 200);
    assert.deepEqual(await second.json(), {
      processed: 0, sent: 0, failed: 0, invalidated: 0, skipped: 0,
    });
  });

  assert.equal(uniSmsCalls, 0);
  assert.equal(smsModule.provider.deliveries.length, 1);
  assert.equal(repository.reminders[0].status, 'sent');
  assert.equal(repository.reminders[0].provider_reference_id, 'fake-sms-1');
});

