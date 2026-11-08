import multer from 'multer';
import {
  PRESCRIPTION_ATTACHMENT_MAX_FILE_SIZE,
  PRESCRIPTION_ATTACHMENT_MAX_FILES,
} from '../validation/prescriptionAttachmentValidation.js';
import { httpError } from '../utils/httpError.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PRESCRIPTION_ATTACHMENT_MAX_FILE_SIZE,
    files: PRESCRIPTION_ATTACHMENT_MAX_FILES,
    fields: 1,
    parts: PRESCRIPTION_ATTACHMENT_MAX_FILES + 1,
    fieldNameSize: 40,
    fieldSize: 100 * 1024,
  },
}).array('attachments', PRESCRIPTION_ATTACHMENT_MAX_FILES);

function safeMultipartError(error) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return httpError(413, 'PRESCRIPTION_ATTACHMENT_TOO_LARGE', 'The prescription attachment must not exceed 5 MB.');
  }
  if (['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)) {
    return httpError(400, 'TOO_MANY_PRESCRIPTION_ATTACHMENTS', 'A maximum of one attachment per prescription is allowed.');
  }
  if (['LIMIT_FIELD_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_FIELD_KEY', 'LIMIT_FIELD_VALUE'].includes(error.code)) {
    const result = httpError(400, 'UNEXPECTED_MULTIPART_FIELD', 'Only the medical record payload and prescription attachments are accepted.');
    result.securityRelevant = true;
    result.securityMetadata = { rejection_type: 'unexpected_multipart_field' };
    return result;
  }
  return httpError(400, 'INVALID_MULTIPART_REQUEST', 'The prescription attachment request is invalid.');
}

export function prescriptionAttachmentUpload(request, response, next) {
  if (!request.is('multipart/form-data')) return next();
  return parser(request, response, error => next(error ? safeMultipartError(error) : undefined));
}
