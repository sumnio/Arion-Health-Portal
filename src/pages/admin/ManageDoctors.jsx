import { useRef, useState } from 'react';
import FormField from '../../components/public/FormField.jsx';
import { adminDoctorService } from '../../services/adminDoctorService.js';
import '../../styles/admin-doctors.css';

export default function ManageDoctors() {
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState({ display_name: '', specialty: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const heading = useRef(null);
  const doctors = adminDoctorService.list(search);
  function open(mode, doctor = null) {
    setPanel({ mode, doctor });
    setForm({ display_name: doctor?.display_name ?? '', specialty: doctor?.specialty ?? '' });
    setError(''); setMessage('');
    requestAnimationFrame(() => heading.current?.focus());
  }
  function save(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    try {
      const doctor = panel.mode === 'add' ? adminDoctorService.create(form) : adminDoctorService.update(panel.doctor.id, form);
      setPanel({ mode: 'view', doctor });
      setError('');
      setMessage('Doctor ' + (panel.mode === 'add' ? 'added' : 'updated') + ' in this mock session.');
      setSearch('');
    } catch (failure) { setError(failure.message); }
    finally { saving.current = false; }
  }
  return <div className="manage-doctors">
    <header className="md-heading"><div><h1>Manage Doctors</h1><p>View and manage doctor account information.</p></div><button className="action-link" onClick={() => open('add')}>Add Doctor</button></header>
    <p className="md-hint">Mock preview only. Changes last until reload; no login credentials are created.</p>
    {message && <p className="md-success" role="status">{message}</p>}
    <div className={`md-layout ${panel ? 'md-with-panel' : ''}`}>
      <section className="md-card" aria-label="Doctor list">
        <FormField label="Search by doctor name or specialty" name="doctor-search" type="search" value={search} onChange={e => setSearch(e.target.value)} />
        <p>{doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'}</p>
        {doctors.length ? <ul className="md-list">{doctors.map(doctor => <li key={doctor.id}><div><h2>{doctor.display_name}</h2><p>{doctor.specialty || 'Specialty not specified'}</p></div><div className="md-actions"><button className="action-link" aria-label={`View ${doctor.display_name}`} onClick={() => open('view', doctor)}>View</button><button className="action-link" aria-label={`Edit ${doctor.display_name}`} onClick={() => open('edit', doctor)}>Edit</button></div></li>)}</ul> : <p role="status">{search.trim() ? 'No doctors match your search.' : 'No doctors yet. Add a doctor to get started.'}</p>}
      </section>
      {panel && <section className="md-card" aria-labelledby="doctor-panel-title">
        <h2 id="doctor-panel-title" ref={heading} tabIndex={-1}>{panel.mode === 'add' ? 'Add Doctor' : panel.mode === 'edit' ? 'Edit Doctor' : 'Doctor information'}</h2>
        {panel.mode === 'view' ? <><dl><dt>Doctor name</dt><dd>{panel.doctor.display_name}</dd><dt>Specialty</dt><dd>{panel.doctor.specialty || 'Not specified'}</dd><dt>Doctor ID</dt><dd>{panel.doctor.id}</dd><dt>Role</dt><dd>Doctor</dd></dl><div className="md-actions"><button className="action-link" onClick={() => open('edit', panel.doctor)}>Edit Doctor</button><button className="action-link" onClick={() => setPanel(null)}>Close</button></div></> : <form onSubmit={save}>
          <p>Doctor name and specialty are required.</p>
          {panel.doctor && <p className="md-id">Doctor ID: {panel.doctor.id}</p>}
          <FormField label="Doctor name" name="doctor-name" required value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
          <FormField label="Specialty" name="doctor-specialty" required value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} />
          {error && <p role="alert" className="md-error">{error}</p>}
          <div className="md-actions"><button type="button" className="action-link" onClick={() => setPanel(null)}>Cancel</button><button type="submit" className="action-link md-primary">Save Doctor</button></div>
        </form>}
      </section>}
    </div>
  </div>;
}
