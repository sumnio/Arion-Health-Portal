import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createApp } from '../src/app.js';

async function withServer(options, run) {
  const server = createServer(createApp(options));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

test('development responses include Helmet defaults without local HSTS or X-Powered-By', async () => {
  await withServer({ nodeEnv: 'development' }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(response.headers.get('strict-transport-security'), null);
    assert.equal(response.headers.get('x-powered-by'), null);
  });
});

test('production responses retain Helmet HSTS for HTTPS deployment', async () => {
  await withServer({ nodeEnv: 'production' }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.match(response.headers.get('strict-transport-security'), /^max-age=/);
  });
});

test('credentialed CORS remains enabled for the configured frontend origin', async () => {
  const origin = 'http://127.0.0.1:5173';
  await withServer({ corsOrigin: origin }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
});

test('credentialed CORS accepts each explicit trusted origin', async () => {
  const origins = ['http://127.0.0.1:5173', 'http://localhost:5173'];
  await withServer({ corsOrigins: origins }, async baseUrl => {
    for (const origin of origins) {
      const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    }
  });
});

test('untrusted browser origin is safely denied without exposing the allowlist', async () => {
  await withServer({ corsOrigins: ['http://127.0.0.1:5173'] }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://untrusted.example.test' },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const body = await response.json();
    assert.equal(body.error.code, 'CORS_DENIED');
    assert.doesNotMatch(JSON.stringify(body), /127\.0\.0\.1|localhost/);
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  });
});

test('requests without Origin remain available to API tools and health checks', async () => {
  await withServer({ corsOrigins: ['http://127.0.0.1:5173'] }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});

test('malformed JSON returns a safe 400 and the server remains available', async () => {
  await withServer({}, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body contains malformed JSON.',
      },
    });
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  });
});

test('JSON over 100 KB returns a safe 413 and the server remains available', async () => {
  await withServer({}, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(101 * 1024) }),
    });

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large.',
      },
    });
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  });
});
