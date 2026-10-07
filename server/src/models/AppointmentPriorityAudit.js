import mongoose from 'mongoose';
import { APPOINTMENT_PRIORITIES } from './Appointment.js';

export const URGENT_REASON_LABELS = Object.freeze([
  'Sudden worsening of condition',
  'Severe pain or discomfort',
  'Breathing difficulty or respiratory concern',
  'Dizziness, weakness, or risk of fainting',
  'Active bleeding or recent injury',
  'Doctor-directed priority',
  'Other urgent concern',
]);

export const PRIORITY_AUDIT_TEXT_MAX = 200;

const immutable = { immutable: true };
const appointmentPriorityAuditSchema = new mongoose.Schema(
  {
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, ...immutable },
    previous_priority: { type: String, enum: APPOINTMENT_PRIORITIES, required: true, ...immutable },
    new_priority: { type: String, enum: APPOINTMENT_PRIORITIES, required: true, ...immutable },
    urgency_reason: { type: String, enum: [...URGENT_REASON_LABELS, null], default: null, ...immutable },
    explanation: { type: String, trim: true, maxlength: PRIORITY_AUDIT_TEXT_MAX, default: null, ...immutable },
    correction_reason: { type: String, trim: true, maxlength: PRIORITY_AUDIT_TEXT_MAX, default: null, ...immutable },
    staff_actor_user_profile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', required: true, ...immutable },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
);

appointmentPriorityAuditSchema.pre('validate', function validateTransition(next) {
  if (this.previous_priority === this.new_priority) return next(new Error('Priority audit must record a change.'));
  if (this.new_priority === 'urgent') {
    if (!URGENT_REASON_LABELS.includes(this.urgency_reason)) return next(new Error('Urgent priority requires an approved reason.'));
    if (this.urgency_reason === 'Other urgent concern' && !this.explanation?.trim()) return next(new Error('Other urgent concern requires an explanation.'));
    if (this.urgency_reason !== 'Other urgent concern' && this.explanation != null) return next(new Error('Explanation is allowed only for Other urgent concern.'));
    if (this.correction_reason != null) return next(new Error('Urgent priority does not accept a correction reason.'));
  }
  if (this.new_priority === 'normal') {
    if (!this.correction_reason?.trim()) return next(new Error('Returning to Normal requires a correction reason.'));
    if (this.urgency_reason != null || this.explanation != null) return next(new Error('Normal priority correction cannot include urgency fields.'));
  }
  return next();
});

appointmentPriorityAuditSchema.index({ appointment_id: 1, created_at: 1 }, { name: 'appointment_priority_audit_history' });
appointmentPriorityAuditSchema.index({ staff_actor_user_profile_id: 1, created_at: -1 }, { name: 'staff_priority_audit_activity' });

export const AppointmentPriorityAudit = mongoose.models.AppointmentPriorityAudit
  ?? mongoose.model('AppointmentPriorityAudit', appointmentPriorityAuditSchema, 'appointment_priority_audits');
