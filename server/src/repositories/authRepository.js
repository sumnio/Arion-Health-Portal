import mongoose from 'mongoose';
import { AuthAccount, Patient, UserProfile } from '../models/index.js';

function safeProfile(profile) {
  if (!profile) return null;
  return {
    user_profile_id: String(profile._id),
    display_name: profile.display_name,
    role: profile.role,
    status: profile.status,
  };
}

async function createWithSession(data, session) {
  const [profile] = await UserProfile.create(
    [
      {
        display_name: data.display_name,
        role: 'patient',
        contact_number: data.contact_number,
        status: 'active',
      },
    ],
    { session },
  );
  const [patient] = await Patient.create(
    [
      {
        user_profile_id: profile._id,
        full_name: data.full_name,
        contact_number: data.contact_number,
        dob: data.dob,
        sex: data.sex,
        address: data.address,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_number: data.emergency_contact_number,
        emergency_contact_relationship: data.emergency_contact_relationship,
        allergies: data.allergies,
        is_pwd: data.is_pwd,
      },
    ],
    { session },
  );
  const [account] = await AuthAccount.create(
    [
      {
        user_profile_id: profile._id,
        email: data.email,
        password_hash: data.password_hash,
      },
    ],
    { session },
  );
  return { account, profile, patient };
}

export const authRepository = {
  async findAccountByEmail(email) {
    return AuthAccount.findOne({ email }).select('+password_hash').lean();
  },

  async findSafeProfileById(id) {
    const profile = await UserProfile.findById(id).lean();
    return safeProfile(profile);
  },

  async findUnlinkedPatientCandidate({ contact_number, dob }) {
    return Patient.findOne({
      user_profile_id: null,
      contact_number,
      dob,
    })
      .select('_id')
      .lean();
  },

  async createPatientRegistration(data) {
    const session = await mongoose.startSession();
    let registration;
    try {
      await session.withTransaction(async () => {
        registration = await createWithSession(data, session);
      });
      return {
        account: registration.account.toObject(),
        profile: safeProfile(registration.profile),
        patient: registration.patient.toObject(),
      };
    } finally {
      await session.endSession();
    }
  },
};
