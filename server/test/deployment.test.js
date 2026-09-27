import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import {
  connectDatabase,
  createConnectionCache,
} from '../src/config/database.js';
import vercelHandler, { createVercelHandler } from '../src/vercel.js';

function mongooseStub(connectImplementation) {
  const connection = { readyState: 0 };
  let calls = 0;
  return {
    connection,
    get calls() { return calls; },
    connect(uri) {
      calls += 1;
      return connectImplementation({ uri, connection, calls });
    },
    async disconnect() { connection.readyState = 0; },
  };
}

test('Vercel adapter exports a request handler and never starts a listener', () => {
  assert.equal(typeof vercelHandler, 'function');
  const adapterSource = readFileSync(new URL('../src/vercel.js', import.meta.url), 'utf8');
  assert.doesNotMatch(adapterSource, /\.listen\s*\(/);
  assert.doesNotMatch(adapterSource, /SIGINT|SIGTERM/);

  const localSource = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(localSource, /server\.listen\s*\(/);
  assert.match(localSource, /SIGINT/);
  assert.match(localSource, /SIGTERM/);
});

test('Vercel handler initializes once per warm instance and retries failed initialization', async () => {
  let connects = 0;
  let creates = 0;
  let fail = true;
  const handler = createVercelHandler({
    environment: {},
    load: () => ({ mongoUri: 'mongodb://example/arion' }),
    validate: config => config,
    connect: async () => {
      connects += 1;
      if (fail) { fail = false; throw new Error('temporary connection failure'); }
    },
    create: () => {
      creates += 1;
      return (_request, response) => response.end('ok');
    },
  });
  await assert.rejects(handler({}, { end() {} }), /temporary connection failure/);
  let body;
  await handler({}, { end(value) { body = value; } });
  await handler({}, { end(value) { body = value; } });
  assert.equal(body, 'ok');
  assert.equal(connects, 2);
  assert.equal(creates, 1);
});

test('first MongoDB connection is cached and a ready connection is reused', async () => {
  const cache = createConnectionCache();
  const driver = mongooseStub(async ({ connection }) => {
    connection.readyState = 1;
  });
  const options = { mongooseInstance: driver, connectionCache: cache, logger() {} };
  const first = await connectDatabase('mongodb://example/arion', options);
  const second = await connectDatabase('mongodb://example/arion', options);
  assert.equal(first, driver.connection);
  assert.equal(second, driver.connection);
  assert.equal(driver.calls, 1);
});

test('concurrent MongoDB connections reuse the same in-flight promise', async () => {
  const cache = createConnectionCache();
  let finish;
  const driver = mongooseStub(({ connection }) => new Promise(resolve => {
    finish = () => { connection.readyState = 1; resolve(); };
  }));
  const options = { mongooseInstance: driver, connectionCache: cache, logger() {} };
  const first = connectDatabase('mongodb://example/arion', options);
  const second = connectDatabase('mongodb://example/arion', options);
  assert.equal(first, second);
  assert.equal(driver.calls, 1);
  finish();
  assert.equal(await first, driver.connection);
});

test('failed MongoDB connection clears the cache and permits a clean retry', async () => {
  const cache = createConnectionCache();
  const driver = mongooseStub(async ({ connection, calls }) => {
    if (calls === 1) throw new Error('connection failed');
    connection.readyState = 1;
  });
  const options = { mongooseInstance: driver, connectionCache: cache, logger() {} };
  await assert.rejects(connectDatabase('mongodb://example/arion', options), /connection failed/);
  assert.equal(cache.promise, null);
  assert.equal(cache.connection, null);
  assert.equal(await connectDatabase('mongodb://example/arion', options), driver.connection);
  assert.equal(driver.calls, 2);
});

test('production trusts exactly one proxy hop and non-production keeps Express default', () => {
  const production = createApp({
    nodeEnv: 'production',
    corsOrigins: ['https://portal.example.test'],
  });
  assert.equal(production.get('trust proxy'), 1);
  assert.equal(createApp().get('trust proxy'), false);
  assert.notEqual(production.get('trust proxy'), true);
});
