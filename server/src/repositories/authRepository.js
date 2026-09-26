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

  async findAccountForMfa(userProfileId) {
    return AuthAccount.findOne({ user_profile_id: userProfileId })
      .select('+mfa_secret_encrypted +mfa_pending_secret_encrypted +mfa_challenge_hash +mfa_challenge_expires_at')
      .lean();
  },

  async setMfaChallenge(userProfileId, { challengeHash, expiresAt }) {
    const result = await AuthAccount.updateOne(
      { user_profile_id: userProfileId },
      { $set: { mfa_challenge_hash: challengeHash, mfa_challenge_expires_at: expiresAt } },
    );
    return result.matchedCount === 1;
  },

  async setPendingMfaSecret(userProfileId, challengeHash, encryptedSecret, now) {
    const result = await AuthAccount.updateOne(
      {
        user_profile_id: userProfileId,
        mfa_enabled: { $ne: true },
        mfa_challenge_hash: challengeHash,
        mfa_challenge_expires_at: { $gt: now },
      },
      { $set: { mfa_pending_secret_encrypted: encryptedSecret } },
    );
    return result.modifiedCount === 1;
  },

  async completeMfaEnrollment(userProfileId, challengeHash, pendingSecret, enrolledAt) {
    const result = await AuthAccount.updateOne(
      {
        user_profile_id: userProfileId,
        mfa_enabled: { $ne: true },
        mfa_pending_secret_encrypted: pendingSecret,
        mfa_challenge_hash: challengeHash,
        mfa_challenge_expires_at: { $gt: enrolledAt },
      },
      {
        $set: {
          mfa_enabled: true,
          mfa_secret_encrypted: pendingSecret,
          mfa_enrolled_at: enrolledAt,
        },
        $unset: {
          mfa_pending_secret_encrypted: 1,
          mfa_challenge_hash: 1,
          mfa_challenge_expires_at: 1,
        },
      },
    );
    return result.modifiedCount === 1;
  },

  async consumeMfaChallenge(userProfileId, challengeHash, now) {
    const result = await AuthAccount.updateOne(
      {
        user_profile_id: userProfileId,
        mfa_enabled: true,
        mfa_challenge_hash: challengeHash,
        mfa_challenge_expires_at: { $gt: now },
      },
      { $unset: { mfa_challenge_hash: 1, mfa_challenge_expires_at: 1 } },
    );
    return result.modifiedCount === 1;
  },

  async clearMfaChallenge(userProfileId) {
    await AuthAccount.updateOne(
      { user_profile_id: userProfileId },
      { $unset: { mfa_challenge_hash: 1, mfa_challenge_expires_at: 1 } },
    );
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
