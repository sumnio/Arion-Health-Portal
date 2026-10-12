import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ApiError } from '../src/services/apiClient.js';
import {
  ASSISTANT_MESSAGE_MAX_LENGTH,
  ASSISTANT_RATE_LIMIT_ERROR,
  ASSISTANT_TEMPORARY_ERROR,
  assistantErrorMessage,
  createPatientAssistantApiService,
} from '../src/services/patientAssistantApiService.js';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');

test('assistant service sends only the trimmed message contract and returns plain reply text', async () => {
  const calls = [];
  const service = createPatientAssistantApiService({
    async request(path, options) {
      calls.push({ path, options });
      return { reply: 'Open My Appointments.' };
    },
  });
  assert.equal(await service.sendMessage('When is my next appointment?'), 'Open My Appointments.');
  assert.deepEqual(calls, [{
    path: '/api/patient/assistant/message',
    options: { method: 'POST', body: { message: 'When is my next appointment?' } },
  }]);
  assert.deepEqual(Object.keys(calls[0].options.body), ['message']);
});

test('assistant service rejects malformed replies and maps errors without leaking internals', async () => {
  const service = createPatientAssistantApiService({ async request() { return { reply: '' }; } });
  await assert.rejects(() => service.sendMessage('Hello'), error => error instanceof ApiError && error.code === 'INVALID_ASSISTANT_RESPONSE');
  assert.equal(assistantErrorMessage(new ApiError('Provider detail', { status: 429 })), ASSISTANT_RATE_LIMIT_ERROR);
  assert.equal(assistantErrorMessage(new Error('Secret upstream failure')), ASSISTANT_TEMPORARY_ERROR);
  assert.equal(ASSISTANT_MESSAGE_MAX_LENGTH, 800);
});

test('authenticated Patient layout alone mounts the floating assistant', async () => {
  const patient = await readSource('../src/layouts/PatientLayout.jsx');
  assert.match(patient, /ArionAssistantChat/);
  for (const layout of ['StaffLayout.jsx', 'DoctorLayout.jsx', 'AdminLayout.jsx']) {
    assert.doesNotMatch(await readSource(`../src/layouts/${layout}`), /ArionAssistantChat/);
  }
});

test('assistant component provides session-only chat, controls, guided categories, and safe text rendering', async () => {
  const source = await readSource('../src/components/assistant/ArionAssistantChat.jsx');
  assert.match(source, /useState\(\(\) => \[welcomeMessage\(welcomeText\)\]\)/);
  assert.match(source, /Open Arion Assistant/);
  assert.match(source, /Close Arion Assistant/);
  assert.match(source, /Clear chat/);
  assert.match(source, /Send message/);
  assert.match(source, /Arion Assistant provides clinic and portal guidance and does not replace a Doctor\./);
  assert.match(source, /categories\.map/);
  assert.match(source, /activeCategory\.questions\.map/);
  assert.match(source, /Back to topics/);
  assert.match(source, /Browse topics/);
  assert.match(source, /sendMessage\(item\.question\)/);
  assert.match(source, /event\.key === 'Enter' && !event\.shiftKey/);
  assert.match(source, /pending \|\| !message/);
  assert.match(source, /maxLength=\{ASSISTANT_MESSAGE_MAX_LENGTH\}/);
  assert.match(source, /role="log"/);
  assert.match(source, /role="status"/);
  assert.match(source, /item\.text/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(source, /patient[_A-Z-]?id|provider|model|conversationHistory/i);
});

test('assistant responsive styles constrain the panel and wrap long text', async () => {
  const source = await readSource('../src/styles/arion-assistant.css');
  assert.match(source, /position: fixed/);
  assert.match(source, /width: min\(400px, calc\(100vw - 32px\)\)/);
  assert.match(source, /height: min\(650px, calc\(100dvh - 48px\)\)/);
  assert.match(source, /overflow-wrap: anywhere/);
  assert.match(source, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source, /@media \(max-width: 360px\)/);
  assert.match(source, /grid-template-columns: 1fr/);
  assert.match(source, /overflow-y: auto/);
  assert.match(source, /@media \(max-width: 540px\)/);
});
