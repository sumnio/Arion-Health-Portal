import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createSupportingDocumentModule } from '../src/services/supportingDocumentModule.js';
import { sanitizeSupportingDocumentFilename } from '../src/validation/supportingDocumentValidation.js';
import { createTokenService } from '../src/services/tokenService.js';
import { httpError } from '../src/utils/httpError.js';

const SECRET = 'supporting-document-test-secret-123456789012';
const ids = Object.freeze({
  patientAProfile: '111111111111111111111111', patientBProfile: '222222222222222222222222',
  inactiveProfile: '333333333333333333333333', doctorAProfile: '444444444444444444444444',
  doctorBProfile: '555555555555555555555555', staffProfile: '666666666666666666666666',
  adminProfile: '777777777777777777777777', patientA: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  patientB: 'bbbbbbbbbbbbbbbbbbbbbbbb', doctorA: 'cccccccccccccccccccccccc',
  doctorB: 'dddddddddddddddddddddddd', pending: '100000000000000000000001',
  confirmed: '100000000000000000000002', cancelled: '100000000000000000000003',
  noShow: '100000000000000000000004', completed: '100000000000000000000005',
  other: '100000000000000000000006', recorded: '100000000000000000000007',
});

const profiles = new Map([
  [ids.patientAProfile, { user_profile_id: ids.patientAProfile, role: 'patient', status: 'active' }],
  [ids.patientBProfile, { user_profile_id: ids.patientBProfile, role: 'patient', status: 'active' }],
  [ids.inactiveProfile, { user_profile_id: ids.inactiveProfile, role: 'patient', status: 'inactive' }],
  [ids.doctorAProfile, { user_profile_id: ids.doctorAProfile, role: 'doctor', status: 'active' }],
  [ids.doctorBProfile, { user_profile_id: ids.doctorBProfile, role: 'doctor', status: 'active' }],
  [ids.staffProfile, { user_profile_id: ids.staffProfile, role: 'staff', status: 'active' }],
  [ids.adminProfile, { user_profile_id: ids.adminProfile, role: 'admin', status: 'active' }],
]);

function appointment(_id, patientId, doctorId, status) {
  return { _id, patient_id: patientId, doctor_id: doctorId, status, appointment_at: new Date('2026-10-20T01:00:00Z') };
}

