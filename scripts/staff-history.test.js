import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createStaffApiRepository } from '../src/repositories/staffApiRepository.js';
import { createStaffApiService } from '../src/services/staffApiService.js';

const raw = {
  id: 'appointment-1', appointment_at: '2026-10-15T02:00:00.000Z', check_in_at: '2026-10-15T01:45:00.000Z',
  patient: { id: 'patient-1', full_name: 'Alex Patient' }, doctor: { id: 'doctor-1', display_name: 'Sample Doctor' },
  status: 'completed', visit_type: 'follow_up', reason: 'Follow-up consultation', priority: 'normal',
  queue_priority: 'senior_pwd', origin: 'patient',
};

test('Staff API repository sends only approved history filters to the Staff endpoint', async () => {
  const calls = [];
  const repository = createStaffApiRepository({ async request(path, options = {}) { calls.push([path, options]); return { history: { items: [raw], page: 2, limit: 10, total: 11, page_count: 2 } }; } });
  const result = await repository.getAppointmentHistory({ range: 'custom', from: '2026-09-01', to: '2026-09-25', status: 'completed', doctorId: 'doctor-1', patientSearch: 'Alex Patient', visitType: 'follow_up', page: 2 });
  assert.equal(calls[0][0], '/api/staff/appointments/history?range=custom&status=completed&visit_type=follow_up&page=2&doctor_id=doctor-1&patient_search=Alex+Patient&from=2026-09-01&to=2026-09-25');
  assert.equal(result.items.length, 1);
  assert.deepEqual(calls[0][1], {});
});

test('Staff history service normalizes operational rows and server pagination', async () => {
  const service = createStaffApiService({ async getAppointmentHistory() { return { items: [raw], page: 2, limit: 10, total: 11, page_count: 2 }; } });
  const result = await service.getAppointmentHistory({});
  assert.equal(result.pageCount, 2); assert.equal(result.total, 11);
  assert.equal(result.items[0].patientName, 'Alex Patient');
  assert.equal(result.items[0].doctorName, 'Sample Doctor');
  assert.equal(result.items[0].visitLabel, 'Follow-up');
  assert.equal(result.items[0].priorityLabel, 'Senior / PWD');
  assert.equal(result.items[0].originLabel, 'Patient booking');
});

test('Staff Queue replaces the terminal-day tab with Appointment History and preserves operational tabs', async () => {
  const source = await readFile(new URL('../src/pages/staff/StaffQueue.jsx', import.meta.url), 'utf8');
  assert.match(source, /Active Queue/); assert.match(source, /Scheduled/); assert.match(source, /Appointment History/);
  assert.doesNotMatch(source, /Completed \/ Cancelled \/ No-show/);
  assert.match(source, /view==='history'\?<StaffAppointmentHistory\/>/);
  assert.match(source, /staffQueueActions/); assert.match(source, /Confirm Arrival/); assert.match(source, /Mark No-show/);
});

test('Staff history UI includes approved defaults, filters, pagination, safe navigation, errors, and empty state', async () => {
  const source = await readFile(new URL('../src/components/scheduling/StaffAppointmentHistory.jsx', import.meta.url), 'utf8');
  for (const expected of ['last_30_days', 'Last 30 Days', 'Today', 'Last 7 Days', 'This Month', 'Custom Range', 'All Doctors', 'All Visit Types', 'Patient Search', 'Completed', 'Cancelled', 'No-show', 'newest first', 'Previous', 'Next', 'View Patient Details', 'Try again', 'No appointment history found']) assert.match(source, new RegExp(expected));
  assert.match(source, /setPage\(1\)/); assert.match(source, /From date must be on or before To date/); assert.match(source, /pageCount > 1/);
  for (const forbidden of ['diagnosis', 'prescription', 'certificate', 'supporting document', 'signature', 'allergies', 'emergency contact', 'phone', 'email']) assert.doesNotMatch(source, new RegExp(forbidden, 'i'));
});

test('Staff history layout stacks safely on small screens', async () => {
  const styles = await readFile(new URL('../src/styles/staff-queue.css', import.meta.url), 'utf8');
  assert.match(styles, /\.staff-queue \.history-filters/);
  assert.match(styles, /\.staff-queue \.history-list > li/);
  assert.match(styles, /overflow-wrap:anywhere/);
  assert.match(styles, /@media\(max-width:550px\).*\.staff-queue \.history-list > li \{ grid-template-columns:1fr/s);
  assert.match(styles, /\.staff-queue \.history-search > div \{ align-items:stretch; flex-direction:column/);
});
