import { useRef, useState } from 'react';
import FormField from '../../components/public/FormField.jsx';
import { adminStaffService } from '../../services/adminStaffService.js';
import '../../styles/admin-doctors.css';

const emptyForm = { display_name: '', contact_number: '' };
function Status({ value }) { return <span className={`account-status account-status-${value}`}>{value}</span>; }

export default function ManageStaff() {
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const heading = useRef(null);
  const saving = useRef(false);
  const staff = adminStaffService.list(search);

  function open(mode, account = null) {
    setPanel({ mode, account });
    setForm(account ? { display_name: account.display_name, contact_number: account.contact_number } : emptyForm);
    setError(''); setMessage('');
    requestAnimationFrame(() => heading.current?.focus());
  }

  function save(event) {
    event.preventDefault();
    if (saving.current || !panel || panel.mode === 'view') return;
    saving.current = true;
    try {
      const account = panel.mode === 'add' ? adminStaffService.create(form) : adminStaffService.update(panel.account.id, form);
      setMessage(`Staff account ${panel.mode === 'add' ? 'added' : 'updated'} in this mock session.`);
      setPanel({ mode: 'view', account }); setSearch(''); setError('');
      requestAnimationFrame(() => heading.current?.focus());
    } catch (failure) { setError(failure.message); }
    finally { saving.current = false; }
  }

  function changeStatus(account) {
    const updated = account.status === 'active' ? adminStaffService.deactivate(account.id) : adminStaffService.reactivate(account.id);
    setMessage(`${updated.display_name}'s account is now ${updated.status}.`);
    setPanel(current => current?.account?.id === updated.id ? { mode: 'view', account: updated } : current);
  }

  return <div className="manage-doctors">
    <header className="md-heading"><div><h1>Manage Staff</h1><p>Manage staff profiles and account access.</p></div><button className="action-link" onClick={() => open('add')}>Add Staff</button></header>
    <p className="md-hint">Mock preview only. Account status changes last until reload and do not perform real authentication.</p>
    {message && <p className="md-success" role="status">{message}</p>}
    <div className={`md-layout ${panel ? 'md-with-panel' : ''}`}>
      <section className="md-card" aria-label="Staff list">
        <FormField label="Search by staff name, contact number, or status" name="staff-search" type="search" value={search} onChange={event => setSearch(event.target.value)} />
        <p>{staff.length} staff {staff.length === 1 ? 'account' : 'accounts'}</p>
        {staff.length ? <ul className="md-list">{staff.map(account => <li key={account.id}>
          <div className="md-account-summary"><div className="md-name-line"><h2>{account.display_name}</h2><Status value={account.status} /></div><p>{account.contact_number}</p><p className="md-id">Account ID: {account.id}</p></div>
          <div className="md-actions"><button className="action-link" aria-label={`View ${account.display_name}`} onClick={() => open('view', account)}>View</button><button className="action-link" aria-label={`Edit ${account.display_name}`} onClick={() => open('edit', account)}>Edit</button><button className="action-link" onClick={() => changeStatus(account)}>{account.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></div>
        </li>)}</ul> : <p role="status">{search.trim() ? 'No staff match your search.' : 'No staff accounts yet. Add staff to get started.'}</p>}
      </section>
      {panel && <section className="md-card" aria-labelledby="staff-panel-title">
        <h2 id="staff-panel-title" ref={heading} tabIndex={-1}>{panel.mode === 'add' ? 'Add Staff' : panel.mode === 'edit' ? 'Edit Staff' : 'Staff information'}</h2>
        {panel.mode === 'view' ? <><dl><dt>Staff name</dt><dd>{panel.account.display_name}</dd><dt>Contact number</dt><dd>{panel.account.contact_number}</dd><dt>Account status</dt><dd><Status value={panel.account.status} /></dd><dt>Account ID</dt><dd>{panel.account.id}</dd><dt>Role</dt><dd>Staff</dd></dl><div className="md-actions"><button className="action-link" onClick={() => open('edit', panel.account)}>Edit Staff</button><button className="action-link" onClick={() => changeStatus(panel.account)}>{panel.account.status === 'active' ? 'Deactivate' : 'Reactivate'}</button><button className="action-link" onClick={() => setPanel(null)}>Close</button></div></> : <form onSubmit={save}>
          <p>Staff name and contact number are required. Login credentials are not created in this mock.</p>
          {panel.account && <p className="md-id">Account ID: {panel.account.id}</p>}
          <FormField label="Staff name" name="staff-name" required value={form.display_name} onChange={event => setForm({ ...form, display_name: event.target.value })} />
          <FormField label="Contact number" name="staff-contact" required value={form.contact_number} onChange={event => setForm({ ...form, contact_number: event.target.value })} />
          {error && <p className="md-error" role="alert">{error}</p>}
          <div className="md-actions"><button type="button" className="action-link" onClick={() => setPanel(null)}>Cancel</button><button type="submit" className="action-link md-primary">Save Staff</button></div>
        </form>}
      </section>}
    </div>
  </div>;
}
