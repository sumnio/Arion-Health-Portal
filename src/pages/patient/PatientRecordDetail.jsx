import { Link, useParams } from 'react-router-dom';
import DateTile from '../../components/dashboard/DateTile.jsx';
import RecordSection from '../../components/records/RecordSection.jsx';
import { medicalRecordService, formatEncounter } from '../../services/medicalRecordService.js';
import '../../styles/patient-records.css';

export default function PatientRecordDetail() {
  const { id } = useParams();
  const record = medicalRecordService.get(id);
  return <div className="patient-records">
    <Link className="record-back" to="/patient/records">← Back to My Records</Link>
    <header className="records-heading"><h1>Medical Record Details</h1><p>View your consultation, diagnosis, prescriptions, and doctor’s notes.</p></header>
    {!record ? <RecordSection title="Medical record not found"><p>This medical record isn’t available in the current mock data.</p><Link className="action-link" to="/patient/records">View My Records</Link></RecordSection> : <div className="records-layout"><div className="record-detail-sections">
      <section className="record-card record-summary" aria-label="Consultation details"><DateTile value={record.encounter_at} /><div><h2>{record.visitType}</h2><p><strong>{record.doctor}</strong><br />{record.specialty}</p><p><time dateTime={record.encounter_at}>{formatEncounter(record.encounter_at)}</time><br />Philippine time</p><p>Arion Health Clinic</p></div></section>
      <RecordSection title="Diagnosis"><p className="record-callout">{record.diagnosis}</p></RecordSection>
      <RecordSection title="Prescriptions">{record.prescriptions.length ? <ul className="record-prescriptions">{record.prescriptions.map(item => <li key={item.id}><h3>{item.medicine}</h3><dl><div><dt>Dosage</dt><dd>{item.dosage}</dd></div><div><dt>Instructions</dt><dd>{item.instructions || 'No additional instructions recorded.'}</dd></div></dl></li>)}</ul> : <p>No prescriptions recorded for this visit.</p>}</RecordSection>
      <RecordSection title="Doctor’s Notes"><p className="record-callout">{record.notes || 'No doctor’s notes recorded for this visit.'}</p></RecordSection>
      <RecordSection title="Follow-up Instructions"><p>{record.follow_up || 'No follow-up instructions recorded for this visit.'}</p></RecordSection>
    </div><aside className="record-detail-sections">
      {record.certificates.length > 0 && <RecordSection title="Related Documents">{record.certificates.map(certificate => <Link className="record-certificate" key={certificate.id} to={'/patient/certificates/' + certificate.id}><strong>Medical Certificate</strong><span>{certificate.purpose}</span><span>Issued {new Date(certificate.date_issued + 'T00:00:00+08:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' })}</span><span>View Certificate →</span></Link>)}</RecordSection>}
      <RecordSection title="About This Record"><p>This is a read-only medical record created at Arion Health Clinic.</p><p className="record-mock-note">Mock medical information for demonstration only.</p></RecordSection>
    </aside></div>}
  </div>;
}
