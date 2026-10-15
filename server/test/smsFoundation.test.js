import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { AppointmentSmsReminder, SMS_REMINDER_STATUSES, SMS_REMINDER_TYPES } from '../src/models/index.js';
import { createFakeSmsProvider } from '../src/services/fakeSmsProvider.js';
import { createSmsModule } from '../src/services/smsModule.js';
import { createSmsReminderService } from '../src/services/smsReminderService.js';
import { createSmsService } from '../src/services/smsService.js';
import { createAppointmentSms, SMS_MESSAGE_MAX_LENGTH } from '../src/services/smsTemplates.js';
import { createUniSmsProvider, UNISMS_SEND_ENDPOINT } from '../src/services/unismsSmsProvider.js';
import { normalizeSecurityEvent } from '../src/services/securityLogger.js';
import { toPhilippineE164 } from '../src/utils/smsPhone.js';

const CRON_SECRET = 'test-cron-reminder-secret-with-enough-entropy';
const objectId = () => new mongoose.Types.ObjectId();

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function schedulerModule(result = { processed: 0, sent: 0, failed: 0, invalidated: 0, skipped: 1 }) {
  return { smsReminderService: { async runDueReminders() { return result; } } };
}

function createMemoryRepository(reminders, context) {
  return {
    async create(data) {
      if (reminders.some(item => String(item.appointment_id) === String(data.appointment_id)
        && item.reminder_type === data.reminder_type && item.schedule_version === data.schedule_version)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      const item = { _id: objectId(), ...data };
      reminders.push(item);
      return item;
    },
    async failStaleProcessing(cutoff, now) {
      let changed = 0;
      for (const item of reminders) {
        if (item.status === 'processing' && item.processing_started_at <= cutoff) {
          Object.assign(item, { status: 'failed', failed_at: now, failure_category: 'stale_processing' });
          changed += 1;
        }
      }
      return changed;
    },
    async claimNextDue(now) {
      const item = reminders.find(candidate => candidate.status === 'scheduled' && candidate.scheduled_for <= now);
      if (!item) return null;
      Object.assign(item, { status: 'processing', processing_started_at: now });
      return { ...item };
    },
    async claimById(id, now) {
      const item = reminders.find(candidate => String(candidate._id) === String(id)
        && candidate.status === 'scheduled' && candidate.scheduled_for <= now);
      if (!item) return null;
      Object.assign(item, { status: 'processing', processing_started_at: now });
      return { ...item };
    },
    async latestScheduleVersion(appointmentId) {
      return reminders.filter(item => String(item.appointment_id) === String(appointmentId))
        .reduce((latest, item) => Math.max(latest, item.schedule_version), 0);
    },
    async invalidateUnsent(appointmentId, now) {
      let changed = 0;
      for (const item of reminders) {
        if (String(item.appointment_id) === String(appointmentId) && ['scheduled', 'processing'].includes(item.status)) {
          Object.assign(item, { status: 'invalidated', invalidated_at: now });
          changed += 1;
        }
      }
      return changed;
    },
    async markInvalidated(id, now) {
      const item = reminders.find(candidate => String(candidate._id) === String(id) && candidate.status === 'processing');
      if (item) Object.assign(item, { status: 'invalidated', invalidated_at: now });
      return item;
    },
    async findDeliveryContext() { return context; },
    async markSent(id, result, now) {
      const item = reminders.find(candidate => String(candidate._id) === String(id) && candidate.status === 'processing');
      if (item) Object.assign(item, { status: 'sent', sent_at: now, provider_reference_id: result.provider_reference_id });
      return item;
    },
    async markFailed(id, result, now) {
      const item = reminders.find(candidate => String(candidate._id) === String(id) && candidate.status === 'processing');
      if (item) Object.assign(item, { status: 'failed', failed_at: now, failure_category: result.safe_error_category });
      return item;
    },
  };
}

test('SMS config defaults disabled with UniSMS and accepts fake test mode', () => {
  const defaults = loadConfig({ NODE_ENV: 'test' });
  assert.equal(defaults.smsEnabled, false);
  assert.equal(defaults.smsProvider, 'unisms');
  assert.equal(defaults.smsProviderTimeoutMs, 5_000);
  const fake = loadConfig({ NODE_ENV: 'test', SMS_ENABLED: 'true', SMS_PROVIDER: 'fake' });
  assert.equal(fake.smsEnabled, true);
  assert.equal(fake.smsProvider, 'fake');
  assert.throws(() => loadConfig({ NODE_ENV: 'test', SMS_PROVIDER: 'unknown' }), /fake or unisms/);
  assert.throws(() => loadConfig({ NODE_ENV: 'test', CRON_REMINDER_SECRET: 'weak' }), /at least 32 characters/);
});

test('phone conversion is strict and does not mutate canonical storage values', () => {
  const stored = '09171234567';
  assert.equal(toPhilippineE164(stored), '+639171234567');
  assert.equal(stored, '09171234567');
  for (const invalid of ['0917123456', '091712345678', '09171abc567', '+639171234567']) assert.throws(() => toPhilippineE164(invalid), /invalid/i);
});

test('fake provider is deterministic and never needs a network client', async () => {
  const provider = createFakeSmsProvider();
  const result = await provider.send({ recipient: '+639171234567', content: 'Arion test' });
  assert.deepEqual(result, { provider: 'fake', provider_reference_id: 'fake-sms-1', outcome: 'sent', provider_status: 'sent', latency_ms: 0, safe_error_category: null });
  assert.equal(provider.deliveries.length, 1);
});

test('disabled SMS never calls its provider', async () => {
  let calls = 0;
  const service = createSmsService({ enabled: false, provider: { name: 'unisms', async send() { calls += 1; } } });
  assert.equal((await service.send({ phoneNumber: '09171234567', content: 'x' })).outcome, 'disabled');
  assert.equal(calls, 0);
});

test('fake and real provider modes remain isolated with no silent fallback', async () => {
  let networkCalls = 0;
  const fake = createSmsModule(
    { smsEnabled: true, smsProvider: 'fake', uniSmsApiKey: 'unused', uniSmsSenderId: 'unused' },
    { repository: createMemoryRepository([], null), fetchImpl: async () => { networkCalls += 1; } },
  );
  assert.equal((await fake.smsService.send({ phoneNumber: '09171234567', content: 'Arion test' })).provider, 'fake');
  assert.equal(networkCalls, 0);

  const real = createSmsModule(
    { smsEnabled: true, smsProvider: 'unisms', uniSmsApiKey: '', uniSmsSenderId: '' },
    { repository: createMemoryRepository([], null), fetchImpl: async () => { networkCalls += 1; } },
  );
  const result = await real.smsService.send({ phoneNumber: '09171234567', content: 'Arion test' });
  assert.equal(result.provider, 'unisms');
  assert.equal(result.outcome, 'failed');
  assert.equal(result.safe_error_category, 'configuration_error');
  assert.equal(networkCalls, 0);
  assert.equal(fake.provider.deliveries.length, 1);
});

test('UniSMS adapter uses the official narrow request and normalizes success', async () => {
  let request;
  const provider = createUniSmsProvider({
    apiKey: 'private-test-key', senderId: 'Arion',
    async fetchImpl(url, options) {
      request = { url, options };
      return {
        ok: true,
        status: 201,
        async json() {
          return {
            message: {
              reference_id: 'msg-123', status: 'pending', recipient: '+639171234567',
              content: 'Arion reminder', sender_id: 'Arion', fail_reason: null,
            },
            extra: 'not-returned',
          };
        },
      };
    },
  });
  const result = await provider.send({ recipient: '+639171234567', content: 'Arion reminder' });
  assert.equal(request.url, UNISMS_SEND_ENDPOINT);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.authorization, `Basic ${Buffer.from('private-test-key:').toString('base64')}`);
  assert.equal(request.options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), { recipient: '+639171234567', content: 'Arion reminder', sender_id: 'Arion' });
  assert.equal(result.provider_reference_id, 'msg-123');
  assert.equal(result.outcome, 'sent');
  assert.equal(result.provider_status, 'pending');
  assert.equal(Number.isInteger(result.latency_ms), true);
  assert.equal(JSON.stringify(result).includes('private-test-key'), false);
  assert.doesNotMatch(JSON.stringify(result), /\+639171234567|Arion reminder/);
  assert.equal(Object.hasOwn(result, 'extra'), false);
});

