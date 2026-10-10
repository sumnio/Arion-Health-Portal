import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createAuthModule } from '../src/services/authModule.js';
import { createAccountSecurityModule } from '../src/services/accountSecurityModule.js';
import { createEmailModule } from '../src/services/emailModule.js';
import { passwordService } from '../src/services/passwordService.js';

const authSecret = 'password-reset-test-auth-secret-long-enough';
const tokenSecret = 'password-reset-test-token-secret-long-enough';
const mfaKey = Buffer.alloc(32, 21).toString('base64');
const oldPassword = 'Old-password-123';
const newPassword = 'New-password-456';
const genericMessage =
  'If a Patient account exists for that email, password reset instructions have been sent.';

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function cookieOf(response, name = 'arion_password_reset') {
  return response.headers.getSetCookie().find(value => value.startsWith(`${name}=`))?.split(';')[0];
}

async function call(base, path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

function resetTokenFrom(delivery) {
  return new URL(delivery.text.match(/https?:\/\/[^\s]+\/reset-password\?token=[A-Za-z0-9_-]+/)[0])
    .searchParams.get('token');
}

async function context({ deliveryFails = false } = {}) {
  const accounts = new Map();
  const profiles = new Map();
  const resets = new Map();
  const challenges = new Map();
  let sequence = 0;

  async function seed(role, { status = 'active', verified = true } = {}) {
    const id = `${role}-profile-${++sequence}`;
    const account = {
      _id: `${role}-account-${sequence}`,
      user_profile_id: id,
      email: `${role}-${sequence}@example.invalid`,
      password_hash: await passwordService.hash(oldPassword),
      email_verification_required: role === 'patient' && !verified,
      email_verified_at: verified ? new Date() : null,
      auth_session_version: 0,
      mfa_enabled: role === 'admin',
    };
    const profile = {
      user_profile_id: id,
      display_name: `${role} ${sequence}`,
      role,
      status,
    };
    accounts.set(account.email, account);
    profiles.set(id, profile);
    return { account, profile };
  }

  const authRepository = {
    async findAccountByEmail(email) { return accounts.get(email) ?? null; },
    async findSafeProfileById(id) { return profiles.get(id) ?? null; },
    async findAuthenticationContextByProfileId(id) {
      const profile = profiles.get(id);
      const account = [...accounts.values()].find(item => item.user_profile_id === id);
      return profile && account
        ? { profile, sessionVersion: account.auth_session_version ?? 0 }
        : null;
    },
  };

  const securityRepository = {
    async replaceVerificationChallenge(data, now) {
      for (const item of challenges.values()) {
        if (item.account_id === data.account_id && !item.consumed_at && !item.invalidated_at) {
          item.invalidated_at = now;
        }
      }
      const item = { _id: `challenge-${++sequence}`, ...data, created_at: now };
      challenges.set(item._id, item);
      return item;
    },
    async findLatestVerificationChallengeForAccount(accountId) {
      return [...challenges.values()].reverse().find(
        item => item.account_id === accountId && !item.consumed_at,
      ) ?? null;
    },
    async rotateVerificationSession(id, hash) {
      const item = challenges.get(id);
      if (!item || item.consumed_at) return null;
      item.session_hash = hash;
      return item;
    },
    async replacePasswordResetToken(data, now) {
      for (const item of resets.values()) {
        if (item.account_id === data.account_id && !item.consumed_at && !item.invalidated_at) {
          item.invalidated_at = now;
        }
      }
      const item = { _id: `reset-${++sequence}`, ...data, created_at: now };
      resets.set(item._id, item);
      return item;
    },
    async findPasswordResetTokenByHash(hash) {
      return [...resets.values()].find(item => item.token_hash === hash) ?? null;
    },
    async findPasswordResetTokenBySessionHash(hash) {
      return [...resets.values()].find(item => item.session_hash === hash) ?? null;
    },
    async findPasswordResetAccount(accountId) {
      const account = [...accounts.values()].find(item => item._id === accountId);
      const profile = account ? profiles.get(account.user_profile_id) : null;
      return account && profile ? { ...account, role: profile.role, status: profile.status } : null;
    },
    async exchangePasswordResetToken(hash, sessionHash, sessionExpiresAt, now) {
      const item = [...resets.values()].find(entry => entry.token_hash === hash);
      if (!item || item.consumed_at || item.invalidated_at || item.expires_at <= now) return null;
      Object.assign(item, {
        consumed_at: now,
        session_hash: sessionHash,
        session_expires_at: sessionExpiresAt,
        session_consumed_at: null,
      });
      return item;
    },
    async invalidatePasswordResetToken(id, now) {
      const item = resets.get(id);
      if (item) item.invalidated_at = now;
    },
    async completePasswordReset(sessionHash, passwordHash, now) {
      const item = [...resets.values()].find(entry => entry.session_hash === sessionHash);
      const account = item
        ? [...accounts.values()].find(entry => entry._id === item.account_id)
        : null;
      const profile = account ? profiles.get(account.user_profile_id) : null;
      if (
        !item || !account || !profile || profile.role !== 'patient' || profile.status !== 'active' ||
        item.invalidated_at || item.session_consumed_at || item.session_expires_at <= now
      ) return null;
      item.session_consumed_at = now;
      account.password_hash = passwordHash;
      account.auth_session_version = (account.auth_session_version ?? 0) + 1;
      for (const other of resets.values()) {
        if (other._id !== item._id && other.account_id === account._id && !other.invalidated_at) {
          other.invalidated_at = now;
        }
      }
      return { account, reset: item };
    },
  };

  const security = createAccountSecurityModule({
    accountTokenHmacSecret: tokenSecret,
    nodeEnv: 'test',
    repository: securityRepository,
  });
  const mail = createEmailModule({
    emailProvider: 'fake',
    appBaseUrl: 'http://127.0.0.1:5173',
  });
  const emailModule = deliveryFails
    ? {
        provider: { name: 'fake', deliveries: [] },
        emailService: {
          async sendPasswordResetEmail() { throw new Error('hidden'); },
          async sendRegistrationVerificationEmail() { throw new Error('hidden'); },
        },
      }
    : mail;
  const authModule = createAuthModule({
    authSecret,
    mfaEncryptionKey: mfaKey,
    nodeEnv: 'test',
    repository: authRepository,
    accountSecurityModule: security,
    emailModule,
  });
  const pass = (_request, _response, next) => next();
  const app = createApp({ nodeEnv: 'test', authSecret }, {
    authModule,
    rateLimiters: {
      loginRateLimiter: pass,
      registerRateLimiter: pass,
      adminProvisionRateLimiter: pass,
      mfaVerifyRateLimiter: pass,
      verificationAttemptRateLimiter: pass,
      verificationResendRateLimiter: pass,
      forgotPasswordRateLimiter: pass,
      passwordResetRateLimiter: pass,
    },
  });
  return {
    accounts, profiles, resets, challenges,
    deliveries: emailModule.provider.deliveries,
    security,
    seed,
    app,
  };
}

test('forgot-password response is identical for Patient, unknown, other roles, and inactive Patient', async () => {
  const c = await context();
  const patient = await c.seed('patient');
  const inactive = await c.seed('patient', { status: 'inactive' });
  const staff = await c.seed('staff');
  const doctor = await c.seed('doctor');
  const admin = await c.seed('admin');
  await withServer(c.app, async base => {
    for (const email of [
      patient.account.email, 'unknown@example.invalid', staff.account.email,
      doctor.account.email, admin.account.email, inactive.account.email,
    ]) {
      const result = await call(base, '/api/auth/forgot-password', {
        method: 'POST', body: { email },
      });
      assert.equal(result.response.status, 200);
      assert.deepEqual(result.body, { message: genericMessage });
    }
    assert.equal(c.deliveries.length, 1);
    assert.equal(c.deliveries[0].to, patient.account.email);
  });
});

test('reset token is hash-only, newer requests supersede it, and exchange creates only an HttpOnly reset cookie', async () => {
  const c = await context();
  const patient = await c.seed('patient');
  await withServer(c.app, async base => {
    await call(base, '/api/auth/forgot-password', { method: 'POST', body: { email: patient.account.email } });
    const firstToken = resetTokenFrom(c.deliveries[0]);
    const firstRecord = [...c.resets.values()][0];
    assert.notEqual(firstRecord.token_hash, firstToken);
    assert.equal(JSON.stringify(firstRecord).includes(firstToken), false);

    await call(base, '/api/auth/forgot-password', { method: 'POST', body: { email: patient.account.email } });
    const secondToken = resetTokenFrom(c.deliveries[1]);
    const old = await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token: firstToken },
    });
    assert.equal(old.response.status, 400);
    const exchanged = await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token: secondToken },
    });
    assert.equal(exchanged.response.status, 200);
    assert.deepEqual(exchanged.body, { status: 'PASSWORD_RESET_SESSION_READY' });
    const setCookies = exchanged.response.headers.getSetCookie().join('; ');
    assert.match(setCookies, /arion_password_reset=/);
    assert.match(setCookies, /HttpOnly/i);
    assert.match(setCookies, /SameSite=Lax/i);
    assert.doesNotMatch(setCookies, /arion_auth=[^;]/);
  });
});

