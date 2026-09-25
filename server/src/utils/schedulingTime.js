export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const SLOT_TIME_PATTERN = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
export const SLOT_MS = 30 * 60 * 1000;

export function isValidDateOnly(value) {
  if (!DATE_PATTERN.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dateOnlyToUtc(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function storedDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function addDays(value, days) {
  const date = dateOnlyToUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function clinicDate(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function minutes(value) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function timeFromMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((item) => item.type !== 'literal').map((item) => [item.type, item.value]));
}

export function zonedDateTimeToUtc(date, time, timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = new Date(desired);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = zonedParts(candidate, timeZone);
    const observedAsUtc = Date.UTC(
      Number(observed.year),
      Number(observed.month) - 1,
      Number(observed.day),
      Number(observed.hour),
      Number(observed.minute),
      Number(observed.second),
    );
    candidate = new Date(candidate.getTime() + desired - observedAsUtc);
  }
  return candidate;
}

export function appointmentLocalParts(value, timeZone) {
  const parts = zonedParts(new Date(value), timeZone);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function rangesOverlap(start, end, otherStart, otherEnd) {
  return start < otherEnd && end > otherStart;
}
