import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import {
  Notification,
  NOTIFICATION_MESSAGE_MAX,
  NOTIFICATION_TITLE_MAX,
} from '../src/models/index.js';
import { createNotificationModule } from '../src/services/notificationModule.js';
import { createTokenService } from '../src/services/tokenService.js';

const ids = Object.freeze({
  patient: '100000000000000000000001',
  staff: '100000000000000000000002',
  doctor: '100000000000000000000003',
  admin: '100000000000000000000004',
  inactive: '100000000000000000000005',
  otherPatient: '100000000000000000000006',
  appointment: '200000000000000000000001',
});
const SECRET = 'notification-test-secret-12345678901234567890';

function clone(value) { return structuredClone(value); }

function memoryRepository(profiles) {
  const items = [];
  return {
    items,
    async findRecipientProfile(id) { return clone(profiles.get(String(id)) ?? null); },
    async create(input) {
      const item = { ...clone(input), _id: new mongoose.Types.ObjectId().toString(), updated_at: input.created_at };
      items.push(item);
      return clone(item);
    },
    async listForRecipient(recipient, { unread_only: unreadOnly, page, limit }) {
      const owned = items
        .filter(item => String(item.recipient_user_profile_id) === String(recipient.user_profile_id) && item.recipient_role === recipient.role)
        .filter(item => !unreadOnly || !item.is_read)
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
      const unread = items.filter(item => String(item.recipient_user_profile_id) === String(recipient.user_profile_id) && item.recipient_role === recipient.role && !item.is_read).length;
      return { items: clone(owned.slice((page - 1) * limit, page * limit)), total: owned.length, unread_count: unread };
    },
    async countUnreadForRecipient(recipient) {
      return items.filter(item => String(item.recipient_user_profile_id) === String(recipient.user_profile_id) && item.recipient_role === recipient.role && !item.is_read).length;
    },
    async markReadForRecipient(notificationId, recipient, readAt) {
      const item = items.find(value => String(value._id) === String(notificationId) && String(value.recipient_user_profile_id) === String(recipient.user_profile_id) && value.recipient_role === recipient.role);
      if (!item) return null;
      if (!item.is_read) { item.is_read = true; item.read_at = readAt; }
      return clone(item);
    },
    async markAllReadForRecipient(recipient, readAt) {
      let count = 0;
      for (const item of items) {
        if (String(item.recipient_user_profile_id) === String(recipient.user_profile_id) && item.recipient_role === recipient.role && !item.is_read) {
          item.is_read = true; item.read_at = readAt; count += 1;
        }
      }
      return count;
    },
  };
}

function profiles() {
  return new Map([
    [ids.patient, { _id: ids.patient, role: 'patient', status: 'active' }],
    [ids.staff, { _id: ids.staff, role: 'staff', status: 'active' }],
    [ids.doctor, { _id: ids.doctor, role: 'doctor', status: 'active' }],
    [ids.admin, { _id: ids.admin, role: 'admin', status: 'active' }],
    [ids.inactive, { _id: ids.inactive, role: 'staff', status: 'inactive' }],
    [ids.otherPatient, { _id: ids.otherPatient, role: 'patient', status: 'active' }],
  ]);
}

function input(overrides = {}) {
  return {
    recipient_user_profile_id: ids.patient,
    recipient_role: 'patient',
    type: 'appointment_created',
    title: 'Appointment created',
    message: 'Your appointment has been created.',
    related_resource_type: 'appointment',
    related_resource_id: ids.appointment,
    ...overrides,
  };
}

test('Notification model declares safe defaults, relationships, enums, and recipient indexes', async () => {
  const item = new Notification(input());
  await item.validate();
  assert.equal(item.is_read, false);
  assert.equal(item.read_at, null);
  assert.equal(Notification.schema.path('recipient_user_profile_id').options.ref, 'UserProfile');
  assert.equal(Notification.schema.path('recipient_user_profile_id').options.immutable, true);
  const names = Notification.schema.indexes().map(([, options]) => options.name);
  assert.ok(names.includes('notification_recipient_history'));
  assert.ok(names.includes('notification_recipient_unread'));
  assert.equal(names.some(name => /ttl|expire/i.test(name)), false);
  await assert.rejects(new Notification(input({ recipient_role: 'owner' })).validate(), /enum/i);
  await assert.rejects(new Notification(input({ type: 'clinical_result' })).validate(), /enum/i);
  await assert.rejects(new Notification(input({ related_resource_id: null })).validate(), /supplied together/i);
});

