import mongoose from 'mongoose';
import { modelOptions } from './modelOptions.js';

const medicalCertificateSchema = new mongoose.Schema(
  {
    medical_certificate_number: { type: String, required: true, trim: true },
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
    medical_record_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      default: null,
    },
    date_issued: { type: Date, required: true },
    purpose: { type: String, required: true, trim: true },
    purpose_code: { type: String, enum: ['Sick Leave', 'School Absence', 'Fit to Return', 'Medical Consultation', 'Follow-up Consultation', 'Work Clearance', 'Travel / General Purpose', 'Other'], default: null },
    custom_purpose: { type: String, trim: true, maxlength: 100, default: null },
    diagnosis_summary: { type: String, required: true, trim: true, maxlength: 500 },
    recommendation: { type: String, trim: true, maxlength: 500, default: null },
    valid_until: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return !value || !this.date_issued || value >= this.date_issued;
        },
        message: 'valid_until cannot be earlier than date_issued',
      },
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'issued'],
      default: 'draft',
    },
    pdf_storage_file_id: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    pdf_sha256: { type: String, default: null, immutable: true, match: /^[a-f0-9]{64}$/ },
    pdf_file_size: { type: Number, default: null, immutable: true, min: 1 },
    pdf_render_version: { type: String, default: null, immutable: true, trim: true },
    pdf_generated_at: { type: Date, default: null, immutable: true },
  },
  modelOptions,
);

medicalCertificateSchema.index(
  { medical_certificate_number: 1 },
  { unique: true, name: 'unique_medical_certificate_number' },
);
medicalCertificateSchema.index(
  { patient_id: 1, date_issued: -1 },
  { name: 'patient_certificate_history' },
);
medicalCertificateSchema.index({ doctor_id: 1 }, { name: 'doctor_certificate_lookup' });
medicalCertificateSchema.index(
  { medical_record_id: 1 },
  { name: 'medical_record_certificate_lookup' },
);

export const MedicalCertificate =
  mongoose.models.MedicalCertificate ??
  mongoose.model('MedicalCertificate', medicalCertificateSchema, 'medical_certificates');
