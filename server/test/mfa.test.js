import assert from 'node:assert/strict';
import test from 'node:test';
import { generate } from 'otplib';
import { createApp } from '../src/app.js';
import { createAuthModule } from '../src/services/authModule.js';
import { passwordService } from '../src/services/passwordService.js';
import { createSecurityLogger } from '../src/services/securityLogger.js';

const SECRET = 'mfa-test-auth-secret-with-enough-entropy-123456';
const MFA_KEY = Buffer.alloc(32, 11).toString('base64');
const ADMIN_PASSWORD = 'AdminPassword123!';

function memoryRepository() {
  const profiles = new Map();
  const accounts = new Map();
  return {
    profiles,
    accounts,
    async findAccountByEmail(email) { return accounts.get(email) ?? null; },
    async findSafeProfileById(id) { return profiles.get(String(id)) ?? null; },
    async findAccountForMfa(id) {
      return [...accounts.values()].find(item => item.user_profile_id === String(id)) ?? null;
    },
    async setMfaChallenge(id, { challengeHash, expiresAt }) {
      const account = [...accounts.values()].find(item => item.user_profile_id === String(id));
      if (!account) return false;
      account.mfa_challenge_hash = challengeHash;
      account.mfa_challenge_expires_at = expiresAt;
      return true;
    },
    async setPendingMfaSecret(id, hash, encrypted, now) {
      const account = await this.findAccountForMfa(id);
      if (!account || account.mfa_enabled || account.mfa_challenge_hash !== hash || account.mfa_challenge_expires_at <= now) return false;
      account.mfa_pending_secret_encrypted = encrypted;
      return true;
    },
    async completeMfaEnrollment(id, hash, pending, enrolledAt) {
      const account = await this.findAccountForMfa(id);
      if (!account || account.mfa_enabled || account.mfa_challenge_hash !== hash || account.mfa_pending_secret_encrypted !== pending || account.mfa_challenge_expires_at <= enrolledAt) return false;
      account.mfa_enabled = true;
      account.mfa_secret_encrypted = pending;
      account.mfa_pending_secret_encrypted = null;
      account.mfa_enrolled_at = enrolledAt;
      account.mfa_challenge_hash = null;
      account.mfa_challenge_expires_at = null;
      return true;
    },
    async consumeMfaChallenge(id, hash, now) {
      const account = await this.findAccountForMfa(id);
      if (!account || !account.mfa_enabled || account.mfa_challenge_hash !== hash || account.mfa_challenge_expires_at <= now) return false;
      account.mfa_challenge_hash = null;
      account.mfa_challenge_expires_at = null;
      return true;
    },
  };
}

