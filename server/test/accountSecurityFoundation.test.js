import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createAccountSecurityService } from '../src/services/accountSecurityService.js';
import { createAccountTokenService, PASSWORD_RESET_TOKEN_BYTES } from '../src/services/accountTokenService.js';
import { createEmailModule } from '../src/services/emailModule.js';
import { EmailDeliveryError } from '../src/services/emailService.js';

const HMAC_SECRET = 'account-token-test-secret-separated-from-auth';
const ACCOUNT_ID = '650000000000000000000001';

function memoryRepository() {
  let sequence = 0;
  const challenges = new Map();
  const resetTokens = new Map();
  return {
    challenges,
    resetTokens,
    async replaceVerificationChallenge(data, now) {
      for (const item of challenges.values()) {
        if (item.account_id === data.account_id && item.purpose === data.purpose && !item.consumed_at && !item.invalidated_at) item.invalidated_at = now;
      }
      const item = { _id: `challenge-${++sequence}`, ...data };
      challenges.set(item._id, item);
      return item;
    },
    async findVerificationChallenge(id) { return challenges.get(id) ?? null; },
    async recordFailedVerificationAttempt(id, now) {
      const item = challenges.get(id);
      if (!item || item.consumed_at || item.invalidated_at || item.expires_at <= now || item.attempt_count >= item.max_attempts) return null;
      item.attempt_count += 1;
      return item;
    },
    async consumeVerificationChallenge(id, now) {
      const item = challenges.get(id);
      if (!item || item.consumed_at || item.invalidated_at || item.expires_at <= now || item.attempt_count >= item.max_attempts) return null;
      item.consumed_at = now;
      return item;
    },
    async replacePasswordResetToken(data, now) {
      for (const item of resetTokens.values()) {
        if (item.account_id === data.account_id && !item.consumed_at && !item.invalidated_at) item.invalidated_at = now;
      }
      const item = { _id: `reset-${++sequence}`, ...data };
      resetTokens.set(item.token_hash, item);
      return item;
    },
    async findPasswordResetTokenByHash(hash) { return resetTokens.get(hash) ?? null; },
    async consumePasswordResetToken(hash, now) {
      const item = resetTokens.get(hash);
      if (!item || item.consumed_at || item.invalidated_at || item.expires_at <= now) return null;
      item.consumed_at = now;
      return item;
    },
  };
}

function foundation({ randomInteger, clock } = {}) {
  const repository = memoryRepository();
  const tokens = createAccountTokenService(HMAC_SECRET, 'test', {
    ...(randomInteger ? { randomInteger } : {}),
  });
  return { repository, tokens, service: createAccountSecurityService({ repository, tokens, clock }) };
}

test('trusted email service builds fixed registration and reset templates with a fake provider', async () => {
  const capture = [];
  const { emailService, provider } = createEmailModule(
    { emailProvider: 'fake', appBaseUrl: 'https://portal.example.test' },
    { capture },
  );
  await emailService.sendRegistrationVerificationEmail({ to: 'patient@example.test', code: '012345' });
  await emailService.sendPasswordResetEmail({ to: 'patient@example.test', token: 'private-token' });
  assert.equal(provider.name, 'fake');
  assert.equal(capture.length, 2);
  assert.equal(capture[0].type, 'registration_verification');
  assert.equal(capture[0].subject, 'Verify your Arion Health Portal account');
  assert.match(capture[0].text, /012345/);
  assert.equal(capture[1].type, 'password_reset');
  assert.match(capture[1].text, /https:\/\/portal\.example\.test\/reset-password\?token=private-token/);
});

test('Resend integration is isolated and provider failures become a controlled error', async () => {
  const requests = [];
  const success = createEmailModule(
    { emailProvider: 'resend', resendApiKey: 'private-api-key', emailFrom: 'Arion <noreply@example.test>', appBaseUrl: 'https://portal.example.test' },
    { fetchImpl: async (url, options) => { requests.push({ url, options }); return { ok: true, async json() { return { id: 'email-1' }; } }; } },
  );
  const delivered = await success.emailService.sendRegistrationVerificationEmail({ to: 'patient@example.test', code: '123456' });
  assert.equal(delivered.messageId, 'email-1');
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].options.body).subject, 'Verify your Arion Health Portal account');

  const failure = createEmailModule(
    { emailProvider: 'resend', resendApiKey: 'private-api-key', emailFrom: 'noreply@example.test', appBaseUrl: 'https://portal.example.test' },
    { fetchImpl: async () => ({ ok: false }) },
  );
  await assert.rejects(
    failure.emailService.sendPasswordResetEmail({ to: 'patient@example.test', token: 'secret-reset-token' }),
    error => error instanceof EmailDeliveryError && error.code === 'EMAIL_DELIVERY_FAILED' && !error.message.includes('secret-reset-token'),
  );
});

