import { httpError } from '../utils/httpError.js';

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const CLAIM_TTL_MS = 15 * 60 * 1000;

function maskedEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, name.length - 1))}@${domain}`;
}
function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw httpError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  return email;
}
function active(invitation, now) {
  return invitation && !invitation.consumed_at && !invitation.invalidated_at && new Date(invitation.expires_at) > now;
}

export function createPortalInvitationService({ repository, tokens, passwords, email, now = () => new Date() }) {
  async function context(token) {
    if (typeof token !== 'string' || token.length < 32 || token.length > 256) return null;
    const invitation = await repository.findByTokenHash(tokens.hashPortalInvitationToken(token));
    if (!active(invitation, now())) return null;
    const patient = await repository.findPatient(invitation.patient_id);
    if (!patient || patient.user_profile_id || patient.portal_email !== invitation.email) return null;
    return { invitation, patient };
  }
  return Object.freeze({
    async issue(patientId, emailValue) {
      const emailAddress = normalizeEmail(emailValue);
      const patient = await repository.findPatient(patientId);
      if (!patient) throw httpError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.');
      if (patient.user_profile_id) throw httpError(409, 'PORTAL_ACCOUNT_ACTIVE', 'This Patient already has an active portal account.');
      if (await repository.findAccountByEmail(emailAddress)) throw httpError(409, 'EMAIL_IN_USE', 'This email already belongs to another portal account.');
      const token = tokens.generatePortalInvitationToken();
      const current = now();
      let invitation;
      try { invitation = await repository.replaceInvitation(patientId, emailAddress, tokens.hashPortalInvitationToken(token), new Date(current.getTime() + INVITATION_TTL_MS), current); }
      catch (error) {
        if (error?.code === 'PORTAL_PATIENT_CHANGED') throw httpError(409, 'INVITATION_CHANGED', 'This Patient can no longer receive a portal invitation.');
        throw error;
      }
      try { await email.sendPortalInvitationEmail({ to: emailAddress, token }); }
      catch (error) { await repository.invalidateDelivery(invitation._id, patientId, now()); throw error; }
      return { invitation_id: String(invitation._id), masked_email: maskedEmail(emailAddress), expires_at: invitation.expires_at };
    },
    async inspect(token) {
      const found = await context(token);
      if (!found) throw httpError(400, 'INVALID_INVITATION', 'This invitation is invalid, expired, or already used.');
      return { status: 'active', masked_email: maskedEmail(found.invitation.email) };
    },
    async sendCode(token) {
      const found = await context(token);
      if (!found) throw httpError(400, 'INVALID_INVITATION', 'This invitation is invalid, expired, or already used.');
      const code = tokens.generateVerificationCode();
      const sessionToken = tokens.generatePortalInvitationSession();
      const current = now();
      const updated = await repository.setOtp(found.invitation._id, { otp_code_hash: tokens.hashPortalInvitationCode(found.invitation._id, code), otp_session_hash: tokens.hashPortalInvitationSession(sessionToken), otp_expires_at: new Date(current.getTime() + OTP_TTL_MS), otp_attempt_count: 0, otp_last_sent_at: current }, current);
      if (!updated) throw httpError(409, 'INVITATION_CHANGED', 'This invitation can no longer be used.');
      await email.sendPortalClaimCodeEmail({ to: found.invitation.email, code });
      return { otp_session: sessionToken, masked_email: maskedEmail(found.invitation.email) };
    },
    async verifyCode({ token, otpSession, code }) {
      const found = await context(token); const current = now();
      const invitation = found?.invitation;
      if (!invitation || !invitation.otp_code_hash || invitation.otp_attempt_count >= invitation.otp_max_attempts || new Date(invitation.otp_expires_at) <= current || invitation.otp_session_hash !== tokens.hashPortalInvitationSession(otpSession)) throw httpError(400, 'INVALID_CODE', 'The verification code is invalid or expired.');
      if (!tokens.verifyPortalInvitationCode(invitation._id, code, invitation.otp_code_hash)) {
        await repository.recordOtpFailure(invitation._id);
        throw httpError(400, 'INVALID_CODE', 'The verification code is invalid or expired.');
      }
      const claimSession = tokens.generatePortalInvitationSession();
      const updated = await repository.setClaimSession(invitation._id, tokens.hashPortalInvitationSession(otpSession), tokens.hashPortalInvitationSession(claimSession), new Date(current.getTime() + CLAIM_TTL_MS), current);
      if (!updated) throw httpError(400, 'INVALID_CODE', 'The verification code is invalid or expired.');
      return { claim_session: claimSession };
    },
    async complete({ token, claimSession, password }) {
      const found = await context(token); const current = now();
      if (!found || typeof password !== 'string' || password.length < 8 || password.length > 128) throw httpError(400, 'INVALID_CLAIM', 'The account claim could not be completed.');
      if (await repository.findAccountByEmail(found.invitation.email)) throw httpError(409, 'EMAIL_IN_USE', 'This email already belongs to another portal account.');
      let result;
      try { result = await repository.claim({ invitationId: found.invitation._id, patientId: found.patient._id, email: found.invitation.email, claimSessionHash: tokens.hashPortalInvitationSession(claimSession), passwordHash: await passwords.hash(password), now: current }); }
      catch (error) {
        if (error?.code === 11000 || error?.message === 'PORTAL_CLAIM_RACE') throw httpError(409, 'CLAIM_NOT_AVAILABLE', 'This invitation has already been used or changed.');
        throw error;
      }
      if (!result) throw httpError(409, 'CLAIM_NOT_AVAILABLE', 'This invitation has already been used or changed.');
      return { status: 'ACCOUNT_CREATED' };
    },
  });
}