function createContext() {
  const tokens = createTokenService(SECRET, 'test');
  const patients = [
    { _id: ids.patientA, user_profile_id: ids.patientAProfile },
    { _id: ids.patientB, user_profile_id: ids.patientBProfile },
    { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', user_profile_id: ids.inactiveProfile },
  ];
  const doctors = [
    { _id: ids.doctorA, user_profile_id: ids.doctorAProfile },
    { _id: ids.doctorB, user_profile_id: ids.doctorBProfile },
  ];
  const appointments = new Map([
    [ids.pending, appointment(ids.pending, ids.patientA, ids.doctorA, 'pending')],
    [ids.confirmed, appointment(ids.confirmed, ids.patientA, ids.doctorA, 'confirmed')],
    [ids.cancelled, appointment(ids.cancelled, ids.patientA, ids.doctorA, 'cancelled')],
    [ids.noShow, appointment(ids.noShow, ids.patientA, ids.doctorA, 'no_show')],
    [ids.completed, appointment(ids.completed, ids.patientA, ids.doctorA, 'completed')],
    [ids.other, appointment(ids.other, ids.patientB, ids.doctorB, 'pending')],
    [ids.recorded, appointment(ids.recorded, ids.patientA, ids.doctorA, 'confirmed')],
  ]);
  const recorded = new Set([ids.recorded]);
  const documents = [];
  const stored = new Map();
  const events = [];
  let sequence = 1;
  const controls = { storageFailureAt: null, metadataFailure: false };
  const storage = {
    async upload(file) {
      if (controls.storageFailureAt === stored.size) throw new Error('private GridFS detail');
      const storageFileId = `${(9000 + sequence).toString(16).padStart(24, '0')}`;
      const storedFilename = `generated-${sequence++}.${file.extension}`;
      stored.set(storageFileId, { buffer: Buffer.from(file.buffer), storedFilename });
      return { storageFileId, storedFilename };
    },
    openDownload(storageFileId) {
      const item = stored.get(String(storageFileId));
      if (!item) throw new Error('missing storage item');
      return Readable.from(item.buffer);
    },
    async delete(storageFileId) { stored.delete(String(storageFileId)); },
  };
  const repository = {
    async findPatientByUserProfileId(profileId) { return patients.find(item => item.user_profile_id === profileId) ?? null; },
    async findDoctorByUserProfileId(profileId) { return doctors.find(item => item.user_profile_id === profileId) ?? null; },
    async findAppointmentById(appointmentId) { return appointments.get(String(appointmentId)) ?? null; },
    async medicalRecordExists(appointmentId) { return recorded.has(String(appointmentId)); },
    async listByAppointment(appointmentId) { return documents.filter(item => item.appointment_id === String(appointmentId)); },
    async createMany(items) {
      const created = items.map(item => ({ ...item, _id: `${(8000 + sequence++).toString(16).padStart(24, '0')}` }));
      if (controls.metadataFailure) {
        documents.push(created[0]);
        throw new Error('private metadata detail');
      }
      documents.push(...created);
      return created;
    },
    async deleteByStorageFileIds(storageIds) {
      for (let index = documents.length - 1; index >= 0; index -= 1) {
        if (storageIds.map(String).includes(String(documents[index].storage_file_id))) documents.splice(index, 1);
      }
    },
    async findForPatient({ documentId, appointmentId, patientId }) {
      return documents.find(item => String(item._id) === String(documentId)
        && item.appointment_id === String(appointmentId) && item.patient_id === String(patientId)) ?? null;
    },
    async findForAppointment({ documentId, appointmentId }) {
      return documents.find(item => String(item._id) === String(documentId)
        && item.appointment_id === String(appointmentId)) ?? null;
    },
  };
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
  const supportingDocumentModule = createSupportingDocumentModule({ repository, storage, now: () => new Date('2026-10-13T00:00:00Z') });
  const securityLogger = { logSecurityEvent(event) { events.push(event); } };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, supportingDocumentModule, securityLogger });
  return {
    app, appointments, recorded, documents, stored, events, controls,
    cookie(profileId, mfaVerified = false) { return `arion_auth=${tokens.sign(profileId, { mfaVerified })}`; },
  };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const PDF = Buffer.from('%PDF-1.7\ncontent');
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

function form(files, extraField = null) {
  const data = new FormData();
  files.forEach(file => data.append(file.field ?? 'files', new Blob([file.bytes], { type: file.type ?? 'application/octet-stream' }), file.name));
  if (extraField) data.append(extraField, 'not allowed');
  return data;
}

function upload(base, appointmentId, cookie, files, extraField = null) {
  return fetch(`${base}/api/patient/appointments/${appointmentId}/supporting-documents`, {
    method: 'POST', headers: cookie ? { cookie } : {}, body: form(files, extraField),
  });
}

const onePdf = [{ name: 'result.pdf', bytes: PDF, type: 'application/pdf' }];

test('active Patient uploads PDF to own Pending appointment with no public URL', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const response = await upload(base, ids.pending, context.cookie(ids.patientAProfile), onePdf);
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.supporting_documents.length, 1);
    assert.equal(body.supporting_documents[0].mime_type, 'application/pdf');
    assert.equal('storage_file_id' in body.supporting_documents[0], false);
    assert.equal(JSON.stringify(body).includes('url'), false);
    assert.equal(context.appointments.get(ids.pending).status, 'pending');
  });
});

test('Confirmed owned appointment accepts supporting documents', async () => {
  const context = createContext();
  await withServer(context.app, async base => assert.equal((await upload(base, ids.confirmed, context.cookie(ids.patientAProfile), onePdf)).status, 201));
});

test('upload authentication, active-account, role, and ownership boundaries are enforced', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    assert.equal((await upload(base, ids.pending, null, onePdf)).status, 401);
    assert.equal((await upload(base, ids.pending, context.cookie(ids.inactiveProfile), onePdf)).status, 403);
    for (const profileId of [ids.staffProfile, ids.doctorAProfile, ids.adminProfile]) {
      assert.equal((await upload(base, ids.pending, context.cookie(profileId, profileId === ids.adminProfile), onePdf)).status, 403);
    }
    assert.equal((await upload(base, ids.other, context.cookie(ids.patientAProfile), onePdf)).status, 404);
  });
});

