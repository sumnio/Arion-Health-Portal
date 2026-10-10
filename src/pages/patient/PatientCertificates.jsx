import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DateTile from '../../components/dashboard/DateTile.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { formatCertificateDate } from '../../services/dateTimeService.js';
import { paginatePatientList, PATIENT_LIST_PAGE_SIZE, patientApiErrorMessage, patientApiService } from '../../services/patientApiService.js';
import '../../styles/patient-certificates.css';

export default function PatientCertificates() {
  const [items, setItems] = useState(null); const [page, setPage] = useState(1); const [error, setError] = useState('');
  useEffect(() => { patientApiService.getCertificates().then(setItems).catch(reason => setError(patientApiErrorMessage(reason, 'Certificates were not found.'))); }, []);
  if (error) return <section className="certificate-card" role="alert"><h1>Unable to load certificates</h1><p>{error}</p></section>;
  if (!items) return <section className="certificate-card" aria-live="polite"><h1>Loading certificates…</h1></section>;
  const certificatePage = paginatePatientList(items, page);
  return <div className="patient-certificates"><header className="certificates-heading"><h1>My Certificates</h1><p>View medical certificates issued by your clinic.</p></header><div className="certificates-layout"><section><p className="certificate-count">{items.length} issued {items.length === 1 ? 'certificate' : 'certificates'} · Most recent first</p><div className="certificate-list">{certificatePage.items.map(item => <article className="certificate-card certificate-list-item" key={item.id}><DateTile value={item.date_issued + 'T00:00:00+08:00'} /><div className="certificate-list-copy"><h2>{item.purpose}</h2><StatusBadge status={item.status} /><p><strong>{item.doctor}</strong><br />{item.specialty}</p><p>Issued {formatCertificateDate(item.date_issued)}<br />Valid until: {formatCertificateDate(item.valid_until)}</p></div><Link className="action-link" to={'/patient/certificates/' + item.id}>View Certificate →</Link></article>)}</div>{items.length > PATIENT_LIST_PAGE_SIZE && <nav className="certificate-pagination" aria-label="Medical certificate pages"><button type="button" className="action-link" disabled={certificatePage.page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {certificatePage.page} of {certificatePage.pageCount}</span><button type="button" className="action-link" disabled={certificatePage.page === certificatePage.pageCount} onClick={() => setPage(value => Math.min(certificatePage.pageCount, value + 1))}>Next</button></nav>}{!items.length && <div className="certificate-card"><h2>No issued certificates yet</h2><p>Your certificates will appear here once issued by your doctor.</p></div>}</section><aside className="certificate-card"><h2>About Medical Certificates</h2><p>Certificates are read-only after your doctor issues them.</p><p>Open an issued certificate to view or download its PDF.</p></aside></div></div>;
}
