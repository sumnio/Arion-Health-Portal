import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { formatBookingDate, formatEncounter } from '../../services/dateTimeService.js';
import { staffApiErrorMessage, staffApiService, staffListPage } from '../../services/staffApiService.js';
import '../../styles/staff-patient-detail.css';

function AppointmentFacts({ appointment }) {
  if (!appointment) return <p>No appointment available.</p>;
  return <dl><div><dt>Date and time</dt><dd>{formatBookingDate(appointment.date)} · {appointment.timeLabel}</dd></div><div><dt>Doctor</dt><dd>{appointment.doctorName}</dd></div><div><dt>Visit type</dt><dd>{appointment.visitLabel}</dd></div><div><dt>Reason</dt><dd>{appointment.reason}</dd></div><div><dt>Status</dt><dd><StatusBadge status={appointment.status} /></dd></div><div><dt>Arrival</dt><dd>{appointment.check_in_at ? `Confirmed ${formatEncounter(appointment.check_in_at)}` : 'Not checked in'}</dd></div><div><dt>Queue priority</dt><dd>{appointment.priorityLabel}</dd></div><div><dt>Origin</dt><dd>{appointment.originLabel}</dd></div></dl>;
}

export default function StaffPatientDetail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, detail: null, error: '' });
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    staffApiService.getPatientDetails(id).then((detail) => active && setState({ loading: false, detail, error: '' })).catch((error) => active && setState({ loading: false, detail: null, error: staffApiErrorMessage(error, 'Patient was not found.') }));
    return () => { active = false; };
  }, [id]);
  if (state.loading) return <div className="staff-patient-detail"><Link to="/staff/patients">← Back to Patients</Link><p role="status">Loading patient information…</p></div>;
  if (state.error || !state.detail) return <div className="staff-patient-detail"><Link to="/staff/patients">← Back to Patients</Link><section className="patient-detail-card"><h1>Patient not found</h1><p role="alert">{state.error}</p></section></div>;
  const { patient, appointments, latestAppointment, upcomingAppointment } = state.detail;
  const appointmentPage = staffListPage(appointments, page);
  return <div className="staff-patient-detail"><Link className="detail-back" to="/staff/patients">← Back to Patients</Link>
    <header className="patient-detail-heading"><div><h1>{patient.full_name}</h1><p>Operational Patient and appointment information.</p></div><Link className="action-link" to={`/staff/patients/${patient.id}/walk-in`}>Create Walk-in Appointment</Link></header>
    <div className="patient-detail-grid"><section className="patient-detail-card"><h2>Patient Information</h2><dl><div><dt>Date of birth</dt><dd>{formatBookingDate(patient.dob)}</dd></div><div><dt>Age</dt><dd>{patient.age} years</dd></div><div><dt>Sex</dt><dd>{patient.sex}</dd></div><div><dt>Contact number</dt><dd>{patient.contact_number}</dd></div><div><dt>Address</dt><dd>{patient.address || 'Not provided'}</dd></div><div><dt>Senior status</dt><dd>{patient.isSenior ? 'Senior' : 'Not a senior'}</dd></div><div><dt>PWD status</dt><dd>{patient.is_pwd ? 'PWD' : 'Not a PWD'}</dd></div><div><dt>Patient type</dt><dd>{patient.hasPortalAccount ? 'Portal Patient' : 'Walk-in / Unlinked'}</dd></div></dl></section>
      <section className="patient-detail-card appointment-summary"><h2>Appointment Summary</h2><h3>Upcoming appointment</h3><AppointmentFacts appointment={upcomingAppointment} /><h3>Latest appointment</h3><AppointmentFacts appointment={latestAppointment} /></section></div>
    <section className="patient-detail-card appointment-history"><h2>Appointment History</h2><p>Operational history only. Clinical records are not available to Staff.</p>{appointments.length ? <><ol>{appointmentPage.items.map((appointment) => <li key={appointment.id}><header><div><time dateTime={appointment.appointment_at}>{formatBookingDate(appointment.date)} · {appointment.timeLabel}</time><strong>{appointment.doctorName}</strong></div><StatusBadge status={appointment.status} /></header><dl><div><dt>Visit</dt><dd>{appointment.visitLabel} · {appointment.reason}</dd></div><div><dt>Arrival</dt><dd>{appointment.check_in_at ? `Confirmed ${formatEncounter(appointment.check_in_at)}` : 'Not checked in'}</dd></div><div><dt>Queue priority</dt><dd>{appointment.priorityLabel}</dd></div><div><dt>Origin</dt><dd>{appointment.originLabel}</dd></div></dl></li>)}</ol>{appointmentPage.pageCount > 1 && <nav className="patient-history-pagination" aria-label="Appointment history pages"><button type="button" disabled={appointmentPage.page === 1} onClick={() => setPage(appointmentPage.page - 1)}>Previous</button><span>Page {appointmentPage.page} of {appointmentPage.pageCount}</span><button type="button" disabled={appointmentPage.page === appointmentPage.pageCount} onClick={() => setPage(appointmentPage.page + 1)}>Next</button></nav>}</> : <p>No appointment history found.</p>}</section>
  </div>;
}
