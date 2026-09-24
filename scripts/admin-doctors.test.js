import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminDoctorService as service } from '../src/services/adminDoctorService.js';
import { adminDashboardService } from '../src/services/adminDashboardService.js';
import { adminDoctorStore } from '../src/mocks/adminDoctorStore.js';
import { adminUserProfileStore } from '../src/mocks/adminUserProfileStore.js';

const validDoctor = {
  display_name: ' Dr. Test Doctor ',
  contact_number: ' 0917 000 0001 ',
  specialty: ' Family Medicine ',
  license_number: ' PRC-TEST-1 ',
  ptr_number: ' PTR-TEST-1 ',
  signature_path: ' signatures/test-doctor.png ',
};

test('doctor profile fields are split from shared account fields', () => {
  const count = service.list().length;
  assert.throws(() => service.create({ ...validDoctor, display_name: ' ' }), /required/);
  assert.throws(() => service.create({ ...validDoctor, contact_number: '' }), /required/);
  assert.throws(() => service.create({ ...validDoctor, license_number: '' }), /required/);

  const added = service.create({ ...validDoctor, role: 'admin', status: 'inactive' });
  assert.equal(added.display_name, 'Dr. Test Doctor');
  assert.equal(added.contact_number, '0917 000 0001');
  assert.equal(added.specialty, 'Family Medicine');
  assert.equal(added.license_number, 'PRC-TEST-1');
  assert.equal(added.ptr_number, 'PTR-TEST-1');
  assert.equal(added.signature_path, 'signatures/test-doctor.png');
  assert.equal(added.role, 'doctor');
  assert.equal(added.status, 'active');
  assert.match(added.id, /^[a-f\d-]{36}$/);
  assert.ok(added.created_at);
  assert.ok(added.updated_at);

  const doctorRow = adminDoctorStore.find(item => item.id === added.id);
  assert.deepEqual(Object.keys(doctorRow).sort(), ['id', 'license_number', 'ptr_number', 'signature_path', 'specialty']);
  const profile = adminUserProfileStore.find(item => item.id === added.id);
  assert.equal(profile.display_name, 'Dr. Test Doctor');
  assert.equal(profile.contact_number, '0917 000 0001');
  assert.equal(profile.role, 'doctor');
  assert.equal(adminDashboardService.getDashboard().totalDoctors, count + 1);
});

test('doctor edit and lifecycle preserve identity and account history', () => {
  const added = service.create(validDoctor);
  const updated = service.update(added.id, { ...validDoctor, display_name: 'Dr. Updated Doctor', contact_number: '0917 222 2222' });
  assert.equal(updated.id, added.id);
  assert.equal(updated.created_at, added.created_at);
  assert.equal(updated.display_name, 'Dr. Updated Doctor');
  assert.equal(service.list('UPDATED DOCTOR')[0].id, added.id);
  assert.equal(service.list('0917 222')[0].id, added.id);
  assert.ok(service.list('PRC-TEST-1').some(doctor => doctor.id === added.id));

  const inactive = service.deactivate(added.id);
  assert.equal(inactive.id, added.id);
  assert.equal(inactive.status, 'inactive');
  assert.ok(adminDoctorStore.some(item => item.id === added.id));
  assert.ok(adminUserProfileStore.some(item => item.id === added.id));
  const active = service.reactivate(added.id);
  assert.equal(active.id, added.id);
  assert.equal(active.status, 'active');
  assert.equal(service.delete, undefined);

  active.display_name = 'external mutation';
  assert.equal(service.get(added.id).display_name, 'Dr. Updated Doctor');
  assert.throws(() => service.update('missing', validDoctor), /not found/);
  assert.throws(() => service.deactivate('missing'), /not found/);
});

test('doctor management UI has lifecycle controls and no delete action', async () => {
  const source = await readFile(new URL('../src/pages/admin/ManageDoctors.jsx', import.meta.url), 'utf8');
  assert.match(source, /Deactivate/);
  assert.match(source, /Reactivate/);
  assert.match(source, /License number/);
  assert.match(source, /PTR number/);
  assert.match(source, /Signature reference/);
  assert.doesNotMatch(source, />Delete</);
});

test('empty doctor list is supported', () => {
  const saved = adminDoctorStore.splice(0);
  try { assert.deepEqual(service.list(), []); } finally { adminDoctorStore.push(...saved); }
});
