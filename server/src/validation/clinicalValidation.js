import mongoose from 'mongoose';
import { httpError } from '../utils/httpError.js';

const recordFields = new Set(['diagnosis', 'notes', 'follow_up', 'prescriptions']);
const certificateFields = new Set(['purpose', 'diagnosis_summary', 'date_issued', 'valid_until']);

export function validateClinicalObjectId(value, name) {
  if (!mongoose.isValidObjectId(value)) {
    throw httpError(400, 'INVALID_ID', `${name} must be a valid identifier.`);
  }
  return String(value);
}

function rejectUnknown(body, allowed) {
  const unsupported = Object.keys(body ?? {}).find((key) => !allowed.has(key));
  if (unsupported) throw httpError(400, 'UNSUPPORTED_FIELD', `${unsupported} is not accepted.`);
}

function requiredText(value, field) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw httpError(400, 'VALIDATION_ERROR', `${field} is required.`);
  return text;
}

function optionalText(value) {
  if (value == null || value === '') return null;
  return String(value).trim() || null;
}

export function validateMedicalRecordCreate(body = {}) {
  rejectUnknown(body, recordFields);
  if (body.prescriptions != null && !Array.isArray(body.prescriptions)) {
    throw httpError(400, 'VALIDATION_ERROR', 'prescriptions must be an array.');
  }
  return {
    diagnosis: requiredText(body.diagnosis, 'diagnosis'),
    notes: optionalText(body.notes),
    follow_up: optionalText(body.follow_up),
    prescriptions: (body.prescriptions ?? []).map((item, index) => {
      rejectUnknown(item ?? {}, new Set(['medicine', 'dosage', 'instructions']));
      return {
        medicine: requiredText(item?.medicine, `prescriptions[${index}].medicine`),
        dosage: requiredText(item?.dosage, `prescriptions[${index}].dosage`),
        instructions: optionalText(item?.instructions),
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
    purpose: requiredText(body.purpose, 'purpose'),
    diagnosis_summary: requiredText(body.diagnosis_summary, 'diagnosis_summary'),
    date_issued: dateIssued,
    valid_until: validUntil,
  };
}