for (const [label, appointmentId] of [['Cancelled', ids.cancelled], ['No-show', ids.noShow], ['Completed', ids.completed]]) {
  test(`${label} appointment rejects upload`, async () => {
    const context = createContext();
    await withServer(context.app, async base => {
      const response = await upload(base, appointmentId, context.cookie(ids.patientAProfile), onePdf);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'APPOINTMENT_NOT_ELIGIBLE_FOR_UPLOAD');
    });
  });
}

test('appointment with Medical Record rejects upload', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const response = await upload(base, ids.recorded, context.cookie(ids.patientAProfile), onePdf);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, 'MEDICAL_RECORD_EXISTS');
  });
});

for (const file of [
  { label: 'PDF', name: 'result.pdf', bytes: PDF, expected: 'application/pdf' },
  { label: 'PNG', name: 'image.png', bytes: PNG, expected: 'image/png' },
  { label: 'JPG', name: 'photo.jpg', bytes: JPEG, expected: 'image/jpeg' },
  { label: 'JPEG', name: 'photo.jpeg', bytes: JPEG, expected: 'image/jpeg' },
]) {
  test(`${file.label} actual signature is accepted`, async () => {
    const context = createContext();
    await withServer(context.app, async base => {
      const response = await upload(base, ids.pending, context.cookie(ids.patientAProfile), [file]);
      assert.equal(response.status, 201);
      assert.equal((await response.json()).supporting_documents[0].mime_type, file.expected);
    });
  });
}

for (const file of [
  { label: 'executable', name: 'malware.exe', bytes: Buffer.from('MZ executable') },
  { label: 'ZIP', name: 'archive.zip', bytes: Buffer.from('PK\x03\x04') },
  { label: 'SVG', name: 'image.svg', bytes: Buffer.from('<svg><script/></svg>') },
  { label: 'DOCX', name: 'document.docx', bytes: Buffer.from('PK\x03\x04') },
  { label: 'renamed executable', name: 'malware.pdf', bytes: Buffer.from('MZ executable'), type: 'application/pdf' },
  { label: 'fake JPG MIME', name: 'fake.jpg', bytes: Buffer.from('<html>bad</html>'), type: 'image/jpeg' },
  { label: 'mismatched extension', name: 'image.pdf', bytes: PNG, type: 'application/pdf' },
]) {
  test(`${file.label} is rejected by content/extension validation`, async () => {
    const context = createContext();
    await withServer(context.app, async base => {
      const response = await upload(base, ids.pending, context.cookie(ids.patientAProfile), [file]);
      assert.equal(response.status, 400);
      assert.equal(context.stored.size, 0);
    });
  });
}

test('unexpected multipart fields and file field names are rejected', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    assert.equal((await upload(base, ids.pending, context.cookie(ids.patientAProfile), onePdf, 'patient_id')).status, 400);
    assert.equal((await upload(base, ids.pending, context.cookie(ids.patientAProfile), [{ ...onePdf[0], field: 'document' }])).status, 400);
  });
});

test('5 MB file and five-file batch are accepted', async () => {
  const context = createContext();
  const exact = Buffer.alloc(5 * 1024 * 1024); PDF.copy(exact);
  await withServer(context.app, async base => {
    const exactResponse = await upload(base, ids.pending, context.cookie(ids.patientAProfile), [{ name: 'large.pdf', bytes: exact }]);
    assert.equal(exactResponse.status, 201);
    const five = [0, 1, 2, 3].map(index => ({ name: `small-${index}.pdf`, bytes: PDF }));
    const response = await upload(base, ids.confirmed, context.cookie(ids.patientAProfile), five.concat({ name: 'small-4.pdf', bytes: PDF }));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).supporting_documents.length, 5);
  });
});

