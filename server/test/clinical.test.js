import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { createApp } from '../src/app.js';
import { createClinicalModule } from '../src/services/clinicalModule.js';
import { createTokenService } from '../src/services/tokenService.js';

const SECRET = 'clinical-test-secret-123456789012345678901';
const ids = {
  patientProfile: '111111111111111111111111', otherPatientProfile: '222222222222222222222222',
  doctorProfile: '333333333333333333333333', otherDoctorProfile: '444444444444444444444444',
  staffProfile: '555555555555555555555555', adminProfile: '666666666666666666666666',
  patient: 'aaaaaaaaaaaaaaaaaaaaaaaa', otherPatient: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  doctor: 'cccccccccccccccccccccccc', otherDoctor: 'dddddddddddddddddddddddd',
  confirmed: '100000000000000000000001', unchecked: '100000000000000000000002',
  otherDoctorAppointment: '100000000000000000000003', cancelled: '100000000000000000000004',
  noShow: '100000000000000000000005', completed: '100000000000000000000006',
};

function clone(value) { return value == null ? value : structuredClone(value); }

function createContext({ certificateIssuanceEnabled = true, notificationTriggers, smsReminders, doctorStatus = 'active', missingSignature = false } = {}) {
  const profiles = new Map([
    [ids.patientProfile, { user_profile_id: ids.patientProfile, display_name: 'Alex Patient', role: 'patient', status: 'active' }],
    [ids.otherPatientProfile, { user_profile_id: ids.otherPatientProfile, display_name: 'Other Patient', role: 'patient', status: 'active' }],
    [ids.doctorProfile, { user_profile_id: ids.doctorProfile, display_name: 'Dr. Maria Santos', role: 'doctor', status: doctorStatus }],
    [ids.otherDoctorProfile, { user_profile_id: ids.otherDoctorProfile, display_name: 'Dr. Other', role: 'doctor', status: 'active' }],
    [ids.staffProfile, { user_profile_id: ids.staffProfile, display_name: 'Staff', role: 'staff', status: 'active' }],
    [ids.adminProfile, { user_profile_id: ids.adminProfile, display_name: 'Admin', role: 'admin', status: 'active' }],
  ]);
  const patients = new Map([
    [ids.patient, { _id: ids.patient, user_profile_id: ids.patientProfile, full_name: 'Alex Patient' }],
    [ids.otherPatient, { _id: ids.otherPatient, user_profile_id: ids.otherPatientProfile, full_name: 'Other Patient' }],
  ]);
  const doctors = new Map([
    [ids.doctor, { _id: ids.doctor, user_profile_id: ids.doctorProfile, specialty: 'General Medicine', license_number: 'LIC-100', ptr_number: 'PTR-100', signature_path: 'protected/maria.png' }],
    [ids.otherDoctor, { _id: ids.otherDoctor, user_profile_id: ids.otherDoctorProfile, specialty: 'Family Medicine', license_number: 'LIC-200', ptr_number: 'PTR-200', signature_path: null }],
  ]);
  for (const doctor of doctors.values()) doctor.user_profile_id = { _id: doctor.user_profile_id, display_name: profiles.get(doctor.user_profile_id).display_name };
  const appointment = (id, patientId, doctorId, status, checked = true) => ({
    _id: id, patient_id: patientId, doctor_id: doctorId, appointment_at: new Date('2026-09-25T02:00:00Z'),
    status, visit_type: 'general_consultation', reason: 'Consultation', check_in_at: checked ? new Date('2026-09-25T01:45:00Z') : null,
  });
  const appointments = new Map([
    [ids.confirmed, appointment(ids.confirmed, ids.patient, ids.doctor, 'confirmed')],
    [ids.unchecked, appointment(ids.unchecked, ids.patient, ids.doctor, 'confirmed', false)],
    [ids.otherDoctorAppointment, appointment(ids.otherDoctorAppointment, ids.patient, ids.otherDoctor, 'confirmed')],
    [ids.cancelled, appointment(ids.cancelled, ids.patient, ids.doctor, 'cancelled')],
    [ids.noShow, appointment(ids.noShow, ids.patient, ids.doctor, 'no_show')],
    [ids.completed, appointment(ids.completed, ids.patient, ids.doctor, 'completed')],
  ]);
  const records = new Map();
  const prescriptions = new Map();
  const certificates = new Map();
  const certificateArtifacts = new Map();
  const certificateRuntime = { numberCalls: 0, renders: [] };
  const priorityAudits = [{ _id: '800000000000000000000001', appointment_id: ids.confirmed, previous_priority: 'normal', new_priority: 'urgent', urgency_reason: 'Severe pain or discomfort', explanation: null, correction_reason: null, staff_actor_user_profile_id: { _id: ids.staffProfile, display_name: 'Staff' }, created_at: new Date('2026-09-25T01:50:00Z') }];
  let sequence = 100;
  const nextId = () => (++sequence).toString(16).padStart(24, '0');
  const populateRecord = (record) => record ? {
    ...clone(record), patient_id: clone(patients.get(String(record.patient_id?._id ?? record.patient_id))),
    doctor_id: clone(doctors.get(String(record.doctor_id?._id ?? record.doctor_id))),
    appointment_id: clone(appointments.get(String(record.appointment_id?._id ?? record.appointment_id))),
  } : null;
  const populateCertificate = (certificate) => {
    if (!certificate) return null;
    const record = records.get(String(certificate.medical_record_id?._id ?? certificate.medical_record_id));
    return {
      ...clone(certificate),
      patient_id: clone(patients.get(String(certificate.patient_id?._id ?? certificate.patient_id))),
      doctor_id: clone(doctors.get(String(certificate.doctor_id?._id ?? certificate.doctor_id))),
      medical_record_id: record ? { _id: record._id, appointment_id: clone(appointments.get(String(record.appointment_id))) } : certificate.medical_record_id,
    };
  };

  const repository = {
    failCertificateDuplicates: 0,
    async findDoctorByUserProfileId(profileId) { return clone([...doctors.values()].find((item) => String(item.user_profile_id._id) === String(profileId))); },
    async findPatientByUserProfileId(profileId) { return clone([...patients.values()].find((item) => item.user_profile_id === profileId)); },
    async findPatientById(patientId) { return clone(patients.get(String(patientId))); },
    async findAppointmentById(id) { return clone(appointments.get(String(id))); },
    async listPriorityHistory(id) { return clone(priorityAudits.filter((item) => item.appointment_id === String(id))); },
    async findRecordByAppointmentId(id) { return clone([...records.values()].find((item) => item.appointment_id === String(id))); },
    async listAppointmentsForDoctor(doctorId, { start, end, patientId } = {}) {
      return [...appointments.values()].filter((item) => item.doctor_id === String(doctorId)
        && (!patientId || item.patient_id === String(patientId))
        && (!start || (new Date(item.appointment_at) >= start && new Date(item.appointment_at) < end)))
        .map((item) => ({ ...clone(item), patient_id: clone(patients.get(item.patient_id)) }));
    },
    async listRecordAppointmentIds(appointmentIds) { return [...records.values()].filter((item) => appointmentIds.map(String).includes(String(item.appointment_id))).map((item) => ({ _id: item._id, appointment_id: item.appointment_id })); },
    async createRecordWithPrescriptions(data, inputs) {
      if ([...records.values()].some((item) => item.appointment_id === String(data.appointment_id))) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const record = { _id: nextId(), ...clone(data), patient_id: String(data.patient_id), doctor_id: String(data.doctor_id), appointment_id: String(data.appointment_id), created_at: new Date(), updated_at: new Date() };
      records.set(record._id, record);
      const made = inputs.map((item) => { const value = { _id: nextId(), medical_record_id: record._id, ...clone(item) }; prescriptions.set(value._id, value); return value; });
      return { record: clone(record), prescriptions: clone(made) };
    },
    async listRecordsForPatient(patientId) { return [...records.values()].filter((item) => item.patient_id === String(patientId)).map(populateRecord); },
    async findRecordForPatient(recordId, patientId) { const item = records.get(String(recordId)); return item?.patient_id === String(patientId) ? populateRecord(item) : null; },
    async listRecordsForDoctorPatient(doctorId, patientId) { return [...records.values()].filter((item) => item.doctor_id === String(doctorId) && item.patient_id === String(patientId)).map(populateRecord); },
    async findRecordForDoctor(recordId, doctorId) { const item = records.get(String(recordId)); return item?.doctor_id === String(doctorId) ? populateRecord(item) : null; },
    async listPrescriptions(recordId) { return [...prescriptions.values()].filter((item) => item.medical_record_id === String(recordId)).map(clone); },
    async createCertificate(data) {
      if (this.failCertificateDuplicates-- > 0 || [...certificates.values()].some((item) => item.medical_certificate_number === data.medical_certificate_number)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const value = { _id: nextId(), ...clone(data), patient_id: String(data.patient_id), doctor_id: String(data.doctor_id), medical_record_id: String(data.medical_record_id), created_at: new Date(), updated_at: new Date() };
      certificates.set(value._id, value); return clone(value);
    },
    async listIssuedCertificatesForPatient(patientId) { return [...certificates.values()].filter((item) => item.patient_id === String(patientId) && item.status === 'issued').map(populateCertificate); },
    async findIssuedCertificateForPatient(id, patientId) { const item = certificates.get(String(id)); return item?.patient_id === String(patientId) && item.status === 'issued' ? populateCertificate(item) : null; },
    async findCertificateForDoctor(id, doctorId) { const item = certificates.get(String(id)); return item?.doctor_id === String(doctorId) ? populateCertificate(item) : null; },
    async listIssuedCertificatesForDoctorPatient(doctorId, patientId) { return [...certificates.values()].filter((item) => item.doctor_id === String(doctorId) && item.patient_id === String(patientId) && item.status === 'issued').map(populateCertificate); },
    async completeConfirmedCheckedIn(id, doctorId) { const item = appointments.get(String(id)); if (!item || item.doctor_id !== String(doctorId) || item.status !== 'confirmed' || !item.check_in_at) return null; item.status = 'completed'; return clone(item); },
  };
  const tokens = createTokenService(SECRET);
  const authModule = { tokens, service: { async getAuthenticatedUser(profileId) { const found = profiles.get(String(profileId)); if (!found) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'UNAUTHENTICATED' }); return clone(found); } } };
  const signatureState = { current: Buffer.from('immutable-signature-v1') };
  const doctorSignatureService = { async getDoctorSignatureForCertificate(doctorId) { return missingSignature || String(doctorId) !== ids.doctor ? null : { metadata: { configured: true }, stream: Readable.from(signatureState.current) }; } };
  const certificateArtifactStorage = {
    async upload(buffer) { const storageFileId = nextId(); certificateArtifacts.set(storageFileId, Buffer.from(buffer)); return { storageFileId }; },
    openDownload(storageFileId) { return Readable.from(certificateArtifacts.get(String(storageFileId))); },
    async delete(storageFileId) { certificateArtifacts.delete(String(storageFileId)); },
  };
  const pdfRenderer = (certificate, { signatureBuffer, signatureMissingText }) => { certificateRuntime.renders.push(clone(certificate)); return Buffer.from(`%PDF-1.4\n${certificate.medical_certificate_number}\n${certificate.patient_name}\n${signatureBuffer?.toString() ?? signatureMissingText ?? 'legacy-no-signature'}\n%%EOF\n`); };
  const clinicalModule = createClinicalModule({ repository, clinic: { name: 'Arion Health Clinic', location: 'Quezon City', timeZone: 'Asia/Manila' }, notificationTriggers, smsReminders, doctorSignatureService, certificateArtifactStorage, pdfRenderer, now: () => new Date('2026-09-25T02:15:00Z'), numberGenerator: () => { certificateRuntime.numberCalls += 1; return 'AHC-20260925-ABCDEF12'; }, certificateIssuanceEnabled });
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, clinicalModule });
  return { app, appointments, records, prescriptions, certificates, certificateArtifacts, certificateRuntime, signatureState, priorityAudits, repository, cookie: (profileId) => `arion_auth=${tokens.sign(profileId, { mfaVerified: profiles.get(String(profileId))?.role === 'admin' })}` };
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await callback(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); }
}
function request(base, path, { method = 'GET', cookie, body } = {}) { return fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
const recordBody = { diagnosis: 'Viral upper respiratory infection', notes: 'Rest advised', follow_up: 'Return in seven days', prescriptions: [{ medicine: 'Paracetamol', dosage: '500 mg', instructions: 'Every six hours as needed' }] };
const certificateBody = { purpose: 'Fit to Return', diagnosis_summary: 'Recovered from viral infection', recommendation: 'May return to regular duties.', valid_until: '2026-10-02' };

test('Doctor reads only own assigned appointments with safe Patient context', async () => { const context = createContext(); await withServer(context.app, async (base) => { const response = await request(base, `/api/doctor/appointments?patient_id=${ids.patient}`, { cookie: context.cookie(ids.doctorProfile) }); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.appointments.length, 5); assert.equal(body.appointments[0].patient.full_name, 'Alex Patient'); assert.equal(body.appointments.some((item) => item.id === ids.otherDoctorAppointment), false); assert.equal('address' in body.appointments[0].patient, false); assert.equal((await request(base, '/api/doctor/appointments', { cookie: context.cookie(ids.patientProfile) })).status, 403); }); });

