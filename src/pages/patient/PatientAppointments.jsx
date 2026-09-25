import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { patientApiErrorMessage, patientApiService } from '../../services/patientApiService.js';
import { formatBookingDate } from '../../services/dateTimeService.js';
import AppointmentSummary from '../../components/appointments/AppointmentSummary.jsx';
import AppointmentActions from '../../components/appointments/AppointmentActions.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import '../../styles/patient-appointments.css';

export default function PatientAppointments() {
  const [items, setItems] = useState(null); const [filter, setFilter] = useState('all'); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const load = () => patientApiService.getAppointments().then(setItems).catch(reason => setError(patientApiErrorMessage(reason, 'Appointments were not found.')));
  useEffect(() => { load(); }, []);
  if (error) return <section className="appointment-card" role="alert"><h1>Unable to load appointments</h1><p>{error}</p></section>;
  if (!items) return <section className="appointment-card" aria-live="polite"><h1>Loading appointments…</h1></section>;
  const upcoming = item => ['pending', 'confirmed'].includes(item.status) && new Date(item.appointment_at) > new Date(); const next = items.filter(upcoming).sort((a, b) => new Date(a.appointment_at) - new Date(b.appointment_at))[0];
  const filtered = items.filter(item => filter === 'all' || (filter === 'upcoming' ? upcoming(item) : !upcoming(item))).sort((a, b) => Number(upcoming(b)) - Number(upcoming(a)) || (upcoming(a) ? new Date(a.appointment_at) - new Date(b.appointment_at) : new Date(b.appointment_at) - new Date(a.appointment_at)));
  async function cancel(id) { try { const updated = await patientApiService.cancelAppointment(id); setItems(current => current.map(item => item.id === id ? updated : item)); setMessage('Appointment cancelled.'); } catch (reason) { throw new Error(patientApiErrorMessage(reason, 'Unable to cancel the appointment.')); } }
  return <div className="patient-appointments"><header className="appointments-intro"><h1>My Appointments</h1><p>View and manage your scheduled visits.</p></header><div className="appointment-stats">{[['Upcoming Appointments', items.filter(upcoming).length], ['Pending Requests', items.filter(item => item.status === 'pending').length], ['Completed Visits', items.filter(item => item.status === 'completed').length], ['Cancelled', items.filter(item => item.status === 'cancelled').length]].map(([label, count]) => <div className="appointment-card" key={label}><strong>{count}</strong><span>{label}</span></div>)}</div><p role="status" className="appointment-message">{message}</p>
    {next && <section className="appointment-card next-appointment"><h2>Next Upcoming Appointment</h2><AppointmentSummary appointment={next} /><Link className="action-link primary-action" to={'/patient/appointments/' + next.id}>View Details</Link></section>}
    <section className="appointment-card appointment-list"><div className="appointment-filters">{[['all', 'All Appointments'], ['upcoming', 'Upcoming'], ['past', 'Past & Cancelled']].map(([value, label]) => <button type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div>{!items.length ? <p className="appointment-empty">You do not have any appointments yet.</p> : <div className="appointment-table" role="table"><div className="appointment-table-head" role="row"><span>Date / Time</span><span>Doctor / Service</span><span>Status</span><span>Actions</span></div>{filtered.map(item => <div className="appointment-row" role="row" key={item.id}><div><strong>{formatBookingDate(item.date)}</strong><p>{item.timeLabel}</p></div><div><strong>{item.doctor}</strong><p>{item.service}</p>{item.reason && <p className="appointment-reason">{item.reason}</p>}</div><div><StatusBadge status={item.status} /></div><div><Link className="appointment-detail-link" to={'/patient/appointments/' + item.id}>View Details</Link><AppointmentActions appointment={item} onCancel={cancel} /></div></div>)}</div>}{items.length > 0 && !filtered.length && <p className="appointment-empty">No appointments in this view.</p>}</section>
  </div>;
}
