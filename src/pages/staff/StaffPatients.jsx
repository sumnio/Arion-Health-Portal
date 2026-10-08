import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { formatBookingDate } from '../../services/dateTimeService.js';
import { patientListPage, staffApiErrorMessage, staffApiService } from '../../services/staffApiService.js';
import '../../styles/staff-patients.css';

function AppointmentSummary({ appointment, empty }) {
  if (!appointment) return <span>{empty}</span>;
  return <><span>{formatBookingDate(appointment.date)} · {appointment.timeLabel}</span><StatusBadge status={appointment.status} /></>;
}

export default function StaffPatients() {
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [state, setState] = useState({ loading: true, patients: [], error: '' });
  useEffect(() => { const timer = setTimeout(async () => { setState((old) => ({ ...old, loading: true, error: '' })); try { setState({ loading: false, patients: await staffApiService.searchPatients(query), error: '' }); } catch (error) { setState({ loading: false, patients: [], error: staffApiErrorMessage(error, 'Unable to search patients.') }); } }, 200); return () => clearTimeout(timer); }, [query]);
  const result = patientListPage(state.patients, page);
  return <div className="staff-patients"><header className="patients-heading"><div><h1>Patients</h1><p>Find a patient and start a walk-in appointment.</p></div><Link className="action-link" to="/staff/patients/new">Register New Walk-in</Link></header>
    <section className="patients-panel" aria-label="Patient directory"><FormField name="staff-patient-search" label="Search by patient name or contact number" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
      {state.loading ? <p role="status">Searching patients…</p> : state.error ? <p role="alert">{state.error}</p> : <><p role="status">{result.total} {result.total === 1 ? 'patient' : 'patients'}{query.trim() ? ' found' : ''}</p>
      {!result.items.length ? <div className="patients-empty"><h2>{query.trim() ? 'No patients found' : 'No patients yet'}</h2><p>{query.trim() ? 'Try another name or contact number.' : 'Register a new walk-in patient to get started.'}</p>{query && <button onClick={() => { setQuery(''); setPage(1); }}>Clear search</button>}</div> : <ul className="patients-list">{result.items.map(patient => <li key={patient.id} className="patient-card"><div className="patient-card-heading"><div><h2>{patient.full_name}</h2><p>{patient.hasPortalAccount ? 'Portal Patient' : 'Walk-in / Unlinked'}</p></div><div className="patient-card-actions"><Link className="action-link" to={`/staff/patients/${patient.id}`}>View Patient</Link><Link className="action-link" to={`/staff/patients/${patient.id}/walk-in`}>Create Walk-in</Link></div></div><dl><div><dt>Age</dt><dd>{patient.age} years</dd></div><div><dt>Contact</dt><dd>{patient.contact_number}</dd></div><div><dt>Senior / PWD</dt><dd>{patient.isSenior ? 'Senior' : 'Not senior'} · {patient.is_pwd ? 'PWD' : 'Not PWD'}</dd></div><div><dt>Latest appointment</dt><dd className="appointment-cell"><AppointmentSummary appointment={patient.latestAppointment} empty="No past appointment" /></dd></div><div><dt>Upcoming appointment</dt><dd className="appointment-cell"><AppointmentSummary appointment={patient.upcomingAppointment} empty="None scheduled" /></dd></div></dl></li>)}</ul>}
      {result.pageCount > 1 && <nav className="patients-pagination"><button disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>Previous</button><span>Page {result.page} of {result.pageCount}</span><button disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}>Next</button></nav>}</>}
    </section></div>;
}
