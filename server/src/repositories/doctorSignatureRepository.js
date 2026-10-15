import { Doctor, DoctorSignature } from '../models/index.js';

export const doctorSignatureRepository = Object.freeze({
  async findDoctorByUserProfileId(userProfileId) { return Doctor.findOne({ user_profile_id: userProfileId }).lean(); },
  async findByDoctorId(doctorId) { return DoctorSignature.findOne({ doctor_id: doctorId }).lean(); },
  async swapForDoctor(doctorId, data) {
    const previous = await DoctorSignature.findOneAndUpdate(
      { doctor_id: doctorId },
      { $set: data, $setOnInsert: { doctor_id: doctorId } },
      { upsert: true, new: false, runValidators: true, lean: true },
    );
    const active = await DoctorSignature.findOne({ doctor_id: doctorId }).lean();
    return { active, previous };
  },
});
