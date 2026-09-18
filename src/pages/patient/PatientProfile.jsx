import { useRef, useState } from 'react';
import FormField from '../../components/public/FormField.jsx';
import { patientProfileService, profileSexOptions, isSenior } from '../../services/patientProfileService.js';
import { clinicToday } from '../../services/bookingService.js';
import '../../styles/patient-profile.css';

const formValues = profile => ({ ...profile, allergies: profile.allergies.join(', ') });
export default function PatientProfile() {
  const [values, setValues] = useState(() => formValues(patientProfileService.get()));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const errorRef = useRef(null);
  const senior = isSenior(values.dob);
  function change(key, value) {
    setValues(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined })); setMessage('');
  }
  function field(key, label, props = {}) {
    return <div><FormField name={'profile-' + key} label={label} value={values[key]} onChange={event => change(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? 'error-' + key : undefined} {...props} />{errors[key] && <p className="profile-error" id={'error-' + key}>{errors[key]}</p>}</div>;
  }
  function save(event) {
    event.preventDefault();
    const result = patientProfileService.save(values);
    if (result.errors) { setErrors(result.errors); setMessage(''); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setValues(formValues(result.profile)); setErrors({}); setMessage('Changes saved in this mock session.');
  }
  function cancel() { setValues(formValues(patientProfileService.get())); setErrors({}); setMessage('Unsaved changes discarded. Your last saved values have been restored.'); }
  return <div className="patient-profile">
    <header className="profile-heading"><h1>My Profile</h1><p>Update your personal information, emergency contact, and health details.</p><p className="profile-note">Mock profile only. Changes on this page reset when you reload. Fields marked * are required.</p></header>
    <p role="status" className="profile-message">{message}</p>
    <div className="profile-layout"><form onSubmit={save} noValidate>
      {Object.values(errors).some(Boolean) && <div ref={errorRef} tabIndex={-1} role="alert" className="profile-errors"><strong>Please check the highlighted fields.</strong><ul>{Object.entries(errors).filter(([, value]) => value).map(([key, value]) => <li key={key}><a href={'#profile-' + key}>{value}</a></li>)}</ul></div>}
      <section className="profile-card" aria-labelledby="personal-title"><h2 id="personal-title">Personal Information</h2><p>Keep your personal details up to date.</p><div className="profile-fields">
        {field('fullName', 'Full name *', { required: true, autoComplete: 'name' })}
        {field('dob', 'Date of birth *', { required: true, type: 'date', max: clinicToday(), autoComplete: 'bday' })}
        {field('sex', 'Sex *', { required: true, children: <><option value="">Select an option</option>{profileSexOptions.map(value => <option key={value}>{value}</option>)}</> })}
        {field('contactNumber', 'Contact number *', { required: true, type: 'tel', autoComplete: 'tel' })}
        {field('email', 'Account email', { type: 'email', readOnly: true, 'aria-describedby': 'profile-email-hint' })}
        {field('address', 'Address (optional)', { autoComplete: 'street-address' })}
      </div><p id="profile-email-hint" className="profile-note">Account email is read-only in this mock profile.</p></section>
      <section className="profile-card" aria-labelledby="emergency-title"><h2 id="emergency-title">Emergency Contact <small>(optional)</small></h2><p>Provide a contact person in case of emergency.</p><div className="profile-fields profile-emergency">
        {field('emergencyName', 'Emergency contact name')}{field('emergencyNumber', 'Emergency contact number', { type: 'tel' })}{field('relationship', 'Relationship')}
      </div></section>
      <section className="profile-card" aria-labelledby="health-title"><h2 id="health-title">Health Information</h2><div className="profile-fields">
        <div><label htmlFor="profile-allergies">Allergies (optional)</label><textarea id="profile-allergies" value={values.allergies} onChange={event => change('allergies', event.target.value)} aria-describedby="allergies-hint" /><p className="profile-note" id="allergies-hint">Separate allergies with commas or new lines.</p></div>
        <div><fieldset><legend>Person with Disability (PWD) status</legend><div className="profile-radios">{[[false, 'No'], [true, 'Yes']].map(([value, label]) => <label key={label}><input type="radio" name="profile-pwd" checked={values.isPwd === value} onChange={() => change('isPwd', value)} />{label}</label>)}</div></fieldset><p className="profile-note">This is self-reported information.</p><p className="profile-senior" aria-live="polite">Senior citizen: <strong>{senior === null ? 'Enter a valid date of birth' : senior ? 'Yes' : 'No'}</strong></p><p className="profile-note">Calculated from date of birth (age 60 or older).</p></div>
      </div><div className="profile-actions"><button type="button" className="action-link" onClick={cancel}>Cancel</button><button type="submit" className="action-link profile-save">Save Changes</button></div></section>
    </form><aside><section className="profile-card"><h2>Account</h2><p>Password changes are not available in this mock preview.</p><button type="button" className="action-link" onClick={() => setPasswordMessage('Change Password is a placeholder. No password has been changed.')}>Change Password</button><p role="status" className="profile-note">{passwordMessage}</p></section></aside></div>
  </div>;
}
