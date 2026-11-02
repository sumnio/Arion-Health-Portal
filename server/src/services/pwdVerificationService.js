import { httpError } from '../utils/httpError.js';
import {
  validatePwdIdNumber,
  validatePwdVerificationFile,
} from '../validation/pwdVerificationValidation.js';

function id(value) {
  return String(value?._id ?? value?.id ?? value);
}

function present(record) {
  if (!record) return Object.freeze({ status: 'not_submitted', submitted_at: null, verified_at: null });
  return Object.freeze({
    status: record.status,
    submitted_at: new Date(record.submitted_at ?? record.created_at).toISOString(),
    verified_at: record.verified_at ? new Date(record.verified_at).toISOString() : null,
  });
}

function duplicateKey(error) {
  return error?.code === 11000;
}

export function createPwdVerificationService({ repository, storage, now = () => new Date() }) {
  async function ownPatient(userProfileId) {
    const patient = await repository.findPatientByUserProfileId(userProfileId);
    if (!patient) throw httpError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return patient;
  }

  return Object.freeze({
    async getOwnStatus(userProfileId) {
      const patient = await ownPatient(userProfileId);
      return present(await repository.findByPatientId(id(patient)));
    },

    async submitOwn(userProfileId, body, file) {
      const patient = await ownPatient(userProfileId);
      const patientId = id(patient);
      const existing = await repository.findByPatientId(patientId);
      if (existing) {
        throw httpError(
          409,
          'PWD_VERIFICATION_ALREADY_SUBMITTED',
          existing.status === 'pending'
            ? 'PWD verification is already pending review.'
            : 'A PWD verification record already exists. Resubmission is not available yet.',
        );
      }
      const pwdIdNumber = validatePwdIdNumber(body?.pwd_id_number);
      const document = validatePwdVerificationFile(file);
      let uploaded;
      try {
        uploaded = await storage.upload(document);
        try {
          const record = await repository.create({
            patient_id: patientId,
            pwd_id_number: pwdIdNumber,
            storage_file_id: uploaded.storageFileId,
            stored_filename: uploaded.storedFilename,
            mime_type: document.mimeType,
            file_size: document.size,
            document_sha256: document.sha256,
            status: 'pending',
            submitted_at: now(),
          });
          return present(record);
        } catch (error) {
          await repository.deleteByStorageFileId?.(uploaded.storageFileId);
          if (duplicateKey(error)) {
            throw httpError(409, 'PWD_VERIFICATION_ALREADY_SUBMITTED', 'PWD verification is already pending review.');
          }
          throw error;
        }
      } catch (error) {
        if (uploaded) await storage.delete(uploaded.storageFileId).catch(() => {});
        if (error?.status) throw error;
        throw httpError(503, 'PWD_VERIFICATION_UPLOAD_UNAVAILABLE', 'PWD verification upload is temporarily unavailable.');
      }
    },
  });
}