async function context(config = {}) {
  const repository = memoryRepository();
  const profile = {
    user_profile_id: 'admin-profile', display_name: 'MFA Admin', role: 'admin', status: 'active',
  };
  repository.profiles.set(profile.user_profile_id, profile);
  repository.accounts.set('admin@example.test', {
    user_profile_id: profile.user_profile_id,
    email: 'admin@example.test',
    password_hash: await passwordService.hash(ADMIN_PASSWORD),
    mfa_enabled: false,
    mfa_secret_encrypted: null,
    mfa_pending_secret_encrypted: null,
    mfa_enrolled_at: null,
    mfa_challenge_hash: null,
    mfa_challenge_expires_at: null,
  });
  const events = [];
  const authModule = createAuthModule({
    authSecret: SECRET, mfaEncryptionKey: MFA_KEY, nodeEnv: 'test', repository,
  });
  const app = createApp(
    {
      nodeEnv: 'test', authSecret: SECRET, mfaEncryptionKey: MFA_KEY,
      mfaVerifyRateLimitMax: 5, mfaVerifyRateLimitWindowMs: 60_000, ...config,
    },
    { authModule, securityLogger: createSecurityLogger({ write: event => events.push(event) }) },
  );
  return { app, repository, events };
}

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function request(base, path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function cookie(response, name) {
  const values = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')];
  const value = values.find(item => item?.startsWith(`${name}=`));
  return value?.split(';')[0] ?? '';
}

async function passwordLogin(base) {
  return request(base, '/api/auth/login', {
    method: 'POST', body: { email: 'admin@example.test', password: ADMIN_PASSWORD },
  });
}

test('Admin first login requires setup and issues no full session until TOTP enrollment succeeds', async () => {
  const { app, repository, events } = await context();
  await withServer(app, async base => {
    const login = await passwordLogin(base);
    assert.equal(login.status, 200);
    assert.equal((await login.json()).status, 'MFA_SETUP_REQUIRED');
    const challenge = cookie(login, 'arion_mfa_challenge');
    assert.ok(challenge);
    assert.equal(cookie(login, 'arion_auth'), 'arion_auth=');
    assert.equal((await request(base, '/api/auth/me', { cookie: challenge })).status, 401);

    const setup = await request(base, '/api/auth/mfa/setup', { method: 'POST', cookie: challenge });
    assert.equal(setup.status, 200);
    const enrollment = await setup.json();
    assert.match(enrollment.otpauth_uri, /^otpauth:\/\/totp\//);
    assert.ok(enrollment.manual_key);

    const code = await generate({ secret: enrollment.manual_key });
    const verified = await request(base, '/api/auth/mfa/verify-setup', {
      method: 'POST', cookie: challenge, body: { code },
    });
    assert.equal(verified.status, 200);
    const session = cookie(verified, 'arion_auth');
    assert.ok(session);
    assert.equal((await verified.json()).user.role, 'admin');
    assert.equal((await request(base, '/api/auth/me', { cookie: session })).status, 200);

    const account = repository.accounts.get('admin@example.test');
    assert.equal(account.mfa_enabled, true);
    assert.ok(account.mfa_enrolled_at);
    assert.notEqual(account.mfa_secret_encrypted, enrollment.manual_key);
    assert.equal(account.mfa_pending_secret_encrypted, null);
    assert.equal(account.mfa_challenge_hash, null);

    const replay = await request(base, '/api/auth/mfa/verify-setup', {
      method: 'POST', cookie: challenge, body: { code },
    });
    assert.equal(replay.status, 401);
    assert.equal((await replay.json()).error.code, 'MFA_CHALLENGE_INVALID');
    assert.ok(events.some(item => item.event === 'MFA_SETUP_STARTED'));
    assert.ok(events.some(item => item.event === 'MFA_SETUP_COMPLETED'));
    assert.doesNotMatch(JSON.stringify(events), new RegExp(enrollment.manual_key));
    assert.doesNotMatch(JSON.stringify(events), new RegExp(code));
  });
});

test('enrolled Admin login requires a fresh valid TOTP challenge', async () => {
  const { app } = await context();
  await withServer(app, async base => {
    const firstLogin = await passwordLogin(base);
    const firstChallenge = cookie(firstLogin, 'arion_mfa_challenge');
    const setup = await (await request(base, '/api/auth/mfa/setup', { method: 'POST', cookie: firstChallenge })).json();
    const setupCode = await generate({ secret: setup.manual_key });
    assert.equal((await request(base, '/api/auth/mfa/verify-setup', {
      method: 'POST', cookie: firstChallenge, body: { code: setupCode },
    })).status, 200);

    const login = await passwordLogin(base);
    assert.equal((await login.json()).status, 'MFA_REQUIRED');
    const challenge = cookie(login, 'arion_mfa_challenge');
    const code = await generate({ secret: setup.manual_key });
    const verified = await request(base, '/api/auth/mfa/verify', {
      method: 'POST', cookie: challenge, body: { code },
    });
    assert.equal(verified.status, 200);
    assert.ok(cookie(verified, 'arion_auth'));
    assert.equal((await request(base, '/api/auth/mfa/verify', {
      method: 'POST', cookie: challenge, body: { code },
    })).status, 401);
  });
});

test('MFA validation is strict and repeated failed codes are rate limited', async () => {
  const { app, events } = await context();
  await withServer(app, async base => {
    const login = await passwordLogin(base);
    const challenge = cookie(login, 'arion_mfa_challenge');
    await request(base, '/api/auth/mfa/setup', { method: 'POST', cookie: challenge });
    const malformed = await request(base, '/api/auth/mfa/verify-setup', {
      method: 'POST', cookie: challenge, body: { code: '12ab' },
    });
    assert.equal(malformed.status, 400);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await request(base, '/api/auth/mfa/verify-setup', {
        method: 'POST', cookie: challenge, body: { code: '000000' },
      });
      assert.equal(failed.status, 401);
    }
    const limited = await request(base, '/api/auth/mfa/verify-setup', {
      method: 'POST', cookie: challenge, body: { code: '000000' },
    });
    assert.equal(limited.status, 429);
    assert.ok(events.some(item => item.event === 'MFA_RATE_LIMITED'));
  });
});

test('expired challenges and pre-MFA Admin session tokens cannot authorize access', async () => {
  const { app, repository } = await context();
  await withServer(app, async base => {
    const login = await passwordLogin(base);
    const challenge = cookie(login, 'arion_mfa_challenge');
    repository.accounts.get('admin@example.test').mfa_challenge_expires_at = new Date(Date.now() - 1000);
    const expired = await request(base, '/api/auth/mfa/setup', { method: 'POST', cookie: challenge });
    assert.equal(expired.status, 401);
    assert.equal((await expired.json()).error.code, 'MFA_CHALLENGE_INVALID');

    const authModule = createAuthModule({
      authSecret: SECRET, mfaEncryptionKey: MFA_KEY, nodeEnv: 'test', repository,
    });
    const legacyAdminCookie = `arion_auth=${authModule.tokens.sign('admin-profile')}`;
    assert.equal((await request(base, '/api/auth/me', { cookie: legacyAdminCookie })).status, 401);
  });
});
