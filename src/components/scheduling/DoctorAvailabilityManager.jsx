import { useCallback, useEffect, useState } from 'react';
import { doctorApiErrorMessage, doctorApiService, doctorWeekDays } from '../../services/doctorApiService.js';
import { formatBookingDate, formatSlot } from '../../services/dateTimeService.js';

const timeLabel = item => `${formatSlot(item.start_time)}–${formatSlot(item.end_time)}`;
function blockParts(item) {
  const format = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(value));
  const value = (parts, type) => parts.find(part => part.type === type)?.value;
  const start = format(item.start_at); const end = format(item.end_at);
  const date = `${value(start, 'year')}-${value(start, 'month')}-${value(start, 'day')}`;
  const startTime = `${value(start, 'hour')}:${value(start, 'minute')}`; const endTime = `${value(end, 'hour')}:${value(end, 'minute')}`;
  const endDate = `${value(end, 'year')}-${value(end, 'month')}-${value(end, 'day')}`;
  return { date, startTime, endTime, wholeDay: startTime === '00:00' && endTime === '00:00' && date !== endDate };
}

export default function DoctorAvailabilityManager() {
  const [data, setData] = useState({ recurring: [], published: [], blocked: [] });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await doctorApiService.getAvailability()); setError(''); }
    catch (reason) { setError(doctorApiErrorMessage(reason, 'Unable to load availability.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const recurringFor = day => data.recurring.filter(item => item.day_of_week === day);
  if (loading && !data.recurring.length && !data.published.length && !data.blocked.length) return <div className="availability-manager"><p role="status">Loading availability…</p></div>;
  return <div className="availability-manager">
    <p className="schedule-note">Read-only schedule · Staff manages Doctor availability and blocked time.</p>
    <p className="availability-explainer">Your working hours, available booking dates, and current or future time off are shown below.</p>
    {error && <p className="availability-error" role="alert">{error} <button type="button" onClick={load}>Try again</button></p>}
    <section className="schedule-panel availability-section" aria-labelledby="weekly-availability-title">
      <h2 id="weekly-availability-title">Working Hours</h2>
      <div className="weekly-availability">{doctorWeekDays.map((name, day) => { const ranges = recurringFor(day); return <article className="availability-day" key={name}><header><div><h3>{name}</h3><span>{ranges.some(item => item.is_active) ? 'Enabled' : 'Disabled'}</span></div></header>{ranges.length ? <ul>{ranges.map(item => <li key={item.id}><span>{timeLabel(item)} · {item.is_active ? 'Active' : 'Inactive'}</span></li>)}</ul> : <p>No recurring ranges.</p>}</article>; })}</div>
    </section>
    <div className="availability-columns">
      <section className="schedule-panel availability-section"><h2>Available Booking Dates</h2><p>Only active dates available for booking are shown.</p>{data.published.length ? <ul className="availability-list">{data.published.map(item => <li key={item.id}><div><strong>{formatBookingDate(item.date)}</strong><span>{timeLabel(item)}</span></div></li>)}</ul> : <p>No active booking dates.</p>}</section>
      <section className="schedule-panel availability-section"><h2>Time Off / Unavailable</h2><p>Only current or future unavailable periods are shown.</p>{data.blocked.length ? <ul className="availability-list">{data.blocked.map(item => { const parts = blockParts(item); return <li key={item.id}><div><strong>{formatBookingDate(parts.date)}</strong><span>{parts.wholeDay ? 'Whole day' : `${formatSlot(parts.startTime)}–${formatSlot(parts.endTime)}`}</span><small>{item.reason}</small></div></li>; })}</ul> : <p>No current or future unavailable times.</p>}</section>
    </div>
  </div>;
}
