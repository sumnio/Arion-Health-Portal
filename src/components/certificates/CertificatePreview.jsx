import { formatCertificateDate } from '../../services/certificateService.js';

export default function CertificatePreview({ certificate }) {
  return <article className="certificate-paper" aria-label="Mock medical certificate preview">
    <header><span className="certificate-cross" aria-hidden="true">✚</span><div><h3>{certificate.clinic.name}</h3><p>{certificate.clinic.address}</p></div></header>
    <p className="certificate-sample">MOCK PREVIEW · NOT FOR OFFICIAL USE</p>
    <h3 className="certificate-paper-title">Medical Certificate</h3>
    <p className="certificate-patient-label">Patient</p><p className="certificate-patient-name">{certificate.patientName}</p>
    <dl><div><dt>Purpose</dt><dd>{certificate.purpose}</dd></div><div><dt>Diagnosis summary</dt><dd>{certificate.diagnosis_summary}</dd></div><div><dt>Date issued</dt><dd>{formatCertificateDate(certificate.date_issued)}</dd></div>{certificate.valid_until && <div><dt>Valid until</dt><dd>{formatCertificateDate(certificate.valid_until)}</dd></div>}<div><dt>Status</dt><dd>Issued</dd></div></dl>
    <footer><strong>{certificate.doctor}</strong><span>{certificate.specialty}</span><span>Issuing doctor · Mock certificate</span></footer>
  </article>;
}
