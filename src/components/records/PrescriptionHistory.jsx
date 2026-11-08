import { Link } from 'react-router-dom';
import { formatEncounter } from '../../services/dateTimeService.js';
import PrescriptionAttachmentButton from './PrescriptionAttachmentButton.jsx';
import RecordSection from './RecordSection.jsx';
import '../../styles/prescription-history.css';

function visitLabel(value) {
  return ({ general_consultation: 'General Consultation', follow_up: 'Follow-up', check_up: 'Check-up' })[value] ?? 'Consultation';
}

export default function PrescriptionHistory({
  items,
  pagination,
  status = 'ready',
  error = '',
  emptyMessage,
  downloadAttachment,
  onPage,
  onRetry,
  showDoctor = false,
  linkRecords = false,
}) {
  return <RecordSection title="Prescriptions">
    <p>Issued prescriptions are read-only. Attachments are available only through secure View and Download actions.</p>
    {status === 'loading' && <p role="status">Loading prescriptions…</p>}
    {status === 'error' && <div role="alert"><p>{error}</p><button type="button" className="action-link" onClick={onRetry}>Retry</button></div>}
    {status === 'ready' && <>
      <p className="prescription-history-count" role="status">{pagination.total} {pagination.total === 1 ? 'prescription' : 'prescriptions'} · Most recent first</p>
      {items.length ? <div className="prescription-history-list">{items.map((item) => {
        const record = item.medical_record;
        const appointment = record?.appointment;
        return <article className="prescription-history-item" key={item.id}>
          <div className="prescription-history-heading"><div><h3>{item.medicine || 'Attached prescription'}</h3><span className="prescription-issued-status">Issued · Read-only</span></div>{item.attachment_available && <span className="prescription-attachment-indicator">Attachment available</span>}</div>
          <dl>
            <div><dt>Issue date</dt><dd>{formatEncounter(item.issued_at)}</dd></div>
            {showDoctor && <div><dt>Doctor</dt><dd>{item.doctor?.display_name || 'Doctor unavailable'}{item.doctor?.specialty ? ` · ${item.doctor.specialty}` : ''}</dd></div>}
            {appointment?.appointment_at && <div><dt>Linked appointment</dt><dd>{formatEncounter(appointment.appointment_at)} · {visitLabel(appointment.visit_type)}</dd></div>}
            <div><dt>Medical Record</dt><dd>{record ? (linkRecords ? <Link to={`/patient/records/${record.id}`}>View linked Medical Record</Link> : `Linked visit from ${formatEncounter(record.encounter_at)}`) : 'Record unavailable'}</dd></div>
            {item.medicine && <div><dt>Medicine</dt><dd>{item.medicine}</dd></div>}
            {item.dosage && <div><dt>Dosage</dt><dd>{item.dosage}</dd></div>}
            {item.instructions && <div><dt>Instructions</dt><dd>{item.instructions}</dd></div>}
          </dl>
          {item.attachment_available && <PrescriptionAttachmentButton prescription={item} downloadAttachment={downloadAttachment} />}
        </article>;
      })}</div> : <p>{emptyMessage}</p>}
      {pagination.pageCount > 1 && <nav className="prescription-history-pagination" aria-label="Prescription history pages"><button type="button" className="action-link" disabled={pagination.page === 1} onClick={() => onPage(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.pageCount}</span><button type="button" className="action-link" disabled={pagination.page === pagination.pageCount} onClick={() => onPage(pagination.page + 1)}>Next</button></nav>}
    </>}
  </RecordSection>;
}
