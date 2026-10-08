import { useMemo, useState } from 'react';
import BookingCalendar from '../booking/BookingCalendar.jsx';
import {
  canReschedulePatientAppointment,
  patientApiErrorMessage,
  patientApiService,
  patientBookingDates,
} from '../../services/patientApiService.js';
import { formatBookingDate, formatSlot } from '../../services/dateTimeService.js';

export default function PatientRescheduleForm({ appointment, onRescheduled }) {
  const dates = useMemo(() => patientBookingDates(), []);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slotsByDate, setSlotsByDate] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!canReschedulePatientAppointment(appointment)) return null;

  const slots = slotsByDate[date] ?? [];
  const availableDates = new Set(Object.entries(slotsByDate).filter(([, values]) => values.some((slot) => slot.available)).map(([value]) => value));

  async function loadAvailability() {
    setLoading(true);
    setMessage('');
    try {
      setSlotsByDate(await patientApiService.getBookableDates(appointment.doctor_id, dates));
    } catch (error) {
      setMessage(patientApiErrorMessage(error, 'Unable to load appointment availability.'));
    } finally {
      setLoading(false);
    }
  }

  async function refreshDate() {
    if (!date) return;
    const next = await patientApiService.getAvailableSlots(appointment.doctor_id, date);
    setSlotsByDate((current) => ({ ...current, [date]: next }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!availableDates.has(date) || !slots.some((slot) => slot.time === time && slot.available)) {
      setMessage('Select an available new date and time.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const updated = await patientApiService.rescheduleAppointment(appointment.id, date, time);
      await onRescheduled(updated);
      setOpen(false);
      setDate('');
      setTime('');
    } catch (error) {
      setMessage(patientApiErrorMessage(error, 'Unable to reschedule the appointment.'));
      if (error?.status === 409) {
        setTime('');
        await refreshDate().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  return <div className="appointment-actions reschedule-action patient-booking">
    {!open && <button type="button" className="action-link primary-action" onClick={() => { setOpen(true); loadAvailability(); }}>Reschedule Appointment</button>}
    {open && <form className="appointment-editor reschedule-editor" onSubmit={submit} aria-label="Reschedule appointment">
      <h3>Choose a new schedule</h3>
      <p className="booking-hint">Rescheduling is available until one hour before the current appointment. The appointment will return to Pending.</p>
      <dl className="reschedule-current">
        <div><dt>Doctor</dt><dd>{appointment.doctor}</dd></div>
        <div><dt>Visit type</dt><dd>{appointment.service}</dd></div>
        <div><dt>Reason</dt><dd>{appointment.reason}</dd></div>
        <div><dt>Current schedule</dt><dd>{formatBookingDate(appointment.date)} · {appointment.timeLabel}</dd></div>
      </dl>
      {message && <p role="alert" className="appointment-error">{message}</p>}
      <BookingCalendar value={date} doctorId={appointment.doctor_id} availableDates={availableDates} loading={loading} onChange={(value) => { setDate(value); setTime(''); setMessage(''); }} invalid={Boolean(message && !date)} />
      <fieldset className="booking-slots">
        <legend>New appointment time</legend>
        {slots.map((slot) => <label key={slot.time} className={`booking-slot${slot.available ? '' : ' unavailable'}`}><input type="radio" name="reschedule-time" value={slot.time} checked={time === slot.time} disabled={!slot.available} onChange={() => { setTime(slot.time); setMessage(''); }} /><span>{formatSlot(slot.time)}{!slot.available && <small>Occupied</small>}</span></label>)}
      </fieldset>
      <p className="booking-hint">{loading ? 'Loading appointment times…' : !date ? 'Choose an available date.' : !slots.length ? 'No published slots on this date.' : 'Available slots can be selected. Occupied slots are shown but disabled.'}</p>
      <div className="appointment-buttons">
        <button className="action-link primary-action" type="submit" disabled={busy || loading}>{busy ? 'Rescheduling…' : 'Confirm New Schedule'}</button>
        <button type="button" className="action-link" disabled={busy} onClick={() => { setOpen(false); setMessage(''); }}>Keep Current Schedule</button>
      </div>
    </form>}
  </div>;
}
