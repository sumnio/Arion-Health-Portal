import { useState } from 'react';
import { doctorAvailabilityService, weekDays } from '../../services/doctorAvailabilityService.js';
import { formatBookingDate, formatSlot, slotRange } from '../../services/bookingService.js';

const blankRange = { start_time: '09:00', end_time: '12:00' };
const timeLabel = item => `${formatSlot(item.start_time)}–${formatSlot(item.end_time)}`;
const blockDate = item => item.start_at.slice(0, 10);
const isWholeDay = item => item.start_at.slice(11, 16) === '00:00' && item.end_at.slice(11, 16) === '00:00' && item.start_at.slice(0, 10) !== item.end_at.slice(0, 10);

export default function DoctorAvailabilityManager() {
  const window = doctorAvailabilityService.publicationWindow();
  const [, refresh] = useState(0);
  const [rangeDrafts, setRangeDrafts] = useState(() => Object.fromEntries(weekDays.map((_, day) => [day, { ...blankRange }])));
  const [published, setPublished] = useState({ date: window.start, ...blankRange });
  const [blocked, setBlocked] = useState({ date: window.start, whole_day: false, start_time: '12:00', end_time: '13:00', reason: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const data = doctorAvailabilityService.get();
  const update = (setter, name, value) => setter(previous => ({ ...previous, [name]: value }));
  function run(action, success) {
    const result = action();
    if (result.error) { setError(result.error); setMessage(''); return; }
    setMessage(success); setError(''); refresh(value => value + 1);
  }
  function recurringFor(day) { return data.recurring.filter(item => item.day_of_week === day); }
  return <div className="availability-manager">
    <p className="schedule-note">Mock scheduling only · Appointment slots remain 30 minutes. Clinic operating hours are configurable and still TBD.</p>
    <p className="availability-explainer"><strong>Recurring templates</strong> describe the usual week. <strong>Published availability</strong> confirms specific dates patients may book. One-time blocked periods override both.</p>
    {message && <p className="availability-message" role="status">{message}</p>}{error && <p className="availability-error" role="alert">{error}</p>}

    <section className="schedule-panel availability-section" aria-labelledby="weekly-availability-title"><h2 id="weekly-availability-title">Weekly Recurring Availability</h2><p>Use separate ranges to leave a regular lunch or recurring break.</p>
      <div className="weekly-availability">{weekDays.map((name, day) => { const ranges = recurringFor(day); const enabled = ranges.some(item => item.is_active); return <article className="availability-day" key={name}>
        <header><div><h3>{name}</h3><span>{enabled ? 'Enabled' : 'Disabled'}</span></div><label className="availability-toggle"><input type="checkbox" checked={enabled} disabled={!ranges.length} onChange={event => run(() => doctorAvailabilityService.setDayActive(day, event.target.checked), `${name} ${event.target.checked ? 'enabled' : 'disabled'}.`)} /> Day enabled</label></header>
        {ranges.length ? <ul>{ranges.map(item => <li key={item.id}><span>{timeLabel(item)} · {item.is_active ? 'Active' : 'Inactive'}</span><button type="button" aria-label={`Remove ${name} ${timeLabel(item)} recurring range`} onClick={() => run(() => doctorAvailabilityService.removeRecurring(item.id), `${name} range removed.`)}>Remove</button></li>)}</ul> : <p>No recurring ranges.</p>}
        <div className="range-form"><label>Start<input aria-label={`${name} recurring start`} type="time" step="1800" value={rangeDrafts[day].start_time} onChange={event => setRangeDrafts(previous => ({ ...previous, [day]: { ...previous[day], start_time: event.target.value } }))} /></label><label>End<input aria-label={`${name} recurring end`} type="time" step="1800" value={rangeDrafts[day].end_time} onChange={event => setRangeDrafts(previous => ({ ...previous, [day]: { ...previous[day], end_time: event.target.value } }))} /></label><button type="button" aria-label={`Add ${name} recurring range`} onClick={() => run(() => doctorAvailabilityService.addRecurring({ day_of_week: day, ...rangeDrafts[day] }), `${name} recurring range added.`)}>Add Range</button></div>
      </article>; })}</div>
    </section>

    <div className="availability-columns"><section className="schedule-panel availability-section"><h2>Published Availability</h2><p>Publish only the specific dates patients may book, from today through {formatBookingDate(window.end)}.</p>
      <div className="availability-form"><label>Date<input aria-label="Published availability date" type="date" min={window.start} max={window.end} value={published.date} onChange={event => update(setPublished, 'date', event.target.value)} /></label><label>Start<input aria-label="Published availability start" type="time" step="1800" value={published.start_time} onChange={event => update(setPublished, 'start_time', event.target.value)} /></label><label>End<input aria-label="Published availability end" type="time" step="1800" value={published.end_time} onChange={event => update(setPublished, 'end_time', event.target.value)} /></label><button type="button" onClick={() => run(() => doctorAvailabilityService.publish(published), `Availability published for ${formatBookingDate(published.date)}.`)}>Publish Range</button></div>
      {data.published.length ? <ul className="availability-list">{data.published.map(item => { const slots = doctorAvailabilityService.getSlots(item.doctor_id, item.date).filter(slot => slot.time >= item.start_time && slot.time < item.end_time); return <li key={item.id}><div><strong>{formatBookingDate(item.date)}</strong><span>{timeLabel(item)}</span><small>{slots.filter(slot => slot.available).length} available 30-minute slots</small></div><button type="button" onClick={() => run(() => doctorAvailabilityService.removePublished(item.id), 'Published range removed. Existing appointments were preserved.')}>Remove</button><div className="slot-preview" aria-label={`Slot preview for ${item.date}`}>{slots.map(slot => <span className={slot.available ? '' : 'unavailable'} key={slot.time}>{slotRange(slot.time)}{slot.blocked ? ' · Blocked' : slot.occupied ? ' · Occupied' : ''}</span>)}</div></li>; })}</ul> : <p>No dates published.</p>}
    </section>

    <section className="schedule-panel availability-section"><h2>Blocked Time</h2><p>Add a one-time whole-day or partial-day exception. A block never creates availability.</p>
      <div className="availability-form"><label>Date<input aria-label="Blocked date" type="date" min={window.start} max={window.end} value={blocked.date} onChange={event => update(setBlocked, 'date', event.target.value)} /></label><label className="whole-day"><input type="checkbox" checked={blocked.whole_day} onChange={event => update(setBlocked, 'whole_day', event.target.checked)} /> Whole day</label>{!blocked.whole_day && <><label>Start<input aria-label="Blocked start" type="time" step="1800" value={blocked.start_time} onChange={event => update(setBlocked, 'start_time', event.target.value)} /></label><label>End<input aria-label="Blocked end" type="time" step="1800" value={blocked.end_time} onChange={event => update(setBlocked, 'end_time', event.target.value)} /></label></>}<label className="reason-field">Reason<input aria-label="Blocked reason" value={blocked.reason} onChange={event => update(setBlocked, 'reason', event.target.value)} placeholder="Meeting, leave, personal break…" /></label><button type="button" onClick={() => run(() => doctorAvailabilityService.addBlocked(blocked), `Blocked time added for ${formatBookingDate(blocked.date)}.`)}>Add Block</button></div>
      {data.blocked.length ? <ul className="availability-list">{data.blocked.map(item => <li key={item.id}><div><strong>{formatBookingDate(blockDate(item))}</strong><span>{isWholeDay(item) ? 'Whole day' : `${formatSlot(item.start_at.slice(11, 16))}–${formatSlot(item.end_at.slice(11, 16))}`}</span><small>{item.reason}</small></div><button type="button" onClick={() => run(() => doctorAvailabilityService.removeBlocked(item.id), 'Blocked time removed.')}>Remove</button></li>)}</ul> : <p>No blocked time.</p>}
    </section></div>
  </div>;
}
