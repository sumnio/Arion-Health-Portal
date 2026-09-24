import { useState } from 'react';
import FormField from '../../components/public/FormField.jsx';
import { adminPatientService } from '../../services/adminPatientService.js';
import '../../styles/admin-doctors.css';

function AccountStatus({ patient }) {
  if (!patient.has_portal_account) return <span className="account-status account-status-none">No portal account</span>;
  return <span className={`account-status account-status-${patient.account_status}`}>{patient.account_status}</span>;
}

function formatDate(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function ManagePatients() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  const result = adminPatientService.list({ query, status, page });

  function updateStatus(patient) {
    const updated = patient.account_status === 'active'
      ? adminPatientService.deactivate(patient.id)
      : adminPatientService.reactivate(patient.id);
    setMessage(`${updated.full_name}'s portal account is now ${updated.account_status}. Patient ID was preserved.`);
  }

  return <div className="manage-doctors manage-patients">
    <header className="md-heading"><div><h1>Manage Patients</h1><p>View Patient portal accounts and manage account access.</p></div></header>
    <p className="md-hint">Mock preview only. Patients without a portal account remain visible but cannot be deactivated or reactivated.</p>
    {message && <p className="md-success" role="status">{message}</p>}
    <section className="md-card" aria-label="Patient account list">
      <div className="md-filter-grid">
        <FormField label="Search by patient name or contact number" name="admin-patient-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <FormField label="Account status" name="admin-patient-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="all">All patients</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="no_account">No portal account</option>
        </FormField>
      </div>
      <p>{result.filteredTotal} of {result.total} {result.total === 1 ? 'patient' : 'patients'}</p>
      {result.items.length ? <ul className="md-list">{result.items.map(patient => <li key={patient.id}>
        <div className="md-account-summary">
          <div className="md-name-line"><h2>{patient.full_name}</h2><AccountStatus patient={patient} /></div>
          <p>{patient.contact_number}</p>
          <p>{patient.has_portal_account ? `Account created: ${formatDate(patient.account_created_at)}` : 'Walk-in/guest Patient'}</p>
          <p className="md-id">Patient ID: {patient.id}</p>
        </div>
        {patient.has_portal_account && <div className="md-actions"><button className="action-link" onClick={() => updateStatus(patient)}>{patient.account_status === 'active' ? 'Deactivate' : 'Reactivate'}</button></div>}
      </li>)}</ul> : <p role="status">{query.trim() || status !== 'all' ? 'No patients match the selected search and status.' : 'No patients are available.'}</p>}
      {result.pageCount > 1 && <nav className="md-pagination" aria-label="Patient list pages">
        <button className="action-link" disabled={result.page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous</button>
        <span>Page {result.page} of {result.pageCount}</span>
        <button className="action-link" disabled={result.page === result.pageCount} onClick={() => setPage(current => Math.min(result.pageCount, current + 1))}>Next</button>
      </nav>}
    </section>
  </div>;
}
