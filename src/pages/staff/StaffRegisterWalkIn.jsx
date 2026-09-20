import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import WalkInQueuePreview from '../../components/staff/WalkInQueuePreview.jsx';
import { staffWalkInService, isSenior, ageFromDob, profileSexOptions } from '../../services/staffWalkInService.js';
import { clinicToday } from '../../services/bookingService.js';
import '../../styles/staff-walkin.css';

export default function StaffRegisterWalkIn() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [values, setValues] = useState({ name: '', dob: '', sex: '', contact_number: '', emergency_contact: '', allergies: '', is_pwd: false });
  const [errors, setErrors] = useState({});
  const [matches, setMatches] = useState([]);
  const found = staffWalkInService.search(query);
  function field(name, label, type = 'text', children) {
    return <div><FormField name={'walkin-' + name} label={label} type={type} value={values[name]} onChange={event => setValues({ ...values, [name]: event.target.value })} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + '-error' : undefined} max={type === 'date' ? clinicToday() : undefined}>{children}</FormField>{errors[name] && <p className="walkin-error" id={name + '-error'}>{errors[name]}</p>}</div>;
  }
  function results(items) {
    return <ul className="walkin-results">{items.map(item => <li key={item.id}><div><strong>{item.name}</strong><p>{item.dob} · {item.contact_number}</p></div><Link className="action-link" to={`/staff/patients/${item.id}/walk-in`}>Select patient</Link></li>)}</ul>;
  }
  function submit(event) {
    event.preventDefault();
    const result = staffWalkInService.register(values);
    setErrors(result.errors ?? {}); setMatches(result.matches ?? []);
    if (result.patient) navigate(`/staff/patients/${result.patient.id}/walk-in`);
  }
  return <div className="staff-walkin"><Link to="/staff/dashboard">← Back to Dashboard</Link><h1>Register Walk-in</h1><p>Find an existing patient first, or register a patient without a portal account.</p><div className="walkin-layout"><div>
    <section className="walkin-panel"><h2>1. Find an existing patient</h2><FormField name="patient-search" label="Search by name or contact number" value={query} onChange={event => setQuery(event.target.value)} />{query.trim() && (found.length ? results(found) : <p role="status">No matching patient. Register below.</p>)}</section>
    <form className="walkin-panel" onSubmit={submit} noValidate><h2>2. New walk-in patient</h2><p>Fields marked * are required. No email, password, or portal account is needed.</p>
      {Object.keys(errors).length > 0 && <p role="alert" className="walkin-error">Please correct the highlighted fields.</p>}
      {matches.length > 0 && <div role="alert"><p>A patient with matching contact information or name and date of birth already exists. Please review and select the existing patient to avoid a duplicate.</p>{results(matches)}</div>}
      <div className="walkin-fields">{field('name', 'Full name *')}{field('dob', 'Date of birth *', 'date')}{field('sex', 'Sex *', 'text', <><option value="">Select sex</option>{profileSexOptions.map(value => <option key={value}>{value}</option>)}</>)}{field('contact_number', 'Contact number *', 'tel')}{field('emergency_contact', 'Emergency contact (optional)')}{field('allergies', 'Allergies (optional, separated by commas)')}</div>
      <label className="walkin-checkbox"><input type="checkbox" checked={values.is_pwd} onChange={event => setValues({ ...values, is_pwd: event.target.checked })} />Person with disability (PWD)</label>
      <p aria-live="polite">{ageFromDob(values.dob) === null ? 'Age and senior status will be derived from date of birth.' : `Age: ${ageFromDob(values.dob)} · Senior status: ${isSenior(values.dob) ? 'Yes' : 'No'} (derived from date of birth)`}</p>
      <div className="walkin-actions"><Link className="action-link" to="/staff/dashboard">Cancel</Link><button type="submit">Register and continue</button></div>
    </form></div><WalkInQueuePreview /></div></div>;
}