test('internal creation validates recipient, type, fields, plain text, and size limits', async () => {
  const repository = memoryRepository(profiles());
  const service = createNotificationModule({ repository, now: () => new Date('2026-10-09T04:00:00.000Z') }).notificationService;
  const created = await service.createNotification(input());
  assert.equal(created.is_read, false);
  assert.equal(created.read_at, null);
  assert.deepEqual(created.related_resource, { type: 'appointment', id: ids.appointment });
  for (const invalid of [
    input({ recipient_role: 'staff' }),
    input({ recipient_role: 'owner' }),
    input({ type: 'diagnosis_ready' }),
    input({ metadata: { diagnosis: 'Private' } }),
    input({ title: 'x'.repeat(NOTIFICATION_TITLE_MAX + 1) }),
    input({ message: 'x'.repeat(NOTIFICATION_MESSAGE_MAX + 1) }),
    input({ title: '<strong>Unsafe</strong>' }),
    input({ related_resource_type: 'record' }),
  ]) await assert.rejects(service.createNotification(invalid));
});

test('listing is recipient-private, newest first, paginated, filtered, and safely projected', async () => {
  const repository = memoryRepository(profiles());
  let current = new Date('2026-10-09T01:00:00.000Z');
  const service = createNotificationModule({ repository, now: () => current }).notificationService;
  await service.createNotification(input({ title: 'Older' }));
  current = new Date('2026-10-09T02:00:00.000Z');
  const newest = await service.createNotification(input({ title: 'Newest', type: 'appointment_confirmed' }));
  current = new Date('2026-10-09T03:00:00.000Z');
  await service.createNotification(input({ recipient_user_profile_id: ids.otherPatient, title: 'Other patient' }));
  await service.markNotificationRead(ids.patient, 'patient', newest.id);

  const firstPage = await service.listNotificationsForRecipient(ids.patient, 'patient', { page: '1', limit: '1' });
  assert.deepEqual(firstPage.items.map(item => item.title), ['Newest']);
  assert.equal(firstPage.total, 2);
  assert.equal(firstPage.unread_count, 1);
  assert.equal('recipient_user_profile_id' in firstPage.items[0], false);
  assert.equal('recipient_role' in firstPage.items[0], false);
  const unread = await service.listNotificationsForRecipient(ids.patient, 'patient', { unread_only: 'true' });
  assert.deepEqual(unread.items.map(item => item.title), ['Older']);
  const empty = await service.listNotificationsForRecipient(ids.doctor, 'doctor', {});
  assert.deepEqual(empty.items, []);
  assert.equal(empty.total, 0);
  for (const query of [{ limit: '51' }, { page: '0' }, { unread_only: 'yes' }, { '$where': 'x' }]) {
    await assert.rejects(service.listNotificationsForRecipient(ids.patient, 'patient', query));
  }
});

test('mark read is owned, server-timed, idempotent, and invalid IDs fail safely', async () => {
  const repository = memoryRepository(profiles());
  let current = new Date('2026-10-09T04:00:00.000Z');
  const service = createNotificationModule({ repository, now: () => current }).notificationService;
  const created = await service.createNotification(input());
  current = new Date('2026-10-09T05:00:00.000Z');
  const first = await service.markNotificationRead(ids.patient, 'patient', created.id);
  assert.equal(first.read_at, current.toISOString());
  current = new Date('2026-10-09T06:00:00.000Z');
  const repeated = await service.markNotificationRead(ids.patient, 'patient', created.id);
  assert.equal(repeated.read_at, '2026-10-09T05:00:00.000Z');
  assert.equal(await service.countUnreadForRecipient(ids.patient, 'patient'), 0);
  await assert.rejects(service.markNotificationRead(ids.otherPatient, 'patient', created.id), error => error.status === 404);
  await assert.rejects(service.markNotificationRead(ids.patient, 'patient', 'not-an-id'), error => error.status === 400);
});

