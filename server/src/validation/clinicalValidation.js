import mongoose from 'mongoose';
import { httpError } from '../utils/httpError.js';
import { APPOINTMENT_VISIT_TYPES } from '../models/index.js';
import { boundedText, INPUT_LIMITS, queryInteger, queryText, rejectUnknownFields, requireObject, validateQueryKeys } from './inputValidation.js';
import { isValidDateOnly } from '../utils/schedulingTime.js';
import { CERTIFICATE_LIMITS, CERTIFICATE_PURPOSES } from '../services/certificateContent.js';

const recordFields = new Set([
  'diagnosis', 'notes', 'follow_up', 'prescriptions',
  'follow_up_required', 'follow_up_recommended_date', 'follow_up_reason',
]);
const certificateFields = new Set(['purpose', 'custom_purpose', 'diagnosis_summary', 'recommendation', 'valid_until']);
export const DOCTOR_HISTORY_RANGES = Object.freeze(['today', 'last_7_days', 'last_30_days', 'this_month', 'custom']);
export const DOCTOR_HISTORY_STATUSES = Object.freeze(['completed', 'cancelled', 'no_show']);
export const DOCTOR_HISTORY_PAGE_SIZE = 10;
export const PATIENT_CERTIFICATE_PAGE_SIZE = 5;
export const PATIENT_CERTIFICATE_VIEWS = Object.freeze(['active', 'archived']);
export const DOCTOR_CERTIFICATE_PAGE_SIZE = 5;
export const DOCTOR_CERTIFICATE_FILTERS = Object.freeze(['all', 'active', 'expired', 'legacy']);
export const PRESCRIPTION_HISTORY_PAGE_SIZE = 5;

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

