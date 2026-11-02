import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createPwdVerificationModule } from '../src/services/pwdVerificationModule.js';
import { createTokenService } from '../src/services/tokenService.js';
import { httpError } from '../src/utils/httpError.js';

const SECRET = 'pwd-verification-test-secret-123456789012';
const ids = Object.freeze({
  patientProfile: '111111111111111111111111',
  otherPatientProfile: '222222222222222222222222',
  doctorProfile: '333333333333333333333333',
  staffProfile: '444444444444444444444444',
  adminProfile: '555555555555555555555555',
  inactiveProfile: '666666666666666666666666',
  patient: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  otherPatient: 'bbbbbbbbbbbbbbbbbbbbbbbb',
});

const profiles = new Map([
  [ids.patientProfile, { user_profile_id: ids.patientProfile, role: 'patient', status: 'active' }],
  [ids.otherPatientProfile, { user_profile_id: ids.otherPatientProfile, role: 'patient', status: 'active' }],
  [ids.doctorProfile, { user_profile_id: ids.doctorProfile, role: 'doctor', status: 'active' }],
  [ids.staffProfile, { user_profile_id: ids.staffProfile, role: 'staff', status: 'active' }],
  [ids.adminProfile, { user_profile_id: ids.adminProfile, role: 'admin', status: 'active' }],
  [ids.inactiveProfile, { user_profile_id: ids.inactiveProfile, role: 'patient', status: 'inactive' }],
]);

function createContext() {
  const tokens = createTokenService(SECRET, 'test');
  const patients = new Map([
    [ids.patientProfile, { _id: ids.patient, user_profile_id: ids.patientProfile, is_pwd: true }],
    [ids.otherPatientProfile, { _id: ids.otherPatient, user_profile_id: ids.otherPatientProfile }],
    [ids.inactiveProfile, { _id: 'cccccccccccccccccccccccc', user_profile_id: ids.inactiveProfile }],
  ]);
  const records = new Map();
  const stored = new Map();
  const events = [];
  let sequence = 0;
  const controls = { storageFailure: false, metadataFailure: false };
  const repository = {
    async findPatientByUserProfileId(profileId) { return patients.get(String(profileId)) ?? null; },
    async findByPatientId(patientId) { return records.get(String(patientId)) ?? null; },
    async create(input) {
      if (controls.metadataFailure) throw new Error('private database detail');
      if (records.has(String(input.patient_id))) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const record = { ...input, _id: `${++sequence}`.padStart(24, '0'), created_at: input.submitted_at };
      records.set(String(input.patient_id), record);
      return record;
    },
    async deleteByStorageFileId(storageFileId) {
      for (const [key, record] of records) if (String(record.storage_file_id) === String(storageFileId)) records.delete(key);
    },
  };
  const storage = {
    async upload(file) {
      if (controls.storageFailure) throw new Error('private GridFS detail');
      const storageFileId = `${9000 + ++sequence}`.padStart(24, '0');
      stored.set(storageFileId, Buffer.from(file.buffer));
      return { storageFileId, storedFilename: `generated-${sequence}.${file.extension}` };
    },
    async delete(storageFileId) { stored.delete(String(storageFileId)); },
  };
  const pwdVerificationModule = createPwdVerificationModule({
    repository, storage, now: () => new Date('2026-11-02T01:00:00.000Z'),
  });
  const authModule = {
    tokens,
    service: {
      async getAuthenticatedUser(profileId) {
        const profile = profiles.get(String(profileId));
        if (!profile) throw httpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
        return profile;
      },
    },
  };
  const securityLogger = { logSecurityEvent(event) { events.push(event); } };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, pwdVerificationModule, securityLogger });
  return {
    app, records, stored, events, controls,
    cookie(profileId, mfaVerified = false) { return `arion_auth=${tokens.sign(profileId, { mfaVerified })}`; },
  };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const PDF = Buffer.from('%PDF-1.7\nprivate PWD verification');

function submission({ idNumber = 'PWD-2026-001', name = 'pwd-card.pdf', bytes = PDF, mimeType = 'application/pdf', extraField = null } = {}) {
  const data = new FormData();
  data.append('pwd_id_number', idNumber);
  data.append('document', new Blob([bytes], { type: mimeType }), name);
  if (extraField) data.append(extraField, 'not allowed');
  return data;
}

