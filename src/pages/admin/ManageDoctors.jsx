import { useEffect, useRef, useState } from 'react';
import FormField from '../../components/public/FormField.jsx';
import { adminApiErrorMessage, adminApiService } from '../../services/adminApiService.js';
import '../../styles/admin-doctors.css';

const emptyForm = { email: '', password: '', display_name: '', contact_number: '', specialty: '', license_number: '', ptr_number: '', signature_path: '' };
function formFor(doctor) { return doctor ? { ...emptyForm, ...Object.fromEntries(Object.keys(emptyForm).map(key => [key, doctor[key] ?? ''])), password: '' } : { ...emptyForm }; }
function Status({ value }) { return <span className={`account-status account-status-${value}`}>{value}</span>; }

export default function ManageDoctors() {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [reload, setReload] = useState(0);
  const [list, setList] = useState({ loading: true, items: [], total: 0, page: 1, pageCount: 1, error: '' });
  const [panel, setPanel] = useState(null); const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const heading = useRef(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setList(current => ({ ...current, loading: true, error: '' }));
      try { const result = await adminApiService.listDoctors({ search, page, limit: 5 }); if (active) setList({ loading: false, ...result, error: '' }); }
      catch (failure) { if (active) setList({ loading: false, items: [], total: 0, page: 1, pageCount: 1, error: adminApiErrorMessage(failure, 'Unable to load Doctor accounts.') }); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [search, page, reload]);

  function open(mode, doctor = null) { setPanel({ mode, doctor }); setForm(formFor(doctor)); setError(''); setMessage(''); requestAnimationFrame(() => heading.current?.focus()); }
  async function save(event) {
    event.preventDefault(); if (saving || !panel || panel.mode === 'view') return;
    setSaving(true); setError('');
    try {
      const doctor = panel.mode === 'add' ? await adminApiService.createDoctor(form) : await adminApiService.updateDoctor(panel.doctor.id, form);
      setForm(current => ({ ...current, password: '' })); setPanel({ mode: 'view', doctor }); setSearch(''); setPage(1); setReload(value => value + 1);
      setMessage(`Doctor ${panel.mode === 'add' ? 'account provisioned' : 'profile updated'} successfully.`);
    } catch (failure) { setError(adminApiErrorMessage(failure, 'Unable to save the Doctor account.')); }
    finally { setSaving(false); }
  }
  async function changeStatus(doctor) {
    if (saving) return; setSaving(true); setError('');
    try { const updated = await adminApiService.setDoctorStatus(doctor); setMessage(`${updated.display_name}'s account is now ${updated.status}.`); setPanel(current => current?.doctor?.id === updated.id ? { mode: 'view', doctor: updated } : current); setReload(value => value + 1); }
    catch (failure) { setError(adminApiErrorMessage(failure, 'Unable to update this Doctor account.')); }
    finally { setSaving(false); }
  }
  const setField = (field, value) => setForm(current => ({ ...current, [field]: value }));

  return <div className="manage-doctors">
    <header className="md-heading"><div><h1>Manage Doctors</h1><p>Provision Doctor accounts and manage approved profile information and portal access.</p></div><button className="action-link" onClick={() => open('add')}>Add Doctor</button></header>
    <p className="md-hint">Account changes are saved through the clinic API. Deactivation preserves the Doctor identity and history.</p>
    {message && <p className="md-success" role="status">{message}</p>}{error && <p className="md-error" role="alert">{error}</p>}
    <div className={`md-layout ${panel ? 'md-with-panel' : ''}`}>
      <section className="md-card" aria-label="Doctor list">
        <FormField label="Search by name, contact, specialty, license, or PTR number" name="doctor-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
        {list.loading ? <p role="status">Loading Doctor accounts…</p> : list.error ? <><p className="md-error" role="alert">{list.error}</p><button className="action-link" onClick={() => setReload(value => value + 1)}>Try again</button></> : <><p>{list.total} {list.total === 1 ? 'doctor' : 'doctors'}</p>
        {list.items.length ? <ul className="md-list">{list.items.map(doctor => <li key={doctor.id}><div className="md-account-summary"><div className="md-name-line"><h2>{doctor.display_name}</h2><Status value={doctor.status} /></div><p>{doctor.specialty}</p><p>{doctor.email}</p><p>{doctor.contact_number}</p><p className="md-id">License: {doctor.license_number} · PTR: {doctor.ptr_number}</p></div><div className="md-actions"><button className="action-link" aria-label={`View ${doctor.display_name}`} onClick={() => open('view', doctor)}>View</button><button className="action-link" aria-label={`Edit ${doctor.display_name}`} onClick={() => open('edit', doctor)}>Edit</button><button className="action-link" disabled={saving} onClick={() => changeStatus(doctor)}>{doctor.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></div></li>)}</ul> : <p role="status">{search.trim() ? 'No doctors match your search.' : 'No Doctor accounts yet. Add a Doctor to get started.'}</p>}
        {list.pageCount > 1 && <nav className="md-pagination" aria-label="Doctor list pages"><button className="action-link" disabled={list.page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {list.page} of {list.pageCount}</span><button className="action-link" disabled={list.page === list.pageCount} onClick={() => setPage(value => Math.min(list.pageCount, value + 1))}>Next</button></nav>}</>}
      </section>
      {panel && <section className="md-card" aria-labelledby="doctor-panel-title"><h2 id="doctor-panel-title" ref={heading} tabIndex={-1}>{panel.mode === 'add' ? 'Add Doctor' : panel.mode === 'edit' ? 'Edit Doctor' : 'Doctor information'}</h2>
        {panel.mode === 'view' ? <><dl><dt>Doctor name</dt><dd>{panel.doctor.display_name}</dd><dt>Email</dt><dd>{panel.doctor.email}</dd><dt>Contact number</dt><dd>{panel.doctor.contact_number}</dd><dt>Account status</dt><dd><Status value={panel.doctor.status} /></dd><dt>Specialty</dt><dd>{panel.doctor.specialty}</dd><dt>License number</dt><dd>{panel.doctor.license_number}</dd><dt>PTR number</dt><dd>{panel.doctor.ptr_number}</dd><dt>Signature reference</dt><dd>{panel.doctor.signature_path || 'Not set'}</dd><dt>Doctor ID</dt><dd>{panel.doctor.id}</dd></dl><div className="md-actions"><button className="action-link" onClick={() => open('edit', panel.doctor)}>Edit Doctor</button><button className="action-link" disabled={saving} onClick={() => changeStatus(panel.doctor)}>{panel.doctor.status === 'active' ? 'Deactivate' : 'Reactivate'}</button><button className="action-link" onClick={() => setPanel(null)}>Close</button></div></> : <form onSubmit={save}>
          <p>{panel.mode === 'add' ? 'Provide account credentials and the approved Doctor profile fields. The Doctor role is assigned by the server.' : 'Email and role are fixed. Update approved profile fields only.'}</p>
          {panel.doctor && <><p className="md-id">Doctor ID: {panel.doctor.id}</p><p>Email: {panel.doctor.email}</p></>}
          {panel.mode === 'add' && <><FormField label="Email" name="doctor-email" type="email" required value={form.email} onChange={event => setField('email', event.target.value)} /><FormField label="Temporary password" name="doctor-password" type="password" required minLength={8} value={form.password} onChange={event => setField('password', event.target.value)} /></>}
          <FormField label="Doctor name" name="doctor-name" required value={form.display_name} onChange={event => setField('display_name', event.target.value)} /><FormField label="Contact number" name="doctor-contact" required value={form.contact_number} onChange={event => setField('contact_number', event.target.value)} /><FormField label="Specialty" name="doctor-specialty" required value={form.specialty} onChange={event => setField('specialty', event.target.value)} /><FormField label="License number" name="doctor-license" required value={form.license_number} onChange={event => setField('license_number', event.target.value)} /><FormField label="PTR number" name="doctor-ptr" required value={form.ptr_number} onChange={event => setField('ptr_number', event.target.value)} /><FormField label="Signature reference (optional)" name="doctor-signature" value={form.signature_path} onChange={event => setField('signature_path', event.target.value)} />
          <div className="md-actions"><button type="button" className="action-link" disabled={saving} onClick={() => setPanel(null)}>Cancel</button><button type="submit" className="action-link md-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Doctor'}</button></div>
        </form>}
      </section>}
    </div>
  </div>;
}
