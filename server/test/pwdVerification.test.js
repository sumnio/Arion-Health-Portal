import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
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
  inactiveStaffProfile: '777777777777777777777777',
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
  [ids.inactiveStaffProfile, { user_profile_id: ids.inactiveStaffProfile, role: 'staff', status: 'inactive' }],
]);

function createContext() {
  const tokens = createTokenService(SECRET, 'test');
  const patients = new Map([
    [ids.patientProfile, { _id: ids.patient, user_profile_id: ids.patientProfile, full_name: 'Primary Patient', is_pwd: true }],
    [ids.otherPatientProfile, { _id: ids.otherPatient, user_profile_id: ids.otherPatientProfile, full_name: 'Other Patient' }],
    [ids.inactiveProfile, { _id: 'cccccccccccccccccccccccc', user_profile_id: ids.inactiveProfile, full_name: 'Inactive Patient' }],
  ]);
  const records = new Map();
  const stored = new Map();
  const events = [];
  const notifications = [];
  let sequence = 0;
  const controls = { storageFailure: false, metadataFailure: false };
  const repository = {
    async findPatientByUserProfileId(profileId) { return patients.get(String(profileId)) ?? null; },
    async findByPatientId(patientId) { return records.get(String(patientId)) ?? null; },
    async findRejectedForResubmission(patientId) { const record = records.get(String(patientId)); return record?.status === 'rejected' ? { ...record } : null; },
    async replaceRejected(patientId, input) {
      const record = records.get(String(patientId));
      if (!record || record.status !== 'rejected') return null;
      Object.assign(record, input, { status: 'pending', verified_at: null, verified_by: null, reviewed_at: null, reviewed_by: null, rejection_reason: null });
      return record;
    },
    async listPending({ page, limit }) {
      const items = [...records.values()].filter(record => record.status === 'pending').sort((left, right) => left.submitted_at - right.submitted_at || String(left._id).localeCompare(String(right._id)));
      return {
        items: items.slice((page - 1) * limit, page * limit).map(record => ({ ...record, patient_id: { _id: record.patient_id, full_name: [...patients.values()].find(patient => patient._id === record.patient_id)?.full_name } })),
        total: items.length,
      };
    },
    async findPendingReviewById(verificationId) {
      const record = [...records.values()].find(item => item._id === String(verificationId) && item.status === 'pending');
      if (!record) return null;
      const patient = [...patients.values()].find(item => item._id === record.patient_id);
      return { ...record, patient_id: { _id: record.patient_id, full_name: patient?.full_name } };
    },
    async reviewPending(verificationId, { action, reviewerId, reviewedAt, rejectionReason }) {
      const record = [...records.values()].find(item => item._id === String(verificationId) && item.status === 'pending');
      if (!record) return null;
      Object.assign(record, { status: action, reviewed_at: reviewedAt, reviewed_by: reviewerId, rejection_reason: rejectionReason, verified_at: action === 'verified' ? reviewedAt : null, verified_by: action === 'verified' ? reviewerId : null });
      record.review_history ??= [];
      record.review_history.push({ action, reviewed_by: reviewerId, reviewed_at: reviewedAt, rejection_reason: rejectionReason });
      return record;
    },
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
    openDownload(storageFileId) { return Readable.from(stored.get(String(storageFileId)) ?? Buffer.alloc(0)); },
  };
  const pwdVerificationModule = createPwdVerificationModule({
    repository, storage,
    notificationTriggers: {
      async pwdVerificationSubmitted(payload) { notifications.push({ event: 'submitted', ...payload }); },
      async pwdVerificationReviewed(payload) { notifications.push({ event: 'reviewed', ...payload }); },
    },
    now: () => new Date('2026-11-02T01:00:00.000Z'),
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
    app, records, stored, events, controls, notifications,
    cookie(profileId, mfaVerified = false) { return `arion_auth=${tokens.sign(profileId, { mfaVerified })}`; },
  };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

function submission({ frontName = 'pwd-front.png', backName = 'pwd-back.png', frontBytes = PNG, backBytes = PNG, frontMimeType = 'image/png', backMimeType = 'image/png', omitFront = false, omitBack = false, extraField = null } = {}) {
  const data = new FormData();
  if (!omitFront) data.append('front_document', new Blob([frontBytes], { type: frontMimeType }), frontName);
  if (!omitBack) data.append('back_document', new Blob([backBytes], { type: backMimeType }), backName);
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
    assert.deepEqual((await response.json()).pwd_verification, { status: 'not_submitted', submitted_at: null, verified_at: null, rejection_reason: null });
  });
});

