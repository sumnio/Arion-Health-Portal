import { useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentService } from '../../services/appointmentService.js';
import { formatBookingDate } from '../../services/bookingService.js';
import AppointmentSummary from '../../components/appointments/AppointmentSummary.jsx';
import AppointmentActions from '../../components/appointments/AppointmentActions.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import '../../styles/patient-appointments.css';

export default function PatientAppointments() {
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [, refresh] = useState(0);
  const items = appointmentService.list();
  const upcoming = item => ['pending', 'confirmed'].includes(item.status) && new Date(item.appointment_at) > new Date();
  const next = items.find(upcoming);
  const filtered = items.filter(item => filter === 'all' || (filter === 'upcoming' ? upcoming(item) : !upcoming(item)))
    .sort((a, b) => Number(upcoming(b)) - Number(upcoming(a))
      || (upcoming(a) ? new Date(a.appointment_at) - new Date(b.appointment_at) : new Date(b.appointment_at) - new Date(a.appointment_at)));
  function changed(text) { setMessage(text); refresh(value => value + 1); }
  return <div className="patient-appointments">
    <header className="appointments-intro"><h1>My Appointments</h1><p>View and manage your scheduled visits.</p><p>Keep track of upcoming appointments and past visits, all in one place.</p></header>
    <div className="appointment-stats">
      {[['Upcoming Appointments', items.filter(upcoming).length], ['Pending Requests', items.filter(item => item.status === 'pending').length], ['Completed Visits', items.filter(item => item.status === 'completed').length], ['Cancelled', items.filter(item => item.status === 'cancelled').length]].map(([label, count]) => <div className="appointment-card" key={label}><strong>{count}</strong><span>{label}</span></div>)}
    </div>
    <p className="appointment-mock-note">Mock data only. Bookings and changes made in this tab reset when the page reloads.</p>
    <p role="status" className="appointment-message">{message}</p>
    {next && <section className="appointment-card next-appointment"><h2>Next Upcoming Appointment</h2><AppointmentSummary appointment={next} /><Link className="action-link primary-action" to={'/patient/appointments/' + next.id}>View Details</Link></section>}
    <section className="appointment-card appointment-list" aria-label="Appointments">
      <div className="appointment-filters" aria-label="Filter appointments">{[['all', 'All Appointments'], ['upcoming', 'Upcoming'], ['past', 'Past & Cancelled']].map(([value, label]) => <button type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>
      <div className="appointment-table" role="table" aria-label="My appointments">
        <div className="appointment-table-head" role="row"><span role="columnheader">Date / Time</span><span role="columnheader">Doctor / Service</span><span role="columnheader">Status</span><span role="columnheader">Actions</span></div>
        {filtered.map(item => <div className="appointment-row" role="row" key={item.id}>
          <div role="cell"><strong>{formatBookingDate(item.date)}</strong><p>{item.timeLabel}</p><small>Philippine time</small></div>
          <div role="cell"><strong>{item.doctor}</strong><p>{item.service}</p>{item.reason && <p className="appointment-reason">{item.reason}</p>}</div>
          <div role="cell"><StatusBadge status={item.status} /></div>
          <div role="cell"><Link className="appointment-detail-link" to={'/patient/appointments/' + item.id} aria-label={'View Details for ' + item.doctor + ' on ' + formatBookingDate(item.date)}>View Details</Link><AppointmentActions appointment={item} onChange={changed} /></div>
        </div>)}
      </div>
      {!filtered.length && <p className="appointment-empty">No appointments in this view.</p>}
    </section>
  </div>;
}
