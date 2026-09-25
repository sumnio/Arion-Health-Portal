import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requireMongoUri } from '../src/config/database.js';

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
