import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminStaffService as service } from '../src/services/adminStaffService.js';
import { adminStaffStore } from '../src/mocks/adminStaffStore.js';
import { adminUserProfileStore } from '../src/mocks/adminUserProfileStore.js';
import { adminDashboardService } from '../src/services/adminDashboardService.js';

const validStaff = { display_name: ' Test Staff ', contact_number: ' 0917 000 0010 ' };

test('staff create and edit use shared UserProfile fields without username login data', () => {
  const before = service.list().length;
  assert.throws(() => service.create({ ...validStaff, display_name: ' ' }), /required/);
  assert.throws(() => service.create({ ...validStaff, contact_number: '' }), /required/);
  const added = service.create({ ...validStaff, username: 'ignored-login', role: 'admin', status: 'inactive' });
  assert.equal(added.display_name, 'Test Staff');
  assert.equal(added.contact_number, '0917 000 0010');
  assert.equal(added.role, 'staff');
  assert.equal(added.status, 'active');
  assert.equal(added.username, undefined);
  assert.match(added.id, /^[a-f\d-]{36}$/);
  assert.deepEqual(Object.keys(adminStaffStore.find(item => item.id === added.id)), ['id']);
  assert.equal(adminUserProfileStore.find(item => item.id === added.id).role, 'staff');
  assert.equal(adminDashboardService.getDashboard().totalStaff, before + 1);

  const updated = service.update(added.id, { display_name: 'Updated Staff', contact_number: '0917 999 0000', username: 'still-ignored' });
  assert.equal(updated.id, added.id);
  assert.equal(updated.created_at, added.created_at);
  assert.equal(updated.contact_number, '0917 999 0000');
  assert.equal(updated.username, undefined);
  assert.equal(service.list('UPDATED')[0].id, added.id);
  assert.equal(service.list('0917 999')[0].id, added.id);
  assert.equal(service.list('no-matching-staff').length, 0);
  assert.throws(() => service.update('missing', validStaff), /not found/);
});

test('staff lifecycle preserves the same Staff and UserProfile identities', () => {
  const added = service.create(validStaff);
  const inactive = service.deactivate(added.id);
  assert.equal(inactive.id, added.id);
  assert.equal(inactive.status, 'inactive');
  assert.ok(adminStaffStore.some(item => item.id === added.id));
  assert.ok(adminUserProfileStore.some(item => item.id === added.id));
  const active = service.reactivate(added.id);
  assert.equal(active.id, added.id);
  assert.equal(active.status, 'active');
  assert.equal(service.delete, undefined);
  assert.throws(() => service.reactivate('missing'), /not found/);
});

test('staff management UI uses contact and lifecycle controls without username or delete', async () => {
  const source = await readFile(new URL('../src/pages/admin/ManageStaff.jsx', import.meta.url), 'utf8');
  assert.match(source, /Contact number/);
  assert.match(source, /Deactivate/);
  assert.match(source, /Reactivate/);
  assert.doesNotMatch(source, /Username/i);
  assert.doesNotMatch(source, />Delete</);
});

test('empty staff directory returns an empty list', () => {
  const saved = adminStaffStore.splice(0);
  try { assert.deepEqual(service.list(), []); } finally { adminStaffStore.push(...saved); }
});