test('assigned Doctor reads safe priority history while unrelated Doctor and other roles are denied', async () => { const context = createContext(); await withServer(context.app, async (base) => { const response = await request(base, `/api/doctor/appointments/${ids.confirmed}/priority-history`, { cookie: context.cookie(ids.doctorProfile) }); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.priority_history[0].urgency_reason, 'Severe pain or discomfort'); assert.equal(JSON.stringify(body).includes('diagnosis'), false); assert.equal((await request(base, `/api/doctor/appointments/${ids.otherDoctorAppointment}/priority-history`, { cookie: context.cookie(ids.doctorProfile) })).status, 403); assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/priority-history`)).status, 401); for (const profile of [ids.patientProfile, ids.staffProfile, ids.adminProfile]) assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/priority-history`, { cookie: context.cookie(profile) })).status, 403); }); });

async function createRecord(context, base, appointmentId = ids.confirmed) {
  const response = await request(base, `/api/doctor/appointments/${appointmentId}/medical-record`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: recordBody });
  return { response, body: await response.json() };
}

test('Doctor creates an assigned MedicalRecord and linked Prescription', async () => {
  const context = createContext(); await withServer(context.app, async (base) => { const { response, body } = await createRecord(context, base); assert.equal(response.status, 201); assert.equal(body.medical_record.diagnosis, recordBody.diagnosis); assert.equal(body.medical_record.prescriptions[0].medicine, 'Paracetamol'); assert.equal(context.records.size, 1); assert.equal(context.prescriptions.size, 1); });
});

