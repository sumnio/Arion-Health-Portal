import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createDoctorSignatureModule } from '../src/services/doctorSignatureModule.js';
import { createTokenService } from '../src/services/tokenService.js';
import { httpError } from '../src/utils/httpError.js';
import { DoctorSignature } from '../src/models/index.js';

const SECRET = 'doctor-signature-test-secret-123456789';
const ids = Object.freeze({
  doctorProfile: '111111111111111111111111', otherDoctorProfile: '222222222222222222222222',
  inactiveDoctorProfile: '333333333333333333333333', patientProfile: '444444444444444444444444',
  staffProfile: '555555555555555555555555', adminProfile: '666666666666666666666666',
  doctor: 'aaaaaaaaaaaaaaaaaaaaaaaa', otherDoctor: 'bbbbbbbbbbbbbbbbbbbbbbbb',
});

function png(width = 400, height = 120) {
  const value = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(value);
  value.writeUInt32BE(13, 8); Buffer.from('IHDR').copy(value, 12);
  value.writeUInt32BE(width, 16); value.writeUInt32BE(height, 20);
  value[24] = 8; value[25] = 6;
  return value;
}

test('DoctorSignature schema keeps one bounded private PNG metadata record per Doctor', () => {
  const paths = DoctorSignature.schema.paths;
  assert.equal(paths.doctor_id.options.unique, true);
  assert.equal(paths.storage_file_id.options.unique, true);
  assert.deepEqual(paths.mime_type.options.enum, ['image/png']);
  assert.equal(paths.file_size.options.max, 1024 * 1024);
  assert.equal(paths.width.options.min, 200);
  assert.equal(paths.width.options.max, 2000);
  assert.equal(paths.height.options.min, 50);
  assert.equal(paths.height.options.max, 1000);
  assert.equal(paths.original_filename, undefined);
  assert.equal(paths.public_url, undefined);
});

function createContext() {
  const tokens = createTokenService(SECRET, 'test');
  const profiles = new Map([
    [ids.doctorProfile, { user_profile_id: ids.doctorProfile, role: 'doctor', status: 'active' }],
    [ids.otherDoctorProfile, { user_profile_id: ids.otherDoctorProfile, role: 'doctor', status: 'active' }],
    [ids.inactiveDoctorProfile, { user_profile_id: ids.inactiveDoctorProfile, role: 'doctor', status: 'inactive' }],
    [ids.patientProfile, { user_profile_id: ids.patientProfile, role: 'patient', status: 'active' }],
    [ids.staffProfile, { user_profile_id: ids.staffProfile, role: 'staff', status: 'active' }],
    [ids.adminProfile, { user_profile_id: ids.adminProfile, role: 'admin', status: 'active' }],
  ]);
  const doctors = new Map([
    [ids.doctorProfile, { _id: ids.doctor, user_profile_id: ids.doctorProfile }],
    [ids.otherDoctorProfile, { _id: ids.otherDoctor, user_profile_id: ids.otherDoctorProfile }],
    [ids.inactiveDoctorProfile, { _id: 'cccccccccccccccccccccccc', user_profile_id: ids.inactiveDoctorProfile }],
  ]);
  const signatures = new Map();
  const stored = new Map();
  const controls = { metadataFailure: false, cleanupFailure: false };
  let sequence = 1;
  const repository = {
    async findDoctorByUserProfileId(profileId) { return doctors.get(String(profileId)) ?? null; },
    async findByDoctorId(doctorId) { return signatures.get(String(doctorId)) ?? null; },
    async swapForDoctor(doctorId, data) {
      if (controls.metadataFailure) throw new Error('private database detail');
      const previous = signatures.get(String(doctorId)) ?? null;
      const saved = { _id: 'dddddddddddddddddddddddd', doctor_id: doctorId, ...data };
      signatures.set(String(doctorId), saved);
      return { active: saved, previous };
    },
  };
  const storage = {
    async upload(file) { const storageFileId = `${sequence++}`.padStart(24, '0'); stored.set(storageFileId, Buffer.from(file.buffer)); return { storageFileId }; },
    openDownload(storageFileId) { return Readable.from(stored.get(String(storageFileId))); },
    async delete(storageFileId) { if (controls.cleanupFailure) throw new Error('private cleanup detail'); stored.delete(String(storageFileId)); },
  };
  const doctorSignatureModule = createDoctorSignatureModule({ repository, storage, now: () => new Date('2026-10-15T01:00:00Z'), logger: { warn() {} } });
  const authModule = { tokens, service: { async getAuthenticatedUser(profileId) { const profile = profiles.get(String(profileId)); if (!profile) throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.'); return profile; } } };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, doctorSignatureModule });
  return { app, signatures, stored, controls, service: doctorSignatureModule.doctorSignatureService, cookie(profileId, mfaVerified = false) { return `arion_auth=${tokens.sign(profileId, { mfaVerified })}`; } };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function form(files, extraField) {
  const data = new FormData();
  files.forEach(item => data.append(item.field ?? 'signature', new Blob([item.bytes], { type: item.type ?? 'image/png' }), item.name ?? 'signature.png'));
  if (extraField) data.append(extraField, 'rejected');
  return data;
}

async function upload(base, cookie, files, extraField) {
  return fetch(`${base}/api/doctor/profile/signature`, { method: 'POST', headers: cookie ? { cookie } : {}, body: form(files, extraField) });
}

test('active Doctor uploads one valid PNG and receives only safe metadata', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const response = await upload(base, context.cookie(ids.doctorProfile), [{ bytes: png() }]);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.signature, { configured: true, mime_type: 'image/png', file_size: 33, width: 400, height: 120, uploaded_at: '2026-10-15T01:00:00.000Z' });
    assert.equal(JSON.stringify(body).includes('storage'), false);
    assert.equal(JSON.stringify(body).includes('url'), false);
  });
});

