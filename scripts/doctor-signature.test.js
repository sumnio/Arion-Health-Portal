import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDoctorApiRepository } from '../src/repositories/doctorApiRepository.js';
import { createDoctorSignatureApiService, validateDoctorSignatureSelection } from '../src/services/doctorSignatureApiService.js';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Doctor signature repository uses only authenticated self-service endpoints', async () => {
  const calls = [];
  const client = {
    async request(path) { calls.push(['request', path]); return { signature: { configured: false } }; },
    async download(path) { calls.push(['download', path]); return { blob: new Blob(['png']) }; },
    async upload(path, formData, options) { calls.push(['upload', path, options.method, formData.get('signature').name]); return { signature: { configured: true } }; },
  };
  const repository = createDoctorApiRepository(client);
  await repository.getSignatureStatus();
  await repository.getSignatureImage();
  const formData = new FormData(); formData.append('signature', new File(['png'], 'mine.png', { type: 'image/png' }));
  await repository.uploadSignature(formData);
  assert.deepEqual(calls, [['request', '/api/doctor/profile/signature/status'], ['download', '/api/doctor/profile/signature'], ['upload', '/api/doctor/profile/signature', 'POST', 'mine.png']]);
});

test('Doctor signature service sends one PNG FormData part and returns a preview blob', async () => {
  let uploaded;
  const service = createDoctorSignatureApiService({
    async getSignatureStatus() { return { configured: false }; },
    async getSignatureImage() { return { blob: new Blob(['png'], { type: 'image/png' }) }; },
    async uploadSignature(formData) { uploaded = [...formData.keys()]; return { configured: true }; },
  });
  assert.deepEqual(await service.getStatus(), { configured: false });
  assert.equal((await service.getPreview()).type, 'image/png');
  assert.deepEqual(await service.upload(new File(['png'], 'mine.png', { type: 'image/png' })), { configured: true });
  assert.deepEqual(uploaded, ['signature']);
});

test('frontend selection validation rejects non-PNG and files over 1 MB', () => {
  assert.equal(validateDoctorSignatureSelection(null), 'Select a PNG signature image.');
  assert.match(validateDoctorSignatureSelection(new File(['x'], 'mine.jpg', { type: 'image/jpeg' })), /Only PNG/);
  assert.match(validateDoctorSignatureSelection(new File([new Uint8Array(1024 * 1024 + 1)], 'mine.png', { type: 'image/png' })), /1 MB/);
  assert.equal(validateDoctorSignatureSelection(new File(['x'], 'mine.png', { type: 'image/png' })), '');
});

test('Doctor Profile provides preview, replace flow, accessibility, and object URL cleanup', async () => {
  const page = await source('../src/pages/doctor/DoctorProfile.jsx');
  assert.match(page, /Certificate Signature/);
  assert.match(page, /accept="image\/png,.png"/);
  assert.match(page, /signatureService\.getStatus/);
  assert.match(page, /signatureService\.getPreview/);
  assert.match(page, /signatureService\.upload\(selected\)/);
  assert.match(page, /URL\.createObjectURL/);
  assert.match(page, /URL\.revokeObjectURL/);
  assert.match(page, /alt="Your certificate signature preview"/);
  assert.match(page, /Replace Signature/);
  assert.doesNotMatch(page, /storage_file_id|https?:\/\//i);
});

test('Doctor Profile route is approved and connected to DoctorPage', async () => {
  const routes = await source('../src/app/routes.js');
  const page = await source('../src/pages/doctor/DoctorPage.jsx');
  assert.match(routes, /"path": "\/doctor\/profile"/);
  assert.match(page, /DoctorProfile/);
  assert.match(page, /route\.path === '\/doctor\/profile'/);
});

test('Admin no longer exposes or sends the legacy signature reference', async () => {
  for (const path of ['../src/pages/admin/ManageDoctors.jsx', '../src/services/adminApiService.js']) assert.doesNotMatch(await source(path), /signature_path|Signature reference/);
});

test('signature UI remains usable on narrow screens', async () => {
  const styles = await source('../src/styles/doctor-profile.css');
  assert.match(styles, /max-width:\s*520px/);
  assert.match(styles, /max-width:\s*100%/);
  assert.match(styles, /width:\s*100%/);
});