test('over 5 MB file and over five files are rejected before storage', async () => {
  const context = createContext();
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1); PDF.copy(oversized);
  await withServer(context.app, async base => {
    assert.equal((await upload(base, ids.pending, context.cookie(ids.patientAProfile), [{ name: 'large.pdf', bytes: oversized }])).status, 413);
    assert.equal((await upload(base, ids.pending, context.cookie(ids.patientAProfile), Array.from({ length: 6 }, (_, index) => ({ name: `${index}.pdf`, bytes: PDF })))).status, 400);
    assert.equal(context.stored.size, 0);
  });
});

test('existing plus new count and combined 25 MB total are enforced', async () => {
  const context = createContext();
  context.documents.push(...Array.from({ length: 5 }, (_, slot) => ({ _id: `${slot}`.padStart(24, '0'), appointment_id: ids.pending, patient_id: ids.patientA, slot, file_size: 10, uploaded_at: new Date(), original_filename: 'old.pdf', mime_type: 'application/pdf' })));
  await withServer(context.app, async base => assert.equal((await upload(base, ids.pending, context.cookie(ids.patientAProfile), onePdf)).status, 409));
  context.documents.length = 0;
  context.documents.push({ _id: '099999999999999999999999', appointment_id: ids.pending, patient_id: ids.patientA, slot: 0, file_size: 21 * 1024 * 1024, uploaded_at: new Date(), original_filename: 'legacy.pdf', mime_type: 'application/pdf' });
  await withServer(context.app, async base => {
    const fiveMb = Buffer.alloc(5 * 1024 * 1024); PDF.copy(fiveMb);
    assert.equal((await upload(base, ids.pending, context.cookie(ids.patientAProfile), [{ name: 'large.pdf', bytes: fiveMb }])).status, 413);
  });
});

test('Patient lists and retrieves only own appointment document with safe headers', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const uploaded = await (await upload(base, ids.pending, context.cookie(ids.patientAProfile), [{ name: 'résult report.pdf', bytes: PDF }])).json();
    const documentId = uploaded.supporting_documents[0].id;
    const list = await fetch(`${base}/api/patient/appointments/${ids.pending}/supporting-documents`, { headers: { cookie: context.cookie(ids.patientAProfile) } });
    assert.equal((await list.json()).supporting_documents.length, 1);
    const response = await fetch(`${base}/api/patient/appointments/${ids.pending}/supporting-documents/${documentId}`, { headers: { cookie: context.cookie(ids.patientAProfile) } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition'), /^attachment;/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), PDF);
    assert.equal((await fetch(`${base}/api/patient/appointments/${ids.other}/supporting-documents/${documentId}`, { headers: { cookie: context.cookie(ids.patientAProfile) } })).status, 404);
  });
});

test('Doctor retrieves assigned appointment document before Medical Record; unrelated Doctor is denied', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const body = await (await upload(base, ids.confirmed, context.cookie(ids.patientAProfile), onePdf)).json();
    const path = `/api/doctor/appointments/${ids.confirmed}/supporting-documents/${body.supporting_documents[0].id}`;
    assert.equal((await fetch(`${base}${path}`, { headers: { cookie: context.cookie(ids.doctorAProfile) } })).status, 200);
    assert.equal((await fetch(`${base}${path}`, { headers: { cookie: context.cookie(ids.doctorBProfile) } })).status, 404);
    assert.equal((await fetch(`${base}/api/doctor/appointments/${ids.confirmed}/supporting-documents`, { headers: { cookie: context.cookie(ids.doctorAProfile) } })).status, 200);
  });
});

test('Medical Record ends Doctor access but Patient retains access', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const body = await (await upload(base, ids.confirmed, context.cookie(ids.patientAProfile), onePdf)).json();
    const documentId = body.supporting_documents[0].id;
    context.recorded.add(ids.confirmed);
    assert.equal((await fetch(`${base}/api/doctor/appointments/${ids.confirmed}/supporting-documents/${documentId}`, { headers: { cookie: context.cookie(ids.doctorAProfile) } })).status, 403);
    assert.equal((await fetch(`${base}/api/doctor/appointments/${ids.confirmed}/supporting-documents`, { headers: { cookie: context.cookie(ids.doctorAProfile) } })).status, 403);
    assert.equal((await fetch(`${base}/api/patient/appointments/${ids.confirmed}/supporting-documents/${documentId}`, { headers: { cookie: context.cookie(ids.patientAProfile) } })).status, 200);
  });
});

