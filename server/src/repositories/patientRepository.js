import mongoose from 'mongoose';
import { Patient, UserProfile } from '../models/index.js';

export const patientRepository = {
  async findByUserProfileId(userProfileId) {
    return Patient.findOne({ user_profile_id: userProfileId }).lean();
  },

  async updateByUserProfileId(userProfileId, updates) {
    const session = await mongoose.startSession();
    let patient;
    try {
      await session.withTransaction(async () => {
        patient = await Patient.findOneAndUpdate(
          { user_profile_id: userProfileId },
          { $set: updates },
          { new: true, runValidators: true, session },
        ).lean();

        if (!patient) return;
        const sharedProfileUpdates = {};
        if (updates.full_name !== undefined) sharedProfileUpdates.display_name = updates.full_name;
        if (updates.contact_number !== undefined) {
          sharedProfileUpdates.contact_number = updates.contact_number;
        }
        if (Object.keys(sharedProfileUpdates).length) {
          await UserProfile.updateOne(
            { _id: userProfileId },
            { $set: sharedProfileUpdates },
            { session },
          );
        }
      });
      return patient;
    } finally {
      await session.endSession();
    }
  },
};
