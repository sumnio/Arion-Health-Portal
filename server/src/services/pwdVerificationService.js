import { httpError } from '../utils/httpError.js';
import {
  validatePwdIdNumber,
  validatePwdRejection,
  validatePwdVerificationId,
  validatePwdVerificationListQuery,
  validatePwdVerificationFile,
} from '../validation/pwdVerificationValidation.js';
import { invokeNotificationTrigger } from './notificationTriggerService.js';

function id(value) {
  return String(value?._id ?? value?.id ?? value);
}

function present(record) {
  if (!record) return Object.freeze({ status: 'not_submitted', submitted_at: null, verified_at: null, rejection_reason: null });
  return Object.freeze({
    status: record.status,
    submitted_at: new Date(record.submitted_at ?? record.created_at).toISOString(),
    verified_at: record.verified_at ? new Date(record.verified_at).toISOString() : null,
    rejection_reason: record.status === 'rejected' ? record.rejection_reason ?? null : null,
  });
}

function duplicateKey(error) {
  return error?.code === 11000;
}

function pendingListItem(record) {
  return Object.freeze({
    id: id(record),
    patient_name: record.patient_id?.full_name ?? 'Patient unavailable',
    status: record.status,
    submitted_at: new Date(record.submitted_at).toISOString(),
  });
}

function reviewView(record) {
  return Object.freeze({
    id: id(record),
    patient_name: record.patient_id?.full_name ?? 'Patient unavailable',
    pwd_id_number: record.pwd_id_number,
    status: record.status,
    submitted_at: new Date(record.submitted_at).toISOString(),
    document: { mime_type: record.mime_type, file_size: record.file_size },
  });
}

export function createPwdVerificationService({ repository, storage, notificationTriggers, now = () => new Date() }) {
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
      if (existing && existing.status !== 'rejected') {
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
        if (existing?.status === 'rejected') {
          const rejected = await repository.findRejectedForResubmission(patientId);
          if (!rejected) {
            throw httpError(409, 'PWD_VERIFICATION_RESUBMISSION_CONFLICT', 'PWD verification can no longer be resubmitted. Refresh the page.');
          }
          const record = await repository.replaceRejected(patientId, {
            pwd_id_number: pwdIdNumber,
            storage_file_id: uploaded.storageFileId,
            stored_filename: uploaded.storedFilename,
            mime_type: document.mimeType,
            file_size: document.size,
            document_sha256: document.sha256,
            submitted_at: now(),
          });
          if (!record) {
            throw httpError(409, 'PWD_VERIFICATION_RESUBMISSION_CONFLICT', 'PWD verification can no longer be resubmitted. Refresh the page.');
          }
          await storage.delete(rejected.storage_file_id).catch(() => {});
          return present(record);
        }
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

    async listPending(query) {
      const paging = validatePwdVerificationListQuery(query);
      const result = await repository.listPending(paging);
      return Object.freeze({
        items: result.items.map(pendingListItem),
        page: paging.page,
        limit: paging.limit,
        total: result.total,
        page_count: Math.max(1, Math.ceil(result.total / paging.limit)),
      });
    },

    async pendingReview(verificationId) {
      const validId = validatePwdVerificationId(verificationId);
      const record = await repository.findPendingReviewById(validId);
      if (!record) throw httpError(404, 'PWD_VERIFICATION_NOT_REVIEWABLE', 'Pending PWD verification was not found.');
      return reviewView(record);
    },

    async pendingDocument(verificationId) {
      const validId = validatePwdVerificationId(verificationId);
      const record = await repository.findPendingReviewById(validId);
      if (!record) throw httpError(404, 'PWD_VERIFICATION_NOT_REVIEWABLE', 'Pending PWD verification was not found.');
      return {
        metadata: { mime_type: record.mime_type, file_size: record.file_size },
        stream: storage.openDownload(record.storage_file_id),
      };
    },

    async verify(verificationId, reviewerId) {
      return review(verificationId, reviewerId, 'verified', null);
    },

    async reject(verificationId, reviewerId, body) {
      return review(verificationId, reviewerId, 'rejected', validatePwdRejection(body));
    },
  });

  async function review(verificationId, reviewerId, action, rejectionReason) {
    const validId = validatePwdVerificationId(verificationId);
    const reviewedAt = now();
    const record = await repository.reviewPending(validId, {
      action,
      reviewerId,
      reviewedAt,
      rejectionReason,
    });
    if (!record) throw httpError(409, 'PWD_VERIFICATION_ALREADY_REVIEWED', 'This PWD verification is no longer pending review.');
    await invokeNotificationTrigger(notificationTriggers, 'pwdVerificationReviewed', {
      patientId: id(record.patient_id),
      status: action,
    });
    return Object.freeze({
      id: id(record),
      status: record.status,
      reviewed_at: new Date(record.reviewed_at).toISOString(),
    });
  }
}
