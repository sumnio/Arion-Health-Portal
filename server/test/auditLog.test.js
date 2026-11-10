import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import {
  AuditLog,
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  AUDIT_RESULTS,
} from '../src/models/AuditLog.js';
import { createAuditLogModule } from '../src/services/auditLogModule.js';
import { createAuditLogService } from '../src/services/auditLogService.js';
import { createTokenService } from '../src/services/tokenService.js';
import { createAdminAccountController } from '../src/controllers/adminAccountController.js';
import { createAuthController } from '../src/controllers/authController.js';
import { createDoctorClinicalController } from '../src/controllers/clinicalController.js';
import { createPatientController } from '../src/controllers/patientController.js';
import { createPortalInvitationController } from '../src/controllers/portalInvitationController.js';
import { createStaffPwdVerificationController } from '../src/controllers/pwdVerificationController.js';
import { createStaffOperationsController } from '../src/controllers/staffOperationsController.js';
import { createStaffSchedulingController } from '../src/controllers/staffSchedulingController.js';

const SECRET = 'audit-log-test-secret-12345678901234567890';
const ids = {
  admin: '111111111111111111111111',
  staff: '222222222222222222222222',
  doctor: '333333333333333333333333',
  patient: '444444444444444444444444',
};

function memoryRepository(seed = []) {
  const entries = seed.map((item, index) => ({
    _id: item._id ?? new mongoose.Types.ObjectId(),
    created_at: item.created_at ?? new Date(Date.UTC(2026, 10, 1, 0, 0, index)),
    safe_metadata: {},
    ...structuredClone(item),
  }));
  return {
    entries,
    async create(entry) {
      const created = { _id: new mongoose.Types.ObjectId(), ...structuredClone(entry) };
      entries.push(created);
      return created;
    },
    async list({ page, limit, filters }) {
      let found = entries.filter((item) => (
        (!filters.role || item.actor_role === filters.role)
        && (!filters.category || item.category === filters.category)
        && (!filters.action || item.action === filters.action)
        && (!filters.result || item.result === filters.result)
        && (!filters.dateFrom || new Date(item.created_at) >= filters.dateFrom)
        && (!filters.dateTo || new Date(item.created_at) <= filters.dateTo)
        && (!filters.searchActor || String(item.actor_display_name_snapshot ?? '').toLowerCase().includes(filters.searchActor.toLowerCase()))
        && (!filters.searchTarget || `${item.target_id ?? ''} ${item.target_display_snapshot ?? ''}`.toLowerCase().includes(filters.searchTarget.toLowerCase()))
        && (!filters.search || `${item.actor_display_name_snapshot ?? ''} ${item.target_id ?? ''} ${item.target_display_snapshot ?? ''}`.toLowerCase().includes(filters.search.toLowerCase()))
      ));
      found = found.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { items: found.slice((page - 1) * limit, page * limit), total: found.length };
    },
  };
}

function validEvent(overrides = {}) {
  return {
    actor_user_id: ids.staff,
    actor_role: 'staff',
    actor_display_name_snapshot: 'Sample Staff',
    category: 'APPOINTMENT',
    action: 'APPOINTMENT_CANCELLED',
    result: 'success',
    target_type: 'Appointment',
    target_id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    target_display_snapshot: 'Appointment',
    safe_metadata: { old_status: 'confirmed', new_status: 'cancelled' },
    ...overrides,
  };
}

test('AuditLog has the dedicated collection, stable enums, and required indexes', () => {
  assert.equal(AuditLog.collection.collectionName, 'audit_logs');
  assert.ok(AUDIT_CATEGORIES.includes('AUTH'));
  assert.ok(AUDIT_ACTIONS.includes('MEDICAL_CERTIFICATE_ISSUED'));
  assert.deepEqual(AUDIT_RESULTS, ['success', 'failed', 'denied']);
  const names = AuditLog.schema.indexes().map(([, options]) => options.name);
  for (const name of [
    'audit_created_desc', 'audit_actor_role_created', 'audit_category_created',
    'audit_action_created', 'audit_result_created', 'audit_target_created',
  ]) assert.ok(names.includes(name));
});

test('AuditLog validates approved category, action, and result values', async () => {
  await new AuditLog(validEvent()).validate();
  for (const override of [
    { category: 'OTHER' }, { action: 'RANDOM_ACTION' }, { result: 'maybe' },
  ]) await assert.rejects(() => new AuditLog(validEvent(override)).validate());
});

