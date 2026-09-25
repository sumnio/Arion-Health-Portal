import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];
export const APPOINTMENT_VISIT_TYPES = [
  'general_consultation',
  'follow_up',
  'check_up',
];
export const APPOINTMENT_PRIORITIES = ['normal', 'urgent'];
export const SLOT_BLOCKING_STATUSES = ['pending', 'confirmed', 'completed'];

const appointmentSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    appointment_at: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: APPOINTMENT_STATUSES,
      default: 'pending',
    },
    visit_type: {
      type: String,
      required: true,
      enum: APPOINTMENT_VISIT_TYPES,
    },
    reason: { type: String, required: true, trim: true },
    priority: {
      type: String,
      required: true,
      enum: APPOINTMENT_PRIORITIES,
      default: 'normal',
    },
    check_in_at: { type: Date, default: null },
    // The creator identifier is approved, but its permanent relationship target is not.
    created_by: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  modelOptions,
);

appointmentSchema.index(
  { doctor_id: 1, appointment_at: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: SLOT_BLOCKING_STATUSES } },
    name: 'unique_blocking_doctor_slot',
  },
);
appointmentSchema.index(
  { patient_id: 1, appointment_at: -1 },
  { name: 'patient_appointment_history' },
);

export const Appointment =
  mongoose.models.Appointment ??
  mongoose.model('Appointment', appointmentSchema, 'appointments');
