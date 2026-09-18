import { Link } from 'react-router-dom';
import DateTile from '../../components/dashboard/DateTile.jsx';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import { certificateService, formatCertificateDate } from '../../services/certificateService.js';
import '../../styles/patient-certificates.css';

export default function PatientCertificates() {
  const certificates = certificateService.list();
  return <div className="patient-certificates">
    <header className="certificates-heading"><h1>My Certificates</h1><p>View medical certificates issued by your clinic.</p></header>
    <div className="certificates-layout"><section aria-label="Issued medical certificates">
      <p className="certificate-count">{certificates.length} issued certificates · Most recent first</p>
      <div className="certificate-list">{certificates.map(item => <article className="certificate-card certificate-list-item" key={item.id}>
        <DateTile value={item.date_issued + 'T00:00:00+08:00'} />
        <div className="certificate-list-copy"><h2>{item.purpose}</h2><StatusBadge status={item.status} /><p><strong>{item.doctor}</strong><br />{item.specialty}</p><p>Issued {formatCertificateDate(item.date_issued)}<br />Valid until: {formatCertificateDate(item.valid_until)}</p></div>
        <Link className="action-link" to={'/patient/certificates/' + item.id} aria-label={'View Certificate: ' + item.purpose + ', ' + formatCertificateDate(item.date_issued)}>View Certificate →</Link>
      </article>)}</div>
      {!certificates.length && <div className="certificate-card"><h2>No issued certificates yet</h2><p>Your certificates will appear here once issued by your doctor.</p></div>}
    </section><aside className="certificate-card"><h2>About Medical Certificates</h2><p>Certificates are issued by your doctor. You can view the purpose, issuing details, and related medical record here.</p><p className="certificate-note">Mock data only. PDF generation will be added later.</p></aside></div>
  </div>;
}
