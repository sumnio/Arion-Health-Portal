const DEFAULT_START_MINUTES = 8 * 60;
const DEFAULT_END_MINUTES = 18 * 60;
const DAY_MINUTES = 24 * 60;

export function affectedCountLabel(count) {
  return `${count} ${count === 1 ? 'appointment needs' : 'appointments need'} rescheduling`;
}

export function timelineBounds(events) {
  const earliest = events.length ? Math.min(...events.map(event => event.startMinute)) : DEFAULT_START_MINUTES;
  const latest = events.length ? Math.max(...events.map(event => event.endMinute)) : DEFAULT_END_MINUTES;
  const startMinute = Math.max(0, Math.min(DEFAULT_START_MINUTES, Math.floor(earliest / 60) * 60));
  const endMinute = Math.min(DAY_MINUTES, Math.max(DEFAULT_END_MINUTES, Math.ceil(latest / 60) * 60));
  const totalMinutes = endMinute - startMinute;
  return {
    startMinute,
    endMinute,
    totalMinutes,
    hourMarks: Array.from({ length: (totalMinutes / 60) + 1 }, (_, index) => startMinute + (index * 60)),
  };
}
