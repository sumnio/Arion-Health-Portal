import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createAnalyticsService, analyticsPeriodRange } from '../src/services/analyticsService.js';
import { createTokenService } from '../src/services/tokenService.js';

const clinic = { timeZone: 'Asia/Manila' };
const now = new Date('2026-10-08T02:00:00.000Z');
const doctorOne = { _id: '100000000000000000000001', user_profile_id: { display_name: 'Doctor One', status: 'active' } };
const doctorTwo = { _id: '100000000000000000000002', user_profile_id: { display_name: 'Doctor Two', status: 'active' } };
const seniorPwd = { _id: '200000000000000000000001', dob: new Date('1950-01-01T00:00:00.000Z'), is_pwd: true };
const adult = { _id: '200000000000000000000002', dob: new Date('1990-01-01T00:00:00.000Z'), is_pwd: false };

function appointment(id, time, status, patient, reason, extras = {}) {
  return {
    _id: id, doctor_id: doctorOne, patient_id: patient, appointment_at: new Date(`2026-10-08T${time}:00.000Z`),
    status, visit_type: extras.visit_type ?? 'general_consultation', reason, priority: extras.priority ?? 'normal',
  };
}

function repository(appointments = []) {
  return {
    async listAppointmentsBetween() { return appointments; },
    async listDoctors() { return [doctorOne, doctorTwo]; },
  };
}

test('analytics period ranges use Asia/Manila day, Monday week, and calendar month boundaries', () => {
  assert.deepEqual(analyticsPeriodRange('today', now, clinic.timeZone), {
    key: 'today', label: 'Today', start_date: '2026-10-08', end_date_exclusive: '2026-10-09', time_zone: clinic.timeZone,
    start: new Date('2026-10-07T16:00:00.000Z'), end: new Date('2026-10-08T16:00:00.000Z'),
  });
  const week = analyticsPeriodRange('week', now, clinic.timeZone);
  assert.equal(week.start.toISOString(), '2026-10-04T16:00:00.000Z');
  assert.equal(week.end.toISOString(), '2026-10-11T16:00:00.000Z');
  assert.equal(week.start_date, '2026-10-05');
  const month = analyticsPeriodRange('month', now, clinic.timeZone);
  assert.equal(month.start.toISOString(), '2026-09-30T16:00:00.000Z');
  assert.equal(month.end.toISOString(), '2026-10-31T16:00:00.000Z');
});

test('analytics aggregates safe operational metrics and does not expose legacy reason text', async () => {
  const items = [
    appointment('300000000000000000000001', '01:00', 'completed', seniorPwd, 'General health concern'),
    appointment('300000000000000000000002', '01:00', 'completed', seniorPwd, 'Private walk-in narrative', { visit_type: 'follow_up' }),
    appointment('300000000000000000000003', '02:00', 'pending', adult, 'Fever, cough, or cold symptoms', { priority: 'urgent' }),
    appointment('300000000000000000000004', '03:00', 'cancelled', adult, 'Other concern', { visit_type: 'check_up' }),
    appointment('300000000000000000000005', '04:00', 'no_show', adult, 'Other concern'),
    appointment('300000000000000000000006', '05:00', 'confirmed', adult, 'Other concern'),
  ];
  const data = await createAnalyticsService({ repository: repository(items), clinic, now: () => now }).get('today');
  assert.deepEqual(data.summary, { total_appointments: 6, pending: 1, confirmed: 1, completed: 2, cancelled: 1, no_show: 1 });
  assert.equal(data.doctor_workload[0].total_appointments, 6);
  assert.equal(data.doctor_workload[0].unique_patients, 2);
  assert.equal(data.doctor_workload[0].patients_served, 1);
  assert.equal(data.doctor_workload[1].total_appointments, 0);
  assert.equal('doctor_id' in data.doctor_workload[0], false);
  assert.equal(data.visit_reasons.find((item) => item.key === 'Other / legacy').count, 1);
  assert.equal(JSON.stringify(data).includes('Private walk-in narrative'), false);
  assert.equal(data.urgent.appointments, 1);
  assert.deepEqual(data.senior_pwd, { metric: 'unique patients with completed appointments', senior: 1, pwd: 1, combined: 1 });
  assert.deepEqual(data.busiest_day, { key: 'Thursday', count: 6 });
  assert.deepEqual(data.busiest_time, { key: '09:00', count: 2 });
  for (const forbidden of ['full_name', 'diagnosis', 'notes', 'prescription', 'explanation']) assert.equal(JSON.stringify(data).toLowerCase().includes(forbidden), false);
});

test('empty analytics period returns zero counts and null peaks safely', async () => {
  const data = await createAnalyticsService({ repository: repository(), clinic, now: () => now }).get('today');
  assert.equal(data.summary.total_appointments, 0);
  assert.equal(data.doctor_workload.length, 2);
  assert.equal(data.busiest_day, null);
  assert.equal(data.busiest_time, null);
});

const secret = 'analytics-test-secret-1234567890123456789012';
function authContext() {
  const profiles = new Map(['staff', 'admin', 'doctor', 'patient'].map((role) => [`${role}-profile`, { user_profile_id: `${role}-profile`, display_name: role, role, status: 'active' }]));
  profiles.set('inactive-staff-profile', { user_profile_id: 'inactive-staff-profile', display_name: 'inactive', role: 'staff', status: 'inactive' });
  const tokens = createTokenService(secret);
  const service = { async getAuthenticatedUser(id) { const profile = profiles.get(String(id)); if (!profile) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'UNAUTHENTICATED' }); return profile; } };
  const analyticsModule = { analyticsService: { async get(period) { return { period: { key: period }, summary: { total_appointments: 0 } }; } } };
  const app = createApp({ nodeEnv: 'test', authSecret: secret }, { authModule: { service, tokens }, analyticsModule });
  return { app, cookie(id) { return `arion_auth=${tokens.sign(id, { mfaVerified: profiles.get(id)?.role === 'admin' })}`; } };
}
async function request(app, path, cookie) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { return await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: cookie ? { cookie } : {} }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test('Staff and MFA-authenticated Admin have separate read-only analytics routes', async () => {
  const context = authContext();
  assert.equal((await request(context.app, '/api/staff/analytics?period=week', context.cookie('staff-profile'))).status, 200);
  assert.equal((await request(context.app, '/api/admin/analytics?period=month', context.cookie('admin-profile'))).status, 200);
  assert.equal((await request(context.app, '/api/admin/analytics', context.cookie('staff-profile'))).status, 403);
  assert.equal((await request(context.app, '/api/staff/analytics', context.cookie('admin-profile'))).status, 403);
});

test('analytics denies unauthenticated, inactive, Patient, and Doctor access', async () => {
  const context = authContext();
  assert.equal((await request(context.app, '/api/staff/analytics')).status, 401);
  assert.equal((await request(context.app, '/api/staff/analytics', context.cookie('inactive-staff-profile'))).status, 403);
  for (const role of ['patient', 'doctor']) {
    assert.equal((await request(context.app, '/api/staff/analytics', context.cookie(`${role}-profile`))).status, 403);
    assert.equal((await request(context.app, '/api/admin/analytics', context.cookie(`${role}-profile`))).status, 403);
  }
});

test('analytics validates period and rejects unknown or operator-style query fields', async () => {
  const context = authContext();
  for (const path of ['/api/staff/analytics?period=year', '/api/staff/analytics?from=2026-01-01', '/api/staff/analytics?period[$ne]=today']) {
    assert.equal((await request(context.app, path, context.cookie('staff-profile'))).status, 400);
  }
});
