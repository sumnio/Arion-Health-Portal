import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createAuthService } from '../src/services/authService.js';
import { createAccountSecurityService } from '../src/services/accountSecurityService.js';
import { createAccountTokenService } from '../src/services/accountTokenService.js';
import { createEmailModule } from '../src/services/emailModule.js';
import { passwordService } from '../src/services/passwordService.js';
import { createTokenService } from '../src/services/tokenService.js';

const AUTH_SECRET = 'email-verification-auth-test-secret';
const HMAC_SECRET = 'email-verification-hmac-test-secret';
const registration = {
  email: 'ivan.patient@example.com', password: 'CorrectHorse123!', display_name: 'Ivan Patient',
  contact_number: '09171234567', dob: '1995-02-01', sex: 'male', address: null,
  emergency_contact_name: null, emergency_contact_number: null,
  emergency_contact_relationship: null, allergies: [], is_pwd: false,
};

function context({ sendFailure = false } = {}) {
  let sequence = 0;
  const accounts = new Map();
  const profiles = new Map();
  const challenges = new Map();
  const deliveries = [];
  const authRepository = {
    async findAccountByEmail(email) { return accounts.get(email) ?? null; },
    async findSafeProfileById(id) { return profiles.get(String(id)) ?? null; },
    async findUnlinkedPatientCandidate() { return null; },
    async createPatientRegistration(data) {
      const id = `profile-${++sequence}`;
      const account = {
        _id: `account-${sequence}`, user_profile_id: id, email: data.email,
        password_hash: data.password_hash,
        email_verification_required: data.email_verification_required,
        email_verified_at: data.email_verified_at,
      };
      const profile = { user_profile_id: id, display_name: data.display_name, role: 'patient', status: 'active' };
      accounts.set(data.email, account); profiles.set(id, profile);
      return { account, profile, patient: { _id: `patient-${sequence}`, user_profile_id: id } };
    },
  };
  const securityRepository = {
    async replaceVerificationChallenge(data, now) {
      for (const item of challenges.values()) {
        if (item.account_id === data.account_id && !item.consumed_at && !item.invalidated_at) item.invalidated_at = now;
      }
      const item = { _id: `challenge-${++sequence}`, ...data };
      challenges.set(item._id, item); return item;
    },
    async findVerificationChallenge(id) { return challenges.get(id) ?? null; },
    async findVerificationChallengeBySessionHash(hash) {
      return [...challenges.values()].find(item => item.session_hash === hash) ?? null;
    },
    async findLatestVerificationChallengeForAccount(accountId) {
      return [...challenges.values()].reverse().find(item => item.account_id === accountId && !item.consumed_at) ?? null;
    },
    async rotateVerificationSession(id, hash) {
      const item = challenges.get(id); if (!item || item.consumed_at) return null;
      item.session_hash = hash; return item;
    },
    async findVerificationAccount(accountId) {
      const account = [...accounts.values()].find(item => item._id === accountId);
      const profile = account && profiles.get(account.user_profile_id);
      return account && profile ? { ...account, role: profile.role, status: profile.status } : null;
    },
    async recordFailedVerificationAttempt(id, now) {
      const item = challenges.get(id);
      if (!item || item.consumed_at || item.invalidated_at || item.expires_at <= now || item.attempt_count >= item.max_attempts) return null;
      item.attempt_count += 1; return item;
    },
    async completeEmailVerification(id, accountId, now) {
      const item = challenges.get(id);
      const account = [...accounts.values()].find(entry => entry._id === accountId);
      if (!item || !account || item.consumed_at || item.invalidated_at || item.expires_at <= now || item.attempt_count >= item.max_attempts) return null;
      item.consumed_at = now; account.email_verification_required = false; account.email_verified_at = now;
      return { challenge: item, account };
    },
    async invalidateVerificationChallenge(id, now) { const item = challenges.get(id); if (item) item.invalidated_at = now; },
  };
  const accountTokens = createAccountTokenService(HMAC_SECRET, 'test');
  const accountSecurity = createAccountSecurityService({ repository: securityRepository, tokens: accountTokens });
  const provider = {
    name: 'fake', deliveries,
    async send(message) { if (sendFailure) throw new Error('provider unavailable'); deliveries.push(message); return { delivered: true }; },
  };
  const { emailService } = createEmailModule({ appBaseUrl: 'http://127.0.0.1:5173' }, { capture: deliveries });
  const email = sendFailure ? { sendRegistrationVerificationEmail: input => provider.send(input) } : emailService;
  const tokens = createTokenService(AUTH_SECRET, 'test');
  const service = createAuthService({ repository: authRepository, passwords: passwordService, tokens, accountSecurity, email });
  const app = createApp({ nodeEnv: 'test', authSecret: AUTH_SECRET }, { authModule: { service, tokens } });
  return { app, accounts, profiles, challenges, deliveries };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function call(base, path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
}

function cookieOf(response) {
  const match = response.headers.get('set-cookie')?.match(/arion_email_verification=([^;,]+)/);
  return match ? `arion_email_verification=${match[1]}` : null;
}
function codeOf(delivery) { return delivery.text.match(/\b\d{6}\b/)[0]; }

test('new Patient registration starts a masked, cookie-bound verification flow without a full session', async () => {
  const c = context();
  await withServer(c.app, async base => {
    const created = await call(base, '/api/auth/register', { method: 'POST', body: registration });
    assert.equal(created.response.status, 201);
    assert.deepEqual(created.body, { status: 'EMAIL_VERIFICATION_REQUIRED', masked_email: 'iv**********@example.com' });
    assert.match(created.response.headers.get('set-cookie'), /arion_email_verification=/);
    assert.match(created.response.headers.get('set-cookie'), /arion_auth=;/);
    assert.equal(c.deliveries.length, 1);
    const account = c.accounts.get(registration.email);
    assert.equal(account.email_verification_required, true);
    assert.equal(account.email_verified_at, null);
    const challenge = [...c.challenges.values()][0];
    assert.notEqual(challenge.code_hash, codeOf(c.deliveries[0]));
    assert.equal(created.response.headers.get('set-cookie').includes(account._id), false);
    assert.equal(JSON.stringify(created.body).includes(registration.email), false);
  });
});

test('registration OTP verifies once, clears the pending cookie, and requires a normal login afterward', async () => {
  const c = context();
  await withServer(c.app, async base => {
    const created = await call(base, '/api/auth/register', { method: 'POST', body: registration });
    const verificationCookie = cookieOf(created.response);
    const status = await call(base, '/api/auth/verification-status', { cookie: verificationCookie });
    assert.equal(status.body.masked_email, 'iv**********@example.com');
    const wrong = await call(base, '/api/auth/verify-email', { method: 'POST', body: { code: '999999' }, cookie: verificationCookie });
    assert.equal(wrong.body.error.code, 'INVALID_VERIFICATION_CODE');
    const verified = await call(base, '/api/auth/verify-email', { method: 'POST', body: { code: codeOf(c.deliveries[0]) }, cookie: verificationCookie });
    assert.deepEqual(verified.body, { status: 'EMAIL_VERIFIED' });
    assert.match(verified.response.headers.get('set-cookie'), /arion_email_verification=;/);
    assert.equal(c.accounts.get(registration.email).email_verification_required, false);
    assert.ok(c.accounts.get(registration.email).email_verified_at);
    const login = await call(base, '/api/auth/login', { method: 'POST', body: { email: registration.email, password: registration.password } });
    assert.ok(login.body.user);
    assert.match(login.response.headers.get('set-cookie'), /^arion_auth=/);
  });
});

test('unverified login issues no auth session and resend invalidates the previous OTP', async () => {
  const c = context();
  await withServer(c.app, async base => {
    await call(base, '/api/auth/register', { method: 'POST', body: registration });
    const firstCode = codeOf(c.deliveries[0]);
    const login = await call(base, '/api/auth/login', { method: 'POST', body: { email: registration.email, password: registration.password } });
    assert.equal(login.body.status, 'EMAIL_VERIFICATION_REQUIRED');
    assert.match(login.response.headers.get('set-cookie'), /arion_auth=;/);
    const loginCookie = cookieOf(login.response);
    const resent = await call(base, '/api/auth/resend-verification', { method: 'POST', cookie: loginCookie });
    const secondCookie = cookieOf(resent.response);
    assert.equal(c.deliveries.length, 2);
    const oldAttempt = await call(base, '/api/auth/verify-email', { method: 'POST', body: { code: firstCode }, cookie: secondCookie });
    assert.notEqual(oldAttempt.response.status, 200);
    const newAttempt = await call(base, '/api/auth/verify-email', { method: 'POST', body: { code: codeOf(c.deliveries[1]) }, cookie: secondCookie });
    assert.equal(newAttempt.response.status, 200);
  });
});

test('legacy Patient accounts without a verification requirement still log in', async () => {
  const c = context();
  const hash = await passwordService.hash(registration.password);
  c.accounts.set(registration.email, { _id: 'legacy-account', user_profile_id: 'legacy-profile', email: registration.email, password_hash: hash, email_verification_required: false, email_verified_at: null });
  c.profiles.set('legacy-profile', { user_profile_id: 'legacy-profile', display_name: 'Legacy Patient', role: 'patient', status: 'active' });
  await withServer(c.app, async base => {
    const login = await call(base, '/api/auth/login', { method: 'POST', body: { email: registration.email, password: registration.password } });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.display_name, 'Legacy Patient');
  });
});

