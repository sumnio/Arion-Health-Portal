import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const passwordResetTokenSchema = new mongoose.Schema(
  {
    account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuthAccount',
      required: true,
      immutable: true,
    },
    token_hash: {
      type: String,
      required: true,
      immutable: true,
      select: false,
    },
    expires_at: { type: Date, required: true },
    consumed_at: { type: Date, default: null },
    invalidated_at: { type: Date, default: null },
  },
  modelOptions,
);

passwordResetTokenSchema.index(
  { token_hash: 1 },
  { unique: true, name: 'unique_password_reset_token_hash' },
);
passwordResetTokenSchema.index(
  { account_id: 1, created_at: -1 },
  { name: 'password_reset_account_history' },
);
passwordResetTokenSchema.index(
  { expires_at: 1 },
  { name: 'password_reset_expiry_lookup' },
);

export const PasswordResetToken =
  mongoose.models.PasswordResetToken ??
  mongoose.model('PasswordResetToken', passwordResetTokenSchema, 'password_reset_tokens');
