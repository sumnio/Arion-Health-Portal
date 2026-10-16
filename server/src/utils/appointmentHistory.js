import { addDays, clinicDate, zonedDateTimeToUtc } from './schedulingTime.js';

export function appointmentHistoryDateRange(filters, current, timeZone) {
  const today = clinicDate(current, timeZone);
  let from = filters.from;
  let to = filters.to;
  if (filters.range === 'today') from = to = today;
  if (filters.range === 'last_7_days') { from = addDays(today, -6); to = today; }
  if (filters.range === 'last_30_days') { from = addDays(today, -29); to = today; }
  if (filters.range === 'this_month') { from = `${today.slice(0, 7)}-01`; to = today; }
  const start = zonedDateTimeToUtc(from, '00:00', timeZone);
  const inclusiveDayEnd = zonedDateTimeToUtc(addDays(to, 1), '00:00', timeZone);
  const end = inclusiveDayEnd < current ? inclusiveDayEnd : current;
  return { from, to, start, end };
}
