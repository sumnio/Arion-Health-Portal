import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const prescriptionSchema = new mongoose.Schema(
  {
    medical_record_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      required: true,
    },
    medicine: {
      type: String,
      default: null,
      trim: true,
      required() { return !this.attachment_storage_file_id; },
    },
    dosage: {
      type: String,
      default: null,
      trim: true,
      required() { return !this.attachment_storage_file_id; },
    },
    instructions: { type: String, default: null, trim: true },
    attachment_storage_file_id: { type: mongoose.Schema.Types.ObjectId, default: null, select: false, immutable: true },
    attachment_mime_type: { type: String, enum: ['application/pdf', 'image/png', 'image/jpeg'], default: null, immutable: true },
    attachment_file_size: { type: Number, min: 1, max: 5 * 1024 * 1024, default: null, immutable: true },
    attachment_original_filename: { type: String, default: null, trim: true, maxlength: 180, immutable: true },
    attachment_sha256: { type: String, match: /^[a-f0-9]{64}$/, default: null, select: false, immutable: true },
    attachment_uploaded_at: { type: Date, default: null, immutable: true },
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
