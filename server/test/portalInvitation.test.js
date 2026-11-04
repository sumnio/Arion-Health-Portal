import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountTokenService } from '../src/services/accountTokenService.js';
import { portalInvitationTemplate } from '../src/services/emailTemplates.js';
import { createPortalInvitationService } from '../src/services/portalInvitationService.js';

function context({ deliveryFails = false, claimError = null } = {}) {
  let invitation; let accountEmail = null; let currentTime = new Date('2026-11-04T00:00:00.000Z');
  const patient = { _id: 'patient-1', full_name: 'Walk In Patient', contact_number: '09171234567', user_profile_id: null, portal_email: null }; const messages = []; const passwordHashes = [];
  const repository = {
    findPatient: async () => ({ ...patient }), findAccountByEmail: async email => accountEmail === email ? { _id: 'account-1' } : null,
    async replaceInvitation(patientId, email, token_hash, expires_at) { if (invitation) invitation.invalidated_at = currentTime; patient.portal_email = email; invitation = { _id: `invite-${messages.length + 1}`, patient_id: patientId, email, token_hash, expires_at, otp_max_attempts: 5, otp_attempt_count: 0 }; return invitation; },
    async invalidateDelivery() { invitation.invalidated_at = new Date(); },
    async findByTokenHash(hash) { return invitation?.token_hash === hash ? { ...invitation } : null; },
    async setOtp(_id, values) { Object.assign(invitation, values); return { ...invitation }; },
    async recordOtpFailure() { invitation.otp_attempt_count += 1; return { ...invitation }; },
    async setClaimSession(_id, otpHash, claimHash, expiresAt) { if (invitation.otp_session_hash !== otpHash) return null; invitation.claim_session_hash = claimHash; invitation.claim_session_expires_at = expiresAt; delete invitation.otp_code_hash; delete invitation.otp_session_hash; return { ...invitation }; },
    async claim(values) { if (claimError) throw claimError; if (values.claimSessionHash !== invitation.claim_session_hash || patient.user_profile_id) return null; patient.user_profile_id = 'profile-1'; invitation.consumed_at = values.now; return { patient_id: patient._id }; },
  };
  const tokens = createAccountTokenService('portal-invitation-test-secret-at-least-32-characters', 'test', { randomInteger: () => 123456 });
  const email = { async sendPortalInvitationEmail(message) { if (deliveryFails) throw new Error('delivery failed'); messages.push({ type: 'invite', ...message }); }, async sendPortalClaimCodeEmail(message) { messages.push({ type: 'code', ...message }); } };
  const service = createPortalInvitationService({ repository, tokens, passwords: { async hash(value) { const hashed = `hash:${value}`; passwordHashes.push(hashed); return hashed; } }, email, now: () => new Date(currentTime) });
  return { service, patient, messages, passwordHashes, advance(milliseconds) { currentTime = new Date(currentTime.getTime() + milliseconds); }, setAccountEmail(value) { accountEmail = value; } };
}

test('portal invitation requires OTP and links the existing Patient without creating another Patient', async () => {
  const c = context();
  await c.service.issue('patient-1', ' WALKIN@Example.com ');
  const token = c.messages[0].token;
  assert.equal((await c.service.inspect(token)).status, 'active');
  const otp = await c.service.sendCode(token);
  const verified = await c.service.verifyCode({ token, otpSession: otp.otp_session, code: c.messages[1].code });
  assert.deepEqual(await c.service.complete({ token, claimSession: verified.claim_session, password: 'PatientPassword1!' }), { status: 'ACCOUNT_CREATED' });
  assert.equal(c.patient.user_profile_id, 'profile-1');
  await assert.rejects(() => c.service.inspect(token), error => error.code === 'INVALID_INVITATION');
});

test('invitation delivery failure is controlled after the clinic Patient remains created', async () => {
  const c = context({ deliveryFails: true });
  await assert.rejects(() => c.service.issue('patient-1', 'walkin@example.com'));
  assert.equal(c.patient._id, 'patient-1');
  assert.equal(c.patient.user_profile_id, null);
});

