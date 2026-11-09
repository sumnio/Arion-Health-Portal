import { useState } from 'react';
import RecordSection from '../records/RecordSection.jsx';
import CertificatePdfPreview from '../certificates/CertificatePdfPreview.jsx';
import StatusBadge from '../dashboard/StatusBadge.jsx';
import { formatCertificateDate, formatEncounter } from '../../services/dateTimeService.js';
import PrescriptionAttachmentButton from './PrescriptionAttachmentButton.jsx';
import { doctorApiService } from '../../services/doctorApiService.js';

const certificateFilters = ['all', 'active', 'expired'];
const certificateEmpty = {
  all: 'No certificates have been issued for this Patient.',
  active: 'No active certificates.',
  expired: 'No expired certificates.',
};

function DoctorCertificateDisclosure({ certificate }) {
  const [open, setOpen] = useState(false);
  const validUntil = certificate.valid_until ? formatCertificateDate(certificate.valid_until) : 'No validity date recorded';
  return <details className="history-disclosure certificate-history-item" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>
      <strong>{certificate.purpose}</strong>
      <span>Certificate no. {certificate.medical_certificate_number}</span>
      <span>Issued {formatCertificateDate(certificate.date_issued)} · Valid until: {validUntil}</span>
      <StatusBadge status={certificate.validity_status ?? certificate.status} />
      <span>View Certificate</span>
    </summary>
    {open && <div className="history-content certificate-history-content">
      <p>This issued certificate is read-only. If another valid document is needed, issue a new certificate.</p>
      <CertificatePdfPreview certificateId={certificate.id} bare hideToolbar />
    </div>}
  </details>;
}

export default function ConsultationHistory({ records, certificates, section = 'all', certificateFilter = 'all', certificatePagination = { page: 1, pageCount: 1, total: 0 }, certificateStatus = 'ready', certificateError = '', onCertificateFilter, onCertificatePage, onCertificateRetry }) {
  const [recordLimit, setRecordLimit] = useState(5);
  return <>
    {section !== 'certificates' && <RecordSection title="Medical Records"><p>Saved medical records are read-only.</p>{records.length ? records.slice(0, recordLimit).map(record => <details className="history-disclosure" key={record.id}><summary><time dateTime={record.encounter_at}>{formatEncounter(record.encounter_at)}</time><strong>{record.diagnosis}</strong><span>View record</span></summary><div className="history-content"><p>Doctor: {record.doctor}</p>{record.notes && <><h3>Doctor’s notes</h3><p className="clinical-text">{record.notes}</p></>}{record.follow_up && <><h3>Follow-up instructions</h3><p className="clinical-text">{record.follow_up}</p></>}{record.follow_up_required ? <><h3>Follow-up recommendation</h3><p className="clinical-text">Recommended {record.follow_up_recommended_date}: {record.follow_up_reason}</p><p>{record.follow_up_appointment && ['pending', 'confirmed'].includes(record.follow_up_appointment.status) ? 'Follow-up appointment scheduled.' : 'Not yet scheduled.'}</p></> : <p>No follow-up recommended.</p>}
      <h3>Related appointment</h3>{record.appointment ? <><p>{formatEncounter(record.appointment.appointment_at)} · {record.appointment.reason}</p><StatusBadge status={record.appointment.status} /></> : <p>{record.appointment_id ? 'Appointment details are unavailable.' : 'No linked appointment (manual record).'}</p>}
      <h3>Prescriptions</h3>{record.prescriptions.length ? <ul className="history-prescriptions">{record.prescriptions.map(item => <li key={item.id}><strong>{item.medicine || 'Attached prescription'}</strong>{item.dosage && <p>{item.dosage}</p>}{item.instructions && <p>{item.instructions}</p>}<PrescriptionAttachmentButton prescription={item} downloadAttachment={doctorApiService.downloadPrescriptionAttachment} /></li>)}</ul> : <p>No prescriptions recorded.</p>}
    </div></details>) : <p>No medical records found.</p>}{records.length > 0 && <p role="status">Showing {Math.min(recordLimit, records.length)} of {records.length} consultations</p>}{recordLimit < records.length && <button type="button" className="action-link" onClick={() => setRecordLimit(limit => limit + 5)}>Load more consultations</button>}</RecordSection>}
    {section !== 'records' && <RecordSection title="Medical Certificates">
      <p>Issued certificates are read-only. Use All, Active, or Expired to review them.</p>
      <div className="certificate-history-filters" role="group" aria-label="Filter medical certificates by validity">
        {certificateFilters.map((filter) => <button key={filter} type="button" className="action-link" aria-pressed={certificateFilter === filter} disabled={certificateStatus === 'loading'} onClick={() => onCertificateFilter?.(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</button>)}
      </div>
      {certificateStatus === 'loading' && <p role="status">Loading certificates…</p>}
      {certificateStatus === 'error' && <div role="alert"><p>{certificateError}</p><button type="button" className="action-link" onClick={onCertificateRetry}>Retry</button></div>}
      {certificateStatus === 'ready' && <>{certificates.map((certificate) => <DoctorCertificateDisclosure key={certificate.id} certificate={certificate} />)}{certificates.length === 0 && <p>{certificateEmpty[certificateFilter]}</p>}
        {certificatePagination.total > 0 && <p role="status">Showing {certificates.length} of {certificatePagination.total} certificates</p>}
        {certificatePagination.pageCount > 1 && <nav className="certificate-history-pagination" aria-label="Doctor certificate pages"><button type="button" className="action-link" disabled={certificatePagination.page === 1} onClick={() => onCertificatePage?.(certificatePagination.page - 1)}>Previous</button><span>Page {certificatePagination.page} of {certificatePagination.pageCount}</span><button type="button" className="action-link" disabled={certificatePagination.page === certificatePagination.pageCount} onClick={() => onCertificatePage?.(certificatePagination.page + 1)}>Next</button></nav>}
      </>}
    </RecordSection>}
  </>;
}
