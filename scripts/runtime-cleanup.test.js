import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, 'src');
const importPattern = /(?:from\s+|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

async function runtimeModules(entry = path.join(srcRoot, 'main.jsx')) {
  const seen = new Set();
  async function visit(file) {
    const resolved = path.normalize(file);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    const source = await readFile(resolved, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const imported = path.resolve(path.dirname(resolved), match[1]);
      await visit(imported);
    }
  }
  await visit(entry);
  return [...seen];
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : [target];
  }));
  return nested.flat().filter((file) => /\.(?:js|jsx)$/.test(file));
}

test('the production module graph contains no legacy mock or fixture dependency', async () => {
  const modules = await runtimeModules();
  const relative = modules.map((file) => path.relative(srcRoot, file).replaceAll('\\', '/'));
  assert.equal(relative.some((file) => file.startsWith('mocks/')), false, relative.join('\n'));
  assert.equal(relative.includes('services/portalService.js'), false);
  assert.equal(relative.includes('app/pageLinks.js'), false);
  assert.equal(relative.some((file) => /(?:Service|Repository)\.js$/.test(file) && !/ApiService|ApiRepository|authService|apiClient|dateTimeService|certificatePdfService/.test(file)), false, relative.join('\n'));
});

test('live pages use role API services without raw fetches or hardcoded backend origins', async () => {
  const files = await sourceFiles(path.join(srcRoot, 'pages'));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(/, file);
    assert.doesNotMatch(source, /https?:\/\/(?:localhost|127\.0\.0\.1):5000/, file);
    assert.doesNotMatch(source, /(?:mocks\/|mockRepository|preview role|demoUser|samplePatient)/i, file);
  }
  for (const role of ['patient', 'doctor', 'staff', 'admin']) {
    const filesForRole = files.filter((file) => file.includes(`${path.sep}pages${path.sep}${role}${path.sep}`));
    const sources = await Promise.all(filesForRole.map((file) => readFile(file, 'utf8')));
    assert.ok(sources.some((source) => source.includes(`${role}ApiService`)), `${role} pages must use the live API service`);
  }
});

test('API repositories share the credentialed client and auth has no browser token store', async () => {
  for (const role of ['patient', 'doctor', 'staff', 'admin']) {
    const source = await readFile(path.join(srcRoot, 'repositories', `${role}ApiRepository.js`), 'utf8');
    assert.match(source, /import \{ apiClient \}/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
  const [client, authContext, authService] = await Promise.all([
    readFile(path.join(srcRoot, 'services', 'apiClient.js'), 'utf8'),
    readFile(path.join(srcRoot, 'auth', 'AuthContext.jsx'), 'utf8'),
    readFile(path.join(srcRoot, 'services', 'authService.js'), 'utf8'),
  ]);
  assert.match(client, /credentials: 'include'/);
  assert.match(client, /API_BASE_URL/);
  assert.match(authService, /\/api\/auth\/me/);
  assert.doesNotMatch(authContext + authService, /localStorage|sessionStorage|mockProfiles|preview role/i);
});

test('certificate PDF output excludes protected storage paths', async () => {
  const { buildCertificatePdf } = await import('../src/services/certificatePdfService.js');
  const pdf = new TextDecoder().decode(buildCertificatePdf({
    medical_certificate_number: 'MC-2026-0099', patientName: 'Patient', purpose: 'Check-up',
    diagnosis_summary: 'Cleared', date_issued: '2026-09-25', status: 'issued', doctor: 'Doctor',
    license_number: 'LIC-1', ptr_number: 'PTR-1', signature_available: true,
    signature_path: 'protected/signatures/doctor.png', clinic: { name: 'Arion Health Clinic', location: 'Clinic' },
  }));
  assert.doesNotMatch(pdf, /signature_path|protected\/signatures|doctor\.png/);
});
