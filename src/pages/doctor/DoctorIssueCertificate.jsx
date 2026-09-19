import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import RecordSection from '../../components/records/RecordSection.jsx';
import FormField from '../../components/public/FormField.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { doctorCertificateService } from '../../services/doctorCertificateService.js';
import { formatEncounter } from '../../services/medicalRecordService.js';
import '../../styles/doctor-certificate.css';

function Preview({ context, values, issued }) {
  return <RecordSection title="Certificate Preview"><article className="doctor-certificate-paper"><header><h3>✚ Arion Health Clinic</h3><p>Quezon City · Mock clinic information</p></header><p className="sample-label">MOCK PREVIEW · NOT FOR OFFICIAL USE</p><h3>Medical Certificate</h3><h4>{context.patient.name}</h4><dl><dt>Purpose</dt><dd>{values.purpose || 'Enter certificate purpose'}</dd><dt>Diagnosis summary</dt><dd>{values.diagnosis_summary || 'Enter diagnosis summary'}</dd><dt>Date issued</dt><dd>{values.date_issued || '—'}</dd>{values.valid_until && <><dt>Valid until</dt><dd>{values.valid_until}</dd></>}<dt>Status</dt><dd>{issued ? 'Issued' : 'Draft'}</dd></dl><footer>{context.doctor.display_name}<p>Issuing doctor · Mock certificate</p></footer></article></RecordSection>;
}
export default function DoctorIssueCertificate() {
  const { id } = useParams();
  return <CertificateForm key={id} id={id} />;
}
function CertificateForm({ id }) {
  const context = doctorCertificateService.context(id);
  const [values, setValues] = useState({ purpose: '', diagnosis_summary: context.record?.diagnosis ?? '', date_issued: context.date ?? '', valid_until: '' });
  const [errors, setErrors] = useState({});
  const [issued, setIssued] = useState(null);
  const [requestId] = useState(() => crypto.randomUUID());
  if (context.error) return <div className="doctor-certificate-page"><h1>Certificate Unavailable</h1><RecordSection title="Unable to load medical record"><p role="alert">{context.error}</p><Link className="action-link" to="/doctor/schedule">Back to Schedule</Link></RecordSection></div>;
  const back = <Link className="action-link" to={`/doctor/patients/${context.patient.id}`}>Back to Patient Details</Link>;
  function submit(event) {
    event.preventDefault();
    if (issued) return;
    const result = doctorCertificateService.issue(id, values, requestId);
    setErrors(result.errors ?? {});
    if (result.certificate) setIssued(result.certificate);
  }
  return <div className="doctor-certificate-page"><h1>{issued ? 'Medical Certificate Issued' : 'Issue Medical Certificate'}</h1><p>{issued ? 'The certificate was issued in mock state for this preview.' : 'Create a certificate from the selected consultation. Fields marked * are required.'}</p><div className="doctor-certificate-layout"><div>
    <RecordSection title="Patient and Medical Record"><h3>{context.patient.name}</h3><p>{context.patient.age} years old · {context.patient.sex}</p><p>Issuing doctor: {context.doctor.display_name}</p><p>Consultation: {formatEncounter(context.record.encounter_at)}</p><p>Diagnosis: {context.record.diagnosis}</p><p className="record-reference">Related medical record: {context.record.id}</p></RecordSection>
    {issued ? <RecordSection title="Certificate issued"><p role="status">Successfully issued. This submission cannot create another certificate.</p><StatusBadge status="issued" /><div className="certificate-actions">{back}<button type="button" className="action-link" disabled>Download PDF</button></div><p>PDF generation will be added later.</p><p>Mock certificates remain available until the application reloads.</p></RecordSection> : <form onSubmit={submit} noValidate><RecordSection title="Certificate Details"><StatusBadge status="draft" />{Object.keys(errors).length > 0 && <p className="certificate-error" role="alert">{errors.form ?? 'Please correct the highlighted fields.'}</p>}
    { [['purpose','Purpose','text'], ['date_issued','Date issued','date'], ['valid_until','Valid until (optional)','date']].map(([name,label,type]) => <div key={name}><FormField name={name} label={label + (name !== 'valid_until' ? ' *' : '')} type={type} value={values[name]} required={name !== 'valid_until'} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? name+'-error' : undefined} onChange={event => setValues(previous => ({...previous,[name]:event.target.value}))} />{errors[name] && <p id={name+'-error'} className="certificate-error">{errors[name]}</p>}</div>)}
    <label htmlFor="diagnosis_summary">Diagnosis summary *</label><textarea id="diagnosis_summary" required rows={4} value={values.diagnosis_summary} aria-invalid={!!errors.diagnosis_summary} aria-describedby={errors.diagnosis_summary ? 'summary-error' : undefined} onChange={event => setValues(previous => ({...previous,diagnosis_summary:event.target.value}))} />{errors.diagnosis_summary && <p id="summary-error" className="certificate-error">{errors.diagnosis_summary}</p>}
    <div className="certificate-actions"><Link className="action-link" to={`/doctor/patients/${context.patient.id}`}>Cancel</Link><button className="action-link primary-action" type="submit">Issue Certificate</button></div></RecordSection></form>}
    {doctorCertificateService.list(id).length > 0 && <RecordSection title="Issued in this preview"><ul>{doctorCertificateService.list(id).map(item => <li key={item.id}>{item.purpose} · {item.date_issued} · Issued</li>)}</ul></RecordSection>}
  </div><Preview context={context} values={issued ?? values} issued={!!issued} /></div></div>;
}
