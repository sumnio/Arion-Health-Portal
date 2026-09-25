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
    diagnosis_summary: { type: String, required: true, trim: true },
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
