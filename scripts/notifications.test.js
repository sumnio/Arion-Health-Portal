import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNotificationApiRepository } from '../src/repositories/notificationApiRepository.js';
import { createNotificationApiService, formatUnreadBadge, NOTIFICATION_PAGE_SIZE } from '../src/services/notificationApiService.js';
import { routeGroups } from '../src/app/routes.js';

const raw = { id: 'notification-1', type: 'appointment_rescheduled', title: 'Appointment rescheduled', message: 'Your appointment with Sample Doctor has been rescheduled.', related_resource: { type: 'appointment', id: 'appointment-1' }, patient_display_name: null, doctor_display_name: 'Sample Doctor', appointment_at: '2026-10-12T06:00:00.000Z', is_read: false, read_at: null, created_at: '2026-10-09T01:30:00.000Z' };

test('notification repository uses only the approved credentialed inbox endpoints', async () => {
  const calls = [];
  const repository = createNotificationApiRepository({ async request(path, options) {
    calls.push({ path, options });
    if (path.includes('unread-count')) return { unread_count: 3 };
    if (path.includes('read-all')) return { updated_count: 3 };
    if (path.includes('/read')) return { notification: { ...raw, is_read: true } };
    return { notifications: { items: [raw], page: 2, limit: 20, total: 21, unread_count: 3 } };
  } });
  await repository.list({ unreadOnly: true, page: 2, limit: 20 });
  await repository.unreadCount();
  await repository.markRead('notification/1');
  await repository.markAllRead();
  assert.match(calls[0].path, /^\/api\/notifications\?/);
  assert.match(calls[0].path, /unread_only=true/);
  assert.match(calls[0].path, /page=2/);
  assert.equal(calls[1].path, '/api/notifications/unread-count');
  assert.equal(calls[2].path, '/api/notifications/notification%2F1/read');
  assert.equal(calls[2].options.method, 'PATCH');
  assert.equal(calls[3].path, '/api/notifications/read-all');
  assert.equal(calls.some(call => call.options?.method === 'POST'), false);
});

test('notification service normalizes recipient-safe responses and pagination', async () => {
  const service = createNotificationApiService({
    async list() { return { items: [raw], page: 2, limit: 20, total: 21, unread_count: 3 }; },
    async unreadCount() { return 3; },
    async markRead() { return { ...raw, is_read: true, read_at: '2026-10-09T01:31:00.000Z' }; },
    async markAllRead() { return 3; },
  });
  const result = await service.list({ page: 2 });
  assert.equal(result.pageCount, 2);
  assert.equal(result.unreadCount, 3);
  assert.deepEqual(result.items[0].relatedResource, { type: 'appointment', id: 'appointment-1' });
  assert.equal(result.items[0].patientDisplayName, null);
  assert.equal(result.items[0].doctorDisplayName, 'Sample Doctor');
  assert.equal(result.items[0].appointmentAt, '2026-10-12T06:00:00.000Z');
  assert.equal(result.items[0].isRead, false);
  assert.equal((await service.markRead(raw.id)).isRead, true);
});

test('badge shows exact counts through 99 and caps larger counts', () => {
  assert.equal(formatUnreadBadge(1), '1');
  assert.equal(formatUnreadBadge(99), '99');
  assert.equal(formatUnreadBadge(100), '99+');
  assert.equal(formatUnreadBadge(-1), '0');
});

test('full notification pages request five items per page', () => {
  assert.equal(NOTIFICATION_PAGE_SIZE, 5);
});

test('all protected roles expose a notification page and share the notification UI', () => {
  for (const role of ['patient', 'staff', 'doctor', 'admin']) assert.ok(routeGroups[role].some(route => route.path === `/${role}/notifications`));
  const bell = readFileSync(new URL('../src/components/notifications/NotificationBell.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/notifications/NotificationsPage.jsx', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/layouts/PortalLayout.jsx', import.meta.url), 'utf8');
  assert.match(layout, /NotificationProvider/);
  assert.match(layout, /NotificationBell/);
  assert.match(bell, /aria-haspopup="dialog"/);
  assert.match(bell, /event\.key === 'Escape'/);
  assert.match(bell, /View All Notifications/);
  assert.match(bell, /No notifications yet\./);
  assert.match(bell, /Unable to mark all notifications as read\./);
  assert.match(page, /aria-label="Notification filters"/);
  assert.match(page, /NOTIFICATION_PAGE_SIZE/);
  assert.match(page, /notification-mark-all/);
  assert.match(page, /detailed/);
  assert.match(page, /You have no unread notifications\./);
  assert.match(page, /Try again/);
  assert.doesNotMatch(bell + page, /setInterval|WebSocket|EventSource/);
});

test('full-page notification items label appointment and event times while the bell remains compact', () => {
  const item = readFileSync(new URL('../src/components/notifications/NotificationListItem.jsx', import.meta.url), 'utf8');
  const bell = readFileSync(new URL('../src/components/notifications/NotificationBell.jsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles/notifications.css', import.meta.url), 'utf8');
  assert.match(item, /notification-detail-grid/);
  assert.match(item, />Appointment</);
  assert.match(item, /EVENT_LABELS/);
  assert.match(item, />Mark as read</);
  assert.match(styles, /\.notification-page-list\s*\{[^}]*display:\s*grid;[^}]*gap:/s);
  assert.match(styles, /\.notification-page-list \.notification-item\s*\{[^}]*border:[^}]*border-radius:[^}]*box-shadow:/s);
  assert.doesNotMatch(bell, /detailed/);
});
