import { Patient, PwdVerification } from '../models/index.js';

export const pwdVerificationRepository = Object.freeze({
  async findPatientByUserProfileId(userProfileId) {
    return Patient.findOne({ user_profile_id: userProfileId }).select('_id').lean();
  },
  async findByPatientId(patientId) {
    return PwdVerification.findOne({ patient_id: patientId })
      .select('patient_id status submitted_at verified_at created_at updated_at')
      .lean();
  },
  async create(input) {
    return (await PwdVerification.create(input)).toObject();
  },
  async deleteByStorageFileId(storageFileId) {
    await PwdVerification.deleteOne({ storage_file_id: storageFileId });
  },
});
