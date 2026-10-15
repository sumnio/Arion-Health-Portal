import { createAppointmentSms } from './smsTemplates.js';

const DEFAULT_BATCH_SIZE = 50;
export const SMS_REMINDER_HOUR_MS = 60 * 60 * 1000;
export const SMS_REMINDER_DAY_MS = 24 * SMS_REMINDER_HOUR_MS;

function log(logger, { event, outcome, reminder, provider, category, latencyMs }) {
  try {
    logger?.logSecurityEvent({
      event,
      severity: outcome === 'sent' ? 'info' : 'warning',
      outcome,
      target_type: 'appointment_sms_reminder',
      target_id: reminder?.appointment_id,
      metadata: {
        reminder_type: reminder?.reminder_type,
        provider,
        result_category: category,
        latency_ms: latencyMs,
      },
    });
  } catch {
    // SMS telemetry must never interrupt appointment or reminder processing.
  }
}

function sameInstant(left, right) {
  return left && right && new Date(left).getTime() === new Date(right).getTime();
}

function timedPlan(appointmentAt, referenceTime) {
  const appointmentTime = new Date(appointmentAt).getTime();
  const remaining = appointmentTime - referenceTime.getTime();
  if (remaining <= 0) return [];
  if (remaining > SMS_REMINDER_DAY_MS) {
    return [
      { reminderType: 'reminder_24h', scheduledFor: new Date(appointmentTime - SMS_REMINDER_DAY_MS) },
      { reminderType: 'reminder_1h', scheduledFor: new Date(appointmentTime - SMS_REMINDER_HOUR_MS) },
    ];
  }
  if (remaining > SMS_REMINDER_HOUR_MS) {
    return [{ reminderType: 'reminder_1h', scheduledFor: new Date(appointmentTime - SMS_REMINDER_HOUR_MS) }];
  }
  return [];
}

function isImmediate(reminderType) {
  return ['booking_immediate', 'reschedule_immediate', 'cancellation_immediate'].includes(reminderType);
}

