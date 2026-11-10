import { validateEmptyBody } from '../validation/inputValidation.js';
import { parseMedicalRecordMultipartPayload } from '../validation/prescriptionAttachmentValidation.js';
import { recordRequestAudit } from '../services/auditLogService.js';

function sendCertificatePdf(response, artifact, { disposition = 'attachment' } = {}) {
  response.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${disposition}; filename="${artifact.filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(artifact.size ? { 'Content-Length': String(artifact.size) } : {}),
    ...(artifact.sha256 ? { ETag: `"sha256-${artifact.sha256}"` } : {}),
  });
  if (artifact.buffer) return response.send(artifact.buffer);
  artifact.stream.once('error', () => { if (!response.headersSent) response.status(503).json({ error: { code: 'CERTIFICATE_PDF_UNAVAILABLE', message: 'The certificate PDF is temporarily unavailable.' } }); else response.destroy(); });
  return artifact.stream.pipe(response);
}

function sendPrescriptionAttachment(response, artifact, { disposition = 'attachment' } = {}) {
  response.set({
    'Content-Type': artifact.mimeType,
    'Content-Disposition': `${disposition}; filename="prescription-attachment"; filename*=UTF-8''${encodeURIComponent(artifact.filename)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(artifact.size ? { 'Content-Length': String(artifact.size) } : {}),
    ...(artifact.sha256 ? { ETag: `"sha256-${artifact.sha256}"` } : {}),
  });
  artifact.stream.once('error', () => {
    if (!response.headersSent) response.status(503).json({ error: { code: 'PRESCRIPTION_ATTACHMENT_UNAVAILABLE', message: 'The prescription attachment is temporarily unavailable.' } });
    else response.destroy();
  });
  return artifact.stream.pipe(response);
}

export function createDoctorClinicalController({ clinicalService }) {
  return {
    async appointments(request, response) {
      response.json({ appointments: await clinicalService.listDoctorAppointments(request.authUser.user_profile_id, request.query) });
    },
    async appointmentHistory(request, response) {
      response.json({ history: await clinicalService.listDoctorAppointmentHistory(request.authUser.user_profile_id, request.query) });
    },
    async priorityHistory(request, response) {
      response.json({ priority_history: await clinicalService.priorityHistoryForDoctor(request.authUser.user_profile_id, request.params.appointmentId) });
    },
    async createRecord(request, response) {
      const body = request.is('multipart/form-data')
        ? parseMedicalRecordMultipartPayload(request.body?.payload)
        : request.body;
      const medicalRecord = await clinicalService.createRecord(request.authUser.user_profile_id, request.params.appointmentId, body, request.files ?? []);
      await recordRequestAudit(request, {
        category: 'MEDICAL_RECORD', action: 'MEDICAL_RECORD_CREATED', result: 'success',
        target_type: 'Medical Record', target_id: medicalRecord.id,
        target_display_snapshot: 'Medical Record',
      });
      for (const prescription of medicalRecord.prescriptions ?? []) {
        await recordRequestAudit(request, {
          category: 'PRESCRIPTION', action: 'PRESCRIPTION_ISSUED', result: 'success',
          target_type: 'Prescription', target_id: prescription.id,
          target_display_snapshot: 'Prescription',
          safe_metadata: { has_attachment: Boolean(prescription.attachment_available) },
        });
        if (prescription.attachment_available) {
          await recordRequestAudit(request, {
            category: 'PRESCRIPTION', action: 'PRESCRIPTION_ATTACHMENT_ISSUED', result: 'success',
            target_type: 'Prescription', target_id: prescription.id,
            target_display_snapshot: 'Prescription attachment',
            safe_metadata: { has_attachment: true },
          });
        }
      }
      response.status(201).json({ medical_record: medicalRecord });
    },
    async patientRecords(request, response) {
      const [medicalRecords, certificates] = await Promise.all([
        clinicalService.listDoctorPatientRecords(request.authUser.user_profile_id, request.params.patientId),
        clinicalService.listDoctorPatientCertificates(request.authUser.user_profile_id, request.params.patientId, request.query),
      ]);
      response.json({
        medical_records: medicalRecords,
        medical_certificates: certificates.items,
        certificate_filter: certificates.status,
        certificate_pagination: { page: certificates.page, page_size: certificates.page_size, total: certificates.total, page_count: certificates.page_count },
      });
    },
    async record(request, response) {
      response.json({ medical_record: await clinicalService.getDoctorRecord(request.authUser.user_profile_id, request.params.recordId) });
    },
    async prescriptionAttachment(request, response) {
      return sendPrescriptionAttachment(response, await clinicalService.getDoctorPrescriptionAttachment(request.authUser.user_profile_id, request.params.prescriptionId), { disposition: request.query.disposition === 'inline' ? 'inline' : 'attachment' });
    },
    async patientPrescriptions(request, response) {
      const result = await clinicalService.listDoctorPatientPrescriptions(request.authUser.user_profile_id, request.params.patientId, request.query);
      response.json({ prescriptions: result.items, pagination: { page: result.page, page_size: result.page_size, total: result.total, page_count: result.page_count } });
    },
    async createCertificate(request, response) {
      const medicalCertificate = await clinicalService.createCertificate(request.authUser.user_profile_id, request.params.recordId, request.body);
      await recordRequestAudit(request, {
        category: 'CERTIFICATE', action: 'MEDICAL_CERTIFICATE_ISSUED', result: 'success',
        target_type: 'Medical Certificate', target_id: medicalCertificate.id,
        target_display_snapshot: 'Medical Certificate',
      });
      response.status(201).json({ medical_certificate: medicalCertificate });
    },
    async previewCertificate(request, response) {
      return sendCertificatePdf(response, await clinicalService.previewCertificate(request.authUser.user_profile_id, request.params.recordId, request.body), { disposition: 'inline' });
    },
    async certificate(request, response) {
      response.json({ medical_certificate: await clinicalService.getDoctorCertificate(request.authUser.user_profile_id, request.params.certificateId) });
    },
    async certificatePdf(request, response) {
      return sendCertificatePdf(response, await clinicalService.getDoctorCertificatePdf(request.authUser.user_profile_id, request.params.certificateId));
    },
    async complete(request, response) {
      validateEmptyBody(request.body);
      response.json({ appointment: await clinicalService.completeConsultation(request.authUser.user_profile_id, request.params.appointmentId) });
    },
  };
}

export function createPatientClinicalController({ clinicalService }) {
  return {
    async records(request, response) {
      response.json({ medical_records: await clinicalService.listPatientRecords(request.authUser.user_profile_id) });
    },
    async record(request, response) {
      response.json({ medical_record: await clinicalService.getPatientRecord(request.authUser.user_profile_id, request.params.recordId) });
    },
    async prescriptionAttachment(request, response) {
      return sendPrescriptionAttachment(response, await clinicalService.getPatientPrescriptionAttachment(request.authUser.user_profile_id, request.params.prescriptionId), { disposition: request.query.disposition === 'inline' ? 'inline' : 'attachment' });
    },
    async prescriptions(request, response) {
      const result = await clinicalService.listPatientPrescriptions(request.authUser.user_profile_id, request.query);
      response.json({ prescriptions: result.items, pagination: { page: result.page, page_size: result.page_size, total: result.total, page_count: result.page_count } });
    },
    async certificates(request, response) {
      const result = await clinicalService.listPatientCertificates(request.authUser.user_profile_id, request.query);
      response.json({
        medical_certificates: result.items,
        view: result.view,
        pagination: { page: result.page, page_size: result.page_size, total: result.total, page_count: result.page_count },
      });
    },
    async certificate(request, response) {
      response.json({ medical_certificate: await clinicalService.getPatientCertificate(request.authUser.user_profile_id, request.params.certificateId) });
    },
    async certificatePdf(request, response) {
      return sendCertificatePdf(response, await clinicalService.getPatientCertificatePdf(request.authUser.user_profile_id, request.params.certificateId));
    },
  };
}
