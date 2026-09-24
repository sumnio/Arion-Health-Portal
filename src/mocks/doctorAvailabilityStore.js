// Provider-independent, session-only scheduling fixtures. These objects mirror
// the approved concepts without selecting a database representation.
const ids = {
  maria: '50000000-0000-4000-8000-000000000001',
  carlo: '50000000-0000-4000-8000-000000000002',
  demo: '50000000-0000-4000-8000-000000000003',
};

const recurring = (id, doctor_id, day_of_week, start_time, end_time, is_active = true) => ({ id, doctor_id, day_of_week, start_time, end_time, is_active });
export const doctorAvailabilityStore = [
  recurring('a-demo-mon-am', ids.demo, 1, '09:00', '12:00'),
  recurring('a-demo-mon-pm', ids.demo, 1, '13:00', '17:00'),
  recurring('a-demo-tue', ids.demo, 2, '09:00', '12:00'),
  recurring('a-demo-wed', ids.demo, 3, '09:00', '12:00'),
  recurring('a-demo-thu', ids.demo, 4, '09:00', '17:00'),
  recurring('a-demo-fri', ids.demo, 5, '09:00', '17:00'),
  recurring('a-demo-sat', ids.demo, 6, '09:00', '12:00', false),
  recurring('a-demo-sun', ids.demo, 0, '09:00', '12:00', false),
];

// UI/service metadata for specific dates the doctors have confirmed as
// patient-bookable. It is intentionally separate from recurring templates.
export const doctorPublishedAvailabilityStore = [];
function seedPublished(doctor_id, dates, start_time, end_time) {
  dates.forEach(date => doctorPublishedAvailabilityStore.push({ id: `published-${doctor_id.slice(-1)}-${date}`, doctor_id, date, start_time, end_time }));
}
// These literal date lists are confirmed-date fixtures. They are deliberately
// not derived from recurring weekday templates.
seedPublished(ids.maria, ['2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16'], '08:00', '11:00');
seedPublished(ids.maria, ['2026-09-19', '2026-09-22', '2026-09-26', '2026-09-29', '2026-10-03', '2026-10-06', '2026-10-10', '2026-10-13', '2026-10-17'], '13:00', '15:00');
seedPublished(ids.carlo, ['2026-09-18', '2026-09-21', '2026-09-25', '2026-09-28', '2026-10-02', '2026-10-05', '2026-10-09', '2026-10-12', '2026-10-16'], '09:00', '12:00');
seedPublished(ids.carlo, ['2026-09-19', '2026-09-22', '2026-09-24', '2026-09-26', '2026-09-29', '2026-10-01', '2026-10-03', '2026-10-06', '2026-10-08', '2026-10-10', '2026-10-13', '2026-10-15', '2026-10-17'], '14:00', '16:00');

doctorPublishedAvailabilityStore.push(
  { id: 'published-demo-2026-09-24', doctor_id: ids.demo, date: '2026-09-24', start_time: '09:00', end_time: '17:00' },
  { id: 'published-demo-2026-09-28-am', doctor_id: ids.demo, date: '2026-09-28', start_time: '09:00', end_time: '12:00' },
  { id: 'published-demo-2026-09-28-pm', doctor_id: ids.demo, date: '2026-09-28', start_time: '13:00', end_time: '17:00' },
);

export const doctorBlockedTimeStore = [
  { id: 'blocked-maria-2026-09-23', doctor_id: ids.maria, start_at: '2026-09-23T00:00:00+08:00', end_at: '2026-09-24T00:00:00+08:00', reason: 'Leave' },
  { id: 'blocked-carlo-2026-09-25', doctor_id: ids.carlo, start_at: '2026-09-25T00:00:00+08:00', end_at: '2026-09-26T00:00:00+08:00', reason: 'Conference' },
  { id: 'blocked-demo-partial', doctor_id: ids.demo, start_at: '2026-09-28T10:00:00+08:00', end_at: '2026-09-28T11:00:00+08:00', reason: 'Meeting' },
];
