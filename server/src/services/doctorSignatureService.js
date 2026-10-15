import { httpError } from '../utils/httpError.js';
import { validateDoctorSignatureFile } from '../validation/doctorSignatureValidation.js';

const id = value => String(value?._id ?? value?.id ?? value);
const present = item => Object.freeze({
  configured: true,
  mime_type: item.mime_type,
  file_size: item.file_size,
  width: item.width,
  height: item.height,
  uploaded_at: new Date(item.uploaded_at ?? item.created_at).toISOString(),
});

export function createDoctorSignatureService({ repository, storage, now = () => new Date(), logger = console }) {
  async function doctorFor(userProfileId) {
    const doctor = await repository.findDoctorByUserProfileId(userProfileId);
    if (!doctor) throw httpError(404, 'DOCTOR_PROFILE_NOT_FOUND', 'Doctor profile was not found.');
    return doctor;
  }

  async function getStatus(userProfileId) {
    const doctor = await doctorFor(userProfileId);
    const signature = await repository.findByDoctorId(id(doctor));
    return signature ? present(signature) : Object.freeze({ configured: false });
  }

  async function uploadOwn(userProfileId, file) {
    const doctor = await doctorFor(userProfileId);
    const validated = validateDoctorSignatureFile(file);
    let uploaded;
    try {
      uploaded = await storage.upload(validated);
      const { active, previous } = await repository.swapForDoctor(id(doctor), {
        storage_file_id: uploaded.storageFileId,
        mime_type: validated.mimeType,
        file_size: validated.size,
        width: validated.width,
        height: validated.height,
        uploaded_at: now(),
      });
      if (previous?.storage_file_id && id(previous.storage_file_id) !== id(uploaded.storageFileId)) {
        await storage.delete(previous.storage_file_id).catch(() => logger?.warn?.('Doctor signature old-file cleanup failed.', { event: 'DOCTOR_SIGNATURE_CLEANUP_FAILED' }));
      }
      return present(active);
    } catch (error) {
      if (uploaded?.storageFileId) await storage.delete(uploaded.storageFileId).catch(() => {});
      if (error?.status) throw error;
      throw httpError(503, 'DOCTOR_SIGNATURE_UPLOAD_UNAVAILABLE', 'Signature upload is temporarily unavailable.');
    }
  }

  async function ownSignature(userProfileId) {
    const doctor = await doctorFor(userProfileId);
    return getDoctorSignatureForCertificate(id(doctor));
  }

  async function getDoctorSignatureForCertificate(doctorId) {
    const signature = await repository.findByDoctorId(doctorId);
    if (!signature) return null;
    return { metadata: present(signature), stream: storage.openDownload(signature.storage_file_id) };
  }

  return Object.freeze({ getStatus, uploadOwn, ownSignature, getDoctorSignatureForCertificate });
}
