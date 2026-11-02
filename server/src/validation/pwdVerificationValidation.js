import { createHash } from 'node:crypto';
import path from 'node:path';
import { PWD_ID_NUMBER_MAX } from '../models/index.js';
import { PWD_REJECTION_REASON_MAX } from '../models/index.js';
import { httpError } from '../utils/httpError.js';
import { boundedText, queryInteger, rejectUnknownFields, requireObject, validateQueryKeys } from './inputValidation.js';
import { validateObjectId } from './appointmentValidation.js';

export const PWD_VERIFICATION_MAX_FILE_SIZE = 5 * 1024 * 1024;
const LIST_FIELDS = new Set(['page', 'limit']);
const REJECT_FIELDS = new Set(['reason']);

const TYPES = Object.freeze({
  pdf: Object.freeze({ mimeType: 'application/pdf', extensions: new Set(['.pdf']) }),
  png: Object.freeze({ mimeType: 'image/png', extensions: new Set(['.png']) }),
  jpeg: Object.freeze({ mimeType: 'image/jpeg', extensions: new Set(['.jpg', '.jpeg']) }),
});

function detectedType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) return 'pdf';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  return null;
}

export function validatePwdIdNumber(value) {
  if (typeof value !== 'string') {
    throw httpError(400, 'PWD_ID_NUMBER_REQUIRED', 'Enter the PWD ID number shown on the document.');
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length < 3 || normalized.length > PWD_ID_NUMBER_MAX || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw httpError(400, 'INVALID_PWD_ID_NUMBER', `PWD ID number must be from 3 through ${PWD_ID_NUMBER_MAX} characters.`);
  }
  return normalized;
}

export function validatePwdVerificationFile(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length < 1) {
    throw httpError(400, 'PWD_DOCUMENT_REQUIRED', 'Select a PWD verification document.');
  }
  const size = file.buffer.length;
  if (size > PWD_VERIFICATION_MAX_FILE_SIZE) {
    throw httpError(413, 'PWD_DOCUMENT_TOO_LARGE', 'PWD verification document must not exceed 5 MB.');
  }
  const type = detectedType(file.buffer);
  const definition = TYPES[type];
  const extension = path.extname(path.basename(String(file.originalname ?? ''))).toLowerCase();
  const declaredMimeType = String(file.mimetype ?? '').toLowerCase();
  if (!definition || !definition.extensions.has(extension) || declaredMimeType !== definition.mimeType) {
    throw httpError(400, 'UNSUPPORTED_PWD_DOCUMENT', 'Only PDF, JPG, JPEG, and PNG files are allowed.');
  }
  return Object.freeze({
    buffer: file.buffer,
    extension: type === 'jpeg' ? 'jpg' : type,
    mimeType: definition.mimeType,
    size,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
  });
}

export function validatePwdVerificationListQuery(query = {}) {
  const value = validateQueryKeys(query, LIST_FIELDS);
  return {
    page: queryInteger(value.page, 'page', { defaultValue: 1, max: 1_000_000 }),
    limit: queryInteger(value.limit, 'limit', { defaultValue: 10, max: 25 }),
  };
}

export function validatePwdVerificationId(value) {
  return validateObjectId(value, 'verificationId');
}

export function validatePwdRejection(value) {
  const body = requireObject(value, 'PWD rejection');
  rejectUnknownFields(body, REJECT_FIELDS);
  return boundedText(body.reason, 'reason', PWD_REJECTION_REASON_MAX);
}
