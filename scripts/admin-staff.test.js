import test from 'node:test';
import assert from 'node:assert/strict';
import { adminStaffService as service } from '../src/services/adminStaffService.js';
import { adminStaffStore } from '../src/mocks/adminStaffStore.js';
import { adminDashboardService } from '../src/services/adminDashboardService.js';

test('staff create/edit validates, preserves identity and limits writable fields', () => {
  const before = service.list().length;
  assert.throws(() => service.create({ display_name: ' ' }), /required/);
  const added = service.create({ display_name: ' Test Staff ', username: ' reception ', role: 'admin', is_active: true });
  assert.equal(added.display_name, 'Test Staff');
  assert.equal(added.username, 'reception');
  assert.equal(added.role, 'staff');
  assert.equal(added.is_active, undefined);
  assert.match(added.id, /^[a-f\d-]{36}$/);
  assert.equal(adminDashboardService.getDashboard().totalStaff, before + 1);
  assert.throws(() => service.create({ display_name: 'Other', username: 'RECEPTION' }), /already used/);
  const other = service.create({ display_name: 'Other' });
  assert.equal(other.username, null);
  assert.throws(() => service.update(other.id, { display_name: 'Other', username: 'reception' }), /already used/);
  assert.equal(service.get(other.id).username, null);
  const updated = service.update(added.id, { display_name: 'Updated Staff', username: 'reception', id: 'changed', role: 'admin' });
  assert.equal(updated.id, added.id);
  assert.equal(updated.role, 'staff');
  assert.equal(service.list('UPDATED')[0].id, added.id);
  assert.equal(service.list('RECEPTION')[0].id, added.id);
  updated.display_name = 'external mutation';
  assert.equal(service.get(added.id).display_name, 'Updated Staff');
  assert.throws(() => service.update(added.id, { display_name: '' }), /required/);
  assert.throws(() => service.update('missing', { display_name: 'Name' }), /not found/);
  assert.equal(service.update(added.id, { display_name: 'Updated Staff', username: ' ' }).username, null);
  assert.equal(service.list('no-matching-staff').length, 0);
});

test('empty staff directory returns an empty list', () => {
  const saved = adminStaffStore.splice(0);
  try { assert.deepEqual(service.list(), []); } finally { adminStaffStore.push(...saved); }
});
