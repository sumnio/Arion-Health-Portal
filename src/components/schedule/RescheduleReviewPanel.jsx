import { useState } from 'react';
import { bookingWindow, clinicDateTimeParts, formatBookingDate, formatSlot } from '../../services/dateTimeService.js';
import { staffApiErrorMessage, staffApiService } from '../../services/staffApiService.js';
import ScheduleDialog from './ScheduleDialog.jsx';
import { affectedCountLabel } from './schedulePresentation.js';

function visitTypeLabel(value) {
  return String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function AffectedAppointmentCard({ item, busy, onRequestReschedule }) {
  const window = bookingWindow();
  const original = clinicDateTimeParts(item.appointment_at);
  const [selected, setSelected] = useState(item.suggested_slots?.[0]?.appointment_at ?? '');
  const [otherDate, setOtherDate] = useState('');
  const [otherSlots, setOtherSlots] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  async function loadOther(date) {
    setOtherDate(date);
    setSelected('');
    setMessage({ type: '', text: '' });
    if (!date) { setOtherSlots([]); return; }
    try { setOtherSlots(await staffApiService.getAvailableSlots(item.doctor.id, date)); }
    catch (error) {
      setOtherSlots([]);
      setMessage({ type: 'error', text: staffApiErrorMessage(error, 'Unable to load replacement times.') });
    }
  }

  function choose(value) {
    setSelected(value);
    setMessage({ type: '', text: '' });
  }

  function leavePending() {
    setSelected('');
    setMessage({ type: 'status', text: 'Appointment left pending. No schedule changes were made.' });
  }

  return <article className="affected-appointment-card">
    <header><div><h3>{item.patient.full_name}</h3><p>{formatBookingDate(original.date)} · {formatSlot(original.time)}</p></div><span className="affected-status">{item.status}</span></header>
    <dl className="affected-operational-details">
      <div><dt>Doctor</dt><dd>{item.doctor.display_name}</dd></div>
      <div><dt>Visit type</dt><dd>{visitTypeLabel(item.visit_type)}</dd></div>
      <div><dt>Original date</dt><dd>{formatBookingDate(original.date)}</dd></div>
      <div><dt>Original time</dt><dd>{formatSlot(original.time)}</dd></div>
    </dl>
    {item.locked ? <p role="note" className="affected-locked-note">This appointment is operationally locked and needs manual review.</p> : <>
      <fieldset className="suggested-slot-list"><legend>Suggested times</legend>
        {item.suggested_slots.length ? item.suggested_slots.map(slot => <label key={slot.appointment_at} className={selected === slot.appointment_at ? 'is-selected' : ''}><input type="radio" name={`replacement-${item.id}`} checked={selected === slot.appointment_at} onChange={() => choose(slot.appointment_at)} /><span><strong>{formatBookingDate(slot.date)}</strong><small>{formatSlot(slot.start_time)}</small></span></label>) : <p>No valid replacement is currently available.</p>}
      </fieldset>
      <details className="alternate-slot-picker"><summary>Choose another date/time</summary><label>Date<input type="date" min={window.start} max={window.end} value={otherDate} onChange={event => loadOther(event.target.value)} /></label>{otherDate && <fieldset><legend>Available times</legend><div>{otherSlots.filter(slot => slot.available).map(slot => <label key={slot.appointment_at} className={selected === slot.appointment_at ? 'is-selected' : ''}><input type="radio" name={`replacement-${item.id}`} checked={selected === slot.appointment_at} onChange={() => choose(slot.appointment_at)} /> {formatSlot(slot.time)}</label>)}</div>{!otherSlots.some(slot => slot.available) && <p>No available times on this date.</p>}</fieldset>}</details>
      {message.text && <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'schedule-error' : 'inline-status'}>{message.text}</p>}
      <div className="affected-card-actions"><button type="button" className="secondary-button" onClick={leavePending}>Leave Pending</button><button type="button" disabled={busy || !selected} onClick={() => onRequestReschedule(item, selected)}>Reschedule</button></div>
    </>}
  </article>;
}

export default function RescheduleReviewPanel({ appointments, busy, onClose, onRequestReschedule }) {
  const count = appointments.length;
  return <ScheduleDialog variant="drawer" title="Review Appointments" description={`${affectedCountLabel(count)}.`} onClose={onClose}>
    <div className="reschedule-review-list">
      {appointments.map(item => <AffectedAppointmentCard key={item.id} item={item} busy={busy} onRequestReschedule={onRequestReschedule} />)}
    </div>
  </ScheduleDialog>;
}