test('inactive Patient cannot finish verification and is never reactivated', async () => {
  const c = context();
  await withServer(c.app, async base => {
    const created = await call(base, '/api/auth/register', { method: 'POST', body: registration });
    const account = c.accounts.get(registration.email);
    c.profiles.get(account.user_profile_id).status = 'inactive';
    const attempt = await call(base, '/api/auth/verify-email', {
      method: 'POST', cookie: cookieOf(created.response), body: { code: codeOf(c.deliveries[0]) },
    });
    assert.equal(attempt.response.status, 403);
    assert.equal(attempt.body.error.code, 'ACCOUNT_INACTIVE');
    assert.equal(account.email_verification_required, true);
    assert.equal(c.profiles.get(account.user_profile_id).status, 'inactive');
  });
});

test('email provider failure is controlled and never returns an OTP or internal identifier', async () => {
  const c = context({ sendFailure: true });
  await withServer(c.app, async base => {
    const created = await call(base, '/api/auth/register', { method: 'POST', body: registration });
    assert.equal(created.response.status, 503);
    assert.equal(created.body.error.code, 'EMAIL_DELIVERY_UNAVAILABLE');
    assert.equal(JSON.stringify(created.body).includes('account-'), false);
    assert.equal(JSON.stringify(created.body).match(/\b\d{6}\b/), null);
  });
});
