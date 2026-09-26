import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createAuthService } from '../src/services/authService.js';
import { passwordService } from '../src/services/passwordService.js';
import { createTokenService } from '../src/services/tokenService.js';

const TEST_SECRET = 'test-only-secret-with-enough-entropy-123456789';

function createMemoryRepository() {
  const accounts = new Map();
  const profiles = new Map();
  const patients = new Map();
  let sequence = 0;

  return {
    accounts,
    profiles,
    patients,
    async findAccountByEmail(email) {
      return accounts.get(email) ?? null;
    },
    async findSafeProfileById(id) {
      const profile = profiles.get(String(id));
      return profile ? { ...profile } : null;
    },
    async findUnlinkedPatientCandidate({ contact_number, dob }) {
      return (
        [...patients.values()].find(
          (patient) =>
            patient.user_profile_id == null &&
            patient.contact_number === contact_number &&
            new Date(patient.dob).getTime() === new Date(dob).getTime(),
        ) ?? null
      );
    },
    async createPatientRegistration(data) {
      if (accounts.has(data.email)) {
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      const id = `profile-${++sequence}`;
      const patientId = `patient-${sequence}`;
      const profile = {
        user_profile_id: id,
        display_name: data.display_name,
        role: 'patient',
        status: 'active',
      };
      const account = {
        user_profile_id: id,
        email: data.email,
        password_hash: data.password_hash,
      };
      const patient = {
        id: patientId,
        user_profile_id: id,
        full_name: data.full_name,
        contact_number: data.contact_number,
        dob: data.dob,
        sex: data.sex,
        address: data.address,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_number: data.emergency_contact_number,
        emergency_contact_relationship: data.emergency_contact_relationship,
        allergies: data.allergies,
        is_pwd: data.is_pwd,
      };
      accounts.set(data.email, account);
      profiles.set(id, profile);
      patients.set(patientId, patient);
      return { account: { ...account }, profile: { ...profile }, patient: { ...patient } };
    },
  };
}

function createTestContext(nodeEnv = 'test') {
  const repository = createMemoryRepository();
  const tokens = createTokenService(TEST_SECRET, nodeEnv);
  const service = createAuthService({ repository, passwords: passwordService, tokens });
  const app = createApp(
    { nodeEnv, authSecret: TEST_SECRET },
    { authModule: { service, tokens } },
  );
  return { app, repository };
}

async function withServer(app, check) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await check(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function request(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validRegistration = {
  email: 'patient@example.com',
  password: 'CorrectHorse123!',
  display_name: 'Alex Santos',
  contact_number: '09171234567',
  dob: '1990-01-15',
  sex: 'male',
  address: 'Quezon City',
  emergency_contact_name: 'Maria Santos',
  emergency_contact_number: '09170000000',
  emergency_contact_relationship: 'Parent',
  allergies: ['Penicillin'],
  is_pwd: false,
};

test('Patient registration creates linked safe account, profile, and Patient data', async () => {
  const { app, repository } = createTestContext();
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { ...validRegistration, email: 'PATIENT@EXAMPLE.COM' },
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.user.role, 'patient');
    assert.equal(body.user.status, 'active');
    assert.equal('password' in body, false);
    assert.equal('password_hash' in body.user, false);

    const account = repository.accounts.get('patient@example.com');
    const patient = [...repository.patients.values()][0];
    assert.ok(account);
    assert.equal(await bcrypt.compare(validRegistration.password, account.password_hash), true);
    assert.notEqual(account.password_hash, validRegistration.password);
    assert.equal(patient.user_profile_id, body.user.user_profile_id);
    assert.equal(patient.full_name, validRegistration.display_name);
    assert.equal('password' in patient, false);
    assert.equal('password_hash' in patient, false);
  });
});

test('duplicate email registration is rejected cleanly', async () => {
  const { app } = createTestContext();
  await withServer(app, async (baseUrl) => {
    const first = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: validRegistration,
    });
    assert.equal(first.status, 201);
    const duplicate = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: validRegistration,
    });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'EMAIL_ALREADY_REGISTERED');
  });
});

test('invalid registration data is rejected before persistence', async () => {
  const { app, repository } = createTestContext();
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { ...validRegistration, password: 'short', dob: 'not-a-date' },
    });
    assert.equal(response.status, 400);
    assert.equal(repository.accounts.size, 0);
  });
});

test('a known unlinked walk-in candidate is not silently duplicated', async () => {
  const { app, repository } = createTestContext();
  repository.patients.set('existing-walk-in', {
    id: 'existing-walk-in',
    user_profile_id: null,
    full_name: 'Alex Santos',
    contact_number: validRegistration.contact_number,
    dob: new Date(validRegistration.dob),
  });
  await withServer(app, async (baseUrl) => {
    const response = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: validRegistration,
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'PATIENT_LINK_REVIEW_REQUIRED');
    assert.equal(repository.patients.size, 1);
    assert.equal(repository.accounts.size, 0);
  });
});

