export const clinicTimeZone = 'Asia/Manila';

export function clinicToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

export function bookingWindow(now = new Date()) {
  const start = clinicToday(now); const end = new Date(start + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 14);
  return { start, end: end.toISOString().slice(0, 10) };
}

export function formatBookingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return 'Not selected';
  return new Date(value + 'T00:00:00+08:00').toLocaleDateString('en-US', { timeZone: clinicTimeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatSlot(time) {
  const [hour, minute] = time.split(':').map(Number);
  return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
}

export function slotRange(time) {
  const [hour, minute] = time.split(':').map(Number); const end = hour * 60 + minute + 30;
  return formatSlot(time) + ' – ' + formatSlot(String(Math.floor(end / 60)).padStart(2, '0') + ':' + String(end % 60).padStart(2, '0'));
}

export function formatEncounter(value) { return new Date(value).toLocaleString('en-US', { timeZone: clinicTimeZone, dateStyle: 'long', timeStyle: 'short' }); }
export function formatCertificateDate(value) { return value ? new Date(value + 'T00:00:00+08:00').toLocaleDateString('en-US', { timeZone: clinicTimeZone, dateStyle: 'long' }) : 'Not specified'; }
