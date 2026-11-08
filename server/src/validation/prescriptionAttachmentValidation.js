import path from 'node:path';
import { httpError } from '../utils/httpError.js';

export const PRESCRIPTION_ATTACHMENT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const PRESCRIPTION_ATTACHMENT_MAX_FILES = 20;
export const PRESCRIPTION_ATTACHMENT_FILENAME_MAX = 180;

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

export function sanitizePrescriptionAttachmentFilename(value) {
  const base = path.basename(String(value ?? '').replace(/\\/g, '/'));
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) throw httpError(400, 'INVALID_PRESCRIPTION_ATTACHMENT_FILENAME', 'A safe attachment filename is required.');
  if (cleaned.length <= PRESCRIPTION_ATTACHMENT_FILENAME_MAX) return cleaned;
  const extension = path.extname(cleaned).slice(0, 10);
  return `${cleaned.slice(0, PRESCRIPTION_ATTACHMENT_FILENAME_MAX - extension.length)}${extension}`;
}

export function validatePrescriptionAttachmentFile(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length < 1) {
    throw httpError(400, 'INVALID_PRESCRIPTION_ATTACHMENT', 'The prescription attachment must contain a file.');
  }
  if (file.buffer.length > PRESCRIPTION_ATTACHMENT_MAX_FILE_SIZE) {
    throw httpError(413, 'PRESCRIPTION_ATTACHMENT_TOO_LARGE', 'The prescription attachment must not exceed 5 MB.');
  }
  const type = detectedType(file.buffer);
  const definition = TYPES[type];
  const originalFilename = sanitizePrescriptionAttachmentFilename(file.originalname);
  const extension = path.extname(originalFilename).toLowerCase();
  if (!definition || !definition.extensions.has(extension)) {
    throw httpError(400, 'UNSUPPORTED_PRESCRIPTION_ATTACHMENT', 'Only PDF, JPG, JPEG, and PNG files are allowed.');
  }
  if (file.mimetype !== definition.mimeType) {
    throw httpError(400, 'PRESCRIPTION_ATTACHMENT_TYPE_MISMATCH', 'The prescription attachment type does not match its contents.');
  }
  return Object.freeze({
    buffer: file.buffer,
    originalFilename,
    mimeType: definition.mimeType,
    extension: type === 'jpeg' ? 'jpg' : type,
    size: file.buffer.length,
  });
}

export function validatePrescriptionAttachmentFiles(files = []) {
  if (!Array.isArray(files)) throw httpError(400, 'INVALID_PRESCRIPTION_ATTACHMENT', 'Prescription attachments must be files.');
  if (files.length > PRESCRIPTION_ATTACHMENT_MAX_FILES) {
    throw httpError(400, 'TOO_MANY_PRESCRIPTION_ATTACHMENTS', 'A maximum of one attachment per prescription is allowed.');
  }
  return files.map(validatePrescriptionAttachmentFile);
}

export function parseMedicalRecordMultipartPayload(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, 'MEDICAL_RECORD_PAYLOAD_REQUIRED', 'Medical record details are required.');
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid payload');
    return parsed;
  } catch {
    throw httpError(400, 'INVALID_MEDICAL_RECORD_PAYLOAD', 'Medical record details must be valid JSON.');
  }
}