test('Patient submits private front and back ID images and receives status-only pending response', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const response = await submit(base, context.cookie(ids.patientProfile));
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.pwd_verification.status, 'pending');
    assert.equal(body.pwd_verification.submitted_at, '2026-11-02T01:00:00.000Z');
    assert.equal(JSON.stringify(body).includes('pwd-front'), false);
    assert.equal(JSON.stringify(body).includes('storage'), false);
    assert.equal(JSON.stringify(body).includes('filename'), false);
    assert.equal(context.records.size, 1);
    assert.equal(context.stored.size, 2);
    assert.deepEqual(context.notifications, [{ event: 'submitted', patientId: ids.patient }]);
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
    assert.equal(context.stored.size, 2);
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

test('front/back presence, image extension, signature, size, and fields are validated', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const cookie = context.cookie(ids.patientProfile);
    assert.equal((await submit(base, cookie, { frontName: 'card.txt' })).status, 400);
    assert.equal((await submit(base, cookie, { frontName: 'card.png', frontBytes: Buffer.from('not an image') })).status, 400);
    assert.equal((await submit(base, cookie, { frontName: 'card.pdf', frontBytes: Buffer.from('%PDF-1.7'), frontMimeType: 'application/pdf' })).status, 400);
    assert.equal((await submit(base, cookie, { frontBytes: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 413);
    assert.equal((await submit(base, cookie, { omitFront: true })).status, 400);
    assert.equal((await submit(base, cookie, { omitBack: true })).status, 400);
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

test('active Staff lists pending requests oldest first without ID numbers or storage details', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    assert.equal((await submit(base, context.cookie(ids.patientProfile))).status, 201);
    assert.equal((await submit(base, context.cookie(ids.otherPatientProfile))).status, 201);
    const response = await fetch(`${base}/api/staff/pwd-verifications?page=1&limit=10`, { headers: { cookie: context.cookie(ids.staffProfile) } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.pwd_verifications.items.map(item => item.patient_name), ['Primary Patient', 'Other Patient']);
    assert.equal(body.pwd_verifications.total, 2);
    assert.equal(JSON.stringify(body).includes('pwd-front'), false);
    assert.equal(JSON.stringify(body).includes('storage'), false);
  });
});

test('only active Staff can review the private pending document with safe inline headers', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    await submit(base, context.cookie(ids.patientProfile));
    const verificationId = [...context.records.values()][0]._id;
    for (const profileId of [ids.patientProfile, ids.doctorProfile, ids.adminProfile, ids.inactiveStaffProfile]) {
      const response = await fetch(`${base}/api/staff/pwd-verifications/${verificationId}/document/front`, { headers: { cookie: context.cookie(profileId, profileId === ids.adminProfile) } });
      assert.equal(response.status, 403);
    }
    assert.equal((await fetch(`${base}/api/staff/pwd-verifications/${verificationId}/document/front`)).status, 401);
    const response = await fetch(`${base}/api/staff/pwd-verifications/${verificationId}/document/front`, { headers: { cookie: context.cookie(ids.staffProfile) } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.match(response.headers.get('content-disposition'), /^inline;/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
    const back = await fetch(`${base}/api/staff/pwd-verifications/${verificationId}/document/back`, { headers: { cookie: context.cookie(ids.staffProfile) } });
    assert.equal(back.status, 200);
  });
});

test('Staff verifies Pending once, records reviewer audit, and triggers a privacy-safe Patient notification', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    await submit(base, context.cookie(ids.patientProfile));
    const record = [...context.records.values()][0];
    const path = `${base}/api/staff/pwd-verifications/${record._id}/verify`;
    const verifyHeaders = { cookie: context.cookie(ids.staffProfile), 'content-type': 'application/json' };
    const response = await fetch(path, { method: 'PATCH', headers: verifyHeaders, body: '{}' });
    assert.equal(response.status, 200);
    assert.equal(record.status, 'verified');
    assert.equal(record.verified_by, ids.staffProfile);
    assert.equal(record.verified_at.toISOString(), '2026-11-02T01:00:00.000Z');
    assert.equal(record.review_history.length, 1);
    assert.deepEqual(record.review_history[0], { action: 'verified', reviewed_by: ids.staffProfile, reviewed_at: record.verified_at, rejection_reason: null });
    assert.deepEqual(context.notifications, [{ event: 'submitted', patientId: ids.patient }, { event: 'reviewed', patientId: ids.patient, status: 'verified' }]);
    assert.equal((await fetch(path, { method: 'PATCH', headers: verifyHeaders, body: '{}' })).status, 409);
    assert.equal((await submit(base, context.cookie(ids.patientProfile))).status, 409);
  });
});

