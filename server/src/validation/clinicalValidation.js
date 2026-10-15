import mongoose from 'mongoose';
import { httpError } from '../utils/httpError.js';
import { boundedText, INPUT_LIMITS, rejectUnknownFields, requireObject, validateQueryKeys } from './inputValidation.js';
import { CERTIFICATE_LIMITS, CERTIFICATE_PURPOSES } from '../services/certificateContent.js';

const recordFields = new Set(['diagnosis', 'notes', 'follow_up', 'prescriptions']);
const certificateFields = new Set(['purpose', 'custom_purpose', 'diagnosis_summary', 'recommendation', 'valid_until']);

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

function certificatePlainText(value, field, max, options) {
  const text = boundedText(value, field, max, options);
  if (text && (/[<>]/.test(text) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text))) {
    throw httpError(400, 'VALIDATION_ERROR', `${field} must contain plain text only.`);
  }
  return text;
}

export function validateCertificateCreate(body = {}, { dateIssued } = {}) {
  rejectUnknown(body, certificateFields);
  const purpose = boundedText(body.purpose, 'purpose', INPUT_LIMITS.shortText);
  if (!CERTIFICATE_PURPOSES.includes(purpose)) {
    throw httpError(400, 'VALIDATION_ERROR', 'purpose must be an approved certificate purpose.');
  }
  const customPurpose = certificatePlainText(body.custom_purpose, 'custom_purpose', CERTIFICATE_LIMITS.customPurpose, { optional: purpose !== 'Other' });
  if (purpose === 'Other' && !customPurpose) {
    throw httpError(400, 'VALIDATION_ERROR', 'custom_purpose is required when purpose is Other.');
  }
  if (purpose !== 'Other' && customPurpose) {
    throw httpError(400, 'VALIDATION_ERROR', 'custom_purpose is accepted only when purpose is Other.');
  }
  if (!(dateIssued instanceof Date) || Number.isNaN(dateIssued.getTime())) {
    throw new TypeError('A valid server-authoritative dateIssued is required.');
  }
  const validUntil = body.valid_until ? dateOnly(body.valid_until, 'valid_until') : null;
  if (validUntil && validUntil < dateIssued) {
    throw httpError(400, 'VALIDATION_ERROR', 'valid_until cannot be earlier than date_issued.');
  }
  return {
    purpose: purpose === 'Other' ? customPurpose : purpose,
    purpose_code: purpose,
    custom_purpose: purpose === 'Other' ? customPurpose : null,
    diagnosis_summary: certificatePlainText(body.diagnosis_summary, 'diagnosis_summary', CERTIFICATE_LIMITS.diagnosisSummary),
    recommendation: certificatePlainText(body.recommendation, 'recommendation', CERTIFICATE_LIMITS.recommendation),
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
