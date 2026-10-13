import { patientApiRepository } from '../repositories/patientApiRepository.js';

export const SUPPORTING_DOCUMENT_MAX_FILES = 5;
export const SUPPORTING_DOCUMENT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE = 25 * 1024 * 1024;

const APPROVED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);
const APPROVED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function extension(filename) {
  return String(filename ?? '').split('.').pop()?.toLowerCase() ?? '';
}

export function validateSupportingDocumentSelection(files) {
  const selected = Array.from(files ?? []);
  if (selected.length > SUPPORTING_DOCUMENT_MAX_FILES) return 'You can upload up to 5 files.';
  if (selected.some((file) => !APPROVED_EXTENSIONS.has(extension(file.name)) || (file.type && !APPROVED_MIME_TYPES.has(file.type)))) {
    return 'Supporting documents must be PDF, JPG, JPEG, or PNG.';
  }
  if (selected.reduce((total, file) => total + file.size, 0) > SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE) {
    return 'The total size of supporting documents cannot exceed 25 MB.';
  }
  if (selected.some((file) => file.size > SUPPORTING_DOCUMENT_MAX_FILE_SIZE)) return 'Each file must be 5 MB or smaller.';
  return '';
}

export function formatSupportingDocumentSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function supportingDocumentTypeLabel(filename) {
  const type = extension(filename);
  return type === 'jpg' || type === 'jpeg' ? 'Image' : type.toUpperCase();
}

function normalize(document) {
  return {
    id: document.id,
    appointmentId: document.appointment_id,
    filename: document.original_filename,
    mimeType: document.mime_type,
    size: document.file_size,
    uploadedAt: document.uploaded_at,
  };
}

export function supportingDocumentErrorMessage(error) {
  if (error?.status === 401) return 'Your session has expired. Please log in again.';
  if (error?.status === 403) return 'You do not have access to these supporting documents.';
  if (error?.status === 413) return 'The selected supporting documents are too large.';
  if (error?.status === 429) return 'Too many attempts. Please try again later.';
  if ([400, 409].includes(error?.status) && error?.message) return error.message;
  return 'The supporting documents could not be uploaded. Please try again later.';
}

export async function createAppointmentThenUploadDocuments({
  values,
  files,
  createAppointment,
  uploadSupportingDocuments,
  onAppointmentCreated = () => {},
}) {
  const appointment = await createAppointment(values);
  onAppointmentCreated(appointment);
  if (!files.length) return { appointment, uploadStatus: 'not-selected' };
  try {
    const documents = await uploadSupportingDocuments(appointment.id, files);
    return { appointment, documents, uploadStatus: 'uploaded' };
  } catch (uploadError) {
    return { appointment, uploadStatus: 'failed', uploadError };
  }
}

export function createPatientSupportingDocumentService(repository = patientApiRepository) {
  return Object.freeze({
    async uploadSupportingDocuments(appointmentId, files) {
      return (await repository.uploadSupportingDocuments(appointmentId, files)).map(normalize);
    },
    async listMySupportingDocuments(appointmentId) {
      return (await repository.listSupportingDocuments(appointmentId)).map(normalize);
    },
    async downloadMySupportingDocument(appointmentId, documentId) {
      return repository.downloadSupportingDocument(appointmentId, documentId);
    },
  });
}

export const patientSupportingDocumentService = createPatientSupportingDocumentService();