test('record creation derives Patient and Doctor and rejects client ownership fields', async () => {
  const context = createContext(); await withServer(context.app, async (base) => { const response = await request(base, `/api/doctor/appointments/${ids.confirmed}/medical-record`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: { ...recordBody, patient_id: ids.otherPatient } }); assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'UNSUPPORTED_FIELD'); });
});

test('Doctor cannot create a record for another Doctor appointment', async () => {
  const context = createContext(); await withServer(context.app, async (base) => assert.equal((await createRecord(context, base, ids.otherDoctorAppointment)).response.status, 403));
});

for (const [role, profile] of [['Patient', ids.patientProfile], ['Staff', ids.staffProfile], ['Admin', ids.adminProfile]]) {
  test(`${role} cannot create a MedicalRecord`, async () => { const context = createContext(); await withServer(context.app, async (base) => assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/medical-record`, { method: 'POST', cookie: context.cookie(profile), body: recordBody })).status, 403)); });
}

test('duplicate MedicalRecord for one appointment is rejected', async () => { const context = createContext(); await withServer(context.app, async (base) => { assert.equal((await createRecord(context, base)).response.status, 201); const duplicate = await createRecord(context, base); assert.equal(duplicate.response.status, 409); assert.equal(duplicate.body.error.code, 'MEDICAL_RECORD_EXISTS'); }); });
test('missing diagnosis and incomplete prescriptions are rejected', async () => { const context = createContext(); await withServer(context.app, async (base) => { for (const body of [{ prescriptions: [] }, { diagnosis: 'A', prescriptions: [{ medicine: '', dosage: '1' }] }]) assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/medical-record`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body })).status, 400); }); });
for (const appointmentId of [ids.cancelled, ids.noShow, ids.completed]) test(`${appointmentId} ineligible state rejects record creation`, async () => { const context = createContext(); await withServer(context.app, async (base) => assert.equal((await createRecord(context, base, appointmentId)).response.status, 409)); });