test('UniSMS configuration, timeout, auth, rate and provider errors are safe', async () => {
  assert.equal((await createUniSmsProvider().send({ recipient: '+639171234567', content: 'x' })).safe_error_category, 'configuration_error');
  assert.equal((await createUniSmsProvider({ apiKey: 'x' }).send({ recipient: '+639171234567', content: 'x' })).safe_error_category, 'configuration_error');
  for (const [status, category] of [[401, 'authentication_error'], [429, 'rate_limited'], [422, 'invalid_recipient'], [500, 'provider_error']]) {
    const provider = createUniSmsProvider({ apiKey: 'secret', senderId: 'Arion', fetchImpl: async () => ({ ok: false, status }) });
    assert.equal((await provider.send({ recipient: '+639171234567', content: 'x' })).safe_error_category, category);
  }
  const timeout = createUniSmsProvider({ apiKey: 'secret', senderId: 'Arion', fetchImpl: async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); } });
  assert.equal((await timeout.send({ recipient: '+639171234567', content: 'x' })).safe_error_category, 'timeout');
});

test('UniSMS adapter fails closed for malformed or rejected official responses', async () => {
  for (const response of [
    { ok: true, status: 200, async json() { return { message: { reference_id: 'msg-1', status: 'pending' } }; } },
    { ok: true, status: 201, async json() { return { reference_id: 'wrong-level', status: 'pending' }; } },
    { ok: true, status: 201, async json() { return { message: { status: 'pending' } }; } },
    { ok: true, status: 201, async json() { return { message: { reference_id: 'msg-1', status: 'failed' } }; } },
  ]) {
    const provider = createUniSmsProvider({ apiKey: 'secret', senderId: 'Arion', fetchImpl: async () => response });
    const result = await provider.send({ recipient: '+639171234567', content: 'x' });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.safe_error_category, 'provider_error');
    assert.equal(result.provider_reference_id, null);
  }
});

