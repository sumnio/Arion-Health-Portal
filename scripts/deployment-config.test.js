import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApiClient } from '../src/services/apiClient.js';
import { resolveApiBaseUrl } from '../src/config/apiConfig.js';

test('API base supports explicit localhost and intentional same-origin empty values', () => {
  assert.equal(resolveApiBaseUrl('http://127.0.0.1:5000/'), 'http://127.0.0.1:5000');
  assert.equal(resolveApiBaseUrl(''), '');
  assert.equal(resolveApiBaseUrl(undefined, { isProduction: true }), '');
  assert.equal(resolveApiBaseUrl(undefined, { isProduction: false }), 'http://127.0.0.1:5000');
});

test('Vite mode defaults keep development local and production same-origin', () => {
  const development = readFileSync(new URL('../.env.development', import.meta.url), 'utf8');
  const production = readFileSync(new URL('../.env.production', import.meta.url), 'utf8');
  assert.match(development, /^VITE_API_BASE_URL=http:\/\/127\.0\.0\.1:5000$/m);
  assert.match(production, /^VITE_API_BASE_URL=$/m);
});

test('same-origin API client retains one canonical api prefix', async () => {
  let requestedUrl;
  const client = createApiClient({
    baseUrl: '',
    fetchImpl: async url => {
      requestedUrl = url;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.request('/api/auth/login');
  assert.equal(requestedUrl, '/api/auth/login');
  assert.doesNotMatch(requestedUrl, /\/api\/api\//);
});

test('Vercel Services route API requests before the frontend SPA fallback', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.services.frontend.root, '.');
  assert.equal(config.services.frontend.framework, 'vite');
  assert.equal(config.services.frontend.outputDirectory, 'dist');
  assert.equal(config.services.backend.root, 'server');
  assert.equal(config.services.backend.framework, 'express');
  assert.equal(config.services.backend.entrypoint, 'src/vercel.js');
  assert.equal(config.rewrites[0].source, '/api/(.*)');
  assert.equal(config.rewrites[0].destination.service, 'backend');
  assert.equal(config.rewrites[1].destination.service, 'frontend');
  assert.deepEqual(config.services.frontend.rewrites, [
    { source: '/(.*)', destination: '/index.html' },
  ]);
  assert.ok(config.services.frontend.headers[0].headers.some(header =>
    header.key === 'X-Frame-Options' && header.value === 'DENY'));
});
