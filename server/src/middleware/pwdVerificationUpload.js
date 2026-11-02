import multer from 'multer';
import { httpError } from '../utils/httpError.js';
import { PWD_VERIFICATION_MAX_FILE_SIZE } from '../validation/pwdVerificationValidation.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PWD_VERIFICATION_MAX_FILE_SIZE,
    files: 1,
    fields: 1,
    parts: 2,
    fieldNameSize: 40,
  },
}).single('document');

function safeMultipartError(error) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return httpError(413, 'PWD_DOCUMENT_TOO_LARGE', 'PWD verification document must not exceed 5 MB.');
  }
  if (['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)) {
    return httpError(400, 'TOO_MANY_PWD_DOCUMENTS', 'Submit one PWD verification document only.');
  }
  if (['LIMIT_FIELD_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_FIELD_KEY'].includes(error.code)) {
    const result = httpError(400, 'UNEXPECTED_MULTIPART_FIELD', 'Only the PWD ID number and document fields are accepted.');
    result.securityRelevant = true;
    result.securityMetadata = { rejection_type: 'unexpected_multipart_field' };
    return result;
  }
  return httpError(400, 'INVALID_MULTIPART_REQUEST', 'The PWD verification request is invalid.');
}

export function pwdVerificationUpload(request, response, next) {
  parser(request, response, error => next(error ? safeMultipartError(error) : undefined));
}