function submit(base, cookie, options) {
  return fetch(`${base}/api/patient/pwd-verification`, {
    method: 'POST', headers: cookie ? { cookie } : {}, body: submission(options),
  });
}

test('legacy is_pwd=true remains not submitted and does not become verified', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const response = await fetch(`${base}/api/patient/pwd-verification`, { headers: { cookie: context.cookie(ids.patientProfile) } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).pwd_verification, { status: 'not_submitted', submitted_at: null, verified_at: null });
  });
});

test('Patient submits one private PDF and receives status-only pending response', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const response = await submit(base, context.cookie(ids.patientProfile));
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.pwd_verification.status, 'pending');
    assert.equal(body.pwd_verification.submitted_at, '2026-11-02T01:00:00.000Z');
    assert.equal(JSON.stringify(body).includes('PWD-2026-001'), false);
    assert.equal(JSON.stringify(body).includes('storage'), false);
    assert.equal(JSON.stringify(body).includes('filename'), false);
    assert.equal(context.records.size, 1);
    assert.equal(context.stored.size, 1);
    assert.equal(context.events.some(event => event.event === 'PWD_VERIFICATION_SUBMITTED'), true);
  });
});

test('duplicate submission is blocked without creating another private file', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    assert.equal((await submit(base, context.cookie(ids.patientProfile))).status, 201);
    const duplicate = await submit(base, context.cookie(ids.patientProfile));
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'PWD_VERIFICATION_ALREADY_SUBMITTED');
    assert.equal(context.records.size, 1);
    assert.equal(context.stored.size, 1);
  });
});

test('upload enforces authentication, active Patient role, and private ownership', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    assert.equal((await submit(base, null)).status, 401);
    assert.equal((await submit(base, context.cookie(ids.inactiveProfile))).status, 403);
    for (const profileId of [ids.doctorProfile, ids.staffProfile, ids.adminProfile]) {
      assert.equal((await submit(base, context.cookie(profileId, profileId === ids.adminProfile))).status, 403);
    }
    assert.equal(context.records.size, 0);
    assert.equal(context.stored.size, 0);
  });
});

test('file extension, signature, size, fields, and ID number are validated', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const cookie = context.cookie(ids.patientProfile);
    assert.equal((await submit(base, cookie, { name: 'card.txt' })).status, 400);
    assert.equal((await submit(base, cookie, { name: 'card.pdf', bytes: Buffer.from('not a pdf') })).status, 400);
    assert.equal((await submit(base, cookie, { mimeType: 'image/png' })).status, 400);
    assert.equal((await submit(base, cookie, { bytes: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 413);
    assert.equal((await submit(base, cookie, { idNumber: '  ' })).status, 400);
    assert.equal((await submit(base, cookie, { extraField: 'status' })).status, 400);
    assert.equal(context.records.size, 0);
    assert.equal(context.stored.size, 0);
  });
});

test('storage or metadata failure leaves no orphan and returns a safe error', async () => {
  const storageContext = createContext();
  storageContext.controls.storageFailure = true;
  await withServer(storageContext.app, async base => {
    const response = await submit(base, storageContext.cookie(ids.patientProfile));
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(await response.json()).includes('GridFS'), false);
    assert.equal(storageContext.stored.size, 0);
  });
  const metadataContext = createContext();
  metadataContext.controls.metadataFailure = true;
  await withServer(metadataContext.app, async base => {
    const response = await submit(base, metadataContext.cookie(ids.patientProfile));
    assert.equal(response.status, 503);
    assert.equal(metadataContext.records.size, 0);
    assert.equal(metadataContext.stored.size, 0);
  });
});

test('no raw PWD document route is exposed to any role', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    for (const profileId of [ids.patientProfile, ids.otherPatientProfile, ids.doctorProfile, ids.staffProfile, ids.adminProfile]) {
      const response = await fetch(`${base}/api/patient/pwd-verification/document`, {
        headers: { cookie: context.cookie(profileId, profileId === ids.adminProfile) },
      });
      assert.equal([403, 404].includes(response.status), true);
    }
  });
});
