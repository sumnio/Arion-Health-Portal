import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

export const SMS_REMINDER_TYPES = Object.freeze([
  'booking_immediate',
  'reminder_24h',
  'reminder_1h',
  'reschedule_immediate',
  'cancellation_immediate',
]);

export const SMS_REMINDER_STATUSES = Object.freeze([
  'scheduled',
  'processing',
  'sent',
  'failed',
  'invalidated',
]);

export const SMS_FAILURE_CATEGORIES = Object.freeze([
  'configuration_error',
  'timeout',
  'authentication_error',
  'rate_limited',
  'provider_error',
  'invalid_recipient',
  'unknown_error',
  'stale_processing',
]);

const appointmentSmsReminderSchema = new mongoose.Schema(
  {
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      immutable: true,
    },
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      immutable: true,
    },
    reminder_type: {
      type: String,
      required: true,
      enum: SMS_REMINDER_TYPES,
      immutable: true,
    },
    scheduled_for: { type: Date, required: true, immutable: true },
    status: {
      type: String,
      required: true,
      enum: SMS_REMINDER_STATUSES,
      default: 'scheduled',
    },
    schedule_version: { type: Number, required: true, min: 1, immutable: true },
    provider: { type: String, enum: ['fake', 'unisms'], default: null },
    provider_reference_id: { type: String, trim: true, maxlength: 200, default: null },
    processing_started_at: { type: Date, default: null },
    sent_at: { type: Date, default: null },
    failed_at: { type: Date, default: null },
    invalidated_at: { type: Date, default: null },
    failure_category: { type: String, enum: SMS_FAILURE_CATEGORIES, default: null },
  },
  modelOptions,
);

appointmentSmsReminderSchema.index(
  { appointment_id: 1, reminder_type: 1, schedule_version: 1 },
  { unique: true, name: 'unique_appointment_sms_reminder_version' },
);
appointmentSmsReminderSchema.index(
  { status: 1, scheduled_for: 1 },
  { name: 'sms_reminder_due_queue' },
);
appointmentSmsReminderSchema.index(
  { appointment_id: 1, status: 1 },
  { name: 'sms_reminder_appointment_status' },
);

export const AppointmentSmsReminder =
  mongoose.models.AppointmentSmsReminder ??
  mongoose.model('AppointmentSmsReminder', appointmentSmsReminderSchema, 'appointment_sms_reminders');
