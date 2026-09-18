import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { appointmentService } from '../../services/appointmentService.js';
import AppointmentSummary from '../../components/appointments/AppointmentSummary.jsx';
import AppointmentActions from '../../components/appointments/AppointmentActions.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import '../../styles/patient-appointments.css';

export default function PatientAppointmentDetail() {
  const { id } = useParams();
  const [message, setMessage] = useState('');
  const [, refresh] = useState(0);
  const item = appointmentService.get(id);
  return <div className="patient-appointments">
    <Link className="appointment-back" to="/patient/appointments">← Back to My Appointments</Link>
    <header className="appointment-detail-heading"><h1>Appointment Details</h1><p>View your appointment information and available actions.</p></header>
    {!item ? <section className="appointment-card"><h2>Appointment not found</h2><p>This appointment isn’t available in the current mock session.</p></section> : <>
      <p role="status" className="appointment-message">{message}</p>
      <div className="appointment-detail-layout"><div>
        <section className="appointment-card"><AppointmentSummary appointment={item} /><AppointmentActions key={id} appointment={item} onChange={text => { setMessage(text); refresh(value => value + 1); }} /></section>
        <section className="appointment-card"><h2>Reason for Visit</h2><p className="appointment-reason">{item.reason || 'No reason provided.'}</p></section>
        <section className="appointment-card"><h2>Clinic Location</h2><p>{item.location}</p></section>
      </div><aside className="appointment-card appointment-status-card"><h2>Appointment Status</h2><StatusBadge status={item.status} /><p>{({ pending: 'Your request is awaiting confirmation.', confirmed: 'Your appointment is confirmed.', completed: 'This visit is completed.', cancelled: 'This appointment has been cancelled.', no_show: 'This appointment is marked as a no-show.' })[item.status]}</p><p className="appointment-mock-note">Mock data only. Changes reset when the page reloads.</p></aside></div>
    </>}
  </div>;
}
