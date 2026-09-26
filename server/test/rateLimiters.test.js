import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createTokenService } from '../src/services/tokenService.js';
import { httpError } from '../src/utils/httpError.js';

const SECRET = 'rate-limit-test-secret-with-enough-entropy-123456';
const profiles = {
  patient: { user_profile_id: 'patient-profile', display_name: 'Patient', role: 'patient', status: 'active' },
  admin: { user_profile_id: 'admin-profile', display_name: 'Admin', role: 'admin', status: 'active' },
};

function authModule() {
  const tokens = createTokenService(SECRET);
  return {
    tokens,
    service: {
      async registerPatient(input) {
        return { ...profiles.patient, display_name: input.display_name };
      },
      async login({ email, password }) {
        if (email !== 'patient@example.test' || password !== 'CorrectPassword123!') {
          throw httpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
        }
        return { user: profiles.patient, token: tokens.sign(profiles.patient.user_profile_id) };
      },
      async getAuthenticatedUser(id) {
        const profile = Object.values(profiles).find((item) => item.user_profile_id === String(id));
        if (!profile) throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
        return profile;
      },
    },
  };
}

function adminAccountModule() {
  let sequence = 0;
  return {
    adminAccountService: {
      async createDoctor(body) { return { id: `doctor-${++sequence}`, ...body, status: 'active' }; },
      async createStaff(body) { return { id: `staff-${++sequence}`, ...body, status: 'active' }; },
    },
  };
}

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function request(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const registration = {
  email: 'new-patient@example.test',
  password: 'CorrectPassword123!',
  display_name: 'New Patient',
  contact_number: '09170000000',
  dob: '1990-01-01',
  sex: 'female',
};

test('login allows normal use, limits generic failures, recovers after its window, and leaves health and me available', async () => {
  const auth = authModule();
  const app = createApp(
    { authSecret: SECRET, loginRateLimitMax: 2, loginRateLimitWindowMs: 100 },
    { authModule: auth },
  );

  await withServer(app, async baseUrl => {
    const valid = await request(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: 'patient@example.test', password: 'CorrectPassword123!' },
    });
    assert.equal(valid.status, 200);
    const cookie = valid.headers.get('set-cookie').split(';')[0];

    const failures = [
      { email: 'patient@example.test', password: 'WrongPassword123!' },
      { email: 'unknown@example.test', password: 'WrongPassword123!' },
    ];
    const failureBodies = [];
    for (const body of failures) {
      const response = await request(baseUrl, '/api/auth/login', { method: 'POST', body });
      assert.equal(response.status, 401);
      failureBodies.push(await response.json());
    }
    assert.deepEqual(failureBodies[0], failureBodies[1]);

    const limited = await request(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: 'patient@example.test', password: 'CorrectPassword123!' },
    });
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), {
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
    assert.ok(limited.headers.get('retry-after'));
    assert.ok(limited.headers.get('ratelimit'));
    assert.equal((await request(baseUrl, '/api/auth/me', { cookie })).status, 200);
    assert.equal((await request(baseUrl, '/api/health')).status, 200);

    await new Promise(resolve => setTimeout(resolve, 125));
    assert.equal((await request(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: 'patient@example.test', password: 'CorrectPassword123!' },
    })).status, 200);
  });
});

test('registration works under its threshold and then returns the shared safe 429 response', async () => {
  const app = createApp(
    { authSecret: SECRET, registerRateLimitMax: 1, registerRateLimitWindowMs: 60_000 },
    { authModule: authModule() },
  );
  await withServer(app, async baseUrl => {
    assert.equal((await request(baseUrl, '/api/auth/register', { method: 'POST', body: registration })).status, 201);
    const limited = await request(baseUrl, '/api/auth/register', {
      method: 'POST', body: { ...registration, email: 'another@example.test' },
    });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
    assert.equal((await request(baseUrl, '/api/health')).status, 200);
  });
});

test('Admin provisioning limiter is shared across Doctor and Staff creation and runs after RBAC', async () => {
  const auth = authModule();
  const app = createApp(
    { authSecret: SECRET, adminProvisionRateLimitMax: 2, adminProvisionRateLimitWindowMs: 60_000 },
    { authModule: auth, adminAccountModule: adminAccountModule() },
  );
  const adminCookie = `arion_auth=${auth.tokens.sign(profiles.admin.user_profile_id)}`;
  const patientCookie = `arion_auth=${auth.tokens.sign(profiles.patient.user_profile_id)}`;

  await withServer(app, async baseUrl => {
    const wrongRole = await request(baseUrl, '/api/admin/doctors', {
      method: 'POST', cookie: patientCookie, body: { display_name: 'Forbidden' },
    });
    assert.equal(wrongRole.status, 403);

    const doctor = await request(baseUrl, '/api/admin/doctors', {
      method: 'POST', cookie: adminCookie, body: { display_name: 'Doctor' },
    });
    const staff = await request(baseUrl, '/api/admin/staff', {
      method: 'POST', cookie: adminCookie, body: { display_name: 'Staff' },
    });
    assert.equal(doctor.status, 201);
    assert.equal(staff.status, 201);

    const limited = await request(baseUrl, '/api/admin/doctors', {
      method: 'POST', cookie: adminCookie, body: { display_name: 'Another Doctor' },
    });
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), {
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    });
    assert.equal((await request(baseUrl, '/api/health')).status, 200);
  });
});
