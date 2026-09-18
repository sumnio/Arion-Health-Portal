import { useState } from 'react';
import { appointmentService, canManageAppointment } from '../../services/appointmentService.js';
import { bookingService, clinicToday, formatSlot } from '../../services/bookingService.js';

export default function AppointmentActions({ appointment, onChange }) {
  const [mode, setMode] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  if (!canManageAppointment(appointment)) return null;
  const slots = bookingService.getSlots(appointment.doctor_id, date);
  function save(event) {
    event.preventDefault();
    const result = mode === 'cancel' ? appointmentService.cancel(appointment.id) : appointmentService.reschedule(appointment.id, date, time);
    if (result.error) { setError(result.error); return; }
    setMode('');
    onChange(mode === 'cancel' ? 'Appointment cancelled in this mock session.' : 'Appointment rescheduled in this mock session.');
  }
  function open(value) { setMode(value); setError(''); setDate(''); setTime(''); }
  return <div className="appointment-actions">
    <div className="appointment-buttons">
      <button type="button" className="action-link" onClick={() => open('reschedule')}>Reschedule</button>
      <button type="button" className="action-link cancel-action" onClick={() => open('cancel')}>Cancel Appointment</button>
    </div>
    {mode && <form className="appointment-editor" onSubmit={save} aria-label={mode === 'cancel' ? 'Cancel appointment' : 'Reschedule appointment'}>
      <h3>{mode === 'cancel' ? 'Cancel this appointment?' : 'Choose a new date and time'}</h3>
      <p>{appointment.doctor} · {appointment.service}</p>
      {mode === 'reschedule' && <>
        <label>New appointment date<input type="date" value={date} min={clinicToday()} onChange={event => { setDate(event.target.value); setTime(''); setError(''); }} /></label>
        <label>Available time (Philippine time)<select value={time} onChange={event => setTime(event.target.value)}>
          <option value="">Select a time</option>
          {slots.map(slot => <option key={slot.time} value={slot.time} disabled={!slot.available}>{formatSlot(slot.time)}{!slot.available ? ' — Unavailable' : ''}</option>)}
        </select></label>
        {date && !slots.some(slot => slot.available) && <p>No available times on this date. Choose another date.</p>}
      </>}
      {error && <p role="alert" className="appointment-error">{error}</p>}
      <div className="appointment-buttons"><button className="action-link primary-action" type="submit">{mode === 'cancel' ? 'Confirm Cancellation' : 'Save New Time'}</button>
        <button type="button" className="action-link" onClick={() => setMode('')}>Keep Current Appointment</button></div>
    </form>}
  </div>;
}
