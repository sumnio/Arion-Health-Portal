import { useRef, useState } from 'react';
import FormField from '../../components/public/FormField.jsx';
import { adminStaffService } from '../../services/adminStaffService.js';
// Reuse the existing Admin account-list and side-panel presentation.
import '../../styles/admin-doctors.css';

export default function ManageStaff() {
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState({ display_name: '', username: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const heading = useRef(null);
  const saving = useRef(false);
  const staff = adminStaffService.list(search);
  function open(mode, account = null) {
    setPanel({ mode, account });
    setForm({ display_name: account?.display_name ?? '', username: account?.username ?? '' });
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
  return <div className="manage-doctors">
    <header className="md-heading"><div><h1>Manage Staff</h1><p>View and manage staff account information.</p></div><button className="action-link" onClick={() => open('add')}>Add Staff</button></header>
    <p>Mock preview only. Changes last until reload; no login credentials are created.</p>
    {message && <p className="md-success" role="status">{message}</p>}
    <div className={`md-layout ${panel ? 'md-with-panel' : ''}`}>
      <section className="md-card" aria-label="Staff list">
        <FormField label="Search by staff name or username" name="staff-search" type="search" value={search} onChange={e => setSearch(e.target.value)} />
        <p>{staff.length} staff {staff.length === 1 ? 'account' : 'accounts'}</p>
        {staff.length ? <ul className="md-list">{staff.map(account => <li key={account.id}><div><h2>{account.display_name}</h2><p>Username: {account.username || 'Not set'}</p><p className="md-id">Account ID: {account.id}</p></div><div className="md-actions"><button className="action-link" aria-label={`View ${account.display_name}`} onClick={() => open('view', account)}>View</button><button className="action-link" aria-label={`Edit ${account.display_name}`} onClick={() => open('edit', account)}>Edit</button></div></li>)}</ul> : <p role="status">{search.trim() ? 'No staff match your search.' : 'No staff accounts yet. Add staff to get started.'}</p>}
      </section>
      {panel && <section className="md-card" aria-labelledby="staff-panel-title">
        <h2 id="staff-panel-title" ref={heading} tabIndex={-1}>{panel.mode === 'add' ? 'Add Staff' : panel.mode === 'edit' ? 'Edit Staff' : 'Staff information'}</h2>
        {panel.mode === 'view' ? <><dl><dt>Staff name</dt><dd>{panel.account.display_name}</dd><dt>Username</dt><dd>{panel.account.username || 'Not set'}</dd><dt>Account ID</dt><dd>{panel.account.id}</dd><dt>Role</dt><dd>Staff</dd></dl><div className="md-actions"><button className="action-link" onClick={() => open('edit', panel.account)}>Edit Staff</button><button className="action-link" onClick={() => setPanel(null)}>Close</button></div></> : <form onSubmit={save}>
          <p>Staff name is required. Username is optional and must be unique when provided.</p>
          {panel.account && <p className="md-id">Account ID: {panel.account.id}</p>}
          <FormField label="Staff name" name="staff-name" required value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
          <FormField label="Username (optional)" name="staff-username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          {error && <p className="md-error" role="alert">{error}</p>}
          <div className="md-actions"><button type="button" className="action-link" onClick={() => setPanel(null)}>Cancel</button><button type="submit" className="action-link md-primary">Save Staff</button></div>
        </form>}
      </section>}
    </div>
  </div>;
}
