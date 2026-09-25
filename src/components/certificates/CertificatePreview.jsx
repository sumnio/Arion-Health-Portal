import { formatCertificateDate } from '../../services/dateTimeService.js';

export default function CertificatePreview({ certificate }) {
  return <article className="certificate-paper" aria-label="Medical certificate preview">
    <header><span className="certificate-cross" aria-hidden="true">✚</span><div><h3>{certificate.clinic.name}</h3><p>{certificate.clinic.location}</p></div></header>
    <p className="certificate-sample">ISSUED · READ-ONLY PREVIEW</p>
    <h3 className="certificate-paper-title">Medical Certificate</h3>
    <p className="certificate-number">Certificate No. {certificate.medical_certificate_number}</p>
    <p className="certificate-patient-label">Patient</p><p className="certificate-patient-name">{certificate.patientName}</p>
    <dl><div><dt>Purpose</dt><dd>{certificate.purpose}</dd></div><div><dt>Diagnosis summary</dt><dd>{certificate.diagnosis_summary}</dd></div><div><dt>Date issued</dt><dd>{formatCertificateDate(certificate.date_issued)}</dd></div>{certificate.valid_until && <div><dt>Valid until</dt><dd>{formatCertificateDate(certificate.valid_until)}</dd></div>}<div><dt>Status</dt><dd>Issued</dd></div></dl>
    <footer><div className="certificate-signature" aria-label={certificate.signature_available ? 'Doctor signature on file' : 'Doctor signature unavailable'}>{certificate.signature_available ? certificate.doctor : 'Signature unavailable'}</div><strong>{certificate.doctor}</strong><span>{certificate.specialty}</span><span>License No. {certificate.license_number} · PTR No. {certificate.ptr_number}</span><span>Issuing doctor</span></footer>
  </article>;
}
