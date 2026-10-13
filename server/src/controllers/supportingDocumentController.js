import { pipeline } from 'node:stream/promises';
import { requestSecurityEvent } from '../services/securityLogger.js';

function safeDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function streamDocument(response, result) {
  response.set({
    'Content-Type': result.document.mime_type,
    'Content-Length': String(result.document.file_size),
    'Content-Disposition': safeDisposition(result.document.original_filename),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  await pipeline(result.stream, response);
}

export function createPatientSupportingDocumentController({ supportingDocumentService }) {
  return Object.freeze({
    async upload(request, response) {
      const documents = await supportingDocumentService.uploadForPatient(
        request.authUser.user_profile_id,
        request.params.appointmentId,
        request.files,
      );
      requestSecurityEvent(request, {
        event: 'SUPPORTING_DOCUMENT_UPLOAD_SUCCESS',
        severity: 'info',
        outcome: 'success',
        target_type: 'appointment',
        target_id: request.params.appointmentId,
        metadata: {
          file_count: documents.length,
          total_size_class: documents.reduce((sum, item) => sum + item.file_size, 0) <= 5 * 1024 * 1024
            ? 'up_to_5mb'
            : 'over_5mb',
        },
      });
      response.status(201).json({ supporting_documents: documents });
    },
    async list(request, response) {
      response.json({
        supporting_documents: await supportingDocumentService.listForPatient(
          request.authUser.user_profile_id,
          request.params.appointmentId,
        ),
      });
    },
    async download(request, response) {
      await streamDocument(response, await supportingDocumentService.patientDownload(
        request.authUser.user_profile_id,
        request.params.appointmentId,
        request.params.documentId,
      ));
    },
  });
}

export function createDoctorSupportingDocumentController({ supportingDocumentService }) {
  return Object.freeze({
    async list(request, response) {
      response.json({
        supporting_documents: await supportingDocumentService.listForDoctor(
          request.authUser.user_profile_id,
          request.params.appointmentId,
        ),
      });
    },
    async download(request, response) {
      await streamDocument(response, await supportingDocumentService.doctorDownload(
        request.authUser.user_profile_id,
        request.params.appointmentId,
        request.params.documentId,
      ));
    },
  });
}
