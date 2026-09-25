import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import {
  AuthAccount,
  Doctor,
  Patient,
  Staff,
  UserProfile,
} from '../src/models/index.js';
import { requireAuthSecret } from '../src/services/tokenService.js';

const config = loadConfig();
const marker = randomUUID().replaceAll('-', '');
const roles = ['patient', 'doctor', 'staff', 'admin'];
const profileIds = [];
let server;

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
  const password = `Authz-${marker.slice(0, 18)}!`;
  const passwordHash = await bcrypt.hash(password, 12);
  const credentials = new Map();

  for (const role of roles) {
    const profile = await UserProfile.create({
      display_name: `Disposable ${role} authorization account`,
      role,
      contact_number: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      status: 'active',
    });
    profileIds.push(profile._id);
    const email = `authz-${role}-${marker}@example.invalid`;
    await AuthAccount.create({
      user_profile_id: profile._id,
      email,
      password_hash: passwordHash,
    });
    credentials.set(role, { email, password, profileId: String(profile._id) });

    if (role === 'patient') {
      await Patient.create({
        user_profile_id: profile._id,
        full_name: 'Disposable Authorization Patient',
        contact_number: profile.contact_number,
        dob: new Date('1990-01-15'),
        sex: 'other',
      });
    } else if (role === 'doctor') {
      await Doctor.create({
        user_profile_id: profile._id,
        specialty: 'Validation',
        license_number: `LIC-${marker}`,
        ptr_number: `PTR-${marker}`,
      });
    } else if (role === 'staff') {
      await Staff.create({ user_profile_id: profile._id });
    }
  }

  const app = createApp({ ...config, enableAuthorizationProbes: true });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const health = await api(baseUrl, '/api/health');
  assert.equal(health.status, 200);

  const cookies = new Map();
  for (const role of roles) {
    const login = await api(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: credentials.get(role),
    });
    assert.equal(login.status, 200);
    cookies.set(role, login.headers.get('set-cookie').split(';')[0]);
    const allowed = await api(baseUrl, `/api/authz-test/role/${role}`, {
      cookie: cookies.get(role),
    });
    assert.equal(allowed.status, 200);
  }

  assert.equal(
    (await api(baseUrl, '/api/authz-test/role/doctor', { cookie: cookies.get('patient') })).status,
    403,
  );
  assert.equal(
    (
      await api(baseUrl, '/api/authz-test/permission/consultation-complete', {
        cookie: cookies.get('doctor'),
      })
    ).status,
    200,
  );
  for (const role of ['staff', 'admin']) {
    assert.equal(
      (
        await api(baseUrl, '/api/authz-test/permission/consultation-complete', {
          cookie: cookies.get(role),
        })
      ).status,
      403,
    );
  }

  const patientProfileId = credentials.get('patient').profileId;
  await UserProfile.updateOne({ _id: patientProfileId }, { status: 'inactive' });
  assert.equal(
    (
      await api(baseUrl, '/api/authz-test/role/patient', {
        cookie: cookies.get('patient'),
      })
    ).status,
    403,
  );
  await UserProfile.updateOne({ _id: patientProfileId }, { status: 'active' });
  assert.equal(
    (
      await api(baseUrl, '/api/authz-test/role/patient', {
        cookie: cookies.get('patient'),
      })
    ).status,
    200,
  );

  console.info(
    JSON.stringify({
      mongoConnected: true,
      health: 200,
      rolesAuthenticated: roles,
      roleIsolation: true,
      doctorCompletionPolicy: true,
      staffCompletionDenied: true,
      adminClinicalEditDenied: true,
      inactiveCookieDenied: true,
      reactivationRestoredAccess: true,
      cleanup: 'pending',
    }),
  );
}

try {
  await main();
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (profileIds.length) {
    await AuthAccount.deleteMany({ user_profile_id: { $in: profileIds } });
    await Patient.deleteMany({ user_profile_id: { $in: profileIds } });
    await Doctor.deleteMany({ user_profile_id: { $in: profileIds } });
    await Staff.deleteMany({ user_profile_id: { $in: profileIds } });
    await UserProfile.deleteMany({ _id: { $in: profileIds } });
  }
  await disconnectDatabase();
  console.info(JSON.stringify({ cleanup: 'complete' }));
}
