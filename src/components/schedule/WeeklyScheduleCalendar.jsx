import { clinicToday, formatSlot, shiftCalendarDate } from '../../services/dateTimeService.js';
import { staffWeekDays } from '../../services/staffApiService.js';
import { timelineBounds } from './schedulePresentation.js';

const DAY_MINUTES = 24 * 60;

function minutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return (hour * 60) + minute;
}

function formatTimelineMark(mark) {
  return mark === DAY_MINUTES ? '12:00 AM' : formatSlot(`${String(Math.floor(mark / 60)).padStart(2, '0')}:00`);
}

function dateOnly(value) {
  return String(value ?? '').slice(0, 10);
}

function publicationAppliesOn(item, day) {
  const startDate = dateOnly(item.availability_date);
  if (item.repeat_weekly !== true) return startDate === day.date;
  const startWeekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();
  return day.date >= startDate
    && day.dayOfWeek === startWeekday
    && !(item.excluded_dates ?? []).some(value => dateOnly(value) === day.date);
}

function publicationRangeForDay(item, day) {
  const override = (item.date_overrides ?? []).find(value => dateOnly(value.availability_date) === day.date);
  return override ?? item;
}

function blockParts(item) {
  const parts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const start = parts(item.start_at); const end = parts(item.end_at);
  const date = `${start.year}-${start.month}-${start.day}`; const endDate = `${end.year}-${end.month}-${end.day}`;
  const wholeDay = start.hour === '00' && start.minute === '00' && end.hour === '00' && end.minute === '00' && date !== endDate;
  return { date, start: wholeDay ? '00:00' : `${start.hour}:${start.minute}`, end: wholeDay ? '24:00' : `${end.hour}:${end.minute}`, wholeDay };
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

function rawEventsForDay(day, schedule) {
  const working = schedule.recurring_availability.filter(item => item.day_of_week === day.dayOfWeek).map(item => ({ id: `working-${item.id}`, type: 'working', label: 'Working Hours', start: item.start_time, end: item.end_time, source: item, disabled: !item.is_active }));
  const special = schedule.published_availability.filter(item => publicationAppliesOn(item, day)).map(item => {
    const range = publicationRangeForDay(item, day);
    return { id: `special-${item.id}-${day.date}`, type: 'special', label: 'Published for booking', start: range.start_time, end: range.end_time, source: item };
  });
  const timeOff = schedule.blocked_times.map(item => ({ item, parts: blockParts(item) })).filter(({ parts }) => parts.date === day.date).map(({ item, parts }) => ({ id: `timeoff-${item.id}`, type: 'timeoff', label: 'Time Off', start: parts.start, end: parts.end, wholeDay: parts.wholeDay, source: item }));
  return [...working, ...special, ...timeOff].map(event => ({ ...event, date: day.date, startMinute: minutes(event.start), endMinute: minutes(event.end) }));
}

export function scheduleTimeline(days, schedule) {
  const events = days.flatMap(day => rawEventsForDay(day, schedule));
  return timelineBounds(events);
}

function eventsForDay(day, schedule, timeline) {
  const layerOrder = { working: 0, special: 1, timeoff: 2 };
  return rawEventsForDay(day, schedule)
    .map(event => ({ ...event, startMinute: Math.max(timeline.startMinute, event.startMinute), endMinute: Math.min(timeline.endMinute, event.endMinute) }))
    .filter(event => event.endMinute > timeline.startMinute && event.startMinute < timeline.endMinute)
    .sort((left, right) => layerOrder[left.type] - layerOrder[right.type] || left.startMinute - right.startMinute || left.endMinute - right.endMinute);
}

export default function WeeklyScheduleCalendar({ weekStart, schedule, onSelectEvent }) {
  const days = scheduleWeekDays(weekStart);
  const timeline = scheduleTimeline(days, schedule);
  const today = clinicToday();
  return <section className="weekly-calendar-card" aria-labelledby="weekly-calendar-title">
    <h2 id="weekly-calendar-title" className="visually-hidden">Weekly schedule calendar</h2>
    <div className="weekly-calendar-scroll" tabIndex={0} aria-label={`Weekly calendar, ${weekRangeLabel(weekStart)}. Scroll horizontally on smaller screens.`}>
      <div className="weekly-calendar-grid" style={{ '--calendar-body-height': `${(timeline.totalMinutes / 60) * 70}px`, '--calendar-hour-step': `${(60 / timeline.totalMinutes) * 100}%` }}>
        <div className="calendar-corner">Time</div>
        {days.map(day => <div key={day.date} className={`calendar-day-heading ${day.date === today ? 'is-today' : ''}`}><strong>{day.shortName}</strong><span>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}</span>{day.date === today && <small>Today</small>}</div>)}
        <div className="calendar-time-axis">{timeline.hourMarks.map((mark) => <span key={mark} style={{ top: `${((mark - timeline.startMinute) / timeline.totalMinutes) * 100}%` }}>{formatTimelineMark(mark)}</span>)}</div>
        {days.map((day) => <div key={day.date} className="calendar-day-track" aria-label={`${day.name}, ${day.date}`}>{eventsForDay(day, schedule, timeline).map(event => {
          const top = ((event.startMinute - timeline.startMinute) / timeline.totalMinutes) * 100;
          const height = ((event.endMinute - event.startMinute) / timeline.totalMinutes) * 100;
          return <button key={event.id} type="button" className={`calendar-schedule-block is-${event.type} ${event.disabled ? 'is-disabled' : ''}`} style={{ top: `${top}%`, height: `${height}%` }} onClick={() => onSelectEvent(event)} aria-label={`${event.label}, ${day.name} ${day.date}, ${event.wholeDay ? 'whole day' : `${formatSlot(event.start)} to ${formatSlot(event.end)}`}${event.disabled ? ', disabled' : ''}`}>
            {event.type === 'special' ? <span className="calendar-publication-label"><span aria-hidden="true">★</span><strong>Published</strong><small>{formatSlot(event.start)} – {formatSlot(event.end)}</small></span> : <>
              <span className="calendar-block-mark" aria-hidden="true">{event.type === 'working' ? '▣' : '⊘'}</span>
              <strong>{event.wholeDay ? 'Whole day' : `${formatSlot(event.start)} – ${formatSlot(event.end)}`}</strong>
              <span>{event.label}{event.disabled ? ' · Disabled' : ''}</span>
            </>}
          </button>;
        })}</div>)}
      </div>
    </div>
  </section>;
}
