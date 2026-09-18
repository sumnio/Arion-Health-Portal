import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../../components/dashboard/StatusBadge.jsx';
import CertificateFacts from '../../components/certificates/CertificateFacts.jsx';
import CertificatePreview from '../../components/certificates/CertificatePreview.jsx';
import { certificateService } from '../../services/certificateService.js';
import { formatEncounter } from '../../services/medicalRecordService.js';
import '../../styles/patient-certificates.css';

export default function PatientCertificateDetail() {
  const { id } = useParams();
  const certificate = certificateService.get(id);
  return <div className="patient-certificates">
    <Link className="certificate-back" to="/patient/certificates">← Back to My Certificates</Link>
    <header className="certificates-heading"><h1>Certificate Details</h1><p>View the details of your issued medical certificate.</p></header>
    {!certificate ? <section className="certificate-card"><h2>Certificate not found</h2><p>This issued certificate isn’t available in the current mock data.</p><Link className="action-link" to="/patient/certificates">View My Certificates</Link></section> : <div className="certificates-layout"><div className="certificate-sections">
      <section className="certificate-card" aria-label="Certificate information"><div className="certificate-title"><h2>{certificate.purpose}</h2><StatusBadge status={certificate.status} /></div><p>Medical Certificate</p><CertificateFacts certificate={certificate} /></section>
      <section className="certificate-card" aria-labelledby="certificate-preview-title"><h2 id="certificate-preview-title">Certificate Preview</h2><CertificatePreview certificate={certificate} /><div className="certificate-download"><button type="button" className="action-link" disabled aria-describedby="pdf-message">Download PDF</button><p id="pdf-message">PDF generation will be added later.</p></div></section>
    </div><aside className="certificate-sections">
      <section className="certificate-card"><h2>Related Medical Record</h2>{certificate.relatedRecord ? <Link className="certificate-related" to={'/patient/records/' + certificate.relatedRecord.id}><strong>{certificate.relatedRecord.visitType}</strong><span>{formatEncounter(certificate.relatedRecord.encounter_at)} · Philippine time</span><span>View Record →</span></Link> : <p>No medical record is linked to this certificate.</p>}</section>
      <section className="certificate-card"><h2>About This Preview</h2><p>This read-only preview uses mock clinic and patient information.</p><p>It is not an official medical certificate.</p></section>
    </aside></div>}
  </div>;
}
