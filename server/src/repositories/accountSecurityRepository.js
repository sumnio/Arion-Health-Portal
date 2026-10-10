import mongoose from 'mongoose';
import {
  AuthAccount,
  EmailVerificationChallenge,
  PasswordResetToken,
  UserProfile,
} from '../models/index.js';

export const accountSecurityRepository = {
  async replaceVerificationChallenge(data, now) {
    await EmailVerificationChallenge.updateMany(
      {
        account_id: data.account_id,
        purpose: data.purpose,
        consumed_at: null,
        invalidated_at: null,
      },
      { $set: { invalidated_at: now } },
    );
    return EmailVerificationChallenge.create(data);
  },

  async findVerificationChallenge(id) {
    return EmailVerificationChallenge.findById(id).select('+code_hash +session_hash').lean();
  },

  async findVerificationChallengeBySessionHash(sessionHash) {
    return EmailVerificationChallenge.findOne({ session_hash: sessionHash })
      .select('+code_hash +session_hash')
      .lean();
  },

  async findLatestVerificationChallengeForAccount(accountId) {
    return EmailVerificationChallenge.findOne({
      account_id: accountId,
      purpose: 'registration_verification',
      consumed_at: null,
    })
      .sort({ created_at: -1 })
      .select('+code_hash +session_hash')
      .lean();
  },

  async rotateVerificationSession(id, sessionHash) {
    return EmailVerificationChallenge.findOneAndUpdate(
      { _id: id, consumed_at: null },
      { $set: { session_hash: sessionHash } },
      { new: true },
    ).select('+code_hash +session_hash').lean();
  },

  async findVerificationAccount(accountId) {
    const account = await AuthAccount.findById(accountId).lean();
    if (!account) return null;
    const profile = await UserProfile.findById(account.user_profile_id).select('role status').lean();
    return profile ? { ...account, role: profile.role, status: profile.status } : null;
  },

  async completeEmailVerification(challengeId, accountId, now) {
    const challenge = await EmailVerificationChallenge.findOneAndUpdate(
      {
        _id: challengeId,
        account_id: accountId,
        consumed_at: null,
        invalidated_at: null,
        expires_at: { $gt: now },
        $expr: { $lt: ['$attempt_count', '$max_attempts'] },
      },
      { $set: { consumed_at: now } },
      { new: true },
    ).lean();
    if (!challenge) return null;
    const account = await AuthAccount.findOneAndUpdate(
      { _id: accountId, email_verification_required: true },
      { $set: { email_verification_required: false, email_verified_at: now } },
      { new: true },
    ).lean();
    return account ? { challenge, account } : null;
  },

  async invalidateVerificationChallenge(id, now) {
    await EmailVerificationChallenge.updateOne(
      { _id: id, consumed_at: null },
      { $set: { invalidated_at: now } },
    );
  },

  async recordFailedVerificationAttempt(id, now) {
    return EmailVerificationChallenge.findOneAndUpdate(
      {
        _id: id,
        consumed_at: null,
        invalidated_at: null,
        expires_at: { $gt: now },
        $expr: { $lt: ['$attempt_count', '$max_attempts'] },
      },
      { $inc: { attempt_count: 1 } },
      { new: true },
    ).select('+code_hash').lean();
  },

  async consumeVerificationChallenge(id, now) {
    return EmailVerificationChallenge.findOneAndUpdate(
      {
        _id: id,
        consumed_at: null,
        invalidated_at: null,
        expires_at: { $gt: now },
        $expr: { $lt: ['$attempt_count', '$max_attempts'] },
      },
      { $set: { consumed_at: now } },
      { new: true },
    ).lean();
  },

  async replacePasswordResetToken(data, now) {
    await PasswordResetToken.updateMany(
      { account_id: data.account_id, consumed_at: null, invalidated_at: null },
      { $set: { invalidated_at: now } },
    );
    return PasswordResetToken.create(data);
  },

  async findPasswordResetTokenByHash(tokenHash) {
    return PasswordResetToken.findOne({ token_hash: tokenHash }).select('+token_hash').lean();
  },

  async findPasswordResetTokenBySessionHash(sessionHash) {
    return PasswordResetToken.findOne({ session_hash: sessionHash })
      .select('+session_hash')
      .lean();
  },

  async findPasswordResetAccount(accountId) {
    const account = await AuthAccount.findById(accountId).lean();
    if (!account) return null;
    const profile = await UserProfile.findById(account.user_profile_id).select('role status').lean();
    return profile ? { ...account, role: profile.role, status: profile.status } : null;
  },

  async exchangePasswordResetToken(tokenHash, sessionHash, sessionExpiresAt, now) {
    return PasswordResetToken.findOneAndUpdate(
      {
        token_hash: tokenHash,
        consumed_at: null,
        invalidated_at: null,
        expires_at: { $gt: now },
      },
      {
        $set: {
          consumed_at: now,
          session_hash: sessionHash,
          session_expires_at: sessionExpiresAt,
          session_consumed_at: null,
        },
      },
      { new: true },
    ).select('+session_hash').lean();
  },

  async invalidatePasswordResetToken(id, now) {
    await PasswordResetToken.updateOne(
      { _id: id, invalidated_at: null },
      { $set: { invalidated_at: now } },
    );
  },

  async completePasswordReset(sessionHash, passwordHash, now) {
    const session = await mongoose.startSession();
    let completed = null;
    try {
      await session.withTransaction(async () => {
        const reset = await PasswordResetToken.findOne({
          session_hash: sessionHash,
          consumed_at: { $ne: null },
          invalidated_at: null,
          session_consumed_at: null,
          session_expires_at: { $gt: now },
        }).select('+session_hash').session(session).lean();
        if (!reset) return;

        const account = await AuthAccount.findById(reset.account_id).session(session).lean();
        if (!account) return;
        const profile = await UserProfile.findById(account.user_profile_id)
          .select('role status')
          .session(session)
          .lean();
        if (!profile || profile.role !== 'patient' || profile.status !== 'active') return;

        const tokenUpdate = await PasswordResetToken.updateOne(
          {
            _id: reset._id,
            session_hash: sessionHash,
            invalidated_at: null,
            session_consumed_at: null,
            session_expires_at: { $gt: now },
          },
          { $set: { session_consumed_at: now } },
          { session },
        );
        if (tokenUpdate.modifiedCount !== 1) return;

        const updatedAccount = await AuthAccount.findByIdAndUpdate(
          account._id,
          {
            $set: { password_hash: passwordHash },
            $inc: { auth_session_version: 1 },
          },
          { new: true, session },
        ).lean();
        await PasswordResetToken.updateMany(
          {
            _id: { $ne: reset._id },
            account_id: account._id,
            invalidated_at: null,
          },
          { $set: { invalidated_at: now } },
          { session },
        );
        completed = { account: updatedAccount, reset };
      });
      return completed;
    } finally {
      await session.endSession();
    }
  },

  async consumePasswordResetToken(tokenHash, now) {
    return PasswordResetToken.findOneAndUpdate(
      {
        token_hash: tokenHash,
        consumed_at: null,
        invalidated_at: null,
        expires_at: { $gt: now },
      },
      { $set: { consumed_at: now } },
      { new: true },
    ).lean();
  },
};