for (const role of ['doctor', 'staff', 'admin']) {
  test(`public registration cannot create the ${role} role`, async () => {
    const { app, repository } = createTestContext();
    await withServer(app, async (baseUrl) => {
      const response = await request(baseUrl, '/api/auth/register', {
        method: 'POST',
        body: { ...validRegistration, email: `${role}@example.com`, role },
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'PUBLIC_ROLE_NOT_ALLOWED');
      assert.equal(repository.profiles.size, 0);
    });
  });
}

test('valid shared login returns a safe profile and establishes an HttpOnly cookie', async () => {
  const { app } = createTestContext();
  await withServer(app, async (baseUrl) => {
    await request(baseUrl, '/api/auth/register', { method: 'POST', body: validRegistration });
    const response = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: validRegistration.email, password: validRegistration.password },
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /^arion_auth=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Max-Age=28800/i);
    assert.match(cookie, /Path=\//i);
    assert.doesNotMatch(cookie, /;\s*Secure/i);
    const body = await response.json();
    assert.deepEqual(Object.keys(body.user).sort(), [
      'display_name',
      'role',
      'status',
      'user_profile_id',
    ]);
  });
});

test('wrong password and unknown email use the same generic login error', async () => {
  const { app } = createTestContext();
  await withServer(app, async (baseUrl) => {
    await request(baseUrl, '/api/auth/register', { method: 'POST', body: validRegistration });
    const attempts = [
      { email: validRegistration.email, password: 'WrongPassword123!' },
      { email: 'unknown@example.com', password: 'WrongPassword123!' },
    ];
    for (const body of attempts) {
      const response = await request(baseUrl, '/api/auth/login', { method: 'POST', body });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      assert.equal(response.headers.get('set-cookie'), null);
    }
  });
});

test('inactive account cannot log in or receive an authentication cookie', async () => {
  const { app, repository } = createTestContext();
  await withServer(app, async (baseUrl) => {
    const registration = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: validRegistration,
    });
    const { user } = await registration.json();
    const activeLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: validRegistration.email, password: validRegistration.password },
    });
    const existingCookie = activeLogin.headers.get('set-cookie').split(';')[0];
    repository.profiles.get(user.user_profile_id).status = 'inactive';
    const response = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: validRegistration.email, password: validRegistration.password },
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    const me = await request(baseUrl, '/api/auth/me', { cookie: existingCookie });
    assert.equal(me.status, 403);
    assert.equal((await me.json()).error.code, 'ACCOUNT_INACTIVE');
  });
});

test('/api/auth/me returns only the authenticated safe profile', async () => {
  const { app } = createTestContext();
  await withServer(app, async (baseUrl) => {
    await request(baseUrl, '/api/auth/register', { method: 'POST', body: validRegistration });
    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: validRegistration.email, password: validRegistration.password },
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const response = await request(baseUrl, '/api/auth/me', { cookie });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.role, 'patient');
    assert.equal('password_hash' in body.user, false);
  });
});

test('/api/auth/me returns 401 without a valid authentication cookie', async () => {
  const { app } = createTestContext();
  await withServer(app, async (baseUrl) => {
    for (const cookie of [undefined, 'arion_auth=invalid-token']) {
      const response = await request(baseUrl, '/api/auth/me', { cookie });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
    }
  });
});

test('logout clears authentication and the cleared cookie cannot access /me', async () => {
  const { app } = createTestContext();
  await withServer(app, async (baseUrl) => {
    await request(baseUrl, '/api/auth/register', { method: 'POST', body: validRegistration });
    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: validRegistration.email, password: validRegistration.password },
    });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const logout = await request(baseUrl, '/api/auth/logout', { method: 'POST', cookie });
    assert.equal(logout.status, 200);
    assert.deepEqual(await logout.json(), { success: true });
    const clearedCookie = logout.headers.get('set-cookie');
    assert.match(clearedCookie, /^arion_auth=;/);
    assert.match(clearedCookie, /HttpOnly/i);
    assert.match(clearedCookie, /SameSite=Lax/i);
    assert.match(clearedCookie, /Path=\//i);
    assert.match(clearedCookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
    assert.doesNotMatch(clearedCookie, /;\s*Secure/i);

    const me = await request(baseUrl, '/api/auth/me', {
      cookie: clearedCookie.split(';')[0],
    });
    assert.equal(me.status, 401);
  });
});

test('production authentication cookie and logout clearing both use Secure', async () => {
  const { app } = createTestContext('production');
  await withServer(app, async (baseUrl) => {
    await request(baseUrl, '/api/auth/register', { method: 'POST', body: validRegistration });
    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: validRegistration.email, password: validRegistration.password },
    });
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /;\s*Secure/i);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Max-Age=28800/i);
    const logout = await request(baseUrl, '/api/auth/logout', {
      method: 'POST',
      cookie: cookie.split(';')[0],
    });
    const cleared = logout.headers.get('set-cookie');
    assert.match(cleared, /;\s*Secure/i);
    assert.match(cleared, /SameSite=Lax/i);
    assert.match(cleared, /Path=\//i);
    assert.match(cleared, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  });
});