test('saved MedicalRecords expose no edit or delete route', async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); const recordId = created.body.medical_record.id; for (const method of ['PATCH', 'DELETE']) assert.equal((await request(base, `/api/doctor/records/${recordId}`, { method, cookie: context.cookie(ids.doctorProfile), body: method === 'PATCH' ? { diagnosis: 'Changed' } : undefined })).status, 404); }); });

test('Patient reads own records with prescriptions but not another Patient records', async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); const id = created.body.medical_record.id; assert.equal((await request(base, '/api/patient/records', { cookie: context.cookie(ids.patientProfile) })).status, 200); assert.equal((await request(base, `/api/patient/records/${id}`, { cookie: context.cookie(ids.patientProfile) })).status, 200); assert.equal((await request(base, `/api/patient/records/${id}`, { cookie: context.cookie(ids.otherPatientProfile) })).status, 404); }); });

test('Doctor reads only own consultation records', async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); const id = created.body.medical_record.id; assert.equal((await request(base, `/api/doctor/patients/${ids.patient}/records`, { cookie: context.cookie(ids.doctorProfile) })).status, 200); assert.equal((await request(base, `/api/doctor/records/${id}`, { cookie: context.cookie(ids.doctorProfile) })).status, 200); assert.equal((await request(base, `/api/doctor/records/${id}`, { cookie: context.cookie(ids.otherDoctorProfile) })).status, 404); }); });

