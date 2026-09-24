import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminPatientListPage, adminPatientService } from '../src/services/adminPatientService.js';
import { adminUserProfileStore } from '../src/mocks/adminUserProfileStore.js';
import { allStaffPatients } from '../src/mocks/staffWalkInStore.js';

test('Admin Patient page renders only basic account information', async () => {
  const pageSource = await readFile(new URL('../src/pages/admin/ManagePatients.jsx', import.meta.url), 'utf8');
  assert.match(pageSource, /Manage Patients/);
  assert.match(pageSource, /Patient ID/);
  assert.match(pageSource, /No portal account/);
  assert.doesNotMatch(pageSource, />Delete/);
  assert.doesNotMatch(pageSource, /diagnosis|prescription|certificate|doctor notes/i);
});

test('Admin Patient search supports full name and contact number', () => {
  const byName = adminPatientService.list({ query: ' ANA ' });
  assert.equal(byName.filteredTotal, 1);
  assert.equal(byName.items[0].full_name, 'Ana Reyes');
  const byPhone = adminPatientService.list({ query: '09175550102' });
  assert.equal(byPhone.filteredTotal, 1);
  assert.equal(byPhone.items[0].full_name, 'Ana Reyes');
  assert.equal(adminPatientService.list({ query: 'not-a-patient' }).filteredTotal, 0);
});

test('linked accounts show only active/inactive while walk-ins show no portal account', () => {
  const active = adminPatientService.list({ status: 'active' }).items;
  const inactive = adminPatientService.list({ status: 'inactive' }).items;
  const guests = adminPatientService.list({ status: 'no_account' }).items;
  assert.ok(active.length > 0 && active.every(patient => patient.account_status === 'active'));
  assert.ok(inactive.length > 0 && inactive.every(patient => patient.account_status === 'inactive'));
  assert.ok(guests.length > 0 && guests.every(patient => patient.user_profile_id === null && patient.account_status === null));
});

test('deactivate and reactivate preserve Patient identity and linked history', () => {
  const patient = adminPatientService.list({ status: 'active' }).items[0];
  const patientCount = allStaffPatients().length;
  const profileCount = adminUserProfileStore.length;
  const profileId = patient.user_profile_id;
  const inactive = adminPatientService.deactivate(patient.id);
  assert.equal(inactive.id, patient.id);
  assert.equal(inactive.user_profile_id, profileId);
  assert.equal(inactive.account_status, 'inactive');
  assert.equal(allStaffPatients().length, patientCount);
  assert.equal(adminUserProfileStore.length, profileCount);
  assert.ok(adminPatientService.list({ status: 'inactive' }).items.some(item => item.id === patient.id));
  const active = adminPatientService.reactivate(patient.id);
  assert.equal(active.id, patient.id);
  assert.equal(active.user_profile_id, profileId);
  assert.equal(active.account_status, 'active');
  assert.equal(adminPatientService.delete, undefined);
});

test('walk-in Patients cannot receive misleading account lifecycle actions', () => {
  const guest = adminPatientService.list({ status: 'no_account' }).items[0];
  assert.equal(guest.has_portal_account, false);
  assert.throws(() => adminPatientService.deactivate(guest.id), /no portal account/);
  assert.throws(() => adminPatientService.reactivate(guest.id), /no portal account/);
});

test('Patient account list paginates at five rows and supports empty data', () => {
  const patients = Array.from({ length: 11 }, (_, index) => ({
    id: `patient-${index}`,
    user_profile_id: null,
    full_name: `Patient ${String(index).padStart(2, '0')}`,
    contact_number: `091700000${String(index).padStart(2, '0')}`,
  }));
  assert.deepEqual([1, 2, 3].map(page => adminPatientListPage(patients, [], { page }).items.length), [5, 5, 1]);
  const empty = adminPatientListPage([], [], {});
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.items, []);
});
