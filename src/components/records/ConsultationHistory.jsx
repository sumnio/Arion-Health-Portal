import { useState } from 'react';
import RecordSection from '../records/RecordSection.jsx';
import CertificatePreview from '../certificates/CertificatePreview.jsx';
import StatusBadge from '../dashboard/StatusBadge.jsx';
import { formatCertificateDate, formatEncounter } from '../../services/dateTimeService.js';

export default function ConsultationHistory({ records, certificates }) {
  const [recordLimit, setRecordLimit] = useState(5);
  const [certificateLimit, setCertificateLimit] = useState(5);
  return <>
    <RecordSection title="Consultation History"><p>Saved medical records are read-only.</p>{records.length ? records.slice(0, recordLimit).map(record => <details className="history-disclosure" key={record.id}><summary><time dateTime={record.encounter_at}>{formatEncounter(record.encounter_at)}</time><strong>{record.diagnosis}</strong><span>View record</span></summary><div className="history-content"><p>Doctor: {record.doctor}</p>{record.notes && <><h3>Doctor’s notes</h3><p className="clinical-text">{record.notes}</p></>}{record.follow_up && <><h3>Follow-up instructions</h3><p className="clinical-text">{record.follow_up}</p></>}
      <h3>Related appointment</h3>{record.appointment ? <><p>{formatEncounter(record.appointment.appointment_at)} · {record.appointment.reason}</p><StatusBadge status={record.appointment.status} /></> : <p>{record.appointment_id ? 'Appointment details are unavailable.' : 'No linked appointment (manual record).'}</p>}
      <h3>Prescriptions</h3>{record.prescriptions.length ? <ul className="history-prescriptions">{record.prescriptions.map(item => <li key={item.id}><strong>{item.medicine}</strong><p>{item.dosage}</p>{item.instructions && <p>{item.instructions}</p>}</li>)}</ul> : <p>No prescriptions recorded.</p>}
    </div></details>) : <p>No medical records available.</p>}{records.length > 0 && <p role="status">Showing {Math.min(recordLimit, records.length)} of {records.length} consultations</p>}{recordLimit < records.length && <button type="button" className="action-link" onClick={() => setRecordLimit(limit => limit + 5)}>Load more consultations</button>}</RecordSection>
    <RecordSection title="Medical Certificates"><p>Issued certificates are read-only.</p>{certificates.length ? certificates.slice(0, certificateLimit).map(certificate => <details className="history-disclosure" key={certificate.id}><summary><strong>{certificate.purpose}</strong><span>{formatCertificateDate(certificate.date_issued)} · {certificate.doctor}</span><StatusBadge status={certificate.status} /><span>View certificate</span></summary><CertificatePreview certificate={certificate} /></details>) : <p>No issued certificates linked to this patient’s records.</p>}{certificates.length > 0 && <p role="status">Showing {Math.min(certificateLimit, certificates.length)} of {certificates.length} certificates</p>}{certificateLimit < certificates.length && <button type="button" className="action-link" onClick={() => setCertificateLimit(limit => limit + 5)}>Load more certificates</button>}</RecordSection>
  </>;
}