test('Doctor issues a server-numbered certificate with structured content and trusted dates', async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); const response = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: { ...certificateBody, medical_certificate_number: 'CLIENT' } }); assert.equal(response.status, 400); const issued = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody }); const body = await issued.json(); assert.equal(issued.status, 201); assert.equal(body.medical_certificate.medical_certificate_number, 'AHC-20260925-ABCDEF12'); assert.equal(body.medical_certificate.status, 'issued'); assert.equal(body.medical_certificate.date_issued, '2026-09-25'); assert.equal(body.medical_certificate.consultation_date, '2026-09-25'); assert.equal(body.medical_certificate.purpose_code, 'Fit to Return'); assert.equal(body.medical_certificate.recommendation, certificateBody.recommendation); assert.match(body.medical_certificate.statement, /may return to regular duties as stated in the recommendation below/); assert.equal(body.medical_certificate.doctor.license_number, 'LIC-100'); assert.equal(body.medical_certificate.doctor.ptr_number, 'PTR-100'); assert.equal(body.medical_certificate.doctor.signature_available, true); assert.equal('signature_path' in body.medical_certificate.doctor, false); assert.equal(body.medical_certificate.clinic.location, 'Quezon City'); for (const excluded of ['notes', 'prescriptions', 'supporting_documents']) assert.equal(excluded in body.medical_certificate, false); }); });

test('new issuance requires a configured Doctor signature and stores no partial artifact', async () => {
  const context = createContext({ missingSignature: true });
  await withServer(context.app, async base => {
    const created = await createRecord(context, base);
    const response = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody });
    assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'DOCTOR_SIGNATURE_REQUIRED');
  });
  assert.equal(context.certificates.size, 0); assert.equal(context.certificateArtifacts.size, 0);
});