test('no arbitrary email-sending endpoint is exposed', async () => {
  const app = createApp({ nodeEnv: 'test', authSecret: 'test-secret' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/email/send`, { method: 'POST' });
    assert.equal(response.status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('verification codes are six digits, preserve leading zeroes, and use keyed hashes', () => {
  const leadingZero = createAccountTokenService(HMAC_SECRET, 'test', { randomInteger: () => 1234 });
  assert.equal(leadingZero.generateVerificationCode(), '001234');
  const tokens = createAccountTokenService(HMAC_SECRET, 'test');
  for (let index = 0; index < 20; index += 1) assert.match(tokens.generateVerificationCode(), /^\d{6}$/);
  const hash = tokens.hashVerificationCode(ACCOUNT_ID, 'registration_verification', '001234');
  assert.equal(hash, tokens.hashVerificationCode(ACCOUNT_ID, 'registration_verification', '001234'));
  assert.equal(tokens.verifyVerificationCode(ACCOUNT_ID, 'registration_verification', '001234', hash), true);
  assert.equal(tokens.verifyVerificationCode(ACCOUNT_ID, 'registration_verification', '001235', hash), false);
  assert.notEqual(hash, '001234');
});

test('verification challenges store only hashes, expire, count failures, consume once, and replace prior challenges', async () => {
  let now = new Date('2026-10-10T00:00:00.000Z');
  const c = foundation({ randomInteger: () => 1234, clock: () => new Date(now) });
  const first = await c.service.createRegistrationVerificationChallenge(ACCOUNT_ID);
  assert.equal('code' in first.challenge, false);
  assert.notEqual(first.challenge.code_hash, first.code);
  const second = await c.service.createRegistrationVerificationChallenge(ACCOUNT_ID, { resendCount: 1 });
  assert.ok(first.challenge.invalidated_at);
  assert.equal((await c.service.verifyRegistrationCode({ challengeId: first.challenge._id, accountId: ACCOUNT_ID, code: first.code })).reason, 'invalidated');

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const failed = await c.service.verifyRegistrationCode({ challengeId: second.challenge._id, accountId: ACCOUNT_ID, code: '999999' });
    assert.equal(failed.reason, 'invalid');
  }
  assert.equal((await c.service.verifyRegistrationCode({ challengeId: second.challenge._id, accountId: ACCOUNT_ID, code: '999999' })).reason, 'attempts_exhausted');
  assert.equal((await c.service.verifyRegistrationCode({ challengeId: second.challenge._id, accountId: ACCOUNT_ID, code: second.code })).reason, 'attempts_exhausted');

  const third = await c.service.createRegistrationVerificationChallenge(ACCOUNT_ID, { resendCount: 2 });
  assert.equal((await c.service.verifyRegistrationCode({ challengeId: third.challenge._id, accountId: ACCOUNT_ID, code: third.code })).valid, true);
  assert.equal((await c.service.verifyRegistrationCode({ challengeId: third.challenge._id, accountId: ACCOUNT_ID, code: third.code })).reason, 'consumed');

  const expired = await c.service.createRegistrationVerificationChallenge(ACCOUNT_ID);
  now = new Date(expired.challenge.expires_at.getTime() + 1);
  assert.equal((await c.service.verifyRegistrationCode({ challengeId: expired.challenge._id, accountId: ACCOUNT_ID, code: expired.code })).reason, 'expired');
});

test('password-reset tokens are high entropy, hash-only, expiring, replaceable, and single-use', async () => {
  let now = new Date('2026-10-10T00:00:00.000Z');
  const c = foundation({ clock: () => new Date(now) });
  const first = await c.service.issuePasswordResetToken(ACCOUNT_ID);
  assert.ok(first.token.length >= 43);
  assert.match(first.token, /^[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(first.token, 'base64url').length, PASSWORD_RESET_TOKEN_BYTES);
  assert.equal('token' in first.record, false);
  assert.notEqual(first.record.token_hash, first.token);
  assert.equal((await c.service.inspectPasswordResetToken(first.token)).valid, true);
  assert.equal((await c.service.inspectPasswordResetToken('wrong-token')).reason, 'invalid');

  const replacement = await c.service.issuePasswordResetToken(ACCOUNT_ID);
  assert.ok(first.record.invalidated_at);
  assert.equal((await c.service.inspectPasswordResetToken(first.token)).reason, 'invalidated');
  assert.equal((await c.service.consumePasswordResetToken(replacement.token)).valid, true);
  assert.equal((await c.service.consumePasswordResetToken(replacement.token)).reason, 'consumed');

  const expired = await c.service.issuePasswordResetToken(ACCOUNT_ID);
  now = new Date(expired.record.expires_at.getTime() + 1);
  assert.equal((await c.service.inspectPasswordResetToken(expired.token)).reason, 'expired');
});
