import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

export const PWD_VERIFICATION_STATUSES = Object.freeze([
  'not_submitted',
  'pending',
  'verified',
  'rejected',
]);

const PERSISTED_PWD_VERIFICATION_STATUSES = PWD_VERIFICATION_STATUSES.filter(status => status !== 'not_submitted');

export const PWD_ID_NUMBER_MAX = 64;
export const PWD_REJECTION_REASON_MAX = 500;

const reviewSchema = new mongoose.Schema({
  action: { type: String, required: true, enum: ['verified', 'rejected'], immutable: true },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', required: true, immutable: true },
  reviewed_at: { type: Date, required: true, immutable: true },
  rejection_reason: { type: String, default: null, trim: true, maxlength: PWD_REJECTION_REASON_MAX, immutable: true },
}, { _id: false });

const pwdVerificationSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true,
    },
    pwd_id_number: {
      type: String,
      default: null,
      trim: true,
      maxlength: PWD_ID_NUMBER_MAX,
      select: false,
    },
    storage_file_id: {
      type: mongoose.Schema.Types.ObjectId,
      unique: true,
      sparse: true,
      select: false,
    },
    stored_filename: { type: String, default: null, trim: true, maxlength: 100, select: false },
    mime_type: {
      type: String,
      default: null,
      enum: ['application/pdf', 'image/png', 'image/jpeg'],
      select: false,
    },
    file_size: { type: Number, default: null, min: 1, max: 5 * 1024 * 1024, select: false },
    document_sha256: { type: String, default: null, minlength: 64, maxlength: 64, select: false },
    front_storage_file_id: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true, select: false },
    front_stored_filename: { type: String, default: null, trim: true, maxlength: 100, select: false },
    front_mime_type: { type: String, enum: ['image/png', 'image/jpeg'], default: null, select: false },
    front_file_size: { type: Number, default: null, min: 1, max: 5 * 1024 * 1024, select: false },
    front_document_sha256: { type: String, default: null, minlength: 64, maxlength: 64, select: false },
    back_storage_file_id: { type: mongoose.Schema.Types.ObjectId, unique: true, sparse: true, select: false },
    back_stored_filename: { type: String, default: null, trim: true, maxlength: 100, select: false },
    back_mime_type: { type: String, enum: ['image/png', 'image/jpeg'], default: null, select: false },
    back_file_size: { type: Number, default: null, min: 1, max: 5 * 1024 * 1024, select: false },
    back_document_sha256: { type: String, default: null, minlength: 64, maxlength: 64, select: false },
    status: { type: String, required: true, enum: PERSISTED_PWD_VERIFICATION_STATUSES, default: 'pending' },
    submitted_at: { type: Date, required: true, default: Date.now },
    verified_at: { type: Date, default: null },
    verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null },
    reviewed_at: { type: Date, default: null },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'UserProfile', default: null },
    rejection_reason: { type: String, default: null, trim: true, maxlength: PWD_REJECTION_REASON_MAX, select: false },
    review_history: { type: [reviewSchema], default: [], select: false },
  },
  modelOptions,
);

pwdVerificationSchema.index(
  { patient_id: 1, status: 1 },
  { name: 'patient_pwd_verification_status' },
);
pwdVerificationSchema.index(
  { status: 1, submitted_at: 1, _id: 1 },
  { name: 'pwd_verification_pending_queue' },
);

export const PwdVerification = mongoose.models.PwdVerification
  ?? mongoose.model('PwdVerification', pwdVerificationSchema, 'pwd_verifications');