test('Doctor draft preview is owner-scoped, branded-state ready, and completely non-persistent', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const created = await createRecord(context, base);
    const path = `/api/doctor/records/${created.body.medical_record.id}/certificates/preview`;
    const preview = await request(base, path, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody });
    const bytes = Buffer.from(await preview.arrayBuffer());
    assert.equal(preview.status, 200); assert.equal(preview.headers.get('content-type'), 'application/pdf');
    assert.match(preview.headers.get('cache-control'), /private/); assert.match(preview.headers.get('content-disposition'), /^inline/);
    assert.match(bytes.toString(), /DRAFT PREVIEW/); assert.equal(context.certificateRuntime.renders.at(-1).doctor_name, 'Dr. Maria Santos'); assert.match(bytes.toString(), /immutable-signature-v1/);
    assert.equal(context.certificates.size, 0); assert.equal(context.certificateArtifacts.size, 0); assert.equal(context.certificateRuntime.numberCalls, 0);
    assert.equal((await request(base, path, { method: 'POST', cookie: context.cookie(ids.otherDoctorProfile), body: certificateBody })).status, 404);
    for (const profile of [ids.patientProfile, ids.staffProfile, ids.adminProfile]) assert.equal((await request(base, path, { method: 'POST', cookie: context.cookie(profile), body: certificateBody })).status, 403);
  });
});

test('draft preview shows missing signature safely and respects active-account and Production gates', async () => {
  const missing = createContext({ missingSignature: true });
  await withServer(missing.app, async base => {
    const created = await createRecord(missing, base);
    const response = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates/preview`, { method: 'POST', cookie: missing.cookie(ids.doctorProfile), body: certificateBody });
    assert.equal(response.status, 200); assert.match(Buffer.from(await response.arrayBuffer()).toString(), /Signature not configured - preview only/);
  });
  const inactive = createContext({ doctorStatus: 'inactive' });
  await withServer(inactive.app, async base => assert.equal((await request(base, `/api/doctor/records/${ids.confirmed}/certificates/preview`, { method: 'POST', cookie: inactive.cookie(ids.doctorProfile), body: certificateBody })).status, 403));
  const restricted = createContext({ certificateIssuanceEnabled: false });
  await withServer(restricted.app, async base => {
    const created = await createRecord(restricted, base);
    assert.equal((await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates/preview`, { method: 'POST', cookie: restricted.cookie(ids.doctorProfile), body: certificateBody })).status, 503);
  });
  for (const context of [missing, inactive, restricted]) {
    assert.equal(context.certificates.size, 0); assert.equal(context.certificateArtifacts.size, 0); assert.equal(context.certificateRuntime.numberCalls, 0);
  }
});

test('immutable PDF artifact is owner-scoped and survives current-signature replacement unchanged', async () => {
  const context = createContext();
  await withServer(context.app, async base => {
    const created = await createRecord(context, base);
    const issued = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody });
    const certificate = (await issued.json()).medical_certificate;
    assert.equal(context.certificateRuntime.renders.at(-1).doctor_name, 'Dr. Maria Santos');
    const first = await request(base, `/api/doctor/certificates/${certificate.id}/pdf`, { cookie: context.cookie(ids.doctorProfile) });
    const original = Buffer.from(await first.arrayBuffer()); assert.equal(first.status, 200); assert.equal(first.headers.get('content-type'), 'application/pdf');
    assert.match(first.headers.get('cache-control'), /private/); assert.ok(first.headers.get('etag')?.startsWith('"sha256-'));
    context.signatureState.current = Buffer.from('immutable-signature-v2');
    const second = await request(base, `/api/patient/certificates/${certificate.id}/pdf`, { cookie: context.cookie(ids.patientProfile) });
    assert.deepEqual(Buffer.from(await second.arrayBuffer()), original);
    for (const profile of [ids.otherPatientProfile, ids.otherDoctorProfile, ids.staffProfile, ids.adminProfile]) {
      const rolePath = profile === ids.otherDoctorProfile ? `/api/doctor/certificates/${certificate.id}/pdf` : `/api/patient/certificates/${certificate.id}/pdf`;
      assert.ok([403, 404].includes((await request(base, rolePath, { cookie: context.cookie(profile) })).status));
    }
  });
});

test('restricted Production certificate issuance fails closed through the direct API', async () => {
  const context = createContext({ certificateIssuanceEnabled: false });
  await withServer(context.app, async (base) => {
    const created = await createRecord(context, base);
    const response = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, {
      method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody,
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'CERTIFICATE_ISSUANCE_DISABLED');
    assert.equal(context.certificates.size, 0);
  });
});

