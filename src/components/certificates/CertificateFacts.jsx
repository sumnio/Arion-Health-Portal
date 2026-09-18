import { formatCertificateDate } from '../../services/certificateService.js';

export default function CertificateFacts({ certificate }) {
  return <dl className="certificate-facts">
    <div><dt>Patient</dt><dd>{certificate.patientName}</dd></div>
    <div><dt>Issuing doctor</dt><dd>{certificate.doctor}<small>{certificate.specialty}</small></dd></div>
    <div><dt>Date issued</dt><dd>{formatCertificateDate(certificate.date_issued)}</dd></div>
    <div><dt>Valid until</dt><dd>{formatCertificateDate(certificate.valid_until)}</dd></div>
  </dl>;
}
