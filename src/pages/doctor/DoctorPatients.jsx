import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { formatBookingDate } from '../../services/dateTimeService.js';
import { doctorApiErrorMessage, doctorApiService } from '../../services/doctorApiService.js';
import { patientAge } from '../../services/patientApiService.js';
import '../../styles/doctor-patients.css';

function AppointmentSummary({ appointment, empty }) {
  if (!appointment) return <span className="patient-list-empty">{empty}</span>;
  return <div className="patient-appointment-summary"><span>{formatBookingDate(appointment.date)} · {appointment.timeLabel}</span><StatusBadge status={appointment.status} /></div>;
}

export default function DoctorPatients() {
  const [state, setState] = useState({ loading: true, patients: [], error: '' });
  useEffect(() => {
    let active = true;
    doctorApiService.getRelatedPatients().then((patients) => active && setState({ loading: false, patients, error: '' })).catch((error) => active && setState({ loading: false, patients: [], error: doctorApiErrorMessage(error, 'Unable to load related patients.') }));
    return () => { active = false; };
  }, []);
  return <div className="doctor-patients-page">
    <header><h1>Patients</h1><p>Patients related to your assigned appointments and consultations.</p></header>
    {state.loading && <p role="status">Loading related patients…</p>}
    {state.error && <p className="patients-error" role="alert">{state.error}</p>}
    {!state.loading && !state.error && !state.patients.length && <section className="patients-empty"><h2>No related patients found.</h2><p>Patients will appear here when an appointment is assigned to you.</p></section>}
    {!state.loading && !state.error && state.patients.length > 0 && <div className="patients-table-wrap"><table><caption>{state.patients.length} related {state.patients.length === 1 ? 'patient' : 'patients'}</caption><thead><tr><th scope="col">Patient</th><th scope="col">Most recent appointment</th><th scope="col">Upcoming appointment</th><th scope="col">Action</th></tr></thead><tbody>{state.patients.map(({ patient, mostRecentAppointment, upcomingAppointment, relatedAppointment }) => {
      const age = patientAge(patient.dob);
      return <tr key={patient.id}><td><strong>{patient.full_name}</strong><span>{age == null ? `Born ${formatBookingDate(patient.dob)}` : `${age} years old · Born ${formatBookingDate(patient.dob)}`}</span></td><td><AppointmentSummary appointment={mostRecentAppointment} empty="No past appointments" /></td><td><AppointmentSummary appointment={upcomingAppointment} empty="No upcoming appointment" /></td><td><Link className="action-link" to={`/doctor/patients/${patient.id}`} state={{ source: 'patients', appointmentId: relatedAppointment?.id, date: relatedAppointment?.date }}>View Patient</Link></td></tr>;
    })}</tbody></table></div>}
  </div>;
}
