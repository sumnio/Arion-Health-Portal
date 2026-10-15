import path from 'node:path';
import { httpError } from '../utils/httpError.js';

export const DOCTOR_SIGNATURE_MAX_FILE_SIZE = 1024 * 1024;
export const DOCTOR_SIGNATURE_MIN_WIDTH = 200;
export const DOCTOR_SIGNATURE_MIN_HEIGHT = 50;
export const DOCTOR_SIGNATURE_MAX_WIDTH = 2000;
export const DOCTOR_SIGNATURE_MAX_HEIGHT = 1000;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function validateDoctorSignatureFile(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length < 29) {
    throw httpError(400, 'INVALID_DOCTOR_SIGNATURE', 'Select a valid PNG signature image.');
  }
  if (file.buffer.length > DOCTOR_SIGNATURE_MAX_FILE_SIZE) {
    throw httpError(413, 'DOCTOR_SIGNATURE_TOO_LARGE', 'The signature image must not exceed 1 MB.');
  }
  const extension = path.extname(String(file.originalname ?? '')).toLowerCase();
  const validHeader = file.buffer.subarray(0, 8).equals(PNG_SIGNATURE)
    && file.buffer.subarray(12, 16).toString('ascii') === 'IHDR';
  if (file.mimetype !== 'image/png' || extension !== '.png' || !validHeader) {
    throw httpError(400, 'UNSUPPORTED_DOCTOR_SIGNATURE', 'Only a genuine PNG signature image is allowed.');
  }
  const width = file.buffer.readUInt32BE(16);
  const height = file.buffer.readUInt32BE(20);
  if (
    width < DOCTOR_SIGNATURE_MIN_WIDTH || width > DOCTOR_SIGNATURE_MAX_WIDTH
    || height < DOCTOR_SIGNATURE_MIN_HEIGHT || height > DOCTOR_SIGNATURE_MAX_HEIGHT
  ) {
    throw httpError(400, 'INVALID_DOCTOR_SIGNATURE_DIMENSIONS', 'Use a PNG between 200×50 and 2000×1000 pixels.');
  }
  return Object.freeze({ buffer: file.buffer, mimeType: 'image/png', size: file.buffer.length, width, height });
}
