import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { staffCalendarService, staffActions } from '../../services/staffCalendarService.js';
import { clinicToday, formatBookingDate } from '../../services/bookingService.js';
import { shiftScheduleDate } from '../../services/doctorScheduleService.js';
import '../../styles/staff-calendar.css';

const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
export default function StaffCalendar() {
  const today = clinicToday();
  const [date, setDate] = useState(today);
  const [doctor, setDoctor] = useState('');
  const [mobileDoctor, setMobileDoctor] = useState(null);
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [, refresh] = useState(0);
  const appointments = staffCalendarService.getDay(date);
  const doctors = [...new Map(appointments.map(item => [item.doctor_id, item.doctor])).entries()];
  const shown = appointments.filter(item => (!doctor || item.doctor_id === doctor) && (!status || item.status === status));
  const visibleDoctors = doctors.filter(([id]) => shown.some(item => item.doctor_id === id));
  const mobileIndex = Math.max(0, visibleDoctors.findIndex(([id]) => id === mobileDoctor));
  function switchDoctor(index) {
    setMobileDoctor(visibleDoctors[index][0]); setSelectedId(null); setCancelling(false);
  }
  const selected = appointments.find(item => item.id === selectedId);
  const actions = selected ? staffActions(selected, today) : {};
  function changeDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setDate(value); setMobileDoctor(null); setSelectedId(null); setDoctor(''); setMessage(''); setError(''); setCancelling(false);
  }
  function update(nextStatus) {
    try {
      staffCalendarService.updateStatus(date, selected.id, nextStatus);
      setMessage(nextStatus === 'confirmed' ? 'Appointment confirmed in this mock session.' : 'Appointment cancelled in this mock session.');
      setError(''); setCancelling(false); refresh(value => value + 1);
    } catch (err) { setError(err.message); }
  }
  return <div className="staff-calendar">
    <header className="calendar-title"><div><h1>Full Calendar</h1><p>View and manage clinic appointments.</p></div><Link className="action-link" to="/staff/patients/new">Register Walk-in</Link></header>
    <div className="calendar-controls">
      <div className="calendar-date"><button aria-label="Previous day" onClick={() => changeDate(shiftScheduleDate(date, -1))}>‹</button><label>Selected date<input type="date" value={date} onChange={event => changeDate(event.target.value)} /></label><button aria-label="Next day" onClick={() => changeDate(shiftScheduleDate(date, 1))}>›</button></div>
      <button onClick={() => changeDate(today)}>Today</button>
      <label>Doctor<select value={doctor} onChange={event => { setDoctor(event.target.value); setMobileDoctor(null); setSelectedId(null); setCancelling(false); }}><option value="">All doctors</option>{doctors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setMobileDoctor(null); setSelectedId(null); setCancelling(false); }}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{value === 'no_show' ? 'No-show' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
    </div>
    <p className="calendar-note">Philippine time · Mock appointments only. Changes last until reload. Today uses the dashboard’s 10:00 AM snapshot.</p>
    <p role="status">{message}</p>{error && <p role="alert">{error}</p>}
    <div className="calendar-layout">
      <section className="calendar-panel" aria-label="Day schedule"><h2>{formatBookingDate(date)}{date === today ? ' · Today' : ''}</h2><p>{shown.length} appointments</p>
        {visibleDoctors.length > 1 && <div className="calendar-doctor-pager" role="group" aria-label="Browse doctors"><button aria-label="Previous doctor" disabled={mobileIndex === 0} onClick={() => switchDoctor(mobileIndex - 1)}>‹</button><span aria-live="polite">{visibleDoctors[mobileIndex][1]}<small>Doctor {mobileIndex + 1} of {visibleDoctors.length}</small></span><button aria-label="Next doctor" disabled={mobileIndex === visibleDoctors.length - 1} onClick={() => switchDoctor(mobileIndex + 1)}>›</button></div>}
        {!shown.length ? <p className="calendar-empty">{appointments.length ? 'No appointments match these filters.' : 'No appointments scheduled for this date.'}</p> : <div className="calendar-doctors">{visibleDoctors.map(([id, name], index) => <section key={id} className={index === mobileIndex ? "mobile-doctor-active" : "mobile-doctor-hidden"}><h3>{name}</h3><ol>{shown.filter(item => item.doctor_id === id).map(item => <li key={item.id}><button className="calendar-entry" aria-pressed={selectedId === item.id} onClick={() => { setSelectedId(item.id); setCancelling(false); setError(''); setMessage(''); }}><time>{item.timeLabel}</time><strong>{item.patientName}</strong><span>{item.reason}</span><StatusBadge status={item.status} /><span className="calendar-view">View appointment →</span></button></li>)}</ol></section>)}</div>}
      </section>
      <section className="calendar-panel calendar-details" aria-label="Appointment information"><h2>Appointment information</h2>{!selected ? <p>Select an appointment to view its details and available actions.</p> : <>
        <h3>{selected.patientName}</h3><StatusBadge status={selected.status} />
        <dl><dt>Date / time</dt><dd>{formatBookingDate(date)} · {selected.timeLabel}</dd><dt>Doctor</dt><dd>{selected.doctor}</dd><dt>Visit / reason</dt><dd>{selected.reason}</dd><dt>Check-in</dt><dd>{selected.check_in_at ? 'Checked in' : 'Not checked in'}</dd></dl>
        <div className="calendar-actions">{actions.confirm && <button onClick={() => update('confirmed')}>Confirm Appointment</button>}{actions.cancel && !cancelling && <button onClick={() => setCancelling(true)}>Cancel Appointment</button>}{actions.queue && <Link className="action-link" to="/staff/queue">Queue / Check-in</Link>}</div>
        {cancelling && actions.cancel && <div className="calendar-cancel"><p>Cancel {selected.patientName}’s appointment?</p><button onClick={() => update('cancelled')}>Yes, cancel appointment</button><button onClick={() => setCancelling(false)}>Keep appointment</button></div>}
        {!actions.cancel && !actions.confirm && <p>This appointment is view-only here.{actions.queue ? ' Use Queue / Check-in for checked-in patients.' : ''}</p>}
      </>}</section>
    </div>
  </div>;
}
