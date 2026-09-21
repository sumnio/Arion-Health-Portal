import test from 'node:test';
import assert from 'node:assert/strict';
import { adminDoctorService as service } from '../src/services/adminDoctorService.js';
import { adminDashboardService } from '../src/services/adminDashboardService.js';
import { adminDoctorStore } from '../src/mocks/adminDoctorStore.js';

test('doctor account validation, identity, search and dashboard consistency', () => {
  const count = service.list().length;
  assert.throws(() => service.create({ display_name: ' ', specialty: 'General Medicine' }));
  assert.throws(() => service.create({ display_name: 'Doctor' }));
  const added = service.create({ display_name: ' Dr. Test Doctor ', specialty: 'Family Medicine', is_active: true, role: 'admin' });
  assert.equal(added.display_name, 'Dr. Test Doctor');
  assert.equal(added.role, 'doctor');
  assert.equal(added.is_active, undefined);
  assert.match(added.id, /^[a-f\d-]{36}$/);
  const edited = service.update(added.id, { display_name: 'Dr. Updated Doctor', specialty: 'General Medicine', id: 'replace', role: 'admin' });
  assert.equal(edited.id, added.id);
  assert.equal(edited.role, 'doctor');
  assert.equal(service.list('UPDATED DOCTOR')[0].id, added.id);
  assert.ok(service.list('general medicine').some(d => d.id === added.id));
  assert.equal(service.list('no-matching-doctor').length, 0);
  assert.equal(adminDashboardService.getDashboard().totalDoctors, count + 1);
  edited.display_name = 'mutated';
  assert.equal(service.get(added.id).display_name, 'Dr. Updated Doctor');
  assert.throws(() => service.update(added.id, { display_name: '', specialty: '' }));
  assert.throws(() => service.update('missing', { display_name: 'Doctor', specialty: 'Medicine' }));
});

test('empty doctor list is supported', () => {
  const saved = adminDoctorStore.splice(0);
  try { assert.deepEqual(service.list(), []); } finally { adminDoctorStore.push(...saved); }
});
