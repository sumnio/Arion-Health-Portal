import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createTokenService } from '../src/services/tokenService.js';

const SECRET = 'security-regression-secret-12345678901234567890';
const RESOURCE_ID = '507f1f77bcf86cd799439011';

function context() {
  const profiles = new Map(
    ['patient', 'doctor', 'staff', 'admin'].map((role) => [
      `${role}-profile`,
      {
        user_profile_id: `${role}-profile`,
        display_name: `Security ${role}`,
        role,
        status: 'active',
      },
    ]),
  );
  const tokens = createTokenService(SECRET, 'test');
  const service = {
    async getAuthenticatedUser(id) {
      const profile = profiles.get(String(id));
      if (!profile) {
        throw Object.assign(new Error('Authentication is required.'), {
          status: 401,
          code: 'UNAUTHENTICATED',
        });
      }
      return { ...profile };
    },
  };
  const authModule = { service, tokens };
  return {
    app: createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule }),
    cookie(role, { mfaVerified = role === 'admin' } = {}) {
      return `arion_auth=${tokens.sign(`${role}-profile`, { mfaVerified })}`;
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
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function attack(baseUrl, path, cookie, method = 'GET') {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { cookie, ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }) },
    ...(method === 'GET' ? {} : { body: '{}' }),
  });
  return { response, body: await response.json() };
}

test('concrete cross-role API attack matrix is denied before feature services run', async () => {
  const { app, cookie } = context();
  const attempts = [
    ['patient', '/api/doctor/availability', 'POST'],
    ['patient', '/api/staff/patients?search=patient', 'GET'],
    ['patient', '/api/admin/doctors', 'GET'],
    ['doctor', '/api/staff/patients?search=patient', 'GET'],
    ['doctor', '/api/admin/staff', 'GET'],
    ['staff', `/api/doctor/appointments/${RESOURCE_ID}/medical-record`, 'POST'],
    ['staff', '/api/admin/doctors', 'GET'],
    ['admin', `/api/doctor/appointments/${RESOURCE_ID}/medical-record`, 'POST'],
    ['admin', `/api/doctor/appointments/${RESOURCE_ID}/complete`, 'PATCH'],
    ['admin', `/api/staff/appointments/${RESOURCE_ID}/check-in`, 'PATCH'],
  ];

  await withServer(app, async (baseUrl) => {
    for (const [role, path, method] of attempts) {
      const { response, body } = await attack(baseUrl, path, cookie(role), method);
      assert.equal(response.status, 403, `${role} ${method} ${path}`);
      assert.equal(body.error.code, 'FORBIDDEN');
      assert.doesNotMatch(JSON.stringify(body), /stack|mongoose|mongodb|password|secret/i);
    }
  });
});

test('Admin API rejects missing, invalid, and pre-MFA sessions without leaking internals', async () => {
  const { app, cookie } = context();
  await withServer(app, async (baseUrl) => {
    const cases = [undefined, 'arion_auth=invalid.jwt.value', cookie('admin', { mfaVerified: false })];
    for (const session of cases) {
      const response = await fetch(`${baseUrl}/api/admin/doctors`, {
        headers: session ? { cookie: session } : {},
      });
      assert.equal(response.status, 401);
      const body = await response.json();
      assert.deepEqual(body, {
        error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      });
    }
  });
});