test('invalid email, an existing account, and an already-linked Patient block invitation creation', async () => {
  const c = context();
  await assert.rejects(() => c.service.issue('patient-1', 'not-an-email'), error => error.code === 'INVALID_EMAIL');
  c.setAccountEmail('used@example.com');
  await assert.rejects(() => c.service.issue('patient-1', 'used@example.com'), error => error.code === 'EMAIL_IN_USE');
  c.patient.user_profile_id = 'existing-profile';
  await assert.rejects(() => c.service.issue('patient-1', 'new@example.com'), error => error.code === 'PORTAL_ACCOUNT_ACTIVE');
  assert.equal(c.messages.length, 0);
});

test('invitation expires after 24 hours and resend invalidates the prior token', async () => {
  const c = context();
  await c.service.issue('patient-1', 'walkin@example.com');
  const firstToken = c.messages.at(-1).token;
  await c.service.issue('patient-1', 'walkin@example.com');
  const secondToken = c.messages.at(-1).token;
  assert.notEqual(firstToken, secondToken);
  await assert.rejects(() => c.service.inspect(firstToken), error => error.code === 'INVALID_INVITATION');
  assert.equal((await c.service.inspect(secondToken)).status, 'active');
  c.advance(24 * 60 * 60 * 1000 + 1);
  await assert.rejects(() => c.service.inspect(secondToken), error => error.code === 'INVALID_INVITATION');
});

test('OTP is required, wrong codes are bounded, and no account links without verification', async () => {
  const c = context();
  await c.service.issue('patient-1', 'walkin@example.com');
  const token = c.messages[0].token;
  await assert.rejects(() => c.service.complete({ token, claimSession: 'unverified', password: 'PatientPassword1!' }), error => error.code === 'CLAIM_NOT_AVAILABLE');
  const otp = await c.service.sendCode(token);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(() => c.service.verifyCode({ token, otpSession: otp.otp_session, code: '654321' }), error => error.code === 'INVALID_CODE');
  }
  await assert.rejects(() => c.service.verifyCode({ token, otpSession: otp.otp_session, code: c.messages[1].code }), error => error.code === 'INVALID_CODE');
  assert.equal(c.patient.user_profile_id, null);
});

test('expired OTP and duplicate email at final claim fail safely', async () => {
  const expired = context();
  await expired.service.issue('patient-1', 'walkin@example.com');
  const expiredToken = expired.messages[0].token;
  const expiredOtp = await expired.service.sendCode(expiredToken);
  expired.advance(10 * 60 * 1000 + 1);
  await assert.rejects(() => expired.service.verifyCode({ token: expiredToken, otpSession: expiredOtp.otp_session, code: expired.messages[1].code }), error => error.code === 'INVALID_CODE');

  const duplicate = context();
  await duplicate.service.issue('patient-1', 'walkin@example.com');
  const token = duplicate.messages[0].token;
  const otp = await duplicate.service.sendCode(token);
  const verified = await duplicate.service.verifyCode({ token, otpSession: otp.otp_session, code: duplicate.messages[1].code });
  duplicate.setAccountEmail('walkin@example.com');
  await assert.rejects(() => duplicate.service.complete({ token, claimSession: verified.claim_session, password: 'PatientPassword1!' }), error => error.code === 'EMAIL_IN_USE');
  assert.equal(duplicate.patient.user_profile_id, null);
});

test('concurrent duplicate-key claim becomes a safe conflict without linking the wrong Patient', async () => {
  const c = context({ claimError: Object.assign(new Error('duplicate'), { code: 11000 }) });
  await c.service.issue('patient-1', 'walkin@example.com');
  const token = c.messages[0].token;
  const otp = await c.service.sendCode(token);
  const verified = await c.service.verifyCode({ token, otpSession: otp.otp_session, code: c.messages[1].code });
  await assert.rejects(() => c.service.complete({ token, claimSession: verified.claim_session, password: 'PatientPassword1!' }), error => error.code === 'CLAIM_NOT_AVAILABLE' && error.status === 409);
  assert.equal(c.patient.user_profile_id, null);
});

test('portal invitation email contains account setup only and no clinical information', () => {
  const serialized = JSON.stringify(portalInvitationTemplate({ claimUrl: 'https://portal.example/claim-account?token=safe-token' })).toLowerCase();
  assert.match(serialized, /claim-account/);
  for (const forbidden of ['diagnosis', 'prescription', 'certificate', 'pwd', 'queue', 'appointment reason', 'supporting document']) assert.equal(serialized.includes(forbidden), false);
});
