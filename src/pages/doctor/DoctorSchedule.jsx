import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import DashboardIcon from '../../components/dashboard/DashboardIcon.jsx';
import { clinicToday, formatBookingDate } from '../../services/dateTimeService.js';
import { shiftScheduleDate } from '../../services/doctorScheduleService.js';
import { doctorApiErrorMessage, doctorApiService } from '../../services/doctorApiService.js';
import DoctorAvailabilityManager from '../../components/scheduling/DoctorAvailabilityManager.jsx';
import '../../styles/doctor-schedule.css';

export default function DoctorSchedule() {
  const today = clinicToday(); const [date, setDate] = useState(today); const [view, setView] = useState('appointments');
  const [state, setState] = useState({ loading: true, appointments: [], error: '' });
  const load = useCallback(async () => { setState((old) => ({ ...old, loading: true, error: '' })); try { setState({ loading: false, appointments: await doctorApiService.getAppointments({ date }), error: '' }); } catch (error) { setState({ loading: false, appointments: [], error: doctorApiErrorMessage(error, 'Unable to load this schedule.') }); } }, [date]);
  useEffect(() => { load(); }, [load]); const appointments = state.appointments;
  return <div className="doctor-schedule-page"><header><h1>My Schedule</h1><p>View appointments and manage your bookable availability.</p></header>
    <div className="schedule-tabs" role="tablist" aria-label="Schedule views"><button role="tab" aria-selected={view === 'appointments'} onClick={() => setView('appointments')}>Appointments</button><button role="tab" aria-selected={view === 'availability'} onClick={() => setView('availability')}>Availability</button></div>
    {view === 'appointments' ? <><nav className="schedule-date-controls" aria-label="Schedule date navigation"><div className="schedule-date-picker"><button type="button" aria-label="Previous day" onClick={() => setDate(shiftScheduleDate(date, -1))}>‹</button><time dateTime={date} aria-live="polite" className={date === today ? 'schedule-today' : ''}>{formatBookingDate(date)}{date === today && <small>Today</small>}</time><button type="button" aria-label="Next day" onClick={() => setDate(shiftScheduleDate(date, 1))}>›</button></div><button type="button" className="action-link" onClick={() => setDate(today)}>Today</button></nav>
      <p className="schedule-note">Philippine time · Live assigned appointments.</p>{state.error && <p role="alert" className="availability-error">{state.error} <button type="button" onClick={load}>Try again</button></p>}
      <div className="schedule-day-layout"><section className="schedule-panel" aria-labelledby="schedule-list-title"><h2 id="schedule-list-title">Appointments</h2>{state.loading ? <p role="status">Loading appointments…</p> : <><p role="status">{appointments.length} {appointments.length === 1 ? 'appointment' : 'appointments'} on {formatBookingDate(date)}</p>{appointments.length ? <ul className="schedule-timeline">{appointments.map(item => <li key={item.id}><time dateTime={item.appointment_at}>{item.timeLabel}</time>{item.patientPath ? <Link className="schedule-appointment" to={item.patientPath} state={{ appointmentId: item.id, date }}><div><h3>{item.patientName}</h3><p>{item.visitLabel} · {item.reason}</p><span className="schedule-view">View Patient →</span></div><StatusBadge status={item.status} /></Link> : <div className="schedule-appointment"><p>Patient unavailable</p></div>}</li>)}</ul> : <div className="schedule-empty"><DashboardIcon name="calendar" /><h3>No appointments for this day</h3><p>Choose another date to view your schedule.</p></div>}</>}</section><aside className="schedule-panel"><h2>Day Summary</h2><p>{formatBookingDate(date)}</p><dl><div><dt>Total appointments</dt><dd>{appointments.length}</dd></div><div><dt>Completed</dt><dd>{appointments.filter(item => item.status === 'completed').length}</dd></div><div><dt>Pending or confirmed</dt><dd>{appointments.filter(item => ['pending', 'confirmed'].includes(item.status)).length}</dd></div></dl><p>Select an appointment to view the assigned patient’s details.</p></aside></div></> : <DoctorAvailabilityManager />}
  </div>;
}
