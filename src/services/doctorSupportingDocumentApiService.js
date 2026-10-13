import { doctorApiRepository } from '../repositories/doctorApiRepository.js';

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

export function createDoctorSupportingDocumentService(repository = doctorApiRepository) {
  return Object.freeze({
    async listSupportingDocuments(appointmentId) {
      return (await repository.listSupportingDocuments(appointmentId)).map(normalize);
    },
    async downloadSupportingDocument(appointmentId, documentId) {
      return repository.downloadSupportingDocument(appointmentId, documentId);
    },
  });
}

export const doctorSupportingDocumentService = createDoctorSupportingDocumentService();