test('signature endpoints enforce authentication, active Doctor role, and owner-only identity', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    assert.equal((await fetch(`${base}/api/doctor/profile/signature/status`)).status, 401);
    assert.equal((await upload(base, context.cookie(ids.inactiveDoctorProfile), [{ bytes: png() }])).status, 403);
    for (const profile of [ids.patientProfile, ids.staffProfile, ids.adminProfile]) {
      assert.equal((await upload(base, context.cookie(profile, profile === ids.adminProfile), [{ bytes: png() }])).status, 403);
    }
    assert.equal((await upload(base, context.cookie(ids.doctorProfile), [{ bytes: png() }])).status, 200);
    assert.equal((await fetch(`${base}/api/doctor/profile/signature`, { headers: { cookie: context.cookie(ids.otherDoctorProfile) } })).status, 404);
  });
});

test('raw signature is streamed privately as inline PNG with safe headers', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    await upload(base, context.cookie(ids.doctorProfile), [{ bytes: png() }]);
    const response = await fetch(`${base}/api/doctor/profile/signature`, { headers: { cookie: context.cookie(ids.doctorProfile) } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-disposition'), /^inline/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png());
  });
});

for (const [label, file, status] of [
  ['non-PNG', { name: 'signature.jpg', type: 'image/jpeg', bytes: Buffer.from('not png') }, 400],
  ['renamed executable', { name: 'signature.png', type: 'image/png', bytes: Buffer.from('MZ executable') }, 400],
  ['wrong extension', { name: 'signature.jpg', type: 'image/png', bytes: png() }, 400],
  ['too-small dimensions', { name: 'signature.png', type: 'image/png', bytes: png(100, 20) }, 400],
]) test(`${label} is rejected before private storage`, async () => {
  const context = createContext();
  await withServer(context.app, async base => assert.equal((await upload(base, context.cookie(ids.doctorProfile), [file])).status, status));
  assert.equal(context.stored.size, 0);
});

