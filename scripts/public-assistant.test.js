import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ApiError } from '../src/services/apiClient.js';
import { createPublicAssistantApiService } from '../src/services/publicAssistantApiService.js';
import { PUBLIC_ASSISTANT_CONFIG, PATIENT_ASSISTANT_CONFIG } from '../src/components/assistant/assistantConfig.js';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');

test('public assistant service sends only message to its separate public endpoint', async () => {
  const calls = [];
  const service = createPublicAssistantApiService({
    async request(path, options) {
      calls.push({ path, options });
      return { reply: 'Select Register.' };
    },
  });
  assert.equal(await service.sendMessage('How do I register?'), 'Select Register.');
  assert.deepEqual(calls, [{
    path: '/api/public/assistant/message',
    options: { method: 'POST', body: { message: 'How do I register?' } },
  }]);
  assert.deepEqual(Object.keys(calls[0].options.body), ['message']);
});

test('public assistant service rejects malformed response envelopes', async () => {
  const service = createPublicAssistantApiService({ async request() { return { reply: '' }; } });
  await assert.rejects(() => service.sendMessage('Register'), error => error instanceof ApiError && error.code === 'INVALID_ASSISTANT_RESPONSE');
});

test('public layout mounts safe mode only for approved guest routes', async () => {
  const source = await readSource('../src/layouts/PublicLayout.jsx');
  assert.match(source, /new Set\(\['\/', '\/login', '\/register', '\/forgot-password'\]\)/);
  assert.match(source, /status === 'guest'/);
  assert.match(source, /PUBLIC_ASSISTANT_PATHS\.has\(location\.pathname\)/);
  assert.match(source, /service=\{publicAssistantApiService\}/);
  assert.doesNotMatch(source, /verify-email|reset-password|unauthorized/);
});

test('public and authenticated Patient modes use distinct welcome text and suggestions', () => {
  assert.notEqual(PUBLIC_ASSISTANT_CONFIG.welcomeMessage, PATIENT_ASSISTANT_CONFIG.welcomeMessage);
  assert.match(PUBLIC_ASSISTANT_CONFIG.welcomeMessage, /For personal appointment or account details, please sign in/);
  assert.equal(PUBLIC_ASSISTANT_CONFIG.suggestions.length, 8);
  assert.equal(PATIENT_ASSISTANT_CONFIG.suggestions.length, 8);
  assert.ok(PUBLIC_ASSISTANT_CONFIG.suggestions.some(item => item.question === 'How do I register?'));
  assert.ok(PATIENT_ASSISTANT_CONFIG.suggestions.some(item => item.question === 'When is my next appointment?'));
  assert.equal(PUBLIC_ASSISTANT_CONFIG.suggestions.some(item => item.question === 'When is my next appointment?'), false);
});

test('shared chat stays session-only and renders responses as plain React text', async () => {
  const source = await readSource('../src/components/assistant/ArionAssistantChat.jsx');
  assert.match(source, /useState/);
  assert.match(source, /item\.text/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML/i);
});

test('Staff, Doctor, Admin, and pre-MFA surfaces do not mount public assistant safe mode', async () => {
  for (const layout of ['StaffLayout.jsx', 'DoctorLayout.jsx', 'AdminLayout.jsx']) {
    const source = await readSource(`../src/layouts/${layout}`);
    assert.doesNotMatch(source, /ArionAssistantChat|publicAssistantApiService|PUBLIC_ASSISTANT_CONFIG/);
  }
  const routes = await readSource('../src/app/AppRouter.jsx');
  assert.doesNotMatch(routes, /publicAssistantApiService|PUBLIC_ASSISTANT_CONFIG/);
});
