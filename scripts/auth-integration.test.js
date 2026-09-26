import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ApiError, createApiClient, RATE_LIMIT_MESSAGE } from '../src/services/apiClient.js';
import { createAuthService } from '../src/services/authService.js';
import { getProtectedRouteDecision, getRoleDashboard } from '../src/auth/authRouting.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('API client uses the configured base URL, JSON, and credentialed requests', async () => {
  let called;
  const client = createApiClient({
    baseUrl: 'http://api.example.test',
    fetchImpl: async (...args) => {
      called = args;
      return jsonResponse({ success: true });
    },
  });
  await client.request('/api/example', { method: 'POST', body: { value: 1 } });
  assert.equal(called[0], 'http://api.example.test/api/example');
  assert.equal(called[1].credentials, 'include');
  assert.equal(called[1].headers['Content-Type'], 'application/json');
  assert.equal(called[1].body, '{"value":1}');
});

test('API client produces a safe network error', async () => {
  const client = createApiClient({ fetchImpl: async () => { throw new Error('socket internals'); } });
  await assert.rejects(client.request('/api/auth/me'), (error) => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.message, 'Unable to connect to the server. Please try again.');
    return true;
  });
});

test('API client replaces login and registration 429 details with a safe retry message', async () => {
  const client = createApiClient({
    fetchImpl: async () => jsonResponse({ error: { code: 'RATE_LIMITED', message: 'internal limiter detail' } }, 429),
  });
  for (const path of ['/api/auth/login', '/api/auth/register']) {
    await assert.rejects(client.request(path, { method: 'POST', body: {} }), (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.message, RATE_LIMIT_MESSAGE);
      return true;
    });
  }
});

test('login uses the real endpoint and returns the safe backend user', async () => {
  let request;
  const service = createAuthService({
    async request(path, options) {
      request = { path, options };
      return { user: { role: 'patient', status: 'active' } };
    },
  });
  const result = await service.login({ email: 'patient@example.com', password: 'secret' });
  assert.equal(request.path, '/api/auth/login');
  assert.deepEqual(request.options.body, { email: 'patient@example.com', password: 'secret' });
  assert.equal(result.user.role, 'patient');
});

test('Admin MFA client uses credentialed challenge endpoints without browser token storage', async () => {
  const calls = [];
  const service = createAuthService({
    async request(path, options) {
      calls.push({ path, options });
      if (path.endsWith('/setup')) return { otpauth_uri: 'otpauth://totp/example', manual_key: 'SETUPKEY' };
      return { user: { role: 'admin', status: 'active' } };
    },
  });
  assert.equal((await service.startMfaSetup()).manual_key, 'SETUPKEY');
  assert.equal((await service.verifyMfaSetup('123456')).user.role, 'admin');
  assert.equal((await service.verifyMfa('654321')).user.role, 'admin');
  assert.deepEqual(calls.map(item => item.path), [
    '/api/auth/mfa/setup', '/api/auth/mfa/verify-setup', '/api/auth/mfa/verify',
  ]);
  assert.equal(calls[1].options.body.code, '123456');
  assert.equal(calls[2].options.body.code, '654321');
});

test('login replaces backend credential details with the approved generic error', async () => {
  const service = createAuthService({
    async request() { throw new ApiError('internal detail', { status: 401, code: 'INVALID_CREDENTIALS' }); },
  });
  await assert.rejects(service.login({ email: 'x@y.com', password: 'bad' }), /Invalid email or password/);
});

test('Patient registration uses the backend and cannot send role or confirmation password', async () => {
  let request;
  const service = createAuthService({
    async request(path, options) {
      request = { path, options };
      return { user: { role: 'patient' } };
    },
  });
  await service.registerPatient({
    display_name: 'Alex Santos', email: 'alex@example.com', password: 'Password123!',
    confirmPassword: 'Password123!', role: 'admin', contact_number: '09170000000',
    dob: '1990-01-01', sex: 'male',
  });
  assert.equal(request.path, '/api/auth/register');
  assert.equal(request.options.body.role, undefined);
  assert.equal(request.options.body.confirmPassword, undefined);
  assert.equal(request.options.body.full_name, 'Alex Santos');
  assert.deepEqual(request.options.body.allergies, []);
  assert.equal(request.options.body.is_pwd, false);
});

test('session restore and logout use the real backend endpoints', async () => {
  const paths = [];
  const service = createAuthService({
    async request(path) { paths.push(path); return path.endsWith('/me') ? { user: { role: 'doctor' } } : { success: true }; },
  });
  assert.equal((await service.getCurrentUser()).role, 'doctor');
  await service.logout();
  assert.deepEqual(paths, ['/api/auth/me', '/api/auth/logout']);
});

test('all approved roles redirect to their own dashboard', () => {
  assert.equal(getRoleDashboard('patient'), '/patient/dashboard');
  assert.equal(getRoleDashboard('doctor'), '/doctor/dashboard');
  assert.equal(getRoleDashboard('staff'), '/staff/dashboard');
  assert.equal(getRoleDashboard('admin'), '/admin/dashboard');
});

test('protected route decisions distinguish guests, wrong roles, inactive accounts, and allowed users', () => {
  assert.equal(getProtectedRouteDecision(null, 'patient'), 'login');
  assert.equal(getProtectedRouteDecision({ role: 'doctor', status: 'active' }, 'patient'), 'unauthorized');
  assert.equal(getProtectedRouteDecision({ role: 'patient', status: 'inactive' }, 'patient'), 'unauthorized');
  assert.equal(getProtectedRouteDecision({ role: 'patient', status: 'active' }, 'patient'), 'allow');
});

test('frontend auth code does not store tokens or retain the mock role selector', () => {
  const authFiles = [
    '../src/services/apiClient.js', '../src/services/authService.js', '../src/auth/AuthContext.jsx',
    '../src/pages/public/LoginPage.jsx', '../src/pages/public/RegisterPage.jsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(authFiles, /localStorage|sessionStorage/);
  assert.doesNotMatch(readFileSync(new URL('../src/pages/public/LoginPage.jsx', import.meta.url), 'utf8'), /Preview role|name="role"/);
  assert.match(authFiles, /credentials: 'include'/);
  assert.match(authFiles, /MFA_SETUP_REQUIRED/);
  assert.match(authFiles, /MFA_REQUIRED/);
});

test('router wraps every protected role group in the real role guard', () => {
  const source = readFileSync(new URL('../src/app/AppRouter.jsx', import.meta.url), 'utf8');
  assert.match(source, /ProtectedRoute role=\{role\}/);
  assert.match(source, /GuestOnlyRoute/);
});
