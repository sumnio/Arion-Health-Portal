import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const portalInvitationSchema = new mongoose.Schema(
  {
    patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, immutable: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    token_hash: { type: String, required: true, select: false },
    expires_at: { type: Date, required: true },
    otp_code_hash: { type: String, default: null, select: false },
    otp_session_hash: { type: String, default: null, select: false },
    otp_expires_at: { type: Date, default: null },
    otp_attempt_count: { type: Number, default: 0, min: 0 },
    otp_max_attempts: { type: Number, default: 5, min: 1 },
    otp_last_sent_at: { type: Date, default: null },
    claim_session_hash: { type: String, default: null, select: false },
    claim_session_expires_at: { type: Date, default: null },
    consumed_at: { type: Date, default: null },
    invalidated_at: { type: Date, default: null },
  },
  modelOptions,
);

portalInvitationSchema.index({ token_hash: 1 }, { unique: true, name: 'unique_portal_invitation_token' });
portalInvitationSchema.index({ patient_id: 1, created_at: -1 }, { name: 'portal_invitation_patient_history' });
portalInvitationSchema.index({ expires_at: 1 }, { name: 'portal_invitation_expiry_lookup' });

export const PortalInvitation = mongoose.models.PortalInvitation
  ?? mongoose.model('PortalInvitation', portalInvitationSchema, 'portal_invitations');
