import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import DashboardIcon from '../../components/dashboard/DashboardIcon.jsx';
import { clinicToday, formatBookingDate } from '../../services/bookingService.js';
import { doctorScheduleService, shiftScheduleDate } from '../../services/doctorScheduleService.js';
import '../../styles/doctor-schedule.css';

export default function DoctorSchedule() {
  const today = clinicToday();
  const [date, setDate] = useState(today);
  const appointments = doctorScheduleService.getDay(date);
  return <div className="doctor-schedule-page">
    <header><h1>My Schedule</h1><p>View your appointments for the selected day.</p></header>
    <nav className="schedule-date-controls" aria-label="Schedule date navigation"><div className="schedule-date-picker"><button type="button" aria-label="Previous day" onClick={() => setDate(shiftScheduleDate(date, -1))}>‹</button><time dateTime={date} aria-live="polite" className={date === today ? 'schedule-today' : ''}>{formatBookingDate(date)}{date === today && <small>Today</small>}</time><button type="button" aria-label="Next day" onClick={() => setDate(shiftScheduleDate(date, 1))}>›</button></div><button type="button" className="action-link" onClick={() => setDate(today)}>Today</button></nav>
    <p className="schedule-note">Philippine time · Mock schedule only. Today matches the Dashboard’s 10:00 AM snapshot.</p>
    <div className="schedule-day-layout"><section className="schedule-panel" aria-labelledby="schedule-list-title"><h2 id="schedule-list-title">Appointments</h2><p role="status">{appointments.length} {appointments.length === 1 ? 'appointment' : 'appointments'} on {formatBookingDate(date)}</p>
      {appointments.length ? <ul className="schedule-timeline">{appointments.map(item => <li key={item.id}><time dateTime={item.appointment_at}>{item.timeLabel}</time><Link className="schedule-appointment" to={item.patientPath} state={{ appointmentId: item.id, date }} aria-label={'View patient ' + item.patientName + ' at ' + item.timeLabel}><div><h3>{item.patientName}</h3><p>{item.reason}</p><span className="schedule-view">View Patient →</span></div><StatusBadge status={item.status} /></Link></li>)}</ul> : <div className="schedule-empty"><DashboardIcon name="calendar" /><h3>No appointments for this day</h3><p>Choose another date to view your schedule.</p></div>}
    </section><aside className="schedule-panel"><h2>Day Summary</h2><p>{formatBookingDate(date)}</p><dl><div><dt>Total appointments</dt><dd>{appointments.length}</dd></div><div><dt>Completed</dt><dd>{appointments.filter(item => item.status === 'completed').length}</dd></div><div><dt>Pending or confirmed</dt><dd>{appointments.filter(item => ['pending', 'confirmed'].includes(item.status)).length}</dd></div></dl><p>Select an appointment to view the assigned patient’s details.</p></aside></div>
  </div>;
}