test('reminder model bounds types, statuses, required references and indexes', async () => {
  const base = { appointment_id: objectId(), patient_id: objectId(), reminder_type: 'reminder_24h', appointment_at: new Date(), scheduled_for: new Date(), schedule_version: 1 };
  await new AppointmentSmsReminder(base).validate();
  for (const field of ['appointment_id', 'patient_id', 'appointment_at', 'scheduled_for']) await assert.rejects(new AppointmentSmsReminder({ ...base, [field]: undefined }).validate());
  await assert.rejects(new AppointmentSmsReminder({ ...base, reminder_type: 'anything' }).validate());
  await assert.rejects(new AppointmentSmsReminder({ ...base, status: 'anything' }).validate());
  assert.deepEqual(new Set(SMS_REMINDER_TYPES), new Set(['booking_immediate', 'reminder_24h', 'reminder_1h', 'reschedule_immediate', 'cancellation_immediate']));
  assert.deepEqual(new Set(SMS_REMINDER_STATUSES), new Set(['scheduled', 'processing', 'sent', 'failed', 'invalidated']));
  const indexes = AppointmentSmsReminder.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.appointment_id === 1 && keys.reminder_type === 1 && keys.schedule_version === 1 && options.unique));
  assert.ok(indexes.some(([keys]) => keys.status === 1 && keys.scheduled_for === 1));
});

test('logical duplicate reminder creation is blocked by repository contract', async () => {
  const reminders = [];
  const service = createSmsReminderService({ repository: createMemoryRepository(reminders, null), smsService: { enabled: false } });
  const input = { appointmentId: objectId(), patientId: objectId(), reminderType: 'reminder_24h', appointmentAt: new Date(), scheduledFor: new Date(), scheduleVersion: 1 };
  await service.scheduleReminder(input);
  await assert.rejects(service.scheduleReminder(input), error => error.code === 11000);
});