export function createSmsReminderService({
  repository,
  smsService,
  logger,
  timeZone = 'Asia/Manila',
  staleProcessingMs = 10 * 60 * 1000,
  now = () => new Date(),
  batchSize = DEFAULT_BATCH_SIZE,
}) {
  async function scheduleReminder(input) {
    return repository.create({
      appointment_id: input.appointmentId,
      patient_id: input.patientId,
      reminder_type: input.reminderType,
      appointment_at: input.appointmentAt,
      scheduled_for: input.scheduledFor,
      schedule_version: input.scheduleVersion,
      status: 'scheduled',
    });
  }

  async function invalidate(reminder, runAt) {
    await repository.markInvalidated(reminder._id, runAt);
    log(logger, {
      event: 'SMS_REMINDER_INVALIDATED', outcome: 'invalidated', reminder,
      provider: smsService.providerName, category: 'stale_or_ineligible', latencyMs: 0,
    });
    return 'invalidated';
  }

  async function processClaimed(reminder, runAt) {
    const startedAt = Date.now();
    const context = await repository.findDeliveryContext(reminder);
    const latestVersion = await repository.latestScheduleVersion(reminder.appointment_id);
    const isCancellation = reminder.reminder_type === 'cancellation_immediate';
    const eligibleStatus = isCancellation
      ? context?.status === 'cancelled'
      : context?.status === 'pending' && !context?.checkedIn;
    const remaining = context?.appointmentAt
      ? new Date(context.appointmentAt).getTime() - runAt.getTime()
      : Number.NEGATIVE_INFINITY;
    const staleTimedReminder =
      (reminder.reminder_type === 'reminder_24h' && remaining <= SMS_REMINDER_HOUR_MS)
      || (reminder.reminder_type === 'reminder_1h' && remaining <= 0);

    if (!context || !eligibleStatus
      || !sameInstant(context.appointmentAt, reminder.appointment_at)
      || reminder.schedule_version !== latestVersion || staleTimedReminder) {
      return invalidate(reminder, runAt);
    }

    let result;
    if (!context.phoneNumber || !context.appointmentAt) {
      result = { provider: smsService.providerName, outcome: 'failed', safe_error_category: 'invalid_recipient' };
    } else {
      const content = createAppointmentSms({
        reminderType: reminder.reminder_type,
        appointmentAt: context.appointmentAt,
        doctorName: context.doctorName,
        timeZone,
        referenceTime: runAt,
      });
      result = await smsService.send({ phoneNumber: context.phoneNumber, content });
    }

    if (result.outcome === 'sent') await repository.markSent(reminder._id, result, now());
    else await repository.markFailed(reminder._id, result, now());
    log(logger, {
      event: 'SMS_REMINDER_PROCESSED', outcome: result.outcome, reminder,
      provider: result.provider, category: result.safe_error_category,
      latencyMs: Date.now() - startedAt,
    });
    return result.outcome;
  }

  async function processReminderById(id) {
    if (!smsService.enabled) return 'skipped';
    const runAt = now();
    const reminder = await repository.claimById(id, runAt);
    if (!reminder) return 'skipped';
    return processClaimed(reminder, runAt);
  }

  async function createPlan({ appointmentId, patientId, appointmentAt, scheduleVersion, type, includeImmediate }) {
    if (!smsService.enabled) return [];
    const referenceTime = now();
    const entries = [];
    if (includeImmediate && new Date(appointmentAt) > referenceTime) {
      entries.push({ reminderType: type, scheduledFor: referenceTime });
    }
    entries.push(...timedPlan(appointmentAt, referenceTime));
    const reminders = [];
    for (const entry of entries) {
      reminders.push(await scheduleReminder({ appointmentId, patientId, appointmentAt, scheduleVersion, ...entry }));
    }
    for (const reminder of reminders.filter((item) => isImmediate(item.reminder_type))) {
      await processReminderById(reminder._id);
    }
    return reminders;
  }

  return Object.freeze({
    scheduleReminder,

    async appointmentBooked({ appointmentId, patientId, appointmentAt }) {
      const referenceTime = now();
      const remaining = new Date(appointmentAt).getTime() - referenceTime.getTime();
      return createPlan({
        appointmentId, patientId, appointmentAt, scheduleVersion: 1,
        type: 'booking_immediate',
        includeImmediate: remaining > 0 && remaining <= SMS_REMINDER_DAY_MS,
      });
    },

    async appointmentRescheduled({ appointmentId, patientId, appointmentAt }) {
      const runAt = now();
      const priorVersion = await repository.latestScheduleVersion(appointmentId);
      await repository.invalidateUnsent(appointmentId, runAt);
      return createPlan({
        appointmentId, patientId, appointmentAt,
        scheduleVersion: Math.max(priorVersion + 1, 1),
        type: 'reschedule_immediate', includeImmediate: new Date(appointmentAt) > runAt,
      });
    },

    async appointmentCancelled({ appointmentId, patientId, appointmentAt }) {
      const runAt = now();
      const scheduleVersion = Math.max(await repository.latestScheduleVersion(appointmentId), 1);
      await repository.invalidateUnsent(appointmentId, runAt);
      if (!smsService.enabled) return [];
      const reminder = await scheduleReminder({
        appointmentId, patientId, appointmentAt, scheduleVersion,
        reminderType: 'cancellation_immediate', scheduledFor: runAt,
      });
      await processReminderById(reminder._id);
      return [reminder];
    },

    async appointmentArrived({ appointmentId }) {
      return repository.invalidateUnsent(appointmentId, now());
    },
    async appointmentNoShow({ appointmentId }) {
      return repository.invalidateUnsent(appointmentId, now());
    },
    async appointmentCompleted({ appointmentId }) {
      return repository.invalidateUnsent(appointmentId, now());
    },

    async runDueReminders() {
      if (!smsService.enabled) return { processed: 0, sent: 0, failed: 0, invalidated: 0, skipped: 1 };
      const runAt = now();
      const staleCutoff = new Date(runAt.getTime() - staleProcessingMs);
      const stale = await repository.failStaleProcessing(staleCutoff, runAt);
      const summary = { processed: 0, sent: 0, failed: 0, invalidated: 0, skipped: stale };
      for (let index = 0; index < batchSize; index += 1) {
        const reminder = await repository.claimNextDue(runAt);
        if (!reminder) break;
        summary.processed += 1;
        const outcome = await processClaimed(reminder, runAt);
        if (outcome === 'sent') summary.sent += 1;
        else if (outcome === 'invalidated') summary.invalidated += 1;
        else summary.failed += 1;
      }
      return summary;
    },

    logWorkflowFailure(method, appointmentId) {
      log(logger, {
        event: 'SMS_REMINDER_WORKFLOW_FAILED', outcome: 'failed',
        reminder: { appointment_id: appointmentId, reminder_type: method },
        provider: smsService.providerName, category: 'workflow_error', latencyMs: 0,
      });
    },
  });
}
