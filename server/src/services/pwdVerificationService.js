import { httpError } from '../utils/httpError.js';
import {
  validatePwdRejection,
  validatePwdVerificationId,
  validatePwdVerificationListQuery,
  validatePwdVerificationFiles,
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
  const documents = record.front_storage_file_id && record.back_storage_file_id
    ? [
        { side: 'front', mime_type: record.front_mime_type, file_size: record.front_file_size },
        { side: 'back', mime_type: record.back_mime_type, file_size: record.back_file_size },
      ]
    : [{ side: 'legacy', mime_type: record.mime_type, file_size: record.file_size }];
  return Object.freeze({
    id: id(record),
    patient_name: record.patient_id?.full_name ?? 'Patient unavailable',
    status: record.status,
    submitted_at: new Date(record.submitted_at).toISOString(),
    documents,
  });
}

async function uploadPair(storage, documents) {
  const results = await Promise.allSettled([
    storage.upload(documents.front, { side: 'front' }),
    storage.upload(documents.back, { side: 'back' }),
  ]);
  const uploaded = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (results.some(result => result.status === 'rejected')) {
    await Promise.all(uploaded.map(file => storage.delete(file.storageFileId).catch(() => {})));
    throw results.find(result => result.status === 'rejected').reason;
  }
  return { front: results[0].value, back: results[1].value };
}

function storedPair(documents, uploaded) {
  return {
    pwd_id_number: null,
    storage_file_id: uploaded.front.storageFileId,
    stored_filename: uploaded.front.storedFilename,
    mime_type: documents.front.mimeType,
    file_size: documents.front.size,
    document_sha256: documents.front.sha256,
    front_storage_file_id: uploaded.front.storageFileId,
    front_stored_filename: uploaded.front.storedFilename,
    front_mime_type: documents.front.mimeType,
    front_file_size: documents.front.size,
    front_document_sha256: documents.front.sha256,
    back_storage_file_id: uploaded.back.storageFileId,
    back_stored_filename: uploaded.back.storedFilename,
    back_mime_type: documents.back.mimeType,
    back_file_size: documents.back.size,
    back_document_sha256: documents.back.sha256,
  };
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

    async submitOwn(userProfileId, body, files) {
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
      if (body && Object.keys(body).length) {
        throw httpError(400, 'UNEXPECTED_PWD_FIELDS', 'PWD verification accepts only the front and back ID images.');
      }
      const documents = validatePwdVerificationFiles(files);
      let uploaded;
      try {
        uploaded = await uploadPair(storage, documents);
        const fileInput = storedPair(documents, uploaded);
        if (existing?.status === 'rejected') {
          const rejected = await repository.findRejectedForResubmission(patientId);
          if (!rejected) {
            throw httpError(409, 'PWD_VERIFICATION_RESUBMISSION_CONFLICT', 'PWD verification can no longer be resubmitted. Refresh the page.');
          }
          const record = await repository.replaceRejected(patientId, {
            ...fileInput,
            submitted_at: now(),
          });
          if (!record) {
            throw httpError(409, 'PWD_VERIFICATION_RESUBMISSION_CONFLICT', 'PWD verification can no longer be resubmitted. Refresh the page.');
          }
          const oldIds = [...new Map([rejected.storage_file_id, rejected.front_storage_file_id, rejected.back_storage_file_id].filter(Boolean).map(fileId => [String(fileId), fileId])).values()];
          await Promise.all(oldIds.map(fileId => storage.delete(fileId).catch(() => {})));
          await invokeNotificationTrigger(notificationTriggers, 'pwdVerificationSubmitted', { patientId });
          return present(record);
        }
        try {
          const record = await repository.create({
            patient_id: patientId,
            ...fileInput,
            status: 'pending',
            submitted_at: now(),
          });
          await invokeNotificationTrigger(notificationTriggers, 'pwdVerificationSubmitted', { patientId });
          return present(record);
        } catch (error) {
          if (duplicateKey(error)) {
            throw httpError(409, 'PWD_VERIFICATION_ALREADY_SUBMITTED', 'PWD verification is already pending review.');
          }
          throw error;
        }
      } catch (error) {
        if (uploaded) {
          await Promise.all([uploaded.front, uploaded.back].filter(Boolean).map(file => storage.delete(file.storageFileId).catch(() => {})));
        }
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

    async pendingDocument(verificationId, side) {
      const validId = validatePwdVerificationId(verificationId);
      const record = await repository.findPendingReviewById(validId);
      if (!record) throw httpError(404, 'PWD_VERIFICATION_NOT_REVIEWABLE', 'Pending PWD verification was not found.');
      if (side === 'front' || side === 'back') {
        const storageFileId = record[`${side}_storage_file_id`];
        if (!storageFileId) throw httpError(404, 'PWD_DOCUMENT_NOT_FOUND', 'The requested PWD ID image was not found.');
        return {
          metadata: { mime_type: record[`${side}_mime_type`], file_size: record[`${side}_file_size`] },
          stream: storage.openDownload(storageFileId),
        };
      }
      if (side != null || !record.storage_file_id) {
        throw httpError(404, 'PWD_DOCUMENT_NOT_FOUND', 'The requested PWD ID image was not found.');
      }
      return { metadata: { mime_type: record.mime_type, file_size: record.file_size }, stream: storage.openDownload(record.storage_file_id) };
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
