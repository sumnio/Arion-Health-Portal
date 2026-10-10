import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

export const EMAIL_VERIFICATION_PURPOSES = Object.freeze(['registration_verification']);

const emailVerificationChallengeSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuthAccount',
      required: true,
      immutable: true,
    },
    purpose: {
      type: String,
      enum: EMAIL_VERIFICATION_PURPOSES,
      required: true,
      immutable: true,
    },
    code_hash: {
      type: String,
      required: true,
      immutable: true,
      select: false,
    },
    expires_at: { type: Date, required: true },
    attempt_count: { type: Number, required: true, default: 0, min: 0 },
    max_attempts: { type: Number, required: true, default: 5, min: 1 },
    resend_count: { type: Number, required: true, default: 0, min: 0 },
    last_sent_at: { type: Date, default: null },
    consumed_at: { type: Date, default: null },
    invalidated_at: { type: Date, default: null },
  },
  modelOptions,
);

emailVerificationChallengeSchema.index(
  { account_id: 1, purpose: 1, created_at: -1 },
  { name: 'email_verification_account_history' },
);
emailVerificationChallengeSchema.index(
  { expires_at: 1 },
  { name: 'email_verification_expiry_lookup' },
);

export const EmailVerificationChallenge =
  mongoose.models.EmailVerificationChallenge ??
  mongoose.model(
    'EmailVerificationChallenge',
    emailVerificationChallengeSchema,
    'email_verification_challenges',
  );
