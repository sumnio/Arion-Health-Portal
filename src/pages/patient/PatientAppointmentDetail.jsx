import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { patientApiErrorMessage, patientApiService } from '../../services/patientApiService.js';
import AppointmentSummary from '../../components/appointments/AppointmentSummary.jsx';
import AppointmentActions from '../../components/appointments/AppointmentActions.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import '../../styles/patient-appointments.css';

export default function PatientAppointmentDetail() {
  const { id } = useParams(); const [item, setItem] = useState(null); const [status, setStatus] = useState('loading'); const [message, setMessage] = useState('');
  useEffect(() => { setStatus('loading'); patientApiService.getAppointment(id).then(value => { setItem(value); setStatus('ready'); }).catch(reason => { setMessage(patientApiErrorMessage(reason, 'This appointment was not found.')); setStatus(reason?.status === 404 ? 'not-found' : 'error'); }); }, [id]);
  async function cancel() { try { const updated = await patientApiService.cancelAppointment(id); setItem(updated); setMessage('Appointment cancelled.'); } catch (reason) { throw new Error(patientApiErrorMessage(reason, 'Unable to cancel the appointment.')); } }
  return <div className="patient-appointments"><Link className="appointment-back" to="/patient/appointments">← Back to My Appointments</Link><header className="appointment-detail-heading"><h1>Appointment Details</h1><p>View your appointment information and available actions.</p></header>{status === 'loading' && <section className="appointment-card" aria-live="polite">Loading appointment…</section>}{status !== 'loading' && status !== 'ready' && <section className="appointment-card" role="alert"><h2>{status === 'not-found' ? 'Appointment not found' : 'Unable to load appointment'}</h2><p>{message}</p></section>}{item && <><p role="status" className="appointment-message">{message}</p><div className="appointment-detail-layout"><div><section className="appointment-card"><AppointmentSummary appointment={item} /><AppointmentActions appointment={item} onCancel={cancel} /></section><section className="appointment-card"><h2>Reason for Visit</h2><p>{item.reason || 'No reason provided.'}</p></section></div><aside className="appointment-card appointment-status-card"><h2>Appointment Status</h2><StatusBadge status={item.status} /><p>{({ pending: 'Your request is awaiting confirmation.', confirmed: 'Your appointment is confirmed.', completed: 'This visit is completed.', cancelled: 'This appointment has been cancelled.', no_show: 'This appointment is marked as a no-show.' })[item.status]}</p></aside></div></>}</div>;
}
