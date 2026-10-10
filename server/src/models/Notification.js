import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

export const NOTIFICATION_RECIPIENT_ROLES = Object.freeze(['patient', 'staff', 'doctor', 'admin']);
export const NOTIFICATION_TYPES = Object.freeze([
  'appointment_created',
  'appointment_confirmed',
  'appointment_rescheduled',
  'appointment_cancelled',
  'appointment_completed',
  'appointment_reminder',
  'patient_booking_created',
  'patient_arrived',
  'appointment_marked_urgent',
  'assigned_appointment_created',
  'security_notice',
  'account_status_notice',
]);
export const NOTIFICATION_RESOURCE_TYPES = Object.freeze(['appointment', 'patient', 'doctor']);
export const NOTIFICATION_TITLE_MAX = 120;
export const NOTIFICATION_MESSAGE_MAX = 500;
export const NOTIFICATION_DISPLAY_NAME_MAX = 160;

const notificationSchema = new mongoose.Schema(
  {
    recipient_user_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
      immutable: true,
    },
    recipient_role: {
      type: String,
      enum: NOTIFICATION_RECIPIENT_ROLES,
      required: true,
      immutable: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      immutable: true,
    },
    title: { type: String, required: true, trim: true, maxlength: NOTIFICATION_TITLE_MAX, immutable: true },
    message: { type: String, required: true, trim: true, maxlength: NOTIFICATION_MESSAGE_MAX, immutable: true },
    related_resource_type: {
      type: String,
      enum: NOTIFICATION_RESOURCE_TYPES,
      default: null,
      immutable: true,
    },
    related_resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      immutable: true,
    },
    patient_display_name: { type: String, trim: true, maxlength: NOTIFICATION_DISPLAY_NAME_MAX, default: null, immutable: true },
    doctor_display_name: { type: String, trim: true, maxlength: NOTIFICATION_DISPLAY_NAME_MAX, default: null, immutable: true },
    appointment_at: { type: Date, default: null, immutable: true },
    is_read: { type: Boolean, required: true, default: false },
    read_at: { type: Date, default: null },
  },
  modelOptions,
);

notificationSchema.pre('validate', function validateResourcePair() {
  if (Boolean(this.related_resource_type) !== Boolean(this.related_resource_id)) {
    this.invalidate('related_resource_id', 'related resource type and id must be supplied together.');
  }
});

notificationSchema.index(
  { recipient_user_profile_id: 1, created_at: -1 },
  { name: 'notification_recipient_history' },
);
notificationSchema.index(
  { recipient_user_profile_id: 1, is_read: 1, created_at: -1 },
  { name: 'notification_recipient_unread' },
);

export const Notification =
  mongoose.models.Notification ??
  mongoose.model('Notification', notificationSchema, 'notifications');