test('certificate number collisions retry and then return controlled conflict', async () => { const context = createContext(); context.repository.failCertificateDuplicates = 3; await withServer(context.app, async (base) => { const created = await createRecord(context, base); const response = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody }); assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'CERTIFICATE_NUMBER_CONFLICT'); }); });
test('valid_until before the server issue date is rejected', async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); const response = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: { ...certificateBody, valid_until: '2026-09-24' } }); assert.equal(response.status, 400); }); });

test('certificate input enforces the purpose allowlist and server-owned issue date', async () => {
  const context = createContext();
  await withServer(context.app, async (base) => {
    const created = await createRecord(context, base);
    const path = `/api/doctor/records/${created.body.medical_record.id}/certificates`;
    for (const body of [
      { ...certificateBody, purpose: 'Fit to Work' },
      { ...certificateBody, purpose: 'Sick Leave', custom_purpose: 'Hidden override' },
      { ...certificateBody, date_issued: '2030-01-01' },
    ]) {
      const response = await request(base, path, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body });
      assert.equal(response.status, 400);
    }
  });
});

test('Other purpose requires bounded safe plain text', async () => {
  const context = createContext();
  await withServer(context.app, async (base) => {
    const created = await createRecord(context, base);
    const path = `/api/doctor/records/${created.body.medical_record.id}/certificates`;
    for (const custom_purpose of [undefined, 'x'.repeat(101), '<img src=x onerror=alert(1)>']) {
      const body = { ...certificateBody, purpose: 'Other' };
      if (custom_purpose !== undefined) body.custom_purpose = custom_purpose;
      assert.equal((await request(base, path, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body })).status, 400);
    }
    const safe = await request(base, path, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: { ...certificateBody, purpose: 'Other', custom_purpose: 'Insurance documentation' } });
    const certificate = (await safe.json()).medical_certificate;
    assert.equal(safe.status, 201);
    assert.equal(certificate.purpose, 'Insurance documentation');
    assert.match(certificate.statement, /for Insurance documentation\.$/);
  });
});

test('certificate diagnosis and recommendation are required, bounded, and plain text', async () => {
  for (const change of [
    { diagnosis_summary: 'x'.repeat(501) },
    { recommendation: 'x'.repeat(501) },
    { diagnosis_summary: '<script>alert(1)</script>' },
    { recommendation: '' },
  ]) {
    const context = createContext();
    await withServer(context.app, async (base) => {
      const created = await createRecord(context, base);
      const response = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: { ...certificateBody, ...change } });
      assert.equal(response.status, 400);
    });
  }
});

test('Patient and inactive Doctor cannot issue certificates', async () => {
  const active = createContext();
  await withServer(active.app, async (base) => {
    const created = await createRecord(active, base);
    assert.equal((await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: active.cookie(ids.patientProfile), body: certificateBody })).status, 403);
  });
  const inactive = createContext({ doctorStatus: 'inactive' });
  await withServer(inactive.app, async (base) => {
    assert.equal((await request(base, `/api/doctor/records/900000000000000000000001/certificates`, { method: 'POST', cookie: inactive.cookie(ids.doctorProfile), body: certificateBody })).status, 403);
  });
});
for (const [role, profile] of [['Staff', ids.staffProfile], ['Admin', ids.adminProfile]]) test(`${role} cannot issue a certificate`, async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); assert.equal((await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(profile), body: certificateBody })).status, 403); }); });

test('Patient reads own issued certificates and cannot read another Patient certificate', async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); const issued = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody }); const cert = (await issued.json()).medical_certificate; assert.equal((await request(base, '/api/patient/certificates', { cookie: context.cookie(ids.patientProfile) })).status, 200); assert.equal((await request(base, `/api/patient/certificates/${cert.id}`, { cookie: context.cookie(ids.patientProfile) })).status, 200); assert.equal((await request(base, `/api/patient/certificates/${cert.id}`, { cookie: context.cookie(ids.otherPatientProfile) })).status, 404); assert.equal((await request(base, `/api/doctor/certificates/${cert.id}`, { cookie: context.cookie(ids.doctorProfile) })).status, 200); assert.equal((await request(base, `/api/doctor/certificates/${cert.id}`, { cookie: context.cookie(ids.otherDoctorProfile) })).status, 404); }); });

