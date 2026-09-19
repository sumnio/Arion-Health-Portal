import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import RecordSection from '../../components/records/RecordSection.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { doctorRecordService } from '../../services/doctorRecordService.js';
import { formatBookingDate } from '../../services/bookingService.js';
import '../../styles/doctor-record.css';

function Field({ label, name, value, onChange, error, required, type }) {
  const props = { id: name, name, value, onChange: event => onChange(event.target.value), required, 'aria-invalid': !!error, 'aria-describedby': error ? name + '-error' : undefined };
  return <div className="clinical-field"><label htmlFor={name}>{label}{required ? ' *' : ' (optional)'}</label>{type ? <input type={type} {...props} /> : <textarea rows={3} {...props} />}{error && <p id={name + '-error'} className="field-error">{error}</p>}</div>;
}
export default function DoctorAddRecord() {
  const { id } = useParams();
  const { state } = useLocation();
  return <RecordForm key={id + (state?.appointmentId ?? '')} id={id} selection={state} />;
}
function RecordForm({ id, selection }) {
  const context = doctorRecordService.context(id, selection);
  const [values, setValues] = useState({ diagnosis: '', notes: '', follow_up: '', encounter_at: context.appointment?.appointment_at.slice(0, 16) ?? '', prescriptions: [] });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const back = <Link className="action-link" to={`/doctor/patients/${id}`} state={selection}>Back to Patient Details</Link>;
  const update = (name, value) => setValues(previous => ({ ...previous, [name]: value }));
  function submit(event) {
    event.preventDefault();
    const result = doctorRecordService.save(id, selection, values);
    setErrors(result.errors ?? {});
    if (result.record) setSaved(result.record);
  }
  if (saved) return <div className="doctor-record-page"><h1>Medical Record Saved</h1><RecordSection title="Consultation recorded"><p role="status">The medical record and {saved.prescriptions.length} prescription(s) were saved in this mock preview. This appointment cannot receive a duplicate record.</p><p><strong>{saved.diagnosis}</strong></p><p>Mock data is kept in memory until the application reloads.</p><div className="record-actions">{back}<Link className="action-link primary-action" to={`/doctor/records/${saved.id}/certificate/new`}>Issue Medical Certificate</Link></div></RecordSection></div>;
  if (context.error) return <div className="doctor-record-page"><h1>Medical Record Unavailable</h1><RecordSection title="Unable to create a record"><p role="alert">{context.error}</p>{back}<Link className="action-link" to="/doctor/schedule">Back to Schedule</Link></RecordSection></div>;
  return <div className="doctor-record-page"><h1>Add Medical Record</h1><p>Record the details of this consultation. Fields marked * are required.</p><div className="record-form-layout"><form onSubmit={submit} noValidate>
    {Object.keys(errors).length > 0 && <p role="alert" className="field-error">{errors.form ?? 'Please correct the highlighted fields.'}</p>}
    <RecordSection title="Consultation Details"><p>{formatBookingDate(context.appointment.appointment_at.slice(0, 10))} · {context.appointment.timeLabel} · Philippine time</p><p>{context.appointment.reason}</p><p>Doctor: {context.doctor.display_name}</p><StatusBadge status={context.appointment.status} /><Field label="Encounter date/time (Philippine time)" name="encounter_at" type="datetime-local" value={values.encounter_at} onChange={value => update('encounter_at', value)} required error={errors.encounter_at} /></RecordSection>
    <RecordSection title="Clinical Information">{[['diagnosis', 'Diagnosis'], ['notes', "Doctor’s notes"], ['follow_up', 'Follow-up instructions']].map(([name, label]) => <Field key={name} name={name} label={label} value={values[name]} onChange={value => update(name, value)} required={name === 'diagnosis'} error={errors[name]} />)}</RecordSection>
    <RecordSection title="Prescriptions"><p>Optional. Add a row only when prescribing medicine.</p>{values.prescriptions.map((row, index) => <fieldset key={row.key}><legend>Prescription {index + 1}</legend>{[['medicine', 'Medicine'], ['dosage', 'Dosage'], ['instructions', 'Instructions']].map(([name, label]) => <Field key={name} type="text" name={`${name}-${index}`} label={label} required={name !== 'instructions'} value={row[name]} error={errors[`${name}-${index}`]} onChange={value => update('prescriptions', values.prescriptions.map(item => item.key === row.key ? { ...item, [name]: value } : item))} />)}<button type="button" className="action-link" onClick={() => { update('prescriptions', values.prescriptions.filter(item => item.key !== row.key)); setErrors({}); }}>Remove Prescription {index + 1}</button></fieldset>)}<button type="button" className="action-link" onClick={() => update('prescriptions', [...values.prescriptions, { key: crypto.randomUUID(), medicine: '', dosage: '', instructions: '' }])}>Add Prescription</button></RecordSection>
    <div className="record-actions"><Link className="action-link" to={`/doctor/patients/${id}`} state={selection}>Cancel</Link><button type="submit" className="action-link primary-action">Save Medical Record</button></div>
  </form><aside><RecordSection title="Patient Information"><h3>{context.patient.name}</h3><p>{context.patient.age} years old · {context.patient.sex}</p><p>{context.patient.contact_number}</p><p>Allergies: {context.patient.allergies.join(', ') || 'None reported'}</p><p>{context.patient.is_pwd ? 'PWD' : 'Not a PWD'}</p></RecordSection><p>Mock preview only. Saves last until the application reloads.</p></aside></div></div>;
}