test('AuditLog document updates are rejected as append-only before persistence', async () => {
  const document = new AuditLog(validEvent());
  document.$isNew = false;
  await assert.rejects(() => document.save(), /AUDIT_LOG_APPEND_ONLY/);
  await assert.rejects(() => AuditLog.updateOne({}, { $set: { result: 'failed' } }), /AUDIT_LOG_APPEND_ONLY/);
  await assert.rejects(() => AuditLog.deleteOne({}), /AUDIT_LOG_APPEND_ONLY/);
  await assert.rejects(() => AuditLog.bulkWrite([{ deleteMany: { filter: {} } }]), /AUDIT_LOG_APPEND_ONLY/);
});

test('central service creates a privacy-safe event and strips sensitive or unknown metadata', async () => {
  const repository = memoryRepository();
  const service = createAuditLogService({ repository, logger: { error() {} }, now: () => new Date('2026-11-10T00:00:00Z') });
  await service.recordAuditEvent(validEvent({
    safe_metadata: {
      old_status: 'confirmed', new_status: 'cancelled', password: 'NeverStoreMe',
      otp_code: '123456', diagnosis: 'private', invitation_token: 'private',
      random_field: 'not approved',
    },
  }));
  assert.equal(repository.entries.length, 1);
  const serialized = JSON.stringify(repository.entries[0]);
  assert.equal(serialized.includes('NeverStoreMe'), false);
  assert.equal(serialized.includes('123456'), false);
  assert.equal(serialized.includes('private'), false);
  assert.deepEqual(repository.entries[0].safe_metadata, {
    old_status: 'confirmed', new_status: 'cancelled',
  });
});

test('invalid audit values are rejected safely without breaking the caller', async () => {
  const repository = memoryRepository();
  const diagnostics = [];
  const service = createAuditLogService({ repository, logger: { error(...args) { diagnostics.push(args); } } });
  assert.equal(await service.recordAuditEvent(validEvent({ category: 'NOPE' })), null);
  assert.equal(repository.entries.length, 0);
  assert.equal(diagnostics.length, 1);
});

test('business action remains successful when best-effort audit storage fails', async () => {
  const service = createAuditLogService({
    repository: { async create() { throw new Error('database unavailable'); } },
    logger: { error() {} },
  });
  const businessResult = { status: 'completed' };
  assert.equal(await service.recordAuditEvent(validEvent()), null);
  assert.deepEqual(businessResult, { status: 'completed' });
});

test('audit queries default to 10, sort newest first, and expose only safe fields', async () => {
  const repository = memoryRepository(Array.from({ length: 12 }, (_, index) => validEvent({
    _id: new mongoose.Types.ObjectId(),
    actor_display_name_snapshot: `Staff ${index}`,
    created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, index)),
    password_hash: 'must-not-return',
  })));
  const service = createAuditLogService({ repository, logger: { error() {} } });
  const result = await service.listAuditEvents({});
  assert.equal(result.items.length, 10);
  assert.equal(result.pagination.page_size, 10);
  assert.equal(result.pagination.total, 12);
  assert.equal(result.items[0].actor, 'Staff 11');
  assert.equal(JSON.stringify(result).includes('must-not-return'), false);
});

test('role, category, action, result, date, actor, and target filters are bounded and forwarded', async () => {
  const repository = memoryRepository([
    validEvent({ actor_display_name_snapshot: 'Alpha Staff', target_id: 'APT-100', created_at: new Date('2026-11-05T00:00:00Z') }),
    validEvent({ actor_role: 'admin', actor_display_name_snapshot: 'Beta Admin', category: 'ACCOUNT', action: 'ACCOUNT_DEACTIVATED', target_type: 'Patient account', target_id: 'PAT-200', result: 'success', created_at: new Date('2026-10-01T00:00:00Z') }),
  ]);
  const service = createAuditLogService({ repository, logger: { error() {} } });
  assert.equal((await service.listAuditEvents({ role: 'staff', category: 'APPOINTMENT', action: 'APPOINTMENT_CANCELLED', result: 'success', date_from: '2026-11-01', date_to: '2026-11-30', search_actor: 'Alpha', search_target: 'APT-100' })).items.length, 1);
  assert.equal((await service.listAuditEvents({ search: 'Alpha' })).items.length, 1);
  assert.equal((await service.listAuditEvents({ search: 'PAT-200' })).items.length, 1);
  await assert.rejects(() => service.listAuditEvents({ search_actor: 'x' }), error => error.code === 'INVALID_AUDIT_FILTER');
  await assert.rejects(() => service.listAuditEvents({ limit: 500, role: 'root' }), error => error.code === 'INVALID_AUDIT_FILTER');
  assert.equal((await service.listAuditEvents({ limit: 500 })).pagination.page_size, 50);
});

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function apiContext() {
  const repository = memoryRepository([validEvent({ created_at: new Date('2026-11-10T00:00:00Z') })]);
  const auditLogModule = createAuditLogModule({ repository, logger: { error() {} } });
  const tokens = createTokenService(SECRET, 'test');
  const profiles = {
    [ids.admin]: { user_profile_id: ids.admin, display_name: 'Admin', role: 'admin', status: 'active' },
    [ids.staff]: { user_profile_id: ids.staff, display_name: 'Staff', role: 'staff', status: 'active' },
    [ids.doctor]: { user_profile_id: ids.doctor, display_name: 'Doctor', role: 'doctor', status: 'active' },
    [ids.patient]: { user_profile_id: ids.patient, display_name: 'Patient', role: 'patient', status: 'active' },
  };
  const authModule = {
    tokens,
    service: { async getAuthenticatedUser(id) { return profiles[id]; } },
    accountTokens: {}, emailService: {},
  };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule, auditLogModule });
  const cookie = (id) => `arion_auth=${tokens.sign(id, { mfaVerified: profiles[id].role === 'admin' })}`;
  return { app, cookie };
}

