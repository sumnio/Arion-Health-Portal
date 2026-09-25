import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import { AuthAccount, Patient, UserProfile } from '../src/models/index.js';
import { requireAuthSecret } from '../src/services/tokenService.js';

const config = loadConfig();
const marker = randomUUID().replaceAll('-', '');
const email = `auth-validation-${marker}@example.invalid`;
let server;
let profileId;
let patientId;

async function api(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  requireAuthSecret(config.authSecret);
  await connectDatabase(config.mongoUri);
  await AuthAccount.init();
  const authIndexNames = new Set(
    (await AuthAccount.collection.indexes()).map((index) => index.name),
  );
  assert.ok(authIndexNames.has('unique_auth_account_email'));
  assert.ok(authIndexNames.has('unique_auth_account_profile'));
  const app = createApp(config);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const password = `Test-${marker.slice(0, 18)}!`;
  const health = await api(baseUrl, '/api/health');
  assert.equal(health.status, 200);
  const registration = await api(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      display_name: 'Disposable Auth Validation Patient',
      contact_number: `09${Date.now().toString().slice(-9)}`,
      dob: '1990-01-15',
      sex: 'other',
      is_pwd: false,
    },
  });
  assert.equal(registration.status, 201);
  const registrationBody = await registration.json();
  profileId = registrationBody.user.user_profile_id;

  const account = await AuthAccount.findOne({ email }).select('+password_hash').lean();
  assert.ok(account);
  assert.equal(await bcrypt.compare(password, account.password_hash), true);
  assert.notEqual(account.password_hash, password);
  const patient = await Patient.findOne({ user_profile_id: profileId }).lean();
  assert.ok(patient);
  patientId = patient._id;

  const login = await api(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(cookie, /^arion_auth=/);

  const me = await api(baseUrl, '/api/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.user_profile_id, profileId);

  const logout = await api(baseUrl, '/api/auth/logout', { method: 'POST', cookie });
  assert.equal(logout.status, 200);
  const clearedCookie = logout.headers.get('set-cookie').split(';')[0];
  const afterLogout = await api(baseUrl, '/api/auth/me', { cookie: clearedCookie });
  assert.equal(afterLogout.status, 401);

  console.info(
    JSON.stringify({
      registration: 201,
      health: 200,
      passwordHashed: true,
      authIndexes: true,
      login: 200,
      me: 200,
      logout: 200,
      afterLogout: 401,
      cleanup: 'pending',
    }),
  );
}

try {
  await main();
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (profileId) {
    await AuthAccount.deleteOne({ user_profile_id: profileId });
    await Patient.deleteOne({ _id: patientId, user_profile_id: profileId });
    await UserProfile.deleteOne({ _id: profileId });
  } else {
    await AuthAccount.deleteOne({ email });
  }
  await disconnectDatabase();
  console.info(JSON.stringify({ cleanup: 'complete' }));
}
