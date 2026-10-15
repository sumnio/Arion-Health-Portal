import multer from 'multer';
import { DOCTOR_SIGNATURE_MAX_FILE_SIZE } from '../validation/doctorSignatureValidation.js';
import { httpError } from '../utils/httpError.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCTOR_SIGNATURE_MAX_FILE_SIZE, files: 1, fields: 0, parts: 1, fieldNameSize: 40 },
}).single('signature');

function safeMultipartError(error) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') return httpError(413, 'DOCTOR_SIGNATURE_TOO_LARGE', 'The signature image must not exceed 1 MB.');
  if (['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)) return httpError(400, 'TOO_MANY_DOCTOR_SIGNATURES', 'Upload exactly one signature image.');
  if (['LIMIT_FIELD_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_FIELD_KEY'].includes(error.code)) {
    const result = httpError(400, 'UNEXPECTED_MULTIPART_FIELD', 'Only the signature upload field is accepted.');
    result.securityRelevant = true;
    result.securityMetadata = { rejection_type: 'unexpected_signature_multipart_field' };
    return result;
  }
  return httpError(400, 'INVALID_MULTIPART_REQUEST', 'The signature upload request is invalid.');
}

export function doctorSignatureUpload(request, response, next) {
  parser(request, response, error => next(error ? safeMultipartError(error) : undefined));
}
