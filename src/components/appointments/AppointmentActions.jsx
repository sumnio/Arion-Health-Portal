import { useState } from 'react';
import { canCancelPatientAppointment } from '../../services/patientApiService.js';

export default function AppointmentActions({ appointment, onCancel }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!canCancelPatientAppointment(appointment)) return null;
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await onCancel(appointment.id); setOpen(false); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  return <div className="appointment-actions">
    <div className="appointment-buttons">
      <button type="button" className="action-link cancel-action" onClick={() => { setOpen(true); setError(''); }}>Cancel Appointment</button>
    </div>
    {open && <form className="appointment-editor" onSubmit={save} aria-label="Cancel appointment">
      <h3>Cancel this appointment?</h3>
      <p>{appointment.doctor} · {appointment.service}</p>
      {error && <p role="alert" className="appointment-error">{error}</p>}
      <div className="appointment-buttons"><button className="action-link primary-action" type="submit" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm Cancellation'}</button>
        <button type="button" className="action-link" disabled={busy} onClick={() => setOpen(false)}>Keep Current Appointment</button></div>
    </form>}
  </div>;
}
