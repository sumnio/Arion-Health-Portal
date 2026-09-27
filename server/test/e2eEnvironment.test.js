import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_E2E_DATABASE,
  deriveE2eMongoUri,
  getE2eRuntimeConfig,
  requireE2eMongoUri,
} from '../scripts/e2eEnvironment.js';

test('E2E configuration derives a dedicated database while preserving Mongo options', () => {
  const uri = deriveE2eMongoUri('mongodb://user:password@localhost:27017/arion_health?retryWrites=true');
  assert.equal(uri, `mongodb://user:password@localhost:27017/${DEFAULT_E2E_DATABASE}?retryWrites=true`);
});

test('E2E configuration refuses a database without an E2E marker', () => {
  assert.throws(
    () => requireE2eMongoUri('mongodb://localhost:27017/arion_health'),
    /dedicated database containing "e2e"/,
  );
});

test('E2E runtime keeps test-only security and local CORS configuration isolated', () => {
  const config = getE2eRuntimeConfig({
    E2E_MONGODB_URI: 'mongodb://localhost:27017/arion_health_e2e',
    E2E_BASE_URL: 'http://127.0.0.1:5173',
    E2E_API_URL: 'http://127.0.0.1:5000',
  });
  assert.equal(config.nodeEnv, 'test');
  assert.equal(config.port, 5000);
  assert.deepEqual(config.corsOrigins, ['http://127.0.0.1:5173']);
});
