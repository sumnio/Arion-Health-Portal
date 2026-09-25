import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const prescriptionSchema = new mongoose.Schema(
  {
    medical_record_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      required: true,
    },
    medicine: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    instructions: { type: String, default: null, trim: true },
  },
  modelOptions,
);

prescriptionSchema.index(
  { medical_record_id: 1 },
  { name: 'medical_record_prescription_lookup' },
);

export const Prescription =
  mongoose.models.Prescription ??
  mongoose.model('Prescription', prescriptionSchema, 'prescriptions');