test('only an active MFA-complete Admin can read the paginated audit API', async () => {
  const context = apiContext();
  await withServer(context.app, async (base) => {
    assert.equal((await fetch(`${base}/api/admin/audit-logs`)).status, 401);
    for (const id of [ids.staff, ids.doctor, ids.patient]) {
      assert.equal((await fetch(`${base}/api/admin/audit-logs`, { headers: { cookie: context.cookie(id) } })).status, 403);
    }
    const response = await fetch(`${base}/api/admin/audit-logs`, { headers: { cookie: context.cookie(ids.admin) } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.items.length, 1);
    assert.equal(body.pagination.page_size, 10);
  });
});

test('Admin audit API has no create, update, delete, or clear endpoint', async () => {
  const context = apiContext();
  await withServer(context.app, async (base) => {
    for (const [method, path] of [
      ['POST', '/api/admin/audit-logs'], ['PATCH', '/api/admin/audit-logs/abc'],
      ['DELETE', '/api/admin/audit-logs/abc'], ['DELETE', '/api/admin/audit-logs'],
    ]) {
      assert.equal((await fetch(`${base}${path}`, { method, headers: { cookie: context.cookie(ids.admin) } })).status, 404);
    }
  });
});

test('important milestone actions are centralized and stable', () => {
  for (const action of [
    'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILURE', 'MFA_VERIFY_SUCCESS', 'MFA_VERIFY_FAILURE',
    'ACCOUNT_ACTIVATED', 'ACCOUNT_DEACTIVATED', 'PWD_VERIFICATION_APPROVED',
    'PWD_VERIFICATION_REJECTED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED',
    'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED', 'WORKING_HOURS_CREATED',
    'WORKING_HOURS_UPDATED', 'WORKING_HOURS_DELETED', 'PUBLISHED_AVAILABILITY_CREATED',
    'PUBLISHED_AVAILABILITY_UPDATED', 'PUBLISHED_AVAILABILITY_REMOVED',
    'TIME_OFF_CREATED', 'TIME_OFF_REMOVED', 'MEDICAL_RECORD_CREATED',
    'PRESCRIPTION_ISSUED', 'PRESCRIPTION_ATTACHMENT_ISSUED',
    'MEDICAL_CERTIFICATE_ISSUED', 'PORTAL_INVITATION_SENT',
    'PORTAL_INVITATION_RESENT', 'PATIENT_ACCOUNT_CLAIMED',
  ]) assert.ok(AUDIT_ACTIONS.includes(action), action);
});

function responseStub() {
  return {
    statusCode: 200, body: null,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    cookie() { return this; },
    clearCookie() { return this; },
  };
}

function auditedRequest(service, overrides = {}) {
  return {
    auditLogService: service,
    authUser: { user_profile_id: ids.staff, display_name: 'Sample Staff', role: 'staff', status: 'active' },
    body: {}, query: {}, params: {}, files: [],
    is() { return false; },
    get() { return null; },
    ...overrides,
  };
}

test('business controllers emit the required privacy-safe milestone events', async () => {
  const repository = memoryRepository();
  const auditLogService = createAuditLogService({ repository, logger: { error() {} } });
  const response = responseStub();

  const admin = createAdminAccountController({ adminAccountService: {
    async deactivateDoctor() { return { id: 'doctor-1', display_name: 'Doctor One' }; },
    async reactivateDoctor() { return { id: 'doctor-1', display_name: 'Doctor One' }; },
  } });
  await admin.deactivateDoctor(auditedRequest(auditLogService, { params: { doctorId: 'doctor-1' }, authUser: { user_profile_id: ids.admin, display_name: 'Admin', role: 'admin' } }), response);
  await admin.reactivateDoctor(auditedRequest(auditLogService, { params: { doctorId: 'doctor-1' }, authUser: { user_profile_id: ids.admin, display_name: 'Admin', role: 'admin' } }), response);

  const pwd = createStaffPwdVerificationController({ pwdVerificationService: {
    async verify() { return { status: 'verified' }; }, async reject() { return { status: 'rejected' }; },
  } });
  await pwd.verify(auditedRequest(auditLogService, { params: { verificationId: 'pwd-1' } }), response);
  await pwd.reject(auditedRequest(auditLogService, { params: { verificationId: 'pwd-2' }, body: { rejection_reason: 'not audited' } }), response);

  const patient = createPatientController({ patientService: {}, appointmentService: {
    async cancelForPatient() { return { id: 'appointment-1', status: 'cancelled' }; },
    async rescheduleForPatient() { return { id: 'appointment-2', status: 'confirmed', appointment_date: '2026-11-12', appointment_time: '10:00' }; },
  } });
  await patient.cancelAppointment(auditedRequest(auditLogService, { params: { appointmentId: 'appointment-1' } }), response);
  await patient.rescheduleAppointment(auditedRequest(auditLogService, { params: { appointmentId: 'appointment-2' }, body: { appointment_date: '2026-11-12' } }), response);

  const scheduleRecord = (id) => ({ id, date: '2026-11-12', day_of_week: 1, start_time: '09:00', end_time: '12:00', start_at: '2026-11-12T09:00:00Z', end_at: '2026-11-12T12:00:00Z' });
  const scheduling = createStaffSchedulingController({
    doctorAvailabilityService: {
      async createRecurringForDoctor() { return scheduleRecord('working-1'); },
      async updateRecurringForDoctor() { return scheduleRecord('working-1'); },
      async deleteRecurringForDoctor() { return scheduleRecord('working-1'); },
      async createPublishedForDoctor() { return scheduleRecord('published-1'); },
      async updatePublishedForDoctor() { return scheduleRecord('published-1'); },
      async deletePublishedForDoctor() { return scheduleRecord('published-1'); },
      async createBlockedForDoctor() { return scheduleRecord('blocked-1'); },
      async deleteBlockedForDoctor() { return scheduleRecord('blocked-1'); },
    },
    bookingAvailabilityService: {},
    doctorUnavailabilityService: {
      async blockedTimeCreated() { return []; }, async blockedTimeDeleted() {},
      async rescheduleForStaff() { return { id: 'appointment-3', appointment_date: '2026-11-13', appointment_time: '11:00' }; },
    },
  });
  const scheduleRequest = (params, body = {}) => auditedRequest(auditLogService, { params: { doctorId: 'doctor-1', ...params }, body });
  await scheduling.createRecurring(scheduleRequest({}), response);
  await scheduling.updateRecurring(scheduleRequest({ availabilityId: 'working-1' }), response);
  await scheduling.deleteRecurring(scheduleRequest({ availabilityId: 'working-1' }), response);
  await scheduling.createPublished(scheduleRequest({}), response);
  await scheduling.updatePublished(scheduleRequest({ publishedId: 'published-1' }), response);
  await scheduling.deletePublished(scheduleRequest({ publishedId: 'published-1' }), response);
  await scheduling.createBlocked(scheduleRequest({}), response);
  await scheduling.deleteBlocked(scheduleRequest({ blockedTimeId: 'blocked-1' }), response);
  await scheduling.rescheduleAffected(scheduleRequest({ appointmentId: 'appointment-3' }), response);

  const clinical = createDoctorClinicalController({ clinicalService: {
    async createRecord() { return { id: 'record-1', prescriptions: [{ id: 'rx-1', attachment_available: true }] }; },
    async createCertificate() { return { id: 'certificate-1' }; },
  } });
  const doctorRequest = (overrides) => auditedRequest(auditLogService, { authUser: { user_profile_id: ids.doctor, display_name: 'Doctor', role: 'doctor' }, ...overrides });
  await clinical.createRecord(doctorRequest({ params: { appointmentId: 'appointment-4' } }), response);
  await clinical.createCertificate(doctorRequest({ params: { recordId: 'record-1' } }), response);

  const staffOperations = createStaffOperationsController({ staffOperationsService: {
    async createWalkInAppointment() { return { id: 'appointment-5', portal_invitation: { status: 'sent' } }; },
    async resendPortalInvitation() { return { status: 'sent' }; },
    async cancel() { return { id: 'appointment-5', status: 'cancelled' }; },
  } });
  await staffOperations.createWalkInAppointment(auditedRequest(auditLogService, { params: { patientId: 'patient-1' } }), response);
  await staffOperations.resendPortalInvitation(auditedRequest(auditLogService, { params: { patientId: 'patient-1' }, body: {} }), response);
  await staffOperations.cancel(auditedRequest(auditLogService, { params: { appointmentId: 'appointment-5' } }), response);

  const invitation = createPortalInvitationController({ portalInvitationService: {
    async complete() { return { status: 'ACCOUNT_CREATED' }; },
  } });
  await invitation.complete(auditedRequest(auditLogService, { authUser: null, params: { token: 'not-audited' }, body: { claim_session: 'not-audited', password: 'not-audited' } }), response);

  const actions = new Set(repository.entries.map(item => item.action));
  for (const action of [
    'ACCOUNT_DEACTIVATED', 'ACCOUNT_ACTIVATED', 'PWD_VERIFICATION_APPROVED',
    'PWD_VERIFICATION_REJECTED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED',
    'WORKING_HOURS_CREATED', 'WORKING_HOURS_UPDATED', 'WORKING_HOURS_DELETED',
    'PUBLISHED_AVAILABILITY_CREATED', 'PUBLISHED_AVAILABILITY_UPDATED',
    'PUBLISHED_AVAILABILITY_REMOVED', 'TIME_OFF_CREATED', 'TIME_OFF_REMOVED',
    'DOCTOR_UNAVAILABILITY_RESCHEDULE_CONFIRMED', 'MEDICAL_RECORD_CREATED',
    'PRESCRIPTION_ISSUED', 'PRESCRIPTION_ATTACHMENT_ISSUED',
    'MEDICAL_CERTIFICATE_ISSUED', 'PORTAL_INVITATION_SENT',
    'PORTAL_INVITATION_RESENT', 'PATIENT_ACCOUNT_CLAIMED',
  ]) assert.ok(actions.has(action), action);
  const serialized = JSON.stringify(repository.entries);
  for (const forbidden of ['not-audited', 'rejection_reason', 'diagnosis', 'medicine']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('login and MFA success/failure events are audited without credentials or codes', async () => {
  const repository = memoryRepository();
  const auditLogService = createAuditLogService({ repository, logger: { error() {} } });
  const user = { user_profile_id: ids.admin, display_name: 'Admin', role: 'admin' };
  const controller = createAuthController({
    nodeEnv: 'test',
    service: {
      async login(body) {
        if (body.email === 'fail@example.test') throw Object.assign(new Error('invalid'), { status: 401 });
        return { user, token: 'not-audited-auth-token' };
      },
    },
    mfaService: {
      async verify(_challenge, code) {
        if (code === '000000') throw Object.assign(new Error('invalid'), { status: 401 });
        return { user, token: 'not-audited-mfa-token' };
      },
      async verifySetup(_challenge, code) {
        if (code === '000000') throw Object.assign(new Error('invalid'), { status: 401 });
        return { user, token: 'not-audited-setup-token' };
      },
    },
  });
  const response = responseStub();
  await controller.login(auditedRequest(auditLogService, { validatedBody: { email: 'admin@example.test', password: 'not-audited-password' } }), response);
  await assert.rejects(() => controller.login(auditedRequest(auditLogService, { validatedBody: { email: 'fail@example.test', password: 'not-audited-password' } }), response));
  await controller.verifyMfa(auditedRequest(auditLogService, { cookies: {}, validatedBody: { code: '123456' } }), response);
  await assert.rejects(() => controller.verifyMfa(auditedRequest(auditLogService, { cookies: {}, validatedBody: { code: '000000' } }), response));
  const actions = repository.entries.map(item => item.action);
  assert.ok(actions.includes('AUTH_LOGIN_SUCCESS'));
  assert.ok(actions.includes('AUTH_LOGIN_FAILURE'));
  assert.ok(actions.includes('MFA_VERIFY_SUCCESS'));
  assert.ok(actions.includes('MFA_VERIFY_FAILURE'));
  const serialized = JSON.stringify(repository.entries);
  for (const forbidden of ['not-audited-password', '123456', '000000', 'not-audited-auth-token', 'not-audited-mfa-token']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
