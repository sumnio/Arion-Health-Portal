import { clinicToday, formatSlot, shiftCalendarDate } from '../../services/dateTimeService.js';
import { staffWeekDays } from '../../services/staffApiService.js';

const START_MINUTES = 8 * 60;
const END_MINUTES = 18 * 60;
const TOTAL_MINUTES = END_MINUTES - START_MINUTES;
const hourMarks = Array.from({ length: 11 }, (_, index) => START_MINUTES + (index * 60));

function minutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return (hour * 60) + minute;
}

function dateOnly(value) {
  return String(value ?? '').slice(0, 10);
}

function blockParts(item) {
  const parts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const start = parts(item.start_at); const end = parts(item.end_at);
  const date = `${start.year}-${start.month}-${start.day}`; const endDate = `${end.year}-${end.month}-${end.day}`;
  const wholeDay = start.hour === '00' && start.minute === '00' && end.hour === '00' && end.minute === '00' && date !== endDate;
  return { date, start: wholeDay ? '08:00' : `${start.hour}:${start.minute}`, end: wholeDay ? '18:00' : `${end.hour}:${end.minute}`, wholeDay };
}

export function startOfClinicWeek(date = clinicToday()) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftCalendarDate(date, -day);
}

export function scheduleWeekDays(weekStart) {
  return staffWeekDays.map((name, index) => ({ name, shortName: name.slice(0, 3), date: shiftCalendarDate(weekStart, index), dayOfWeek: index }));
}

export function weekRangeLabel(weekStart) {
  const end = shiftCalendarDate(weekStart, 6);
  const startDate = new Date(`${weekStart}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const start = startDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(startDate.getUTCFullYear() !== endDate.getUTCFullYear() ? { year: 'numeric' } : {}) });
  const finish = endDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  return `${start} – ${finish}`;
}

function clusterLayouts(events) {
  const ordered = [...events].sort((left, right) => left.startMinute - right.startMinute || left.endMinute - right.endMinute);
  const clusters = [];
  for (const event of ordered) {
    const current = clusters.at(-1);
    if (!current || event.startMinute >= current.endMinute) clusters.push({ endMinute: event.endMinute, events: [event] });
    else { current.events.push(event); current.endMinute = Math.max(current.endMinute, event.endMinute); }
  }
  return clusters.flatMap((cluster) => {
    const laneEnds = [];
    const placed = cluster.events.map((event) => {
      let lane = laneEnds.findIndex(end => event.startMinute >= end);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = event.endMinute;
      return { ...event, lane };
    });
    return placed.map(event => ({ ...event, laneCount: laneEnds.length }));
  });
}

function eventsForDay(day, schedule) {
  const working = schedule.recurring_availability.filter(item => item.day_of_week === day.dayOfWeek).map(item => ({ id: `working-${item.id}`, type: 'working', label: 'Working Hours', start: item.start_time, end: item.end_time, source: item, disabled: !item.is_active }));
  const special = schedule.published_availability.filter(item => dateOnly(item.availability_date) === day.date).map(item => ({ id: `special-${item.id}`, type: 'special', label: 'Special Availability', start: item.start_time, end: item.end_time, source: item }));
  const timeOff = schedule.blocked_times.map(item => ({ item, parts: blockParts(item) })).filter(({ parts }) => parts.date === day.date).map(({ item, parts }) => ({ id: `timeoff-${item.id}`, type: 'timeoff', label: 'Time Off', start: parts.start, end: parts.end, wholeDay: parts.wholeDay, source: item }));
  return clusterLayouts([...working, ...special, ...timeOff].map((event) => ({ ...event, date: day.date, startMinute: Math.max(START_MINUTES, minutes(event.start)), endMinute: Math.min(END_MINUTES, minutes(event.end)) })).filter(event => event.endMinute > START_MINUTES && event.startMinute < END_MINUTES));
}

export default function WeeklyScheduleCalendar({ weekStart, schedule, onSelectEvent }) {
  const days = scheduleWeekDays(weekStart);
  const today = clinicToday();
  return <section className="weekly-calendar-card" aria-labelledby="weekly-calendar-title">
    <h2 id="weekly-calendar-title" className="visually-hidden">Weekly schedule calendar</h2>
    <div className="weekly-calendar-scroll" tabIndex={0} aria-label={`Weekly calendar, ${weekRangeLabel(weekStart)}. Scroll horizontally on smaller screens.`}>
      <div className="weekly-calendar-grid">
        <div className="calendar-corner">Time</div>
        {days.map(day => <div key={day.date} className={`calendar-day-heading ${day.date === today ? 'is-today' : ''}`}><strong>{day.shortName}</strong><span>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}</span>{day.date === today && <small>Today</small>}</div>)}
        <div className="calendar-time-axis">{hourMarks.map((mark) => <span key={mark} style={{ top: `${((mark - START_MINUTES) / TOTAL_MINUTES) * 100}%` }}>{formatSlot(`${String(Math.floor(mark / 60)).padStart(2, '0')}:00`)}</span>)}</div>
        {days.map((day) => <div key={day.date} className="calendar-day-track" aria-label={`${day.name}, ${day.date}`}>{eventsForDay(day, schedule).map(event => {
          const top = ((event.startMinute - START_MINUTES) / TOTAL_MINUTES) * 100;
          const height = ((event.endMinute - event.startMinute) / TOTAL_MINUTES) * 100;
          const width = 100 / event.laneCount;
          return <button key={event.id} type="button" className={`calendar-schedule-block is-${event.type} ${event.disabled ? 'is-disabled' : ''}`} style={{ top: `${top}%`, height: `${height}%`, left: `calc(${event.lane * width}% + 4px)`, width: `calc(${width}% - 8px)` }} onClick={() => onSelectEvent(event)} aria-label={`${event.label}, ${day.name} ${day.date}, ${event.wholeDay ? 'whole day' : `${formatSlot(event.start)} to ${formatSlot(event.end)}`}${event.disabled ? ', disabled' : ''}`}>
            <span className="calendar-block-mark" aria-hidden="true">{event.type === 'working' ? '▣' : event.type === 'special' ? '★' : '⊘'}</span>
            <strong>{event.wholeDay ? 'Whole day' : `${formatSlot(event.start)} – ${formatSlot(event.end)}`}</strong>
            <span>{event.label}{event.disabled ? ' · Disabled' : ''}</span>
          </button>;
        })}</div>)}
      </div>
    </div>
  </section>;
}
