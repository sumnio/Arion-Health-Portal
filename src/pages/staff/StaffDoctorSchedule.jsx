import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatBookingDate, formatSlot } from '../../services/dateTimeService.js';
import { staffApiErrorMessage, staffApiService, staffPublicationWindow, staffWeekDays } from '../../services/staffApiService.js';
import '../../styles/staff-doctors.css';

const blankRange = { start_time: '09:00', end_time: '12:00' };
const timeLabel = item => `${formatSlot(item.start_time)} – ${formatSlot(item.end_time)}`;
function blockParts(item) {
  const parts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const start = parts(item.start_at); const end = parts(item.end_at);
  const date = `${start.year}-${start.month}-${start.day}`; const endDate = `${end.year}-${end.month}-${end.day}`;
  return { date, start: `${start.hour}:${start.minute}`, end: `${end.hour}:${end.minute}`, wholeDay: start.hour === '00' && start.minute === '00' && end.hour === '00' && end.minute === '00' && date !== endDate };
}

export default function StaffDoctorSchedule() {
  const { id } = useParams(); const window = staffPublicationWindow();
  const [state, setState] = useState({ loading: true, doctor: null, schedule: { recurring_availability: [], published_availability: [], blocked_times: [] }, error: '' });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [actionError, setActionError] = useState('');
  const [rangeDrafts, setRangeDrafts] = useState(() => Object.fromEntries(staffWeekDays.map((_, day) => [day, { ...blankRange }])));
  const [editing, setEditing] = useState(null);
  const [published, setPublished] = useState({ availability_date: window.start, ...blankRange });
  const [blocked, setBlocked] = useState({ date: window.start, whole_day: false, start_time: '12:00', end_time: '13:00', reason: '' });
  const load = useCallback(async () => {
    setState(old => ({ ...old, loading: true, error: '' }));
    try { const result = await staffApiService.getDoctorSchedule(id); setState({ loading: false, ...result, error: result.doctor ? '' : 'Doctor not found.' }); }
    catch (error) { setState(old => ({ ...old, loading: false, error: staffApiErrorMessage(error, 'Unable to load this Doctor schedule.') })); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  async function run(action, success, afterSuccess) {
    if (busy) return;
    setBusy(true); setMessage(''); setActionError('');
    try { await action(); await load(); afterSuccess?.(); setMessage(success); }
    catch (error) { setActionError(staffApiErrorMessage(error, 'The schedule change could not be saved.')); }
    finally { setBusy(false); }
  }
  const updateRange = (day, field, value) => setRangeDrafts(old => ({ ...old, [day]: { ...old[day], [field]: value } }));
  if (state.loading && !state.doctor) return <div className="staff-schedule"><Link to="/staff/doctors">← Back to Doctors</Link><p role="status">Loading schedule…</p></div>;
  if (state.error || !state.doctor) return <div className="staff-schedule"><Link to="/staff/doctors">← Back to Doctors</Link><p role="alert" className="schedule-error">{state.error || 'Doctor not found.'}</p></div>;
  const recurringFor = day => state.schedule.recurring_availability.filter(item => item.day_of_week === day);
  return <div className="staff-schedule">
    <Link className="schedule-back" to="/staff/doctors">← Back to Doctors</Link>
    <header><h1>Manage Schedule</h1><h2>{state.doctor.display_name}</h2><p>{state.doctor.specialty}</p></header>
    {message && <p role="status" className="schedule-success">{message}</p>}{actionError && <p role="alert" className="schedule-error">{actionError}</p>}

    <section className="staff-schedule-section"><h2>Regular Working Hours</h2><p>Set the Doctor’s usual weekly hours. Booking dates must fit within an enabled time range.</p>
      <div className="working-days">{staffWeekDays.map((name, day) => <article key={name} className="working-day"><h3>{name}</h3>
        {recurringFor(day).length ? <ul>{recurringFor(day).map(item => <li key={item.id}>{editing?.id === item.id ? <div className="compact-form"><label>Start<input type="time" step="1800" value={editing.start_time} onChange={event => setEditing({ ...editing, start_time: event.target.value })}/></label><label>End<input type="time" step="1800" value={editing.end_time} onChange={event => setEditing({ ...editing, end_time: event.target.value })}/></label><button disabled={busy} onClick={() => run(() => staffApiService.updateDoctorAvailability(id, item.id, { start_time: editing.start_time, end_time: editing.end_time }), `${name} hours updated.`, () => setEditing(null))}>Save</button><button disabled={busy} className="secondary-button" onClick={() => setEditing(null)}>Cancel</button></div> : <><span>{timeLabel(item)} · {item.is_active ? 'Enabled' : 'Disabled'}</span><div className="row-actions"><button disabled={busy} onClick={() => setEditing({ ...item })}>Edit</button><button disabled={busy} onClick={() => run(() => staffApiService.updateDoctorAvailability(id, item.id, { is_active: !item.is_active }), `${name} hours ${item.is_active ? 'disabled' : 'enabled'}.`)}>{item.is_active ? 'Disable' : 'Enable'}</button><button disabled={busy} className="danger-button" onClick={() => run(() => staffApiService.deleteDoctorAvailability(id, item.id), `${name} time range deleted.`)}>Delete</button></div></>}</li>)}</ul> : <p>No working hours set.</p>}
        <div className="compact-form add-range"><label>Start<input type="time" step="1800" value={rangeDrafts[day].start_time} onChange={event => updateRange(day, 'start_time', event.target.value)}/></label><label>End<input type="time" step="1800" value={rangeDrafts[day].end_time} onChange={event => updateRange(day, 'end_time', event.target.value)}/></label><button disabled={busy} onClick={() => run(() => staffApiService.createDoctorAvailability(id, { day_of_week: day, ...rangeDrafts[day] }), `${name} time range added.`)}>Add Time Range</button></div>
      </article>)}</div>
    </section>

    <section className="staff-schedule-section"><h2>Available Booking Dates</h2><p>Add specific dates patients may book. Only current and future ranges are shown.</p>
      <div className="compact-form"><label>Date<input type="date" min={window.start} max={window.end} value={published.availability_date} onChange={event => setPublished({ ...published, availability_date: event.target.value })}/></label><label>Start<input type="time" step="1800" value={published.start_time} onChange={event => setPublished({ ...published, start_time: event.target.value })}/></label><label>End<input type="time" step="1800" value={published.end_time} onChange={event => setPublished({ ...published, end_time: event.target.value })}/></label><button disabled={busy} onClick={() => run(() => staffApiService.createPublishedAvailability(id, published), `Booking date added for ${formatBookingDate(published.availability_date)}.`)}>Add Booking Date</button></div>
      {state.schedule.published_availability.length ? <ul className="schedule-records">{state.schedule.published_availability.map(item => <li key={item.id}><div><strong>{formatBookingDate(item.availability_date)}</strong><span>{timeLabel(item)}</span></div><button disabled={busy} className="danger-button" onClick={() => run(() => staffApiService.deletePublishedAvailability(id, item.id), 'Booking date removed.')}>Remove</button></li>)}</ul> : <p>No active booking dates.</p>}
    </section>

    <section className="staff-schedule-section"><h2>Time Off / Unavailable</h2><p>Add a whole-day or partial-day period when the Doctor is unavailable.</p>
      <div className="compact-form"><label>Date<input type="date" value={blocked.date} onChange={event => setBlocked({ ...blocked, date: event.target.value })}/></label><label className="inline-check"><input type="checkbox" checked={blocked.whole_day} onChange={event => setBlocked({ ...blocked, whole_day: event.target.checked })}/> Whole day</label>{!blocked.whole_day && <><label>Start<input type="time" step="1800" value={blocked.start_time} onChange={event => setBlocked({ ...blocked, start_time: event.target.value })}/></label><label>End<input type="time" step="1800" value={blocked.end_time} onChange={event => setBlocked({ ...blocked, end_time: event.target.value })}/></label></>}<label className="reason-input">Reason<input value={blocked.reason} onChange={event => setBlocked({ ...blocked, reason: event.target.value })}/></label><button disabled={busy} onClick={() => run(() => staffApiService.createBlockedTime(id, blocked), `Time off added for ${formatBookingDate(blocked.date)}.`)}>Add Time Off</button></div>
      {state.schedule.blocked_times.length ? <ul className="schedule-records">{state.schedule.blocked_times.map(item => { const parts = blockParts(item); return <li key={item.id}><div><strong>{formatBookingDate(parts.date)}</strong><span>{parts.wholeDay ? 'Whole day' : `${formatSlot(parts.start)} – ${formatSlot(parts.end)}`}</span><small>{item.reason}</small></div><button disabled={busy} className="danger-button" onClick={() => run(() => staffApiService.deleteBlockedTime(id, item.id), 'Time off removed.')}>Remove</button></li>; })}</ul> : <p>No current or future time off.</p>}
    </section>
  </div>;
}