test('atomic claim permits one concurrent delivery and terminal reminders do not resend', async () => {
  const now = new Date('2026-10-14T00:00:00.000Z');
  const appointmentId = objectId();
  const reminders = [
    { _id: objectId(), appointment_id: appointmentId, patient_id: objectId(), reminder_type: 'reminder_1h', appointment_at: new Date('2026-10-15T08:30:00.000Z'), scheduled_for: new Date(now - 1), schedule_version: 1, status: 'scheduled' },
    { _id: objectId(), appointment_id: appointmentId, patient_id: objectId(), reminder_type: 'reminder_24h', appointment_at: new Date('2026-10-15T08:30:00.000Z'), scheduled_for: new Date(now - 1), schedule_version: 1, status: 'sent' },
    { _id: objectId(), appointment_id: appointmentId, patient_id: objectId(), reminder_type: 'booking_immediate', appointment_at: new Date('2026-10-15T08:30:00.000Z'), scheduled_for: new Date(now - 1), schedule_version: 1, status: 'invalidated' },
    { _id: objectId(), appointment_id: appointmentId, patient_id: objectId(), reminder_type: 'cancellation_immediate', appointment_at: new Date('2026-10-15T08:30:00.000Z'), scheduled_for: new Date(now - 1), schedule_version: 1, status: 'failed' },
  ];
  const repository = createMemoryRepository(reminders, { phoneNumber: '09171234567', appointmentAt: new Date('2026-10-15T08:30:00.000Z'), doctorName: 'Dr. Santos', status: 'pending', checkedIn: false });
  const provider = createFakeSmsProvider();
  const service = createSmsReminderService({ repository, smsService: createSmsService({ enabled: true, provider }), now: () => now });
  const results = await Promise.all([service.runDueReminders(), service.runDueReminders()]);
  assert.equal(results.reduce((sum, item) => sum + item.sent, 0), 1);
  assert.equal(provider.deliveries.length, 1);
  assert.equal(reminders.find(item => item.reminder_type === 'reminder_1h').provider_reference_id, 'fake-sms-1');
});

test('stale processing is failed without automatic retry', async () => {
  const now = new Date('2026-10-14T00:20:00.000Z');
  const reminder = { _id: objectId(), appointment_id: objectId(), patient_id: objectId(), reminder_type: 'reminder_1h', appointment_at: new Date('2026-10-14T01:00:00.000Z'), scheduled_for: new Date('2026-10-14T00:00:00.000Z'), schedule_version: 1, status: 'processing', processing_started_at: new Date('2026-10-14T00:00:00.000Z') };
  const provider = createFakeSmsProvider();
  const service = createSmsReminderService({ repository: createMemoryRepository([reminder], {}), smsService: createSmsService({ enabled: true, provider }), now: () => now });
  assert.deepEqual(await service.runDueReminders(), { processed: 0, sent: 0, failed: 0, invalidated: 0, skipped: 1 });
  assert.equal(reminder.status, 'failed');
  assert.equal(reminder.failure_category, 'stale_processing');
  assert.equal(provider.deliveries.length, 0);
});

test('templates are bounded and omit unapproved clinical/document input', () => {
  for (const reminderType of SMS_REMINDER_TYPES) {
    const message = createAppointmentSms({ reminderType, appointmentAt: '2026-10-15T08:30:00.000Z', doctorName: 'Doctor Santos', visitReason: 'private reason', diagnosis: 'private diagnosis', supportingDocument: 'private.pdf' });
    assert.ok(message.length <= SMS_MESSAGE_MAX_LENGTH);
    assert.match(message, /^Arion:/);
    assert.match(message, /^[\x20-\x7E]+$/);
    assert.doesNotMatch(message, /private|diagnosis|\.pdf/i);
  }
  const fallback = createAppointmentSms({ reminderType: 'reminder_24h', appointmentAt: '2026-10-15T08:30:00.000Z', doctorName: 'D'.repeat(500) });
  assert.ok(fallback.length <= SMS_MESSAGE_MAX_LENGTH);
});

