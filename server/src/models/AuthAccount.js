import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const authAccountSchema = new mongoose.Schema(
  {
    user_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password_hash: {
      type: String,
      required: true,
      select: false,
    },
  },
  modelOptions,
);

authAccountSchema.index(
  { user_profile_id: 1 },
  { unique: true, name: 'unique_auth_account_profile' },
);
authAccountSchema.index(
  { email: 1 },
  { unique: true, name: 'unique_auth_account_email' },
);

export const AuthAccount =
  mongoose.models.AuthAccount ??
  mongoose.model('AuthAccount', authAccountSchema, 'auth_accounts');
