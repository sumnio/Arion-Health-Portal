import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requireMongoUri } from '../src/config/database.js';
import { loadConfig } from '../src/config/env.js';
import { requireAuthSecret } from '../src/services/tokenService.js';

async function withServer(app, check) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const { port } = server.address();
    await check(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('Express app initializes and health endpoint returns expected JSON', async () => {
  await withServer(createApp(), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'arion-health-api' });
  });
});

test('unknown API routes return a clean JSON 404', async () => {
  await withServer(createApp(), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});

test('authorization probe routes are disabled during normal application operation', async () => {
  await withServer(createApp(), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/authz-test/protected`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'NOT_FOUND');
  });
});

test('central error middleware hides unexpected implementation details', async () => {
  const app = express();
  app.get('/error', () => { throw new Error('private detail'); });
  app.use(errorHandler);
  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/error`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected server error occurred.' } });
  });
});

test('MongoDB configuration fails clearly when the URI is missing', () => {
  assert.throws(() => requireMongoUri(''), /MONGODB_URI is required/);
  assert.equal(requireMongoUri(' mongodb://localhost:27017/arion_test '), 'mongodb://localhost:27017/arion_test');
});

test('authentication configuration requires a signing secret', () => {
  assert.throws(() => requireAuthSecret(''), /AUTH_SECRET is required/);
  assert.equal(requireAuthSecret(' test-secret '), 'test-secret');
});

test('unconfigured clinic location never falls back to fake clinic data', () => {
  const config = loadConfig({});
  assert.equal(config.clinicLocation, 'Clinic location not configured');
  assert.doesNotMatch(config.clinicLocation, /mock|wellness avenue/i);
});

test('rate-limit configuration has safe defaults and validates positive integers', () => {
  const defaults = loadConfig({});
  assert.equal(defaults.loginRateLimitWindowMs, 900_000);
  assert.equal(defaults.loginRateLimitMax, 10);
  assert.equal(defaults.registerRateLimitWindowMs, 3_600_000);
  assert.equal(defaults.registerRateLimitMax, 5);
  assert.equal(defaults.adminProvisionRateLimitWindowMs, 900_000);
  assert.equal(defaults.adminProvisionRateLimitMax, 20);

  const configured = loadConfig({
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: '1000',
    AUTH_LOGIN_RATE_LIMIT_MAX: '2',
    AUTH_REGISTER_RATE_LIMIT_WINDOW_MS: '2000',
    AUTH_REGISTER_RATE_LIMIT_MAX: '3',
    ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS: '3000',
    ADMIN_PROVISION_RATE_LIMIT_MAX: '4',
  });
  assert.equal(configured.loginRateLimitMax, 2);
  assert.equal(configured.registerRateLimitMax, 3);
  assert.equal(configured.adminProvisionRateLimitMax, 4);
  assert.throws(() => loadConfig({ AUTH_LOGIN_RATE_LIMIT_MAX: '0' }), /positive integer/);
});
