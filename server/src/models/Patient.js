import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const patientSchema = new mongoose.Schema(
  {
    user_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      default: null,
    },
    full_name: { type: String, required: true, trim: true },
    contact_number: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    sex: { type: String, required: true, trim: true },
    address: { type: String, default: null, trim: true },
    emergency_contact_name: { type: String, default: null, trim: true },
    emergency_contact_number: { type: String, default: null, trim: true },
    emergency_contact_relationship: { type: String, default: null, trim: true },
    allergies: { type: [String], default: [] },
    is_pwd: { type: Boolean, default: false },
  },
  modelOptions,
);

patientSchema.index(
  { user_profile_id: 1 },
  {
    unique: true,
    partialFilterExpression: { user_profile_id: { $type: 'objectId' } },
    name: 'unique_patient_portal_profile',
  },
);
patientSchema.index({ contact_number: 1 }, { name: 'patient_contact_lookup' });

export const Patient =
  mongoose.models.Patient ?? mongoose.model('Patient', patientSchema, 'patients');
