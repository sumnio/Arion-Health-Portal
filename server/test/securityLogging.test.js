import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createSecurityLogger } from '../src/services/securityLogger.js';
import { createTokenService } from '../src/services/tokenService.js';
import { httpError } from '../src/utils/httpError.js';
import { validateAdminListQuery } from '../src/validation/adminAccountValidation.js';

const SECRET = 'security-logging-test-secret-with-enough-entropy';
const profiles = {
  patient: { user_profile_id: 'patient-profile', display_name: 'Patient', role: 'patient', status: 'active' },
  staff: { user_profile_id: 'staff-profile', display_name: 'Staff', role: 'staff', status: 'active' },
  admin: { user_profile_id: 'admin-profile', display_name: 'Admin', role: 'admin', status: 'active' },
};

function captureLogger() {
  const events = [];
  return { events, logger: createSecurityLogger({ write: event => events.push(event) }) };
}

function authModule() {
  const tokens = createTokenService(SECRET, 'test');
  return {
    tokens,
    service: {
      async registerPatient() { return profiles.patient; },
      async login({ email, password }) {
        if (email !== 'patient@example.test' || password !== 'CorrectPassword123!') {
          throw httpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
        }
        return { user: profiles.patient, token: tokens.sign(profiles.patient.user_profile_id) };
      },
      async getAuthenticatedUser(id) {
        const profile = Object.values(profiles).find(item => item.user_profile_id === String(id));
        if (!profile) throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
        return profile;
      },
    },
  };
}