export function validateMedicalRecordCreate(body = {}, { attachmentCount = 0 } = {}) {
  rejectUnknown(body, recordFields);
  if (!Number.isInteger(attachmentCount) || attachmentCount < 0 || attachmentCount > INPUT_LIMITS.prescriptions) {
    throw httpError(400, 'INVALID_PRESCRIPTION_ATTACHMENT_COUNT', 'The prescription attachment count is invalid.');
  }
  if (body.prescriptions != null && !Array.isArray(body.prescriptions)) {
    throw httpError(400, 'VALIDATION_ERROR', 'prescriptions must be an array.');
  }
  if ((body.prescriptions?.length ?? 0) > INPUT_LIMITS.prescriptions) {
    throw httpError(400, 'VALIDATION_ERROR', `prescriptions must contain at most ${INPUT_LIMITS.prescriptions} items.`);
  }
  const followUpRequired = body.follow_up_required ?? false;
  if (typeof followUpRequired !== 'boolean') {
    throw httpError(400, 'VALIDATION_ERROR', 'follow_up_required must be true or false.');
  }
  let followUpRecommendedDate = null;
  let followUpReason = null;
  if (followUpRequired) {
    if (!isValidDateOnly(body.follow_up_recommended_date)) {
      throw httpError(400, 'VALIDATION_ERROR', 'follow_up_recommended_date must use a valid YYYY-MM-DD date.');
    }
    followUpRecommendedDate = body.follow_up_recommended_date;
    followUpReason = boundedText(body.follow_up_reason, 'follow_up_reason', 500);
  } else if (body.follow_up_recommended_date || body.follow_up_reason) {
    throw httpError(400, 'VALIDATION_ERROR', 'Follow-up date and reason are accepted only when follow_up_required is true.');
  }
  const attachmentIndexes = (body.prescriptions ?? [])
    .map((item) => item?.attachment_index)
    .filter((value) => value != null);
  if (new Set(attachmentIndexes).size !== attachmentIndexes.length) {
    throw httpError(400, 'DUPLICATE_PRESCRIPTION_ATTACHMENT_REFERENCE', 'Each prescription attachment may be used only once.');
  }
  if (attachmentIndexes.length !== attachmentCount) {
    throw httpError(400, 'UNREFERENCED_PRESCRIPTION_ATTACHMENT', 'Every uploaded attachment must belong to one prescription.');
  }
  return {
    diagnosis: boundedText(body.diagnosis, 'diagnosis', 2000),
    notes: boundedText(body.notes, 'notes', INPUT_LIMITS.narrative, { optional: true }),
    follow_up: boundedText(body.follow_up, 'follow_up', 2000, { optional: true }),
    follow_up_required: followUpRequired,
    follow_up_recommended_date: followUpRecommendedDate,
    follow_up_reason: followUpReason,
    prescriptions: (body.prescriptions ?? []).map((item, index) => {
      rejectUnknown(item, new Set(['medicine', 'dosage', 'instructions', 'attachment_index']));
      const attachmentIndex = item.attachment_index;
      const hasAttachment = attachmentIndex != null;
      if (hasAttachment && (!Number.isInteger(attachmentIndex) || attachmentIndex < 0 || attachmentIndex >= attachmentCount)) {
        throw httpError(400, 'INVALID_PRESCRIPTION_ATTACHMENT_REFERENCE', `prescriptions[${index}].attachment_index is invalid.`);
      }
      const medicine = boundedText(item.medicine, `prescriptions[${index}].medicine`, INPUT_LIMITS.shortText, { optional: true });
      const dosage = boundedText(item.dosage, `prescriptions[${index}].dosage`, INPUT_LIMITS.shortText, { optional: true });
      if (!hasAttachment && (!medicine || !dosage)) {
        throw httpError(400, 'VALIDATION_ERROR', `prescriptions[${index}] requires medicine and dosage, or an attachment.`);
      }
      if ((medicine && !dosage) || (!medicine && dosage)) {
        throw httpError(400, 'VALIDATION_ERROR', `prescriptions[${index}] must include both medicine and dosage when using structured details.`);
      }
      return {
        medicine,
        dosage,
        instructions: boundedText(item.instructions, `prescriptions[${index}].instructions`, INPUT_LIMITS.reason, { optional: true }),
        attachment_index: hasAttachment ? attachmentIndex : null,
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
  if (body.valid_until == null || body.valid_until === '') {
    throw httpError(400, 'VALIDATION_ERROR', 'valid_until is required.');
  }
  const validUntil = dateOnly(body.valid_until, 'valid_until');
  if (validUntil < dateIssued) {
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

function scalar(value, field) {
  if (Array.isArray(value) || (value != null && typeof value === 'object')) {
    throw httpError(400, 'INVALID_QUERY', `${field} must be a single value.`);
  }
  return value;
}

export function validateDoctorAppointmentHistoryQuery(query = {}) {
  validateQueryKeys(query, new Set(['range', 'from', 'to', 'status', 'patient_search', 'visit_type', 'page']));
  const range = scalar(query.range, 'range') || 'last_30_days';
  const status = scalar(query.status, 'status') || 'all';
  const visitType = scalar(query.visit_type, 'visit_type') || 'all';
  if (!DOCTOR_HISTORY_RANGES.includes(range)) throw httpError(400, 'INVALID_QUERY', 'range is not an approved history range.');
  if (status !== 'all' && !DOCTOR_HISTORY_STATUSES.includes(status)) throw httpError(400, 'INVALID_QUERY', 'status is not an approved history status.');
  if (visitType !== 'all' && !APPOINTMENT_VISIT_TYPES.includes(visitType)) throw httpError(400, 'INVALID_QUERY', 'visit_type is not an approved value.');
  const from = scalar(query.from, 'from') || null;
  const to = scalar(query.to, 'to') || null;
  if (range === 'custom') {
    if (!from || !to) throw httpError(400, 'INVALID_QUERY', 'from and to are required for a custom range.');
    if (!isValidDateOnly(from) || !isValidDateOnly(to)) throw httpError(400, 'INVALID_QUERY', 'from and to must use valid YYYY-MM-DD dates.');
    if (from > to) throw httpError(400, 'INVALID_QUERY', 'from must be on or before to.');
  } else if (from || to) {
    throw httpError(400, 'INVALID_QUERY', 'from and to are accepted only for a custom range.');
  }
  return {
    range,
    from,
    to,
    status,
    patient_search: queryText(scalar(query.patient_search, 'patient_search'), 'patient_search', { max: INPUT_LIMITS.name }),
    visit_type: visitType,
    page: queryInteger(query.page, 'page', { defaultValue: 1, max: 100000 }),
    limit: DOCTOR_HISTORY_PAGE_SIZE,
  };
}

export function validateDoctorCertificateQuery(query = {}) {
  validateQueryKeys(query, new Set(['certificate_status', 'certificate_page']));
  const status = scalar(query.certificate_status, 'certificate_status') || 'all';
  if (!DOCTOR_CERTIFICATE_FILTERS.includes(status)) {
    throw httpError(400, 'INVALID_QUERY', 'certificate_status is not an approved value.');
  }
  return {
    status,
    page: queryInteger(scalar(query.certificate_page, 'certificate_page'), 'certificate_page', { defaultValue: 1, max: 100000 }),
    limit: DOCTOR_CERTIFICATE_PAGE_SIZE,
  };
}

export function validatePatientCertificateQuery(query = {}) {
  validateQueryKeys(query, new Set(['view', 'page']));
  const view = scalar(query.view, 'view') || 'active';
  if (!PATIENT_CERTIFICATE_VIEWS.includes(view)) {
    throw httpError(400, 'INVALID_QUERY', 'view must be active or archived.');
  }
  return {
    view,
    page: queryInteger(query.page, 'page', { defaultValue: 1, max: 100000 }),
    limit: PATIENT_CERTIFICATE_PAGE_SIZE,
  };
}

export function validatePrescriptionHistoryQuery(query = {}) {
  validateQueryKeys(query, new Set(['page']));
  return {
    page: queryInteger(scalar(query.page, 'page'), 'page', { defaultValue: 1, max: 100000 }),
    limit: PRESCRIPTION_HISTORY_PAGE_SIZE,
  };
}
