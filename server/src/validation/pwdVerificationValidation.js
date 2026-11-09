import { createHash } from 'node:crypto';
import path from 'node:path';
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

export function validatePwdVerificationFile(file, side = 'document') {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length < 1) {
    throw httpError(400, 'PWD_DOCUMENT_REQUIRED', `Select the ${side} image of the PWD ID.`);
  }
  const size = file.buffer.length;
  if (size > PWD_VERIFICATION_MAX_FILE_SIZE) {
    throw httpError(413, 'PWD_DOCUMENT_TOO_LARGE', 'PWD verification document must not exceed 5 MB.');
  }
  const type = detectedType(file.buffer);
  const definition = TYPES[type];
  const extension = path.extname(path.basename(String(file.originalname ?? ''))).toLowerCase();
  const declaredMimeType = String(file.mimetype ?? '').toLowerCase();
  if (!definition || type === 'pdf' || !definition.extensions.has(extension) || declaredMimeType !== definition.mimeType) {
    throw httpError(400, 'UNSUPPORTED_PWD_DOCUMENT', 'Only JPG, JPEG, and PNG images are allowed for the front and back of the PWD ID.');
  }
  return Object.freeze({
    buffer: file.buffer,
    extension: type === 'jpeg' ? 'jpg' : type,
    mimeType: definition.mimeType,
    size,
    sha256: createHash('sha256').update(file.buffer).digest('hex'),
  });
}

export function validatePwdVerificationFiles(files = {}) {
  return Object.freeze({
    front: validatePwdVerificationFile(files.front_document?.[0], 'front'),
    back: validatePwdVerificationFile(files.back_document?.[0], 'back'),
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
