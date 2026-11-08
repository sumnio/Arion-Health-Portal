import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { affectedCountLabel, timelineBounds } from '../src/components/schedule/schedulePresentation.js';

test('affected appointment count copy handles singular, plural, and zero', () => {
  assert.equal(affectedCountLabel(0), '0 appointments need rescheduling');
  assert.equal(affectedCountLabel(1), '1 appointment needs rescheduling');
  assert.equal(affectedCountLabel(3), '3 appointments need rescheduling');
});

test('calendar timeline keeps the standard day and expands for early or late schedule blocks', () => {
  assert.deepEqual(timelineBounds([]), { startMinute: 480, endMinute: 1080, totalMinutes: 600, hourMarks: [480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080] });
  const late = timelineBounds([{ startMinute: 1260, endMinute: 1410 }]);
  assert.equal(late.startMinute, 480);
  assert.equal(late.endMinute, 1440);
  assert(late.hourMarks.includes(1380));
  const early = timelineBounds([{ startMinute: 390, endMinute: 450 }]);
  assert.equal(early.startMinute, 360);
  assert.equal(early.endMinute, 1080);
});

test('Staff schedule presents a compact warning, accessible review drawer, explicit confirmation, and safe stale-slot copy', async () => {
  const [page, panel, dialog, calendar, styles] = await Promise.all([
    readFile(new URL('../src/pages/staff/StaffDoctorSchedule.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/schedule/RescheduleReviewPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/schedule/ScheduleDialog.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/schedule/WeeklyScheduleCalendar.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/staff-doctors.css', import.meta.url), 'utf8'),
  ]);
  for (const text of ['No appointments need rescheduling', 'Review Appointments', 'Some appointments overlap', 'Reschedule appointment?', 'Confirm Reschedule', 'That time is no longer available. Please choose another slot.', 'Reload suggestions']) assert.match(page, new RegExp(text.replace(/[?]/g, '\\?')));
  for (const text of ['patient.full_name', 'Doctor', 'Visit type', 'Original date', 'Original time', 'Suggested times', 'Choose another date/time', 'Reschedule', 'Leave Pending']) assert.match(panel, new RegExp(text));
  assert.match(panel, /role=\{message\.type === 'error' \? 'alert' : 'status'\}/);
  assert.doesNotMatch(panel, /diagnosis|prescription|medical record|certificate|supporting document|PWD document/i);
  assert.match(dialog, /is-\$\{variant\}/);
  assert.match(dialog, /Escape/);
  assert.match(dialog, /previousFocus/);
  assert.match(calendar, /scheduleTimeline/);
  assert.match(calendar, /--calendar-body-height/);
  assert.match(calendar, /Published for booking/);
  assert.doesNotMatch(calendar, /clusterLayouts|laneCount/);
  assert.match(styles, /schedule-dialog\.is-drawer/);
  assert.match(styles, /max-height:\s*min\(72vh, 760px\)/);
  assert.match(styles, /overflow:\s*auto/);
  assert.match(styles, /calendar-view-control[^}]*justify-content:\s*center/);
  assert.match(styles, /week-stepper button[^}]*place-items:\s*center/);
  assert.match(styles, /calendar-schedule-block[^}]*width:\s*calc\(100% - 10px\)/);
  assert.match(styles, /calendar-schedule-block\.is-special[^}]*border-left-width:\s*6px/);
  assert.match(styles, /calendar-schedule-block\.is-timeoff[^}]*repeating-linear-gradient/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /affected-card-actions/);
});
