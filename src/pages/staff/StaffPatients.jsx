import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import StaffPwdVerification from '../../components/StaffPwdVerification.jsx';
import { formatBookingDate, formatEncounter } from '../../services/dateTimeService.js';
import { patientListPage, staffApiErrorMessage, staffApiService } from '../../services/staffApiService.js';
import '../../styles/staff-patients.css';

export default function StaffPatients() {
  const [view, setView] = useState('patients'); const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [pendingPwdCount, setPendingPwdCount] = useState(0); const [state, setState] = useState({ loading: true, patients: [], error: '' });
  useEffect(() => { const timer = setTimeout(async () => { setState((old) => ({ ...old, loading: true, error: '' })); try { setState({ loading: false, patients: await staffApiService.searchPatients(query), error: '' }); } catch (error) { setState({ loading: false, patients: [], error: staffApiErrorMessage(error, 'Unable to search patients.') }); } }, 200); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { let active = true; staffApiService.getPwdVerifications(1).then(result => { if (active) setPendingPwdCount(result.total); }).catch(() => {}); return () => { active = false; }; }, []);
  const result = patientListPage(state.patients, page);
  return <div className="staff-patients"><header className="patients-heading"><div><h1>Patients</h1><p>Find a patient and start a walk-in appointment.</p></div><Link className="action-link" to="/staff/patients/new">Register New Walk-in</Link></header>
    <nav className="patients-view-tabs" aria-label="Staff Patient views"><button type="button" aria-pressed={view === 'patients'} onClick={() => setView('patients')}>Patients</button><button type="button" aria-pressed={view === 'pwd'} onClick={() => setView('pwd')}>PWD Verification ({pendingPwdCount})</button></nav>
    {view === 'pwd' ? <StaffPwdVerification onCountChange={setPendingPwdCount} /> : <section className="patients-panel" aria-label="Patient directory"><FormField name="staff-patient-search" label="Search by full name, contact number, or email" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
      {state.loading ? <p role="status">Searching patients…</p> : state.error ? <p role="alert">{state.error}</p> : <><p role="status">{result.total} {result.total === 1 ? 'patient' : 'patients'}{query.trim() ? ' found' : ''}</p>
      {!result.items.length ? <div className="patients-empty"><h2>{query.trim() ? 'No patients found' : 'No patients yet'}</h2><p>{query.trim() ? 'Try another name, contact number, or email.' : 'Register a new walk-in Patient to get started.'}</p>{query && <button onClick={() => { setQuery(''); setPage(1); }}>Clear search</button>}</div> : <ul className="patients-list">{result.items.map(patient => <li key={patient.id} className="patient-card"><div className="patient-card-heading"><div><h2>{patient.full_name}</h2><p>{patient.portal_status}</p></div><div className="patient-card-actions"><Link className="action-link" to={`/staff/patients/${patient.id}`}>View Patient</Link><Link className="action-link" to={`/staff/patients/${patient.id}/walk-in`}>Create Walk-in</Link></div></div><dl><div><dt>Date of birth</dt><dd>{formatBookingDate(patient.dob)}</dd></div><div><dt>Contact</dt><dd>{patient.contact_number || 'Not available'}</dd></div><div><dt>Email</dt><dd>{patient.email || 'Not provided'}</dd></div><div><dt>Last visit</dt><dd>{patient.last_visit_at ? formatEncounter(patient.last_visit_at) : 'No past visit'}</dd></div></dl></li>)}</ul>}
      {result.pageCount > 1 && <nav className="patients-pagination"><button disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>Previous</button><span>Page {result.page} of {result.pageCount}</span><button disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}>Next</button></nav>}</>}
    </section>}</div>;
}
