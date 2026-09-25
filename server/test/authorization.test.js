import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { requirePermission, requireRole } from '../src/middleware/authorization.js';
import { PERMISSIONS } from '../src/services/authorizationPolicy.js';
import { createTokenService } from '../src/services/tokenService.js';

const TEST_SECRET = 'authorization-test-secret-12345678901234567890';

function createContext() {
  const profiles = new Map(
    ['patient', 'doctor', 'staff', 'admin'].map((role) => [
      `${role}-profile`,
      {
        user_profile_id: `${role}-profile`,
        display_name: `Test ${role}`,
        role,
        status: 'active',
        password_hash: 'must-never-leave-the-middleware',
      },
    ]),
  );
  profiles.set('inactive-profile', {
    user_profile_id: 'inactive-profile',
    display_name: 'Inactive Patient',
    role: 'patient',
    status: 'inactive',
  });
  profiles.set('unknown-role-profile', {
    user_profile_id: 'unknown-role-profile',
    display_name: 'Unknown Role',
    role: 'superadmin',
    status: 'active',
  });

  const tokens = createTokenService(TEST_SECRET);
  const service = {
    async getAuthenticatedUser(id) {
      const profile = profiles.get(String(id));
      if (!profile) throw Object.assign(new Error('Authentication is required.'), {
        status: 401,
        code: 'UNAUTHENTICATED',
      });
      return { ...profile };
    },
    async registerPatient() {
      throw new Error('not used');
    },
    async login() {
      throw new Error('not used');
    },
  };
  const app = createApp(
    {
      nodeEnv: 'test',
      authSecret: TEST_SECRET,
      enableAuthorizationProbes: true,
    },
    { authModule: { service, tokens } },
  );
  return {
    app,
    profiles,
    cookie(roleOrId) {
      const id = roleOrId.endsWith('-profile') ? roleOrId : `${roleOrId}-profile`;
      return `arion_auth=${tokens.sign(id)}`;
    },
  };
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

function get(baseUrl, path, cookie) {
  return fetch(`${baseUrl}${path}`, { headers: cookie ? { cookie } : {} });
}

test('unauthenticated protected request returns 401', async () => {
  const { app } = createContext();
  await withServer(app, async (baseUrl) => {
    const response = await get(baseUrl, '/api/authz-test/protected');
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'UNAUTHENTICATED');
  });
});

test('Patient can access Patient-only route and no other role route', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    assert.equal((await get(baseUrl, '/api/authz-test/role/patient', cookie('patient'))).status, 200);
    for (const role of ['doctor', 'staff', 'admin']) {
      const response = await get(baseUrl, `/api/authz-test/role/${role}`, cookie('patient'));
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'FORBIDDEN');
    }
  });
});

test('Doctor can access Doctor route but not Staff or Admin routes', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    assert.equal((await get(baseUrl, '/api/authz-test/role/doctor', cookie('doctor'))).status, 200);
    assert.equal((await get(baseUrl, '/api/authz-test/role/staff', cookie('doctor'))).status, 403);
    assert.equal((await get(baseUrl, '/api/authz-test/role/admin', cookie('doctor'))).status, 403);
  });
});

test('Staff can access Staff route but not Doctor or Admin routes', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    assert.equal((await get(baseUrl, '/api/authz-test/role/staff', cookie('staff'))).status, 200);
    assert.equal((await get(baseUrl, '/api/authz-test/role/doctor', cookie('staff'))).status, 403);
    assert.equal((await get(baseUrl, '/api/authz-test/role/admin', cookie('staff'))).status, 403);
  });
});

test('Admin can access account administration but is not a clinical superuser', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    assert.equal((await get(baseUrl, '/api/authz-test/role/admin', cookie('admin'))).status, 200);
    assert.equal(
      (await get(baseUrl, '/api/authz-test/permission/clinical-record-create', cookie('admin'))).status,
      403,
    );
    assert.equal(
      (await get(baseUrl, '/api/authz-test/permission/consultation-complete', cookie('admin'))).status,
      403,
    );
  });
});

test('only Doctor policy permits clinical creation and consultation completion', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    for (const permission of ['clinical-record-create', 'consultation-complete']) {
      assert.equal(
        (await get(baseUrl, `/api/authz-test/permission/${permission}`, cookie('doctor'))).status,
        200,
      );
      assert.equal(
        (await get(baseUrl, `/api/authz-test/permission/${permission}`, cookie('staff'))).status,
        403,
      );
    }
  });
});

test('inactive account is rejected with 403 even when its JWT remains valid', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    const response = await get(baseUrl, '/api/authz-test/role/patient', cookie('inactive-profile'));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'ACCOUNT_INACTIVE');
  });
});

test('role and permission middleware reject unknown policy configuration and roles', async () => {
  assert.throws(() => requireRole('superadmin'), /approved roles/);
  assert.throws(() => requirePermission('everything'), /approved permission/);

  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    const response = await get(
      baseUrl,
      '/api/authz-test/role/admin',
      cookie('unknown-role-profile'),
    );
    assert.equal(response.status, 403);
  });
});

test('ownership helper allows the owner and rejects another authenticated user', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    assert.equal(
      (await get(baseUrl, '/api/authz-test/ownership/patient-profile', cookie('patient'))).status,
      200,
    );
    const denied = await get(
      baseUrl,
      '/api/authz-test/ownership/another-profile',
      cookie('patient'),
    );
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error.code, 'FORBIDDEN');
  });
});

test('authorization context and /me expose only safe UserProfile fields', async () => {
  const { app, cookie } = createContext();
  await withServer(app, async (baseUrl) => {
    for (const path of ['/api/authz-test/protected', '/api/auth/me']) {
      const response = await get(baseUrl, path, cookie('doctor'));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(Object.keys(body.user).sort(), [
        'display_name',
        'role',
        'status',
        'user_profile_id',
      ]);
      assert.equal('password_hash' in body.user, false);
    }
  });
});
