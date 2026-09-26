import mongoose from 'mongoose';
import { httpError } from '../utils/httpError.js';
import { boundedText, INPUT_LIMITS, rejectUnknownFields, requireObject, validateQueryKeys } from './inputValidation.js';

const recordFields = new Set(['diagnosis', 'notes', 'follow_up', 'prescriptions']);
const certificateFields = new Set(['purpose', 'diagnosis_summary', 'date_issued', 'valid_until']);

export function validateClinicalObjectId(value, name) {
  if (!mongoose.isObjectIdOrHexString(value)) {
    throw httpError(400, 'INVALID_ID', `${name} must be a valid identifier.`);
  }
  return String(value);
}

function rejectUnknown(body, allowed) {
  requireObject(body);
  rejectUnknownFields(body, allowed);
}

export function validateMedicalRecordCreate(body = {}) {
  rejectUnknown(body, recordFields);
  if (body.prescriptions != null && !Array.isArray(body.prescriptions)) {
    throw httpError(400, 'VALIDATION_ERROR', 'prescriptions must be an array.');
  }
  if ((body.prescriptions?.length ?? 0) > INPUT_LIMITS.prescriptions) {
    throw httpError(400, 'VALIDATION_ERROR', `prescriptions must contain at most ${INPUT_LIMITS.prescriptions} items.`);
  }
  return {
    diagnosis: boundedText(body.diagnosis, 'diagnosis', 2000),
    notes: boundedText(body.notes, 'notes', INPUT_LIMITS.narrative, { optional: true }),
    follow_up: boundedText(body.follow_up, 'follow_up', 2000, { optional: true }),
    prescriptions: (body.prescriptions ?? []).map((item, index) => {
      rejectUnknown(item, new Set(['medicine', 'dosage', 'instructions']));
      return {
        medicine: boundedText(item.medicine, `prescriptions[${index}].medicine`, INPUT_LIMITS.shortText),
        dosage: boundedText(item.dosage, `prescriptions[${index}].dosage`, INPUT_LIMITS.shortText),
        instructions: boundedText(item.instructions, `prescriptions[${index}].instructions`, INPUT_LIMITS.reason, { optional: true }),
      };
    }),
  };
}

function dateOnly(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(400, 'VALIDATION_ERROR', `${field} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw httpError(400, 'VALIDATION_ERROR', `${field} must be a valid date.`);
  }
  return date;
}

export function validateCertificateCreate(body = {}) {
  rejectUnknown(body, certificateFields);
  const dateIssued = dateOnly(body.date_issued, 'date_issued');
  const validUntil = body.valid_until ? dateOnly(body.valid_until, 'valid_until') : null;
  if (validUntil && validUntil < dateIssued) {
    throw httpError(400, 'VALIDATION_ERROR', 'valid_until cannot be earlier than date_issued.');
  }
  return {
    purpose: boundedText(body.purpose, 'purpose', INPUT_LIMITS.shortText),
    diagnosis_summary: boundedText(body.diagnosis_summary, 'diagnosis_summary', 2000),
    date_issued: dateIssued,
    valid_until: validUntil,
  };
}

export function validateDoctorAppointmentQuery(query = {}) {
  validateQueryKeys(query, new Set(['date', 'patient_id']));
  if (query.date != null && (Array.isArray(query.date) || typeof query.date !== 'string')) {
    throw httpError(400, 'INVALID_QUERY', 'date must be a single YYYY-MM-DD value.');
  }
  if (query.patient_id != null && (Array.isArray(query.patient_id) || typeof query.patient_id !== 'string')) {
    throw httpError(400, 'INVALID_QUERY', 'patient_id must be a single identifier.');
  }
  return { date: query.date, patient_id: query.patient_id };
}
