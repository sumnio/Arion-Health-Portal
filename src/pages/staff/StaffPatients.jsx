import { useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import { staffPatientsService } from '../../services/staffPatientsService.js';
import '../../styles/staff-patients.css';

export default function StaffPatients() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const result = staffPatientsService.list({ query, page });
  return <div className="staff-patients">
    <header className="patients-heading"><div><h1>Patients</h1><p>Find a patient and start a walk-in appointment.</p></div><Link className="action-link" to="/staff/patients/new">Register New Walk-in</Link></header>
    <section className="patients-panel" aria-label="Patient directory">
      <FormField name="staff-patient-search" label="Search by patient name or contact number" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
      <p role="status">{result.filteredTotal} {result.filteredTotal === 1 ? 'patient' : 'patients'}{query.trim() ? ' found' : ' in this mock session'}</p>
      {!result.items.length ? <div className="patients-empty"><h2>{result.total ? 'No matching patients' : 'No patients yet'}</h2><p>{result.total ? 'Try another name or contact number.' : 'Register a new walk-in patient to get started.'}</p>{query && <button onClick={() => { setQuery(''); setPage(1); }}>Clear search</button>}</div> : <ul className="patients-list">{result.items.map(patient => <li key={patient.id} className="patient-card">
        <div className="patient-card-heading"><h2>{patient.name}</h2><Link className="action-link" aria-label={`Create Walk-in Appointment for ${patient.name}`} to={`/staff/patients/${patient.id}/walk-in`}>Create Walk-in Appointment</Link></div>
        <dl><div><dt>Date of birth / age</dt><dd>{patient.dob ?? 'Not available'}{patient.age !== null && ` · ${patient.age} years`}</dd></div><div><dt>Sex</dt><dd>{patient.sex || 'Not available'}</dd></div><div><dt>Contact number</dt><dd>{patient.contactNumber || 'Not available'}</dd></div><div><dt>PWD</dt><dd>{patient.isPwd ? 'Yes' : 'No'}</dd></div><div><dt>Senior (derived from DOB)</dt><dd>{patient.isSenior === null ? 'Not available' : patient.isSenior ? 'Yes' : 'No'}</dd></div></dl>
      </li>)}</ul>}
      {result.pageCount > 1 && <nav className="patients-pagination" aria-label="Patient list pages"><button disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>Previous</button><span aria-live="polite">Page {result.page} of {result.pageCount}</span><button disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}>Next</button></nav>}
    </section>
  </div>;
}
