import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

export const SUPPORTING_DOCUMENT_FILENAME_MAX = 120;

const consultationSupportingDocumentSchema = new mongoose.Schema(
  {
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    storage_file_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    slot: { type: Number, required: true, min: 0, max: 4 },
    original_filename: { type: String, required: true, trim: true, maxlength: SUPPORTING_DOCUMENT_FILENAME_MAX },
    stored_filename: { type: String, required: true, trim: true, maxlength: 100 },
    mime_type: { type: String, required: true, enum: ['application/pdf', 'image/png', 'image/jpeg'] },
    file_size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    uploaded_at: { type: Date, required: true, default: Date.now },
  },
  modelOptions,
);

consultationSupportingDocumentSchema.index(
  { appointment_id: 1, slot: 1 },
  { unique: true, name: 'unique_supporting_document_slot' },
);
consultationSupportingDocumentSchema.index(
  { patient_id: 1, appointment_id: 1, uploaded_at: 1 },
  { name: 'patient_appointment_supporting_documents' },
);

export const ConsultationSupportingDocument =
  mongoose.models.ConsultationSupportingDocument
  ?? mongoose.model(
    'ConsultationSupportingDocument',
    consultationSupportingDocumentSchema,
    'consultation_supporting_documents',
  );