test('successful reset changes password, consumes session, preserves verification, and revokes old JWT', async () => {
  const c = await context();
  const patient = await c.seed('patient');
  await withServer(c.app, async base => {
    const oldLogin = await call(base, '/api/auth/login', {
      method: 'POST', body: { email: patient.account.email, password: oldPassword },
    });
    const oldAuthCookie = cookieOf(oldLogin.response, 'arion_auth');
    await call(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: patient.account.email },
    });
    const token = resetTokenFrom(c.deliveries[0]);
    const exchange = await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token },
    });
    const resetCookie = cookieOf(exchange.response);
    const status = await call(base, '/api/auth/password-reset/status', { cookie: resetCookie });
    assert.deepEqual(status.body, { status: 'PASSWORD_RESET_SESSION_READY' });
    const mismatch = await call(base, '/api/auth/reset-password', {
      method: 'POST', cookie: resetCookie,
      body: { password: newPassword, confirm_password: `${newPassword}x` },
    });
    assert.equal(mismatch.body.error.code, 'PASSWORDS_DO_NOT_MATCH');
    const reset = await call(base, '/api/auth/reset-password', {
      method: 'POST', cookie: resetCookie,
      body: { password: newPassword, confirm_password: newPassword },
    });
    assert.deepEqual(reset.body, { status: 'PASSWORD_RESET_COMPLETED' });
    assert.equal(await bcrypt.compare(newPassword, patient.account.password_hash), true);
    assert.equal(patient.account.email_verification_required, false);
    assert.equal(patient.account.auth_session_version, 1);
    assert.equal((await call(base, '/api/auth/me', { cookie: oldAuthCookie })).response.status, 401);
    assert.equal((await call(base, '/api/auth/login', {
      method: 'POST', body: { email: patient.account.email, password: oldPassword },
    })).response.status, 401);
    assert.equal((await call(base, '/api/auth/login', {
      method: 'POST', body: { email: patient.account.email, password: newPassword },
    })).response.status, 200);
    assert.equal((await call(base, '/api/auth/reset-password', {
      method: 'POST', cookie: resetCookie,
      body: { password: 'Another-pass-789', confirm_password: 'Another-pass-789' },
    })).response.status, 400);
  });
});

