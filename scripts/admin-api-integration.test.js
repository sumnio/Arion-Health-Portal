import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ApiError } from '../src/services/apiClient.js';
import { createAdminApiRepository } from '../src/repositories/adminApiRepository.js';
import { adminApiErrorMessage, createAdminApiService } from '../src/services/adminApiService.js';

function page(items = []) { return { items, total: items.length, page: 1, page_size: 5, page_count: 1 }; }

test('Admin repository uses credentialed API routes and approved HTTP methods', async () => {
  const calls = [];
  const client = { async request(path, options = {}) { calls.push({ path, options }); if (path.startsWith('/api/admin/doctors?')) return { doctors: page() }; if (path.startsWith('/api/admin/staff?')) return { staff: page() }; if (path.startsWith('/api/admin/patients?')) return { patients: page() }; if (path === '/api/admin/doctors') return { doctor: { id: 'doctor-1' } }; if (path === '/api/admin/staff') return { staff: { id: 'staff-1' } }; if (path.includes('/patients/')) return { patient: { id: 'patient-1' } }; return { doctor: { id: 'doctor-1' }, staff: { id: 'staff-1' } }; } };
  const repository = createAdminApiRepository(client);
  await repository.getDoctors({ search: 'Santos', page: 2, limit: 5 });
  await repository.getStaff({ search: 'Reception', page: 1, limit: 5 });
  await repository.getPatients({ search: 'Ana', status: 'inactive', page: 1, limit: 5 });
  await repository.createDoctor({ email: 'doctor@example.com' }); await repository.updateDoctor('doctor/1', { display_name: 'Doctor' }); await repository.deactivateDoctor('doctor/1'); await repository.reactivateDoctor('doctor/1');
  await repository.createStaff({ email: 'staff@example.com' }); await repository.updateStaff('staff/1', { display_name: 'Staff' }); await repository.deactivatePatient('patient/1'); await repository.reactivatePatient('patient/1');
  assert.match(calls[0].path, /search=Santos.*page=2.*limit=5/);
  assert.match(calls[1].path, /search=Reception/);
  assert.match(calls[2].path, /status=inactive/);
  assert.equal(calls[3].options.method, 'POST'); assert.equal(calls[4].options.method, 'PATCH');
  assert.match(calls[4].path, /doctor%2F1$/); assert.match(calls[5].path, /deactivate$/); assert.match(calls[6].path, /reactivate$/);
  assert.equal(calls[7].options.method, 'POST'); assert.equal(calls[8].options.method, 'PATCH'); assert.match(calls[9].path, /deactivate$/); assert.match(calls[10].path, /reactivate$/);
});

test('Admin service normalizes pages and sends only approved create/update fields', async () => {
  const captured = {};
  const repository = {
    async getDoctors() { return page([{ id: 'doctor-1' }]); }, async getStaff() { return page([{ id: 'staff-1' }]); }, async getPatients() { return page([{ id: 'patient-1' }]); },
    async createDoctor(payload) { captured.doctorCreate = payload; return { id: 'doctor-2', status: 'active' }; }, async updateDoctor(id, payload) { captured.doctorUpdate = { id, payload }; return { id }; },
    async createStaff(payload) { captured.staffCreate = payload; return { id: 'staff-2', status: 'active' }; }, async updateStaff(id, payload) { captured.staffUpdate = { id, payload }; return { id }; },
    async deactivateDoctor() {}, async reactivateDoctor() {}, async deactivateStaff() {}, async reactivateStaff() {}, async deactivatePatient() {}, async reactivatePatient() {},
  };
  const service = createAdminApiService(repository); const dashboard = await service.getDashboard();
  assert.equal(dashboard.doctors.total, 1); assert.equal(dashboard.staff.total, 1); assert.equal(dashboard.patients.total, 1);
  await service.createDoctor({ email: ' doctor@example.com ', password: 'password123', display_name: ' Doctor ', contact_number: ' 0917 ', specialty: ' GP ', license_number: ' L-1 ', ptr_number: ' P-1 ', signature_path: ' ', role: 'admin' });
  await service.updateDoctor('doctor-1', { email: 'ignored@example.com', password: 'ignored', display_name: ' Doctor ', contact_number: ' 0917 ', specialty: ' GP ', license_number: ' L-1 ', ptr_number: ' P-1 ', signature_path: '' });
  await service.createStaff({ email: ' staff@example.com ', password: 'password123', display_name: ' Staff ', contact_number: ' 0918 ', role: 'admin', username: 'ignored' });
  await service.updateStaff('staff-1', { email: 'ignored@example.com', display_name: ' Staff ', contact_number: ' 0918 ' });
  assert.deepEqual(Object.keys(captured.doctorCreate), ['email', 'password', 'display_name', 'contact_number', 'specialty', 'license_number', 'ptr_number', 'signature_path']);
  assert.equal(captured.doctorCreate.email, 'doctor@example.com'); assert.equal(captured.doctorCreate.role, undefined);
  assert.equal(captured.doctorUpdate.payload.email, undefined); assert.equal(captured.doctorUpdate.payload.password, undefined);
  assert.deepEqual(Object.keys(captured.staffCreate), ['email', 'password', 'display_name', 'contact_number']); assert.equal(captured.staffCreate.username, undefined);
  assert.deepEqual(Object.keys(captured.staffUpdate.payload), ['display_name', 'contact_number']);
});

test('Admin pages use the live service without mock service imports or destructive actions', async () => {
  const files = await Promise.all(['AdminDashboard.jsx', 'ManageDoctors.jsx', 'ManageStaff.jsx', 'ManagePatients.jsx'].map(name => readFile(new URL(`../src/pages/admin/${name}`, import.meta.url), 'utf8')));
  for (const source of files) { assert.match(source, /adminApiService/); assert.doesNotMatch(source, /admin(?:Dashboard|Doctor|Staff|Patient)Service/); assert.doesNotMatch(source, />Delete</); }
  assert.match(files[1], /type="email"/); assert.match(files[1], /type="password"/); assert.match(files[2], /type="email"/); assert.match(files[2], /type="password"/);
  assert.match(files[3], /No portal account/); assert.doesNotMatch(files[3], /diagnosis|prescription|certificate|doctor notes/i);
});

test('Admin duplicate and lifecycle errors are presented safely', () => {
  assert.equal(adminApiErrorMessage(new ApiError('internal duplicate detail', { status: 409, code: 'EMAIL_ALREADY_REGISTERED' })), 'That email is already registered.');
  assert.equal(adminApiErrorMessage(new ApiError('forbidden', { status: 403 })), 'You do not have access to this Admin operation.');
});
