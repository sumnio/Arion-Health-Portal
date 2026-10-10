import {
  EmailVerificationChallenge,
  PasswordResetToken,
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
    return EmailVerificationChallenge.findById(id).select('+code_hash').lean();
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