test('unverified Patient remains unverified after reset and login still requires email verification', async () => {
  const c = await context();
  const patient = await c.seed('patient', { verified: false });
  await c.security.service.createRegistrationVerificationChallenge(patient.account._id);
  await withServer(c.app, async base => {
    await call(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: patient.account.email },
    });
    const exchange = await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token: resetTokenFrom(c.deliveries[0]) },
    });
    await call(base, '/api/auth/reset-password', {
      method: 'POST', cookie: cookieOf(exchange.response),
      body: { password: newPassword, confirm_password: newPassword },
    });
    assert.equal(patient.account.email_verification_required, true);
    assert.equal(patient.account.email_verified_at, null);
    const login = await call(base, '/api/auth/login', {
      method: 'POST', body: { email: patient.account.email, password: newPassword },
    });
    assert.equal(login.body.status, 'EMAIL_VERIFICATION_REQUIRED');
    assert.doesNotMatch(login.response.headers.getSetCookie().join('; '), /arion_auth=[^;]/);
  });
});

test('malformed, expired, consumed, and post-exchange reused links are rejected generically', async () => {
  const c = await context();
  const patient = await c.seed('patient');
  await withServer(c.app, async base => {
    const malformed = await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token: 'bad' },
    });
    assert.equal(malformed.body.error.code, 'PASSWORD_RESET_INVALID');
    await call(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: patient.account.email },
    });
    const token = resetTokenFrom(c.deliveries[0]);
    [...c.resets.values()][0].expires_at = new Date(0);
    const expired = await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token },
    });
    assert.equal(expired.body.error.message, 'This password reset link is invalid or has expired.');

    await call(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: patient.account.email },
    });
    const fresh = resetTokenFrom(c.deliveries[1]);
    assert.equal((await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token: fresh },
    })).response.status, 200);
    assert.equal((await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token: fresh },
    })).response.status, 400);
  });
});

test('inactive Patient cannot finish an exchanged reset session', async () => {
  const c = await context();
  const patient = await c.seed('patient');
  await withServer(c.app, async base => {
    await call(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: patient.account.email },
    });
    const exchange = await call(base, '/api/auth/password-reset/session', {
      method: 'POST', body: { token: resetTokenFrom(c.deliveries[0]) },
    });
    patient.profile.status = 'inactive';
    const reset = await call(base, '/api/auth/reset-password', {
      method: 'POST', cookie: cookieOf(exchange.response),
      body: { password: newPassword, confirm_password: newPassword },
    });
    assert.equal(reset.response.status, 400);
    assert.equal(await bcrypt.compare(oldPassword, patient.account.password_hash), true);
    assert.equal(patient.profile.status, 'inactive');
  });
});

test('email provider failure stays enumeration-safe and invalidates the unusable token', async () => {
  const c = await context({ deliveryFails: true });
  const patient = await c.seed('patient');
  await withServer(c.app, async base => {
    const result = await call(base, '/api/auth/forgot-password', {
      method: 'POST', body: { email: patient.account.email },
    });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { message: genericMessage });
    assert.equal([...c.resets.values()][0].invalidated_at instanceof Date, true);
  });
});