test('mark all affects only the authenticated recipient', async () => {
  const repository = memoryRepository(profiles());
  const service = createNotificationModule({ repository, now: () => new Date('2026-10-09T05:00:00.000Z') }).notificationService;
  await service.createNotification(input({ title: 'One' }));
  await service.createNotification(input({ title: 'Two' }));
  await service.createNotification(input({ recipient_user_profile_id: ids.otherPatient, title: 'Other' }));
  assert.equal(await service.markAllNotificationsRead(ids.patient, 'patient'), 2);
  assert.equal(await service.countUnreadForRecipient(ids.patient, 'patient'), 0);
  assert.equal(await service.countUnreadForRecipient(ids.otherPatient, 'patient'), 1);
});

async function withServer(app, check) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await check(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function apiContext() {
  const profileMap = profiles();
  const repository = memoryRepository(profileMap);
  const notificationModule = createNotificationModule({ repository, now: () => new Date('2026-10-09T05:00:00.000Z') });
  for (const [role, profileId] of [['patient', ids.patient], ['staff', ids.staff], ['doctor', ids.doctor], ['admin', ids.admin]]) {
    await notificationModule.notificationService.createNotification(input({ recipient_user_profile_id: profileId, recipient_role: role, title: `${role} notice` }));
  }
  const tokens = createTokenService(SECRET);
  const service = { async getAuthenticatedUser(profileId) { const profile = profileMap.get(String(profileId)); if (!profile) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'UNAUTHENTICATED' }); return { user_profile_id: String(profile._id), display_name: profile.role, role: profile.role, status: profile.status }; } };
  const app = createApp({ nodeEnv: 'test', authSecret: SECRET }, { authModule: { service, tokens }, notificationModule });
  return {
    app,
    repository,
    cookie(profileId, mfaVerified = profileMap.get(profileId)?.role === 'admin') {
      return `arion_auth=${tokens.sign(profileId, { mfaVerified })}`;
    },
  };
}

async function request(base, path, { method = 'GET', cookie, body } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('notification API allows every active role only its own safely projected inbox', async () => {
  const context = await apiContext();
  await withServer(context.app, async base => {
    for (const [role, profileId] of [['patient', ids.patient], ['staff', ids.staff], ['doctor', ids.doctor], ['admin', ids.admin]]) {
      const response = await request(base, '/api/notifications', { cookie: context.cookie(profileId) });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body.notifications.items.map(item => item.title), [`${role} notice`]);
      const serialized = JSON.stringify(body);
      for (const forbidden of ['recipient_user_profile_id', 'recipient_role', 'password', 'mfa_', 'diagnosis', 'prescription']) assert.equal(serialized.includes(forbidden), false);
    }
  });
});

test('notification API enforces authentication, active status, and full Admin MFA', async () => {
  const context = await apiContext();
  await withServer(context.app, async base => {
    assert.equal((await request(base, '/api/notifications')).status, 401);
    assert.equal((await request(base, '/api/notifications', { cookie: context.cookie(ids.inactive) })).status, 403);
    assert.equal((await request(base, '/api/notifications', { cookie: context.cookie(ids.admin, false) })).status, 401);
    assert.equal((await request(base, '/api/notifications', { cookie: context.cookie(ids.admin, true) })).status, 200);
  });
});

test('notification API supports unread count, owned read operations, read-all, and no public creation', async () => {
  const context = await apiContext();
  await withServer(context.app, async base => {
    const patientCookie = context.cookie(ids.patient);
    const patientItem = context.repository.items.find(item => String(item.recipient_user_profile_id) === ids.patient);
    const count = await request(base, '/api/notifications/unread-count', { cookie: patientCookie });
    assert.deepEqual(await count.json(), { unread_count: 1 });
    const denied = await request(base, `/api/notifications/${patientItem._id}/read`, { method: 'PATCH', cookie: context.cookie(ids.otherPatient), body: {} });
    assert.equal(denied.status, 404);
    const read = await request(base, `/api/notifications/${patientItem._id}/read`, { method: 'PATCH', cookie: patientCookie, body: {} });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).notification.is_read, true);
    assert.equal((await request(base, '/api/notifications/read-all', { method: 'PATCH', cookie: patientCookie, body: {} })).status, 200);
    assert.equal((await request(base, '/api/notifications', { method: 'POST', cookie: patientCookie, body: input() })).status, 404);
    assert.equal((await request(base, `/api/notifications/${patientItem._id}/read`, { method: 'PATCH', cookie: patientCookie, body: { is_read: true } })).status, 400);
    assert.equal((await request(base, '/api/notifications?limit=51', { cookie: patientCookie })).status, 400);
  });
});
