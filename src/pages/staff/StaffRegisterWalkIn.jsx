import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../../components/public/FormField.jsx';
import WalkInQueuePreview from '../../components/staff/WalkInQueuePreview.jsx';
import { staffApiErrorMessage, staffApiService } from '../../services/staffApiService.js';
import { patientAge, patientIsSenior, patientProfileSexOptions } from '../../services/patientApiService.js';
import { clinicToday, formatEncounter } from '../../services/dateTimeService.js';
import { philippineMobileInput, philippineMobileInputAttributes, validatePhilippineMobile } from '../../services/phoneNumber.js';
import '../../styles/staff-walkin.css';

const initialValues = { full_name: '', email: '', dob: '', sex: '', contact_number: '', address: '', emergency_contact_name: '', emergency_contact_number: '', emergency_contact_relationship: '', allergies: '' };

function PatientCandidate({ patient, actionLabel = 'Use Existing Patient' }) {
  return <li><div><strong>{patient.full_name}</strong><p>DOB: {patient.dob} · Contact: {patient.contact_number || 'Not available'}</p><p>Email: {patient.email || 'Not provided'} · Portal: {patient.portal_status}</p>{patient.match_reasons?.length ? <p>Match: {patient.match_reasons.join(', ')}</p> : null}{patient.last_visit_at ? <p>Last visit: {formatEncounter(patient.last_visit_at)}</p> : null}</div><Link className="action-link" to={`/staff/patients/${patient.id}/walk-in`}>{actionLabel}</Link></li>;
}

export default function StaffRegisterWalkIn() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [duplicateReview, setDuplicateReview] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!query.trim()) { setFound([]); setSearching(false); return undefined; }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try { const results = await staffApiService.searchPatients(query); if (active) { setFound(results); setError(''); } }
      catch (reason) { if (active) setError(staffApiErrorMessage(reason, 'Unable to search patients.')); }
      finally { if (active) setSearching(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  function updateValue(name, value) {
    setValues(current => ({ ...current, [name]: value }));
    setFieldErrors(current => ({ ...current, [name]: undefined }));
    setDuplicateReview(null); setError('');
  }
  function field(name, label, type = 'text', children, props = {}) {
    return <div><FormField name={`walkin-${name}`} label={label} type={type} value={values[name]} aria-invalid={!!fieldErrors[name]} onChange={event => updateValue(name, event.target.value)} max={type === 'date' ? clinicToday() : undefined} {...props}>{children}</FormField>{fieldErrors[name] && <p className="walkin-error">{fieldErrors[name]}</p>}</div>;
  }
  function phoneField(name, label, required = false) {
    return field(name, label, 'tel', null, { ...philippineMobileInputAttributes, required, onChange: event => { const next = philippineMobileInput(event.target.value); if (next.accepted) updateValue(name, next.value); }, onBlur: () => setFieldErrors(current => ({ ...current, [name]: validatePhilippineMobile(values[name], { optional: !required }) || undefined })) });
  }
  function validateForm() {
    const nextErrors = {};
    const contactError = validatePhilippineMobile(values.contact_number);
    const emergencyError = validatePhilippineMobile(values.emergency_contact_number, { optional: true });
    if (contactError) nextErrors.contact_number = contactError;
    if (emergencyError) nextErrors.emergency_contact_number = emergencyError;
    if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = 'Enter a valid email address.';
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }
  async function createPatient(duplicateConfirmation) {
    setSubmitting(true); setError('');
    try { const patient = await staffApiService.registerWalkIn(values, { duplicateConfirmation }); navigate(`/staff/patients/${patient.id}/walk-in`); }
    catch (reason) { if (reason?.details?.candidates) setDuplicateReview(reason.details); setError(staffApiErrorMessage(reason, 'Unable to register this walk-in Patient.')); }
    finally { setSubmitting(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true); setError(''); setDuplicateReview(null);
    try {
      const review = await staffApiService.checkWalkInDuplicates(values);
      if (review.has_matches || review.email_conflict) setDuplicateReview(review);
      else await createPatient(false);
    } catch (reason) {
      if (reason?.details?.candidates) setDuplicateReview(reason.details);
      setError(staffApiErrorMessage(reason, 'Unable to check for an existing Patient.'));
    } finally { setSubmitting(false); }
  }

  const results = <ul className="walkin-results">{found.map(item => <PatientCandidate key={item.id} patient={item} actionLabel="Select Patient" />)}</ul>;
  return <div className="staff-walkin"><Link to="/staff/dashboard">← Back to Dashboard</Link><h1>Register Walk-in</h1><p>Search for a returning Patient first. Register a new Patient only when no existing record is correct.</p><div className="walkin-layout"><div><section className="walkin-panel"><h2>1. Find an existing Patient</h2><FormField name="patient-search" label="Search by full name, contact number, or email" value={query} onChange={event => setQuery(event.target.value)} />{searching ? <p role="status">Searching…</p> : query.trim() && (found.length ? results : <p role="status">No matching Patient. Review the details and register below.</p>)}</section>
    <form className="walkin-panel" onSubmit={submit} noValidate><h2>2. New walk-in Patient</h2><p>Fields marked * are required. Email is optional. Staff never creates or sees the Patient’s password.</p>{error && <p role="alert" className="walkin-error">{error}</p>}{duplicateReview && <section className="duplicate-review" aria-live="polite"><h3>A similar Patient already exists</h3><p>Please review these candidates before creating a new Patient. Records are never merged automatically.</p><ul className="walkin-results">{duplicateReview.candidates.map(item => <PatientCandidate key={item.id} patient={item} />)}</ul>{duplicateReview.email_conflict ? <p role="alert" className="walkin-error">This email already belongs to a portal account. Use the existing Patient or enter a different email.</p> : duplicateReview.continue_allowed ? <button type="button" className="secondary-action" disabled={submitting} onClick={() => createPatient(true)}>{submitting ? 'Creating…' : 'Continue as New Patient'}</button> : null}</section>}<div className="walkin-fields">{field('full_name', 'Full name *')}{field('email', 'Email (optional)', 'email')}{field('dob', 'Date of birth *', 'date')}{field('sex', 'Sex *', 'text', <><option value="">Select sex</option>{patientProfileSexOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</>)}{phoneField('contact_number', 'Contact number *', true)}{field('address', 'Address (optional)')}{field('emergency_contact_name', 'Emergency contact name (optional)')}{phoneField('emergency_contact_number', 'Emergency contact number (optional)')}{field('emergency_contact_relationship', 'Emergency contact relationship (optional)')}{field('allergies', 'Allergies (optional, separated by commas)')}</div><p className="walkin-note">When an email is provided, a portal invitation is sent only after the walk-in appointment is successfully created.</p><p className="walkin-note">New walk-in Patients begin without PWD priority. PWD priority is used only for an existing Patient with verified PWD status.</p><p>{patientAge(values.dob) === null ? 'Age and senior status will be derived from date of birth.' : `Age: ${patientAge(values.dob)} · Senior status: ${patientIsSenior(values.dob) ? 'Yes' : 'No'} (derived from date of birth)`}</p><div className="walkin-actions"><Link className="action-link" to="/staff/dashboard">Cancel</Link><button type="submit" disabled={submitting}>{submitting ? 'Checking…' : 'Review and continue'}</button></div></form></div><WalkInQueuePreview /></div></div>;
}