function adminAccountModule() {
  return {
    adminAccountService: {
      async createDoctor() { return { id: 'doctor-target', status: 'active' }; },
      async createStaff() { return { id: 'staff-target', status: 'active' }; },
      async listDoctors(query) { validateAdminListQuery(query); return { items: [], total: 0, page: 1, page_size: 5, page_count: 1 }; },
      async deactivateDoctor(id) { return { id, status: 'inactive' }; },
      async reactivateDoctor(id) { return { id, status: 'active' }; },
      async deactivateStaff(id) { return { id, status: 'inactive' }; },
      async reactivateStaff(id) { return { id, status: 'active' }; },
      async deactivatePatient(id) { return { id, account_status: 'inactive' }; },
      async reactivatePatient(id) { return { id, account_status: 'active' }; },
    },
  };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function request(base, path, { method = 'GET', cookie, body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function context(config = {}) {
  const auth = authModule();
  const capture = captureLogger();
  const app = createApp(
    { nodeEnv: 'test', authSecret: SECRET, enableAuthorizationProbes: true, ...config },
    { authModule: auth, adminAccountModule: adminAccountModule(), securityLogger: capture.logger },
  );
  return { ...capture, app, auth, cookie: role => `arion_auth=${auth.tokens.sign(profiles[role].user_profile_id, { mfaVerified: role === 'admin' })}` };
}

test('successful and failed login emit safe structured authentication events', async () => {
  const c = context();
  await withServer(c.app, async base => {
    const password = 'CorrectPassword123!';
    assert.equal((await request(base, '/api/auth/login', { method: 'POST', body: { email: 'patient@example.test', password } })).status, 200);
    assert.equal((await request(base, '/api/auth/login', { method: 'POST', body: { email: 'patient@example.test', password: 'WrongPassword123!' } })).status, 401);
    const success = c.events.find(item => item.event === 'AUTH_LOGIN_SUCCESS');
    const failure = c.events.find(item => item.event === 'AUTH_LOGIN_FAILURE');
    assert.equal(success.actor_user_profile_id, profiles.patient.user_profile_id);
    assert.equal(success.actor_role, 'patient');
    assert.equal(failure.outcome, 'denied');
    const output = JSON.stringify(c.events);
    assert.doesNotMatch(output, /CorrectPassword123|WrongPassword123|arion_auth|eyJ/);
    assert.doesNotMatch(output, /patient@example\.test/);
  });
});

test('rate limiting logs its stable event and limiter type', async () => {
  const c = context({ loginRateLimitMax: 1, loginRateLimitWindowMs: 60_000 });
  await withServer(c.app, async base => {
    const body = { email: 'patient@example.test', password: 'WrongPassword123!' };
    assert.equal((await request(base, '/api/auth/login', { method: 'POST', body })).status, 401);
    assert.equal((await request(base, '/api/auth/login', { method: 'POST', body })).status, 429);
    const event = c.events.find(item => item.event === 'RATE_LIMIT_TRIGGERED');
    assert.equal(event.metadata.limiter_type, 'login');
    assert.equal(event.route, '/api/auth/login');
    assert.ok(event.ip);
  });
});

test('role, permission, inactive-account, and ownership denials emit focused events', async () => {
  const c = context();
  await withServer(c.app, async base => {
    assert.equal((await request(base, '/api/authz-test/role/admin', { cookie: c.cookie('patient') })).status, 403);
    assert.equal((await request(base, '/api/authz-test/permission/clinical-record-create', { cookie: c.cookie('staff') })).status, 403);
    assert.equal((await request(base, '/api/authz-test/ownership/another-profile', { cookie: c.cookie('patient') })).status, 403);
    const ownership = c.events.find(item => item.event === 'AUTHZ_OWNERSHIP_DENIED');
    assert.equal(ownership.target_id, 'another-profile');
    assert.ok(c.events.filter(item => item.event === 'AUTHZ_FORBIDDEN').length >= 2);
    assert.doesNotMatch(JSON.stringify(c.events), /diagnosis|prescription|doctor notes|medical narrative/i);
  });
});

test('Admin provisioning and lifecycle actions emit actor and target events', async () => {
  const c = context();
  await withServer(c.app, async base => {
    const cookie = c.cookie('admin');
    const body = { display_name: 'Disposable', password: 'Temporary123!' };
    assert.equal((await request(base, '/api/admin/doctors', { method: 'POST', cookie, body })).status, 201);
    assert.equal((await request(base, '/api/admin/staff', { method: 'POST', cookie, body })).status, 201);
    assert.equal((await request(base, '/api/admin/doctors/doctor-target/deactivate', { method: 'PATCH', cookie, body: {} })).status, 200);
    assert.equal((await request(base, '/api/admin/doctors/doctor-target/reactivate', { method: 'PATCH', cookie, body: {} })).status, 200);
    assert.ok(c.events.some(item => item.event === 'ADMIN_DOCTOR_CREATED' && item.target_id === 'doctor-target'));
    assert.ok(c.events.some(item => item.event === 'ADMIN_STAFF_CREATED' && item.target_id === 'staff-target'));
    assert.ok(c.events.some(item => item.event === 'ACCOUNT_DEACTIVATED'));
    assert.ok(c.events.some(item => item.event === 'ACCOUNT_REACTIVATED'));
    assert.ok(c.events.filter(item => item.event.startsWith('ADMIN_') || item.event.startsWith('ACCOUNT_')).every(item => item.actor_role === 'admin'));
    assert.doesNotMatch(JSON.stringify(c.events), /Temporary123/);
  });
});

test('security-relevant protected fields and operator queries are logged without values', async () => {
  const c = context();
  await withServer(c.app, async base => {
    assert.equal((await request(base, '/api/auth/login', { method: 'POST', body: { email: 'patient@example.test', password: 'WrongPassword123!', role: 'admin' } })).status, 400);
    assert.equal((await request(base, '/api/admin/doctors?search[$ne]=private-value', { cookie: c.cookie('admin') })).status, 400);
    const rejected = c.events.filter(item => item.event === 'SECURITY_INPUT_REJECTED');
    assert.equal(rejected.length, 2);
    assert.doesNotMatch(JSON.stringify(rejected), /private-value|WrongPassword123|patient@example\.test/);
  });
});

test('logger redacts dangerous metadata recursively and logger failure cannot break requests', async () => {
  const captured = [];
  const logger = createSecurityLogger({ write: event => captured.push(event) });
  logger.logSecurityEvent({
    event: 'TEST', metadata: {
      password: 'plain', token: 'jwt-value', email: 'private@example.test',
      nested: { mongodb_uri: 'mongodb://credential', diagnosis_summary: 'private' }, safe: 'ok',
    },
  });
  const output = JSON.stringify(captured);
  assert.doesNotMatch(output, /plain|jwt-value|mongodb:\/\/credential|private/);
  assert.match(output, /\[REDACTED\]/);
  assert.equal(captured[0].metadata.safe, 'ok');

  const throwingLogger = createSecurityLogger({ write() { throw new Error('sink unavailable'); } });
  assert.doesNotThrow(() => throwingLogger.logSecurityEvent({ event: 'TEST' }));
  const auth = authModule();
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule: auth, securityLogger: throwingLogger });
  await withServer(app, async base => assert.equal((await request(base, '/api/health')).status, 200));
});
