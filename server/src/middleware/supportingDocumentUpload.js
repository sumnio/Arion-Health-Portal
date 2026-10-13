import multer from 'multer';
import {
  SUPPORTING_DOCUMENT_MAX_FILE_SIZE,
  SUPPORTING_DOCUMENT_MAX_FILES,
} from '../validation/supportingDocumentValidation.js';
import { httpError } from '../utils/httpError.js';

const parser = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: SUPPORTING_DOCUMENT_MAX_FILE_SIZE,
    files: SUPPORTING_DOCUMENT_MAX_FILES,
    fields: 0,
    parts: SUPPORTING_DOCUMENT_MAX_FILES,
    fieldNameSize: 40,
  },
}).array('files', SUPPORTING_DOCUMENT_MAX_FILES);

function safeMultipartError(error) {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return httpError(413, 'SUPPORTING_DOCUMENT_TOO_LARGE', 'Each supporting document must not exceed 5 MB.');
  }
  if (['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)) {
    return httpError(400, 'TOO_MANY_SUPPORTING_DOCUMENTS', 'A maximum of 5 supporting documents is allowed per appointment.');
  }
  if (['LIMIT_FIELD_COUNT', 'LIMIT_UNEXPECTED_FILE', 'LIMIT_FIELD_KEY'].includes(error.code)) {
    const result = httpError(400, 'UNEXPECTED_MULTIPART_FIELD', 'Only the files upload field is accepted.');
    result.securityRelevant = true;
    result.securityMetadata = { rejection_type: 'unexpected_multipart_field' };
    return result;
  }
  return httpError(400, 'INVALID_MULTIPART_REQUEST', 'The supporting-document upload request is invalid.');
}

export function supportingDocumentUpload(request, response, next) {
  parser(request, response, error => next(error ? safeMultipartError(error) : undefined));
}
