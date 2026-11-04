import mongoose from 'mongoose';
import { AuthAccount, Patient, PortalInvitation, UserProfile } from '../models/index.js';

export const portalInvitationRepository = {
  findPatient(id) { return Patient.findById(id).lean(); },
  findAccountByEmail(email) { return AuthAccount.findOne({ email }).select('_id user_profile_id').lean(); },
  async replaceInvitation(patientId, email, tokenHash, expiresAt, now) {
    await PortalInvitation.updateMany({ patient_id: patientId, consumed_at: null, invalidated_at: null }, { $set: { invalidated_at: now } });
    const invitation = await PortalInvitation.create({ patient_id: patientId, email, token_hash: tokenHash, expires_at: expiresAt });
    const patientUpdate = await Patient.updateOne({ _id: patientId, user_profile_id: null }, { $set: { portal_email: email, portal_invitation_expires_at: expiresAt } });
    if (patientUpdate.modifiedCount !== 1) {
      await PortalInvitation.updateOne({ _id: invitation._id }, { $set: { invalidated_at: now } });
      throw Object.assign(new Error('Portal invitation patient state changed.'), { code: 'PORTAL_PATIENT_CHANGED' });
    }
    return invitation.toObject();
  },
  findByTokenHash(hash) { return PortalInvitation.findOne({ token_hash: hash }).select('+token_hash +otp_code_hash +otp_session_hash +claim_session_hash').lean(); },
  async invalidateDelivery(id, patientId, now) {
    await PortalInvitation.updateOne({ _id: id, consumed_at: null }, { $set: { invalidated_at: now } });
    await Patient.updateOne({ _id: patientId, user_profile_id: null }, { $set: { portal_invitation_expires_at: null } });
  },
  async setOtp(id, values, now) {
    return PortalInvitation.findOneAndUpdate(
      { _id: id, consumed_at: null, invalidated_at: null, expires_at: { $gt: now } },
      { $set: values }, { new: true },
    ).select('+otp_code_hash +otp_session_hash').lean();
  },
  async recordOtpFailure(id) {
    return PortalInvitation.findOneAndUpdate({ _id: id, consumed_at: null }, { $inc: { otp_attempt_count: 1 } }, { new: true }).lean();
  },
  async setClaimSession(id, otpSessionHash, claimSessionHash, expiresAt, now) {
    return PortalInvitation.findOneAndUpdate(
      { _id: id, otp_session_hash: otpSessionHash, otp_expires_at: { $gt: now }, consumed_at: null, invalidated_at: null },
      { $set: { claim_session_hash: claimSessionHash, claim_session_expires_at: expiresAt }, $unset: { otp_code_hash: 1, otp_session_hash: 1 } },
      { new: true },
    ).lean();
  },
  async claim({ invitationId, patientId, email, claimSessionHash, passwordHash, now }) {
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const invitation = await PortalInvitation.findOne({
          _id: invitationId, patient_id: patientId, email, claim_session_hash: claimSessionHash,
          claim_session_expires_at: { $gt: now }, expires_at: { $gt: now }, consumed_at: null, invalidated_at: null,
        }).session(session).lean();
        if (!invitation) return;
        const patient = await Patient.findOne({ _id: patientId, user_profile_id: null, portal_email: email }).session(session).lean();
        if (!patient || await AuthAccount.exists({ email }).session(session)) return;
        const [profile] = await UserProfile.create([{ display_name: patient.full_name, role: 'patient', contact_number: patient.contact_number, status: 'active' }], { session });
        const [account] = await AuthAccount.create([{ user_profile_id: profile._id, email, password_hash: passwordHash, email_verification_required: false, email_verified_at: now }], { session });
        const linked = await Patient.updateOne({ _id: patientId, user_profile_id: null }, { $set: { user_profile_id: profile._id, portal_invitation_expires_at: null } }, { session });
        if (linked.modifiedCount !== 1) throw new Error('PORTAL_CLAIM_RACE');
        await PortalInvitation.updateOne({ _id: invitationId, consumed_at: null }, { $set: { consumed_at: now }, $unset: { claim_session_hash: 1 } }, { session });
        result = { account_id: String(account._id), patient_id: String(patientId) };
      });
      return result ?? null;
    } finally { await session.endSession(); }
  },
};
