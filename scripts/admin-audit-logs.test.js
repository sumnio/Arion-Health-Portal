import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeGroups } from '../src/app/routes.js';
import { createAdminApiRepository } from '../src/repositories/adminApiRepository.js';
import { createAdminApiService } from '../src/services/adminApiService.js';
import {
  auditActionLabel,
  auditCategoryLabel,
  formatAuditDateTime,
} from '../src/services/auditLogPresentation.js';

const pageSource = () => readFile(new URL('../src/pages/admin/AdminAuditLogs.jsx', import.meta.url), 'utf8');

test('Admin Audit Logs route is Admin-only navigation and dispatches its page', async () => {
  assert.ok(routeGroups.admin.some(route => route.path === '/admin/audit-logs' && route.title === 'Audit Logs'));
  for (const role of ['public', 'patient', 'doctor', 'staff']) {
    assert.equal(routeGroups[role].some(route => route.path === '/admin/audit-logs'), false);
  }
  const adminPage = await readFile(new URL('../src/pages/admin/AdminPage.jsx', import.meta.url), 'utf8');
  assert.match(adminPage, /AdminAuditLogs/);
  assert.match(adminPage, /\/admin\/audit-logs/);
});

test('repository sends bounded server filters, search, pagination, and fixed 10-row request', async () => {
  const calls = [];
  const repository = createAdminApiRepository({ async request(path) { calls.push(path); return { items: [], pagination: {} }; } });
  const service = createAdminApiService(repository);
  await service.listAuditLogs({
    page: 2, search: 'Sample Patient', date_from: '2026-11-01', date_to: '2026-11-10',
    role: 'staff', category: 'PWD', action: 'PWD_VERIFICATION_APPROVED', result: 'success',
  });
  const url = new URL(calls[0], 'http://local.test');
  assert.equal(url.pathname, '/api/admin/audit-logs');
  assert.equal(url.searchParams.get('limit'), '10');
  assert.equal(url.searchParams.get('page'), '2');
  for (const name of ['search', 'date_from', 'date_to', 'role', 'category', 'action', 'result']) {
    assert.ok(url.searchParams.has(name), name);
  }
});

test('service exposes only approved table fields and never forwards unexpected metadata', async () => {
  const service = createAdminApiService({
    async getAuditLogs() {
      return {
        items: [{
          id: 'audit-1', created_at: '2026-11-10T11:42:00.000Z', actor: 'Sample Staff',
          actor_role: 'staff', category: 'PWD', action: 'PWD_VERIFICATION_APPROVED',
          target_type: 'Patient', target_id: 'patient-1', target_display: 'Sample Patient', result: 'success',
          safe_metadata: { operation: 'review' }, password_hash: 'never', diagnosis: 'private', token: 'secret',
        }],
        pagination: { total: 1, page: 1, page_size: 10, page_count: 1 },
      };
    },
  });
  const result = await service.listAuditLogs();
  assert.deepEqual(Object.keys(result.items[0]).sort(), [
    'action', 'actor', 'actor_role', 'category', 'created_at', 'id', 'result',
    'target_display', 'target_type',
  ].sort());
  const serialized = JSON.stringify(result);
  for (const secret of ['never', 'private', 'secret', 'safe_metadata']) assert.equal(serialized.includes(secret), false);
});

test('labels and Manila time are readable without changing backend values', () => {
  assert.equal(auditActionLabel('PWD_VERIFICATION_APPROVED'), 'PWD verification approved');
  assert.equal(auditActionLabel('MEDICAL_RECORD_CREATED'), 'Medical Record created');
  assert.equal(auditActionLabel('PORTAL_INVITATION_RESENT'), 'Portal invitation resent');
  assert.equal(auditCategoryLabel('MEDICAL_RECORD'), 'Medical Record');
  assert.equal(formatAuditDateTime('2026-11-10T11:42:00.000Z'), 'Nov 10, 2026 • 7:42 PM');
});

test('page has all filters, semantic table fields, states, pagination, and no mutation controls', async () => {
  const source = await pageSource();
  for (const text of [
    'Search actor or target', 'Date From', 'Date To', 'Role', 'Category', 'Action', 'Result',
    'Date &amp; Time', 'Actor', 'Target', 'Loading audit logs…', 'No audit logs found.',
    'No audit logs match the selected filters.', 'Retry', 'Previous', 'Next',
  ]) assert.ok(source.includes(text), text);
  assert.match(source, /<table>/);
  assert.match(source, /<th scope="col">/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /value\.length >= 2/);
  assert.doesNotMatch(source, />\s*(?:Edit|Delete|Clear Logs|Delete All|Restore|Change Result|Export)\s*</i);
  assert.doesNotMatch(source, /safe_metadata|password_hash|diagnosis|doctor_notes|certificate_content/i);
});

test('Audit Logs uses a mobile card layout and controlled tablet table scrolling', async () => {
  const css = await readFile(new URL('../src/styles/admin-audit-logs.css', import.meta.url), 'utf8');
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /td::before/);
  assert.match(css, /@media\(max-width:390px\)/);
});
