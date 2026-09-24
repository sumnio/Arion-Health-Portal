import { useRef, useState } from 'react';
import FormField from '../../components/public/FormField.jsx';
import { adminDoctorService } from '../../services/adminDoctorService.js';
import '../../styles/admin-doctors.css';

const emptyForm = { display_name: '', contact_number: '', specialty: '', license_number: '', ptr_number: '', signature_path: '' };

function formFor(doctor) {
  return doctor ? Object.fromEntries(Object.keys(emptyForm).map(key => [key, doctor[key] ?? ''])) : emptyForm;
}

function Status({ value }) {
  return <span className={`account-status account-status-${value}`}>{value}</span>;
}

export default function ManageDoctors() {
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const heading = useRef(null);
  const doctors = adminDoctorService.list(search);

  function open(mode, doctor = null) {
    setPanel({ mode, doctor });
    setForm(formFor(doctor));
    setError(''); setMessage('');
    requestAnimationFrame(() => heading.current?.focus());
  }

  function save(event) {
    event.preventDefault();
    if (saving.current || !panel || panel.mode === 'view') return;
    saving.current = true;
    try {
      const doctor = panel.mode === 'add' ? adminDoctorService.create(form) : adminDoctorService.update(panel.doctor.id, form);
      setPanel({ mode: 'view', doctor });
      setError(''); setSearch('');
      setMessage(`Doctor ${panel.mode === 'add' ? 'added' : 'updated'} in this mock session.`);
    } catch (failure) { setError(failure.message); }
    finally { saving.current = false; }
  }

  function changeStatus(doctor) {
    const updated = doctor.status === 'active' ? adminDoctorService.deactivate(doctor.id) : adminDoctorService.reactivate(doctor.id);
    setMessage(`${updated.display_name}'s account is now ${updated.status}.`);
    setPanel(current => current?.doctor?.id === updated.id ? { mode: 'view', doctor: updated } : current);
  }

  const setField = (field, value) => setForm(current => ({ ...current, [field]: value }));

  return <div className="manage-doctors">
    <header className="md-heading"><div><h1>Manage Doctors</h1><p>Manage doctor profiles and account access.</p></div><button className="action-link" onClick={() => open('add')}>Add Doctor</button></header>
    <p className="md-hint">Mock preview only. Account status changes last until reload and do not perform real authentication.</p>
    {message && <p className="md-success" role="status">{message}</p>}
    <div className={`md-layout ${panel ? 'md-with-panel' : ''}`}>
      <section className="md-card" aria-label="Doctor list">
        <FormField label="Search by name, contact, specialty, license, or PTR number" name="doctor-search" type="search" value={search} onChange={event => setSearch(event.target.value)} />
        <p>{doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'}</p>
        {doctors.length ? <ul className="md-list">{doctors.map(doctor => <li key={doctor.id}>
          <div className="md-account-summary"><div className="md-name-line"><h2>{doctor.display_name}</h2><Status value={doctor.status} /></div><p>{doctor.specialty}</p><p>{doctor.contact_number}</p><p className="md-id">License: {doctor.license_number} · PTR: {doctor.ptr_number}</p></div>
          <div className="md-actions"><button className="action-link" aria-label={`View ${doctor.display_name}`} onClick={() => open('view', doctor)}>View</button><button className="action-link" aria-label={`Edit ${doctor.display_name}`} onClick={() => open('edit', doctor)}>Edit</button><button className="action-link" onClick={() => changeStatus(doctor)}>{doctor.status === 'active' ? 'Deactivate' : 'Reactivate'}</button></div>
        </li>)}</ul> : <p role="status">{search.trim() ? 'No doctors match your search.' : 'No doctors yet. Add a doctor to get started.'}</p>}
      </section>
      {panel && <section className="md-card" aria-labelledby="doctor-panel-title">
        <h2 id="doctor-panel-title" ref={heading} tabIndex={-1}>{panel.mode === 'add' ? 'Add Doctor' : panel.mode === 'edit' ? 'Edit Doctor' : 'Doctor information'}</h2>
        {panel.mode === 'view' ? <><dl>
          <dt>Doctor name</dt><dd>{panel.doctor.display_name}</dd><dt>Contact number</dt><dd>{panel.doctor.contact_number}</dd><dt>Account status</dt><dd><Status value={panel.doctor.status} /></dd><dt>Specialty</dt><dd>{panel.doctor.specialty}</dd><dt>License number</dt><dd>{panel.doctor.license_number}</dd><dt>PTR number</dt><dd>{panel.doctor.ptr_number}</dd><dt>Signature reference</dt><dd>{panel.doctor.signature_path || 'Not set'}</dd><dt>Doctor ID</dt><dd>{panel.doctor.id}</dd>
        </dl><div className="md-actions"><button className="action-link" onClick={() => open('edit', panel.doctor)}>Edit Doctor</button><button className="action-link" onClick={() => changeStatus(panel.doctor)}>{panel.doctor.status === 'active' ? 'Deactivate' : 'Reactivate'}</button><button className="action-link" onClick={() => setPanel(null)}>Close</button></div></> : <form onSubmit={save}>
          <p>Name, contact number, specialty, license number, and PTR number are required. Signature stores a mock path/reference only.</p>
          {panel.doctor && <p className="md-id">Doctor ID: {panel.doctor.id}</p>}
          <FormField label="Doctor name" name="doctor-name" required value={form.display_name} onChange={event => setField('display_name', event.target.value)} />
          <FormField label="Contact number" name="doctor-contact" required value={form.contact_number} onChange={event => setField('contact_number', event.target.value)} />
          <FormField label="Specialty" name="doctor-specialty" required value={form.specialty} onChange={event => setField('specialty', event.target.value)} />
          <FormField label="License number" name="doctor-license" required value={form.license_number} onChange={event => setField('license_number', event.target.value)} />
          <FormField label="PTR number" name="doctor-ptr" required value={form.ptr_number} onChange={event => setField('ptr_number', event.target.value)} />
          <FormField label="Signature reference (optional)" name="doctor-signature" value={form.signature_path} onChange={event => setField('signature_path', event.target.value)} />
          {error && <p role="alert" className="md-error">{error}</p>}
          <div className="md-actions"><button type="button" className="action-link" onClick={() => setPanel(null)}>Cancel</button><button type="submit" className="action-link md-primary">Save Doctor</button></div>
        </form>}
      </section>}
    </div>
  </div>;
}