test('Staff rejection requires a bounded reason, notifies safely, and rejected Patient can resubmit without losing audit history', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    await submit(base, context.cookie(ids.patientProfile));
    const record = [...context.records.values()][0];
    const path = `${base}/api/staff/pwd-verifications/${record._id}/reject`;
    const headers = { cookie: context.cookie(ids.staffProfile), 'content-type': 'application/json' };
    assert.equal((await fetch(path, { method: 'PATCH', headers, body: '{}' })).status, 400);
    assert.equal((await fetch(path, { method: 'PATCH', headers, body: JSON.stringify({ reason: 'x'.repeat(501) }) })).status, 400);
    const rejected = await fetch(path, { method: 'PATCH', headers, body: JSON.stringify({ reason: 'Document is unreadable.' }) });
    assert.equal(rejected.status, 200);
    assert.equal(record.status, 'rejected');
    assert.equal(record.rejection_reason, 'Document is unreadable.');
    assert.equal(record.review_history.length, 1);
    assert.deepEqual(context.notifications, [{ event: 'submitted', patientId: ids.patient }, { event: 'reviewed', patientId: ids.patient, status: 'rejected' }]);
    const status = await (await fetch(`${base}/api/patient/pwd-verification`, { headers: { cookie: context.cookie(ids.patientProfile) } })).json();
    assert.equal(status.pwd_verification.rejection_reason, 'Document is unreadable.');
    const oldStorageId = record.storage_file_id;
    const resubmitted = await submit(base, context.cookie(ids.patientProfile));
    assert.equal(resubmitted.status, 201);
    assert.equal((await resubmitted.json()).pwd_verification.status, 'pending');
    assert.equal(record.review_history.length, 1);
    assert.equal(record.status, 'pending');
    assert.equal(context.stored.has(String(oldStorageId)), false);
    assert.equal((await submit(base, context.cookie(ids.patientProfile))).status, 409);
  });
});

test('concurrent Staff reviews permit exactly one Pending transition', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    await submit(base, context.cookie(ids.patientProfile));
    const record = [...context.records.values()][0];
    const headers = { cookie: context.cookie(ids.staffProfile), 'content-type': 'application/json' };
    const responses = await Promise.all([
      fetch(`${base}/api/staff/pwd-verifications/${record._id}/verify`, { method: 'PATCH', headers, body: '{}' }),
      fetch(`${base}/api/staff/pwd-verifications/${record._id}/reject`, { method: 'PATCH', headers, body: JSON.stringify({ reason: 'Unable to verify.' }) }),
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    assert.equal(record.review_history.length, 1);
    assert.equal(context.notifications.filter(item => item.event === 'reviewed').length, 1);
    assert.ok(['verified', 'rejected'].includes(record.status));
  });
});
