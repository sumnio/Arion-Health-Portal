import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const staffSchema = new mongoose.Schema(
  {
    user_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
    },
  },
  modelOptions,
);

staffSchema.index({ user_profile_id: 1 }, { unique: true, name: 'unique_staff_profile' });

export const Staff =
  mongoose.models.Staff ?? mongoose.model('Staff', staffSchema, 'staff');