test('Staff/Admin have no content route and no generic public file route exists', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const body = await (await upload(base, ids.pending, context.cookie(ids.patientAProfile), onePdf)).json();
    const suffix = `/appointments/${ids.pending}/supporting-documents/${body.supporting_documents[0].id}`;
    assert.equal((await fetch(`${base}/api/patient${suffix}`, { headers: { cookie: context.cookie(ids.staffProfile) } })).status, 403);
    assert.equal((await fetch(`${base}/api/doctor${suffix}`, { headers: { cookie: context.cookie(ids.adminProfile, true) } })).status, 403);
    assert.equal((await fetch(`${base}/api/files/${body.supporting_documents[0].id}`)).status, 404);
    assert.equal((await fetch(`${base}/api/patient${suffix}`, { method: 'DELETE', headers: { cookie: context.cookie(ids.patientAProfile) } })).status, 404);
  });
});

test('document remains bound to original appointment and cannot appear under another appointment', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const body = await (await upload(base, ids.pending, context.cookie(ids.patientAProfile), onePdf)).json();
    const documentId = body.supporting_documents[0].id;
    assert.equal((await fetch(`${base}/api/patient/appointments/${ids.confirmed}/supporting-documents/${documentId}`, { headers: { cookie: context.cookie(ids.patientAProfile) } })).status, 404);
    assert.equal(context.documents[0].appointment_id, ids.pending);
  });
});

test('filename is sanitized and bounded while storage uses a generated filename', async () => {
  assert.equal(sanitizeSupportingDocumentFilename('../../<script>.png'), '_script_.png');
  assert.ok(sanitizeSupportingDocumentFilename(`${'a'.repeat(200)}.pdf`).length <= 120);
  const context = createContext();
  await withServer(context.app, async base => {
    await upload(base, ids.pending, context.cookie(ids.patientAProfile), [{ name: '<script>.png', bytes: PNG }]);
    assert.equal(context.documents[0].original_filename, '_script_.png');
    assert.match(context.documents[0].stored_filename, /^generated-\d+\.png$/);
    assert.notEqual(context.documents[0].stored_filename, context.documents[0].original_filename);
  });
});

test('invalid batch persists nothing and storage failure cleans partial files without changing appointment', async () => {
  const context = createContext();
  const before = structuredClone(context.appointments.get(ids.pending));
  await withServer(context.app, async base => {
    const invalid = await upload(base, ids.pending, context.cookie(ids.patientAProfile), [onePdf[0], { name: 'bad.jpg', bytes: Buffer.from('bad') }]);
    assert.equal(invalid.status, 400);
    assert.equal(context.stored.size, 0);
    context.controls.storageFailureAt = 1;
    const failed = await upload(base, ids.pending, context.cookie(ids.patientAProfile), [onePdf[0], { name: 'second.png', bytes: PNG }]);
    assert.equal(failed.status, 503);
    assert.equal((await failed.json()).error.code, 'SUPPORTING_DOCUMENT_UPLOAD_UNAVAILABLE');
    assert.equal(context.stored.size, 0);
    assert.deepEqual(context.appointments.get(ids.pending), before);
  });
});

test('metadata failure cleans GridFS files and partially created metadata', async () => {
  const context = createContext();
  context.controls.metadataFailure = true;
  await withServer(context.app, async base => {
    const response = await upload(base, ids.pending, context.cookie(ids.patientAProfile), onePdf);
    assert.equal(response.status, 503);
    assert.equal(context.stored.size, 0);
    assert.equal(context.documents.length, 0);
  });
});

test('upload logs no filename or bytes and assistant/provider modules receive no document', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    await upload(base, ids.pending, context.cookie(ids.patientAProfile), [{ name: 'private-result.pdf', bytes: PDF }]);
    const serialized = JSON.stringify(context.events);
    assert.equal(serialized.includes('private-result'), false);
    assert.equal(serialized.includes(PDF.toString()), false);
    assert.equal(serialized.includes('openai'), false);
    assert.match(serialized, /SUPPORTING_DOCUMENT_UPLOAD_SUCCESS/);
  });
});
