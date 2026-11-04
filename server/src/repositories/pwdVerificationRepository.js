import { Patient, PwdVerification } from '../models/index.js';

export const pwdVerificationRepository = Object.freeze({
  async findPatientByUserProfileId(userProfileId) {
    return Patient.findOne({ user_profile_id: userProfileId }).select('_id full_name').lean();
  },
  async findByPatientId(patientId) {
    return PwdVerification.findOne({ patient_id: patientId })
      .select('patient_id status submitted_at verified_at reviewed_at rejection_reason created_at updated_at')
      .lean();
  },
  async findRejectedForResubmission(patientId) {
    return PwdVerification.findOne({ patient_id: patientId, status: 'rejected' })
      .select('+storage_file_id +front_storage_file_id +back_storage_file_id status')
      .lean();
  },
  async replaceRejected(patientId, input) {
    return PwdVerification.findOneAndUpdate(
      { patient_id: patientId, status: 'rejected' },
      {
        $set: {
          ...input,
          status: 'pending',
          verified_at: null,
          verified_by: null,
          reviewed_at: null,
          reviewed_by: null,
          rejection_reason: null,
        },
      },
      { new: true, runValidators: true },
    ).select('patient_id status submitted_at verified_at reviewed_at rejection_reason created_at updated_at').lean();
  },
  async listPending({ page, limit }) {
    const filter = { status: 'pending' };
    const [items, total] = await Promise.all([
      PwdVerification.find(filter)
        .select('patient_id status submitted_at')
        .populate({ path: 'patient_id', select: 'full_name' })
        .sort({ submitted_at: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PwdVerification.countDocuments(filter),
    ]);
    return { items, total };
  },
  async findPendingReviewById(verificationId) {
    return PwdVerification.findOne({ _id: verificationId, status: 'pending' })
      .select('patient_id status submitted_at mime_type file_size storage_file_id front_mime_type front_file_size front_storage_file_id back_mime_type back_file_size back_storage_file_id')
      .populate({ path: 'patient_id', select: 'full_name' })
      .lean();
  },
  async reviewPending(verificationId, { action, reviewerId, reviewedAt, rejectionReason }) {
    const set = {
      status: action,
      reviewed_at: reviewedAt,
      reviewed_by: reviewerId,
      rejection_reason: rejectionReason,
      verified_at: action === 'verified' ? reviewedAt : null,
      verified_by: action === 'verified' ? reviewerId : null,
    };
    return PwdVerification.findOneAndUpdate(
      { _id: verificationId, status: 'pending' },
      {
        $set: set,
        $push: { review_history: { action, reviewed_by: reviewerId, reviewed_at: reviewedAt, rejection_reason: rejectionReason } },
      },
      { new: true, runValidators: true },
    ).select('patient_id status submitted_at verified_at reviewed_at reviewed_by rejection_reason').lean();
  },
  async create(input) {
    return (await PwdVerification.create(input)).toObject();
  },
  async deleteByStorageFileId(storageFileId) {
    await PwdVerification.deleteOne({ storage_file_id: storageFileId });
  },
});
