import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const medicalRecordSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    appointment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    encounter_at: { type: Date, required: true },
    diagnosis: { type: String, required: true, trim: true },
    notes: { type: String, default: null, trim: true },
    follow_up: { type: String, default: null, trim: true },
  },
  modelOptions,
);

medicalRecordSchema.index(
  { patient_id: 1, encounter_at: -1 },
  { name: 'patient_medical_record_history' },
);
medicalRecordSchema.index({ doctor_id: 1 }, { name: 'doctor_medical_record_lookup' });
medicalRecordSchema.index(
  { appointment_id: 1 },
  {
    unique: true,
    partialFilterExpression: { appointment_id: { $type: 'objectId' } },
    name: 'unique_record_per_appointment',
  },
);

export const MedicalRecord =
  mongoose.models.MedicalRecord ??
  mongoose.model('MedicalRecord', medicalRecordSchema, 'medical_records');
