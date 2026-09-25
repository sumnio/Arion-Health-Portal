import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const doctorSchema = new mongoose.Schema(
  {
    user_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
    },
    specialty: { type: String, required: true, trim: true },
    license_number: { type: String, required: true, trim: true },
    ptr_number: { type: String, required: true, trim: true },
    signature_path: { type: String, default: null, trim: true },
  },
  modelOptions,
);

doctorSchema.index({ user_profile_id: 1 }, { unique: true, name: 'unique_doctor_profile' });
doctorSchema.index({ license_number: 1 }, { unique: true, name: 'unique_doctor_license' });
doctorSchema.index({ ptr_number: 1 }, { unique: true, name: 'unique_doctor_ptr' });

export const Doctor =
  mongoose.models.Doctor ?? mongoose.model('Doctor', doctorSchema, 'doctors');
