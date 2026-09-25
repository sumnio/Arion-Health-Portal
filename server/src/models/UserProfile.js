import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const userProfileSchema = new mongoose.Schema(
  {
    display_name: { type: String, required: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ['patient', 'doctor', 'staff', 'admin'],
    },
    contact_number: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  modelOptions,
);

export const UserProfile =
  mongoose.models.UserProfile ??
  mongoose.model('UserProfile', userProfileSchema, 'user_profiles');
