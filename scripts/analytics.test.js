import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAnalyticsApiRepository } from '../src/repositories/analyticsApiRepository.js';
import { analyticsPeriods, createAnalyticsService } from '../src/services/analyticsService.js';

test('analytics repository uses role-scoped read-only endpoints and encodes period', async () => {
  const calls = [];
  const repository = createAnalyticsApiRepository({ async request(path, options) { calls.push({ path, options }); return { analytics: { summary: {} } }; } });
  await repository.getAnalytics('staff', 'this & that');
  await repository.getAnalytics('admin', 'month');
  assert.deepEqual(calls, [
    { path: '/api/staff/analytics?period=this%20%26%20that', options: undefined },
    { path: '/api/admin/analytics?period=month', options: undefined },
  ]);
});

test('analytics service supports only approved roles and periods', async () => {
  const calls = [];
  const service = createAnalyticsService({ async getAnalytics(role, period) { calls.push({ role, period }); return { role, period }; } });
  assert.deepEqual(analyticsPeriods.map((item) => item.key), ['today', 'week', 'month']);
  assert.deepEqual(await service.getAnalytics('staff', 'week'), { role: 'staff', period: 'week' });
  assert.deepEqual(await service.getAnalytics('admin', 'month'), { role: 'admin', period: 'month' });
  assert.throws(() => service.getAnalytics('doctor', 'today'), /Staff and Admin/);
  assert.throws(() => service.getAnalytics('staff', 'year'), /Unsupported/);
  assert.equal(calls.length, 2);
});

test('analytics page includes period, loading, error, empty, metric, and privacy states', async () => {
  const source = await readFile(new URL('../src/pages/analytics/ClinicAnalytics.jsx', import.meta.url), 'utf8');
  for (const text of ['analyticsPeriods', 'Loading clinic analytics', 'Try again', 'No appointments were scheduled', 'Doctor Workload', 'Appointment Status Breakdown', 'Visit Reasons', 'Busiest Day', 'Busiest Time']) assert.match(source, new RegExp(text));
  assert.doesNotMatch(source, /patient\.full_name|diagnosis|prescription|clinical note/i);
});