test('scheduler requires its bearer secret and role cookies never substitute', async () => {
  const app = createApp({ nodeEnv: 'test', authSecret: 'test-secret', cronReminderSecret: CRON_SECRET }, { smsModule: schedulerModule() });
  await withServer(app, async baseUrl => {
    for (const cookie of [undefined, 'arion_auth=patient', 'arion_auth=doctor', 'arion_auth=staff', 'arion_auth=admin']) {
      const response = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, { method: 'POST', headers: cookie ? { cookie } : {} });
      assert.equal(response.status, 401);
    }
    assert.equal((await fetch(`${baseUrl}/api/internal/sms-reminders/run`, { method: 'POST', headers: { authorization: 'Bearer wrong' } })).status, 401);
    const accepted = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { processed: 0, sent: 0, failed: 0, invalidated: 0, skipped: 1 });
  });
});

test('scheduler denies blank and malformed bearer headers', async () => {
  const app = createApp({ nodeEnv: 'test', authSecret: 'test-secret', cronReminderSecret: CRON_SECRET }, { smsModule: schedulerModule() });
  await withServer(app, async baseUrl => {
    for (const authorization of ['', 'Bearer', 'Bearer ', 'bearer value', 'Basic value', `Bearer ${CRON_SECRET} extra`]) {
      const response = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, {
        method: 'POST', headers: authorization ? { authorization } : {},
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: { code: 'CRON_UNAUTHORIZED', message: 'Scheduler authentication is required.' },
      });
    }
  });
});

test('scheduler fails closed without a secret and rejects request bodies', async () => {
  const missing = createApp({ nodeEnv: 'test', authSecret: 'test-secret' }, { smsModule: schedulerModule() });
  await withServer(missing, async baseUrl => {
    assert.equal((await fetch(`${baseUrl}/api/internal/sms-reminders/run`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } })).status, 401);
  });
  const configured = createApp({ nodeEnv: 'test', authSecret: 'test-secret', cronReminderSecret: CRON_SECRET }, { smsModule: schedulerModule() });
  await withServer(configured, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}`, 'content-type': 'application/json' }, body: '{"force":true}' });
    assert.equal(response.status, 400);
  });
});

test('scheduler response is privacy-minimized', async () => {
  const summary = { processed: 2, sent: 1, failed: 1, skipped: 0 };
  const app = createApp({ nodeEnv: 'test', authSecret: 'test-secret', cronReminderSecret: CRON_SECRET }, { smsModule: schedulerModule(summary) });
  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } });
    const body = await response.json();
    assert.deepEqual(body, summary);
    assert.doesNotMatch(JSON.stringify(body), /patient|phone|message|secret|0917|\+63/i);
  });
});

test('scheduler uses a separate configurable rate limit', async () => {
  const app = createApp({
    nodeEnv: 'test', authSecret: 'test-secret', cronReminderSecret: CRON_SECRET,
    smsSchedulerRateLimitMax: 1, smsSchedulerRateLimitWindowMs: 60_000,
  }, { smsModule: schedulerModule() });
  await withServer(app, async baseUrl => {
    const options = { method: 'POST', headers: { authorization: `Bearer ${CRON_SECRET}` } };
    assert.equal((await fetch(`${baseUrl}/api/internal/sms-reminders/run`, options)).status, 200);
    const limited = await fetch(`${baseUrl}/api/internal/sms-reminders/run`, options);
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
  });
});

test('security logging redacts SMS secrets, recipient and raw content', () => {
  const event = normalizeSecurityEvent({ event: 'SMS_TEST', metadata: { api_key: 'top-secret-key', cron_secret: 'cron-secret', phone_number: '09171234567', recipient: '+639171234567', sms_body: 'Arion private body', content: 'raw message', result_category: 'timeout' } });
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /top-secret|cron-secret|09171234567|\+639171234567|private body|raw message/);
  assert.equal(event.metadata.result_category, 'timeout');
});