test('oversize, missing, multiple, alternate field, and extra field requests are rejected', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const oversized = Buffer.alloc(1024 * 1024 + 1); png().copy(oversized);
    assert.equal((await upload(base, context.cookie(ids.doctorProfile), [{ bytes: oversized }])).status, 413);
    assert.equal((await upload(base, context.cookie(ids.doctorProfile), [])).status, 400);
    assert.equal((await upload(base, context.cookie(ids.doctorProfile), [{ bytes: png() }, { bytes: png() }])).status, 400);
    assert.equal((await upload(base, context.cookie(ids.doctorProfile), [{ field: 'file', bytes: png() }])).status, 400);
    assert.equal((await upload(base, context.cookie(ids.doctorProfile), [{ bytes: png() }], 'doctor_id')).status, 400);
  });
});

test('replacement stores new first, keeps one metadata record, and removes old file', async () => {
  const context = createContext();
  await context.service.uploadOwn(ids.doctorProfile, { originalname: 'one.png', mimetype: 'image/png', buffer: png(400, 120) });
  const firstStorageId = context.signatures.get(ids.doctor).storage_file_id;
  await context.service.uploadOwn(ids.doctorProfile, { originalname: 'two.png', mimetype: 'image/png', buffer: png(500, 150) });
  assert.equal(context.signatures.size, 1);
  assert.equal(context.stored.has(String(firstStorageId)), false);
  assert.equal(context.signatures.get(ids.doctor).width, 500);
});

test('concurrent replacements retain one active metadata record and one stored object', async () => {
  const context = createContext();
  await context.service.uploadOwn(ids.doctorProfile, { originalname: 'one.png', mimetype: 'image/png', buffer: png() });
  await Promise.all([
    context.service.uploadOwn(ids.doctorProfile, { originalname: 'two.png', mimetype: 'image/png', buffer: png(500, 150) }),
    context.service.uploadOwn(ids.doctorProfile, { originalname: 'three.png', mimetype: 'image/png', buffer: png(600, 160) }),
  ]);
  assert.equal(context.signatures.size, 1);
  assert.equal(context.stored.size, 1);
});

test('failed replacement preserves previous metadata and cleans the unreferenced new file', async () => {
  const context = createContext();
  await context.service.uploadOwn(ids.doctorProfile, { originalname: 'one.png', mimetype: 'image/png', buffer: png() });
  const previous = context.signatures.get(ids.doctor);
  context.controls.metadataFailure = true;
  await assert.rejects(() => context.service.uploadOwn(ids.doctorProfile, { originalname: 'two.png', mimetype: 'image/png', buffer: png(500, 150) }), error => error.code === 'DOCTOR_SIGNATURE_UPLOAD_UNAVAILABLE');
  assert.equal(context.signatures.get(ids.doctor), previous);
  assert.equal(context.stored.size, 1);
});

test('old-file cleanup failure does not roll back a successful replacement', async () => {
  const context = createContext();
  await context.service.uploadOwn(ids.doctorProfile, { originalname: 'one.png', mimetype: 'image/png', buffer: png() });
  context.controls.cleanupFailure = true;
  const result = await context.service.uploadOwn(ids.doctorProfile, { originalname: 'two.png', mimetype: 'image/png', buffer: png(600, 160) });
  assert.equal(result.width, 600);
  assert.equal(context.signatures.get(ids.doctor).width, 600);
});

test('internal certificate hook returns only the requested Doctor private stream and metadata', async () => {
  const context = createContext();
  await context.service.uploadOwn(ids.doctorProfile, { originalname: 'signature.png', mimetype: 'image/png', buffer: png() });
  const result = await context.service.getDoctorSignatureForCertificate(ids.doctor);
  assert.equal(result.metadata.configured, true);
  assert.equal(await context.service.getDoctorSignatureForCertificate(ids.otherDoctor), null);
  assert.equal('storage_file_id' in result.metadata, false);
});
