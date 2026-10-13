import path from 'node:path';
import { SUPPORTING_DOCUMENT_FILENAME_MAX } from '../models/index.js';
import { httpError } from '../utils/httpError.js';
import { validateObjectId } from './appointmentValidation.js';

export const SUPPORTING_DOCUMENT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const SUPPORTING_DOCUMENT_MAX_FILES = 5;
export const SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE = 25 * 1024 * 1024;

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

export function sanitizeSupportingDocumentFilename(value) {
  const base = path.basename(String(value ?? '').replace(/\\/g, '/'));
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) throw httpError(400, 'INVALID_DOCUMENT_FILENAME', 'A safe filename is required.');
  if (cleaned.length <= SUPPORTING_DOCUMENT_FILENAME_MAX) return cleaned;
  const extension = path.extname(cleaned).slice(0, 10);
  return `${cleaned.slice(0, SUPPORTING_DOCUMENT_FILENAME_MAX - extension.length)}${extension}`;
}

export function validateSupportingDocumentFile(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length < 1) {
    throw httpError(400, 'INVALID_SUPPORTING_DOCUMENT', 'Each supporting document must contain a file.');
  }
  const size = file.buffer.length;
  if (size > SUPPORTING_DOCUMENT_MAX_FILE_SIZE) {
    throw httpError(413, 'SUPPORTING_DOCUMENT_TOO_LARGE', 'Each supporting document must not exceed 5 MB.');
  }
  const type = detectedType(file.buffer);
  const definition = TYPES[type];
  const originalFilename = sanitizeSupportingDocumentFilename(file.originalname);
  const extension = path.extname(originalFilename).toLowerCase();
  if (!definition || !definition.extensions.has(extension)) {
    throw httpError(400, 'UNSUPPORTED_SUPPORTING_DOCUMENT', 'Only PDF, JPG, JPEG, and PNG files are allowed.');
  }
  return Object.freeze({
    buffer: file.buffer,
    originalFilename,
    mimeType: definition.mimeType,
    extension: type === 'jpeg' ? 'jpg' : type,
    size,
  });
}

export function validateSupportingDocumentBatch(files) {
  if (!Array.isArray(files) || !files.length) {
    throw httpError(400, 'SUPPORTING_DOCUMENT_REQUIRED', 'Select at least one supporting document.');
  }
  if (files.length > SUPPORTING_DOCUMENT_MAX_FILES) {
    throw httpError(400, 'TOO_MANY_SUPPORTING_DOCUMENTS', 'A maximum of 5 supporting documents is allowed per appointment.');
  }
  const validated = files.map(validateSupportingDocumentFile);
  const total = validated.reduce((sum, file) => sum + file.size, 0);
  if (total > SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE) {
    throw httpError(413, 'SUPPORTING_DOCUMENT_TOTAL_TOO_LARGE', 'Supporting documents must not exceed 25 MB in total.');
  }
  return validated;
}

export function validateSupportingDocumentIds(appointmentId, documentId = null) {
  validateObjectId(appointmentId, 'appointmentId');
  if (documentId != null) validateObjectId(documentId, 'documentId');
}
