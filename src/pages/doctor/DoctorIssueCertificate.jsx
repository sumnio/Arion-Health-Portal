import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CertificatePdfPreview from '../../components/certificates/CertificatePdfPreview.jsx';
import CertificatePdfButton from '../../components/certificates/CertificatePdfButton.jsx';
import RecordSection from '../../components/records/RecordSection.jsx';
import FormField from '../../components/public/FormField.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { certificateIssuanceEnabled } from '../../config/featureConfig.js';
import { certificatePurposeOptions } from '../../services/certificateContent.js';
import { doctorApiErrorMessage, doctorApiService } from '../../services/doctorApiService.js';
import { clinicToday, formatCertificateDate, formatEncounter } from '../../services/dateTimeService.js';
import useUnsavedChangesWarning from '../../hooks/useUnsavedChangesWarning.js';
import '../../styles/doctor-certificate.css';

const initialValues = () => ({ purpose: '', custom_purpose: '', diagnosis_summary: '', recommendation: '', valid_until: '' });

export default function DoctorIssueCertificate() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [issued, setIssued] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useUnsavedChangesWarning(hasUnsavedChanges && !issued && !submitting);

  useEffect(() => {
    let active = true;
    doctorApiService.getRecord(id).then((item) => {
      if (!active) return;
      setRecord(item);
      setValues((old) => ({ ...old, diagnosis_summary: item.diagnosis.slice(0, 500) }));
    }).catch((error) => active && setLoadError(doctorApiErrorMessage(error, 'Medical record not found.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="doctor-certificate-page"><h1>Issue Medical Certificate</h1><p role="status">Loading medical record…</p></div>;
  if (loadError || !record) return <div className="doctor-certificate-page"><h1>Certificate Unavailable</h1><RecordSection title="Unable to load medical record"><p role="alert">{loadError}</p><Link className="action-link" to="/doctor/schedule">Back to Schedule</Link></RecordSection></div>;
  const patientId = record.patient?.id;
  const returnState = record.appointment_id ? { appointmentId: record.appointment_id, tab: 'consultation' } : undefined;
  const back = <Link className="action-link" to={patientId ? `/doctor/patients/${patientId}` : '/doctor/schedule'} state={returnState}>Back to Patient Details</Link>;
  if (!certificateIssuanceEnabled) return <div className="doctor-certificate-page"><h1>Medical Certificate Issuance Unavailable</h1><RecordSection title="Production safety restriction"><p role="alert">Medical certificate issuance is disabled in this environment.</p>{back}</RecordSection></div>;

  const changePurpose = (event) => {
    const purpose = event.target.value;
    setValues((previous) => ({ ...previous, purpose, custom_purpose: purpose === 'Other' ? previous.custom_purpose : '' }));
    setHasUnsavedChanges(true);
  };
  const updateValue = (name, value) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setHasUnsavedChanges(true);
  };

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!values.purpose) nextErrors.purpose = 'Select a purpose.';
    if (values.purpose === 'Other' && !values.custom_purpose.trim()) nextErrors.custom_purpose = 'Specify the certificate purpose.';
    if (!values.diagnosis_summary.trim()) nextErrors.diagnosis_summary = 'Enter a diagnosis summary.';
    if (!values.recommendation.trim()) nextErrors.recommendation = 'Enter a short recommendation.';
    if (values.valid_until && values.valid_until < clinicToday()) nextErrors.valid_until = 'Valid until must be on or after the issue date.';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setSubmitting(true); setErrors({});
    try {
      const certificate = await doctorApiService.issueCertificate(id, values, record.patientName);
      setIssued(certificate);
      setHasUnsavedChanges(false);
    }
    catch (error) { setErrors({ form: doctorApiErrorMessage(error, 'Unable to issue this certificate.') }); }
    finally { setSubmitting(false); }
  }

  return <div className="doctor-certificate-page"><h1>{issued ? 'Medical Certificate Issued' : 'Issue Medical Certificate'}</h1><p>{issued ? 'The issued certificate was reloaded from the server and is read-only.' : 'Create a concise certificate from the selected consultation. Fields marked * are required.'}</p><div className="doctor-certificate-layout"><div>
    <RecordSection title="Patient and Medical Record"><h3>{record.patientName}</h3><p>Issuing doctor: {record.doctor}</p><p>Consultation: {formatEncounter(record.appointment?.appointment_at ?? record.encounter_at)}</p><p>Diagnosis: {record.diagnosis}</p><p className="record-reference">Related medical record: {record.id}</p></RecordSection>
    {issued ? <RecordSection title="Certificate issued"><p role="status">Successfully issued. This certificate cannot be edited, deleted, or reissued here.</p><StatusBadge status="issued" /><div className="certificate-actions">{back}<CertificatePdfButton audience="doctor" certificate={{ ...issued, patientName: record.patientName }} /></div><p>The immutable PDF was generated and stored securely when this certificate was issued.</p></RecordSection> : <form onSubmit={submit} noValidate><RecordSection title="Certificate Details"><StatusBadge status="draft" />{errors.form && <p className="certificate-error" role="alert">{errors.form}</p>}
      <label htmlFor="purpose">Purpose *</label><select id="purpose" value={values.purpose} onChange={changePurpose} required><option value="">Select purpose</option>{certificatePurposeOptions.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}</select>{errors.purpose && <p className="certificate-error">{errors.purpose}</p>}
      {values.purpose === 'Other' && <div><FormField name="custom_purpose" label="Specify Purpose *" value={values.custom_purpose} required maxLength={100} onChange={(event) => updateValue('custom_purpose', event.target.value)} />{errors.custom_purpose && <p className="certificate-error">{errors.custom_purpose}</p>}</div>}
      <label htmlFor="diagnosis_summary">Diagnosis Summary *</label><textarea id="diagnosis_summary" rows={4} maxLength={500} value={values.diagnosis_summary} onChange={(event) => updateValue('diagnosis_summary', event.target.value)} /><p className="certificate-helper">Review and keep only the clinical summary needed for this certificate.</p>{errors.diagnosis_summary && <p className="certificate-error">{errors.diagnosis_summary}</p>}
      <label htmlFor="recommendation">Recommendation *</label><textarea id="recommendation" rows={4} maxLength={500} value={values.recommendation} onChange={(event) => updateValue('recommendation', event.target.value)} /><p className="certificate-helper">Keep this short and relevant to the certificate.</p>{errors.recommendation && <p className="certificate-error">{errors.recommendation}</p>}
      <div className="certificate-readonly-field"><span>Date issued</span><strong>{formatCertificateDate(clinicToday())}</strong><small>The final issue date is assigned by the server.</small></div>
      <FormField name="valid_until" label="Valid until (optional)" type="date" value={values.valid_until} min={clinicToday()} onChange={(event) => updateValue('valid_until', event.target.value)} />{errors.valid_until && <p className="certificate-error">{errors.valid_until}</p>}
      <div className="certificate-actions">{back}<button disabled={submitting} className="action-link primary-action" type="submit">{submitting ? 'Issuing…' : 'Issue Certificate'}</button></div></RecordSection></form>}
  </div><CertificatePdfPreview recordId={id} values={values} certificateId={issued?.id ?? null} /></div></div>;
}
