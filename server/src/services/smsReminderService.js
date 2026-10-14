import { createAppointmentSms } from './smsTemplates.js';

const DEFAULT_BATCH_SIZE = 50;

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
    // SMS telemetry must never interrupt reminder processing.
  }
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
  return Object.freeze({
    async scheduleReminder(input) {
      return repository.create({
        appointment_id: input.appointmentId,
        patient_id: input.patientId,
        reminder_type: input.reminderType,
        scheduled_for: input.scheduledFor,
        schedule_version: input.scheduleVersion,
        status: 'scheduled',
      });
    },

    async runDueReminders() {
      if (!smsService.enabled) return { processed: 0, sent: 0, failed: 0, skipped: 1 };
      const runAt = now();
      const staleCutoff = new Date(runAt.getTime() - staleProcessingMs);
      const stale = await repository.failStaleProcessing(staleCutoff, runAt);
      const summary = { processed: 0, sent: 0, failed: 0, skipped: stale };

      for (let index = 0; index < batchSize; index += 1) {
        const reminder = await repository.claimNextDue(runAt);
        if (!reminder) break;
        summary.processed += 1;
        const startedAt = Date.now();
        const context = await repository.findDeliveryContext(reminder);
        let result;
        if (!context?.phoneNumber || !context?.appointmentAt) {
          result = {
            provider: smsService.providerName,
            outcome: 'failed',
            safe_error_category: 'invalid_recipient',
          };
        } else {
          const content = createAppointmentSms({
            reminderType: reminder.reminder_type,
            appointmentAt: context.appointmentAt,
            doctorName: context.doctorName,
            timeZone,
          });
          result = await smsService.send({ phoneNumber: context.phoneNumber, content });
        }

        if (result.outcome === 'sent') {
          await repository.markSent(reminder._id, result, now());
          summary.sent += 1;
        } else {
          await repository.markFailed(reminder._id, result, now());
          summary.failed += 1;
        }
        log(logger, {
          event: 'SMS_REMINDER_PROCESSED',
          outcome: result.outcome,
          reminder,
          provider: result.provider,
          category: result.safe_error_category,
          latencyMs: Date.now() - startedAt,
        });
      }
      return summary;
    },
  });
}
