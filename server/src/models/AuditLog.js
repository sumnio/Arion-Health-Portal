import mongoose from 'mongoose';

export const AUDIT_CATEGORIES = Object.freeze([
  'AUTH', 'MFA', 'ACCOUNT', 'APPOINTMENT', 'SCHEDULE', 'PWD',
  'MEDICAL_RECORD', 'PRESCRIPTION', 'CERTIFICATE',
  'PORTAL_INVITATION', 'PATIENT_ACCOUNT',
]);

export const AUDIT_RESULTS = Object.freeze(['success', 'failed', 'denied']);

export const AUDIT_ACTIONS = Object.freeze([
  'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILURE', 'AUTH_LOGOUT',
  'MFA_VERIFY_SUCCESS', 'MFA_VERIFY_FAILURE',
  'ACCOUNT_ACTIVATED', 'ACCOUNT_DEACTIVATED',
  'PWD_VERIFICATION_APPROVED', 'PWD_VERIFICATION_REJECTED',
  'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED',
  'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED',
  'WORKING_HOURS_CREATED', 'WORKING_HOURS_UPDATED', 'WORKING_HOURS_DELETED',
  'PUBLISHED_AVAILABILITY_CREATED', 'PUBLISHED_AVAILABILITY_UPDATED',
  'PUBLISHED_AVAILABILITY_REMOVED', 'TIME_OFF_CREATED', 'TIME_OFF_REMOVED',
  'MEDICAL_RECORD_CREATED', 'PRESCRIPTION_ISSUED',
  'PRESCRIPTION_ATTACHMENT_ISSUED', 'MEDICAL_CERTIFICATE_ISSUED',
  'PORTAL_INVITATION_SENT', 'PORTAL_INVITATION_RESENT',
  'PATIENT_ACCOUNT_CLAIMED',
]);

const auditLogSchema = new mongoose.Schema(
  {
    actor_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null },
    actor_role: { type: String, enum: ['patient', 'doctor', 'staff', 'admin', 'system', 'unknown'], required: true },
    actor_display_name_snapshot: { type: String, trim: true, maxlength: 120, default: null },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    category: { type: String, enum: AUDIT_CATEGORIES, required: true },
    target_type: { type: String, trim: true, maxlength: 80, required: true },
    target_id: { type: String, trim: true, maxlength: 120, default: null },
    target_display_snapshot: { type: String, trim: true, maxlength: 160, default: null },
    result: { type: String, enum: AUDIT_RESULTS, required: true },
    request_id: { type: String, trim: true, maxlength: 120, default: null },
    safe_metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    created_at: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { versionKey: false, strict: 'throw' },
);

auditLogSchema.index({ created_at: -1 }, { name: 'audit_created_desc' });
auditLogSchema.index({ actor_role: 1, created_at: -1 }, { name: 'audit_actor_role_created' });
auditLogSchema.index({ category: 1, created_at: -1 }, { name: 'audit_category_created' });
auditLogSchema.index({ action: 1, created_at: -1 }, { name: 'audit_action_created' });
auditLogSchema.index({ result: 1, created_at: -1 }, { name: 'audit_result_created' });
auditLogSchema.index(
  { target_type: 1, target_id: 1, created_at: -1 },
  { name: 'audit_target_created' },
);

function rejectMutation(next) {
  next(new Error('AUDIT_LOG_APPEND_ONLY'));
}

for (const operation of [
  'updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
  'deleteOne', 'deleteMany', 'findOneAndDelete',
]) {
  auditLogSchema.pre(operation, rejectMutation);
}

auditLogSchema.pre('updateOne', { document: true, query: false }, rejectMutation);
auditLogSchema.pre('deleteOne', { document: true, query: false }, rejectMutation);
auditLogSchema.pre('bulkWrite', rejectMutation);

auditLogSchema.pre('save', function preventExistingSave(next) {
  if (!this.isNew) return next(new Error('AUDIT_LOG_APPEND_ONLY'));
  return next();
});

export const AuditLog = mongoose.models.AuditLog
  ?? mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
