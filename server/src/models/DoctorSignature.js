import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const doctorSignatureSchema = new mongoose.Schema(
  {
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, unique: true, immutable: true },
    storage_file_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    mime_type: { type: String, required: true, enum: ['image/png'] },
    file_size: { type: Number, required: true, min: 1, max: 1024 * 1024 },
    width: { type: Number, required: true, min: 200, max: 2000 },
    height: { type: Number, required: true, min: 50, max: 1000 },
    uploaded_at: { type: Date, required: true, default: Date.now },
  },
  modelOptions,
);

export const DoctorSignature = mongoose.models.DoctorSignature
  ?? mongoose.model('DoctorSignature', doctorSignatureSchema, 'doctor_signatures');
