import { httpError } from '../utils/httpError.js';
import {
  SUPPORTING_DOCUMENT_MAX_FILES,
  SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE,
  validateSupportingDocumentBatch,
  validateSupportingDocumentIds,
} from '../validation/supportingDocumentValidation.js';

const UPLOAD_STATUSES = new Set(['pending', 'confirmed']);
const DOCTOR_VIEW_STATUSES = new Set(['pending', 'confirmed']);

function id(value) {
  return String(value?._id ?? value?.id ?? value);
}

function present(document) {
  return Object.freeze({
    id: id(document),
    appointment_id: id(document.appointment_id),
    original_filename: document.original_filename,
    mime_type: document.mime_type,
    file_size: document.file_size,
    uploaded_at: new Date(document.uploaded_at ?? document.created_at).toISOString(),
  });
}

function duplicateKey(error) {
  return error?.code === 11000;
}

export function createSupportingDocumentService({ repository, storage, now = () => new Date() }) {
  async function patientContext(userProfileId, appointmentId) {
    validateSupportingDocumentIds(appointmentId);
    const patient = await repository.findPatientByUserProfileId(userProfileId);
    if (!patient) throw httpError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    const appointment = await repository.findAppointmentById(appointmentId);
    if (!appointment || id(appointment.patient_id) !== id(patient)) {
      throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
    }
    return { patient, appointment };
  }

  async function doctorContext(userProfileId, appointmentId) {
    validateSupportingDocumentIds(appointmentId);
    const doctor = await repository.findDoctorByUserProfileId(userProfileId);
    if (!doctor) throw httpError(404, 'DOCTOR_PROFILE_NOT_FOUND', 'Doctor profile was not found.');
    const appointment = await repository.findAppointmentById(appointmentId);
    if (!appointment || id(appointment.doctor_id) !== id(doctor)) {
      throw httpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment was not found.');
    }
    if (!DOCTOR_VIEW_STATUSES.has(appointment.status) || await repository.medicalRecordExists(appointmentId)) {
      throw httpError(403, 'SUPPORTING_DOCUMENT_ACCESS_ENDED', 'Supporting documents are not available for this consultation.');
    }
    return { doctor, appointment };
  }

  async function removeStored(uploaded) {
    await Promise.allSettled(uploaded.map(item => storage.delete(item.storageFileId)));
  }

  async function uploadForPatient(userProfileId, appointmentId, files) {
    const validatedFiles = validateSupportingDocumentBatch(files);
    const { patient, appointment } = await patientContext(userProfileId, appointmentId);
    if (!UPLOAD_STATUSES.has(appointment.status)) {
      throw httpError(409, 'APPOINTMENT_NOT_ELIGIBLE_FOR_UPLOAD', 'Supporting documents can be uploaded only to a Pending or Confirmed appointment.');
    }
    if (await repository.medicalRecordExists(appointmentId)) {
      throw httpError(409, 'MEDICAL_RECORD_EXISTS', 'Supporting documents cannot be uploaded after the Medical Record is created.');
    }
    const existing = await repository.listByAppointment(appointmentId);
    if (existing.length + validatedFiles.length > SUPPORTING_DOCUMENT_MAX_FILES) {
      throw httpError(409, 'SUPPORTING_DOCUMENT_LIMIT_REACHED', 'A maximum of 5 supporting documents is allowed per appointment.');
    }
    const totalSize = existing.reduce((sum, item) => sum + item.file_size, 0)
      + validatedFiles.reduce((sum, item) => sum + item.size, 0);
    if (totalSize > SUPPORTING_DOCUMENT_MAX_TOTAL_SIZE) {
      throw httpError(413, 'SUPPORTING_DOCUMENT_TOTAL_TOO_LARGE', 'Supporting documents must not exceed 25 MB in total.');
    }
    const occupiedSlots = new Set(existing.map(item => item.slot));
    const slots = Array.from({ length: SUPPORTING_DOCUMENT_MAX_FILES }, (_, index) => index)
      .filter(slot => !occupiedSlots.has(slot))
      .slice(0, validatedFiles.length);
    const uploaded = [];
    try {
      for (const file of validatedFiles) {
        uploaded.push(await storage.upload(file));
      }
      const uploadedAt = now();
      const metadata = validatedFiles.map((file, index) => ({
        appointment_id: appointmentId,
        patient_id: id(patient),
        storage_file_id: uploaded[index].storageFileId,
        slot: slots[index],
        original_filename: file.originalFilename,
        stored_filename: uploaded[index].storedFilename,
        mime_type: file.mimeType,
        file_size: file.size,
        uploaded_at: uploadedAt,
      }));
      try {
        return (await repository.createMany(metadata)).map(present);
      } catch (error) {
        await repository.deleteByStorageFileIds?.(uploaded.map(item => item.storageFileId));
        if (duplicateKey(error)) {
          throw httpError(409, 'SUPPORTING_DOCUMENT_LIMIT_REACHED', 'The appointment supporting-document limit was reached.');
        }
        throw error;
      }
    } catch (error) {
      await removeStored(uploaded);
      if (error?.status) throw error;
      throw httpError(503, 'SUPPORTING_DOCUMENT_UPLOAD_UNAVAILABLE', 'Supporting-document upload is temporarily unavailable.');
    }
  }

  async function listForPatient(userProfileId, appointmentId) {
    await patientContext(userProfileId, appointmentId);
    return (await repository.listByAppointment(appointmentId)).map(present);
  }

  async function listForDoctor(userProfileId, appointmentId) {
    await doctorContext(userProfileId, appointmentId);
    return (await repository.listByAppointment(appointmentId)).map(present);
  }

  async function patientDownload(userProfileId, appointmentId, documentId) {
    validateSupportingDocumentIds(appointmentId, documentId);
    const { patient } = await patientContext(userProfileId, appointmentId);
    const document = await repository.findForPatient({ documentId, appointmentId, patientId: id(patient) });
    if (!document) throw httpError(404, 'SUPPORTING_DOCUMENT_NOT_FOUND', 'Supporting document was not found.');
    return { document: present(document), stream: storage.openDownload(document.storage_file_id) };
  }

  async function doctorDownload(userProfileId, appointmentId, documentId) {
    validateSupportingDocumentIds(appointmentId, documentId);
    await doctorContext(userProfileId, appointmentId);
    const document = await repository.findForAppointment({ documentId, appointmentId });
    if (!document) throw httpError(404, 'SUPPORTING_DOCUMENT_NOT_FOUND', 'Supporting document was not found.');
    return { document: present(document), stream: storage.openDownload(document.storage_file_id) };
  }

  return Object.freeze({
    uploadForPatient,
    listForPatient,
    listForDoctor,
    patientDownload,
    doctorDownload,
  });
}