test('issued certificates expose no edit or delete route', async () => { const context = createContext(); await withServer(context.app, async (base) => { const created = await createRecord(context, base); const issued = await request(base, `/api/doctor/records/${created.body.medical_record.id}/certificates`, { method: 'POST', cookie: context.cookie(ids.doctorProfile), body: certificateBody }); const cert = (await issued.json()).medical_certificate; for (const method of ['PATCH', 'DELETE']) assert.equal((await request(base, `/api/doctor/certificates/${cert.id}`, { method, cookie: context.cookie(ids.doctorProfile), body: method === 'PATCH' ? { status: 'draft' } : undefined })).status, 404); }); });

test('Doctor completes checked-in confirmed appointment only after record exists', async () => { const context = createContext(); await withServer(context.app, async (base) => { assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, { method: 'PATCH', cookie: context.cookie(ids.doctorProfile) })).status, 409); const created = await createRecord(context, base); const response = await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, { method: 'PATCH', cookie: context.cookie(ids.doctorProfile) }); assert.equal(response.status, 200); assert.equal((await response.json()).appointment.status, 'completed'); assert.ok(context.records.has(created.body.medical_record.id)); assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, { method: 'PATCH', cookie: context.cookie(ids.doctorProfile) })).status, 409); }); });

test('Doctor completion invokes the Patient notification trigger only after the successful transition', async () => {
  const calls = [];
  const context = createContext({
    notificationTriggers: {
      async appointmentCompleted(value) { calls.push(structuredClone(value)); },
    },
  });
  await withServer(context.app, async (base) => {
    assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, {
      method: 'PATCH', cookie: context.cookie(ids.doctorProfile),
    })).status, 409);
    await createRecord(context, base);
    assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, {
      method: 'PATCH', cookie: context.cookie(ids.doctorProfile),
    })).status, 200);
    assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, {
      method: 'PATCH', cookie: context.cookie(ids.doctorProfile),
    })).status, 409);
  });
  assert.deepEqual(calls, [{ appointmentId: ids.confirmed, patientId: ids.patient }]);
});

test('Doctor completion invalidates SMS reminders without rolling back on reminder failure', async () => {
  const calls = [];
  const context = createContext({
    smsReminders: {
      async appointmentCompleted(value) {
        calls.push(structuredClone(value));
        throw new Error('SMS reminder storage unavailable');
      },
    },
  });
  await withServer(context.app, async (base) => {
    await createRecord(context, base);
    const response = await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, {
      method: 'PATCH', cookie: context.cookie(ids.doctorProfile),
    });
    assert.equal(response.status, 200);
    assert.equal(context.appointments.get(ids.confirmed).status, 'completed');
  });
  assert.deepEqual(calls, [{ appointmentId: ids.confirmed }]);
});

test('unchecked consultation cannot be completed even after record save', async () => { const context = createContext(); await withServer(context.app, async (base) => { assert.equal((await createRecord(context, base, ids.unchecked)).response.status, 201); const response = await request(base, `/api/doctor/appointments/${ids.unchecked}/complete`, { method: 'PATCH', cookie: context.cookie(ids.doctorProfile) }); assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'PATIENT_NOT_CHECKED_IN'); }); });
for (const [role, profile] of [['Patient', ids.patientProfile], ['Staff', ids.staffProfile], ['Admin', ids.adminProfile]]) test(`${role} cannot complete consultation`, async () => { const context = createContext(); await withServer(context.app, async (base) => assert.equal((await request(base, `/api/doctor/appointments/${ids.confirmed}/complete`, { method: 'PATCH', cookie: context.cookie(profile) })).status, 403)); });
for (const appointmentId of [ids.cancelled, ids.noShow, ids.completed]) test(`${appointmentId} cannot be completed`, async () => { const context = createContext(); await withServer(context.app, async (base) => assert.equal((await request(base, `/api/doctor/appointments/${appointmentId}/complete`, { method: 'PATCH', cookie: context.cookie(ids.doctorProfile) })).status, 409)); });
test('/api/health remains available with clinical routes mounted', async () => { const context = createContext(); await withServer(context.app, async (base) => assert.equal((await request(base, '/api/health')).status, 200)); });
