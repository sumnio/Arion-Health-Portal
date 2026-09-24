import { formatCertificateDate } from '../../services/certificateService.js';

export default function CertificateFacts({ certificate }) {
  return <dl className="certificate-facts">
    <div><dt>Certificate number</dt><dd>{certificate.medical_certificate_number}</dd></div>
    <div><dt>Patient</dt><dd>{certificate.patientName}</dd></div>
    <div><dt>Issuing doctor</dt><dd>{certificate.doctor}<small>{certificate.specialty}</small></dd></div>
    <div><dt>License number</dt><dd>{certificate.license_number}</dd></div>
    <div><dt>PTR number</dt><dd>{certificate.ptr_number}</dd></div>
    <div><dt>Doctor signature</dt><dd>{certificate.signature_available ? 'Signature on file' : 'Not available'}</dd></div>
    <div><dt>Date issued</dt><dd>{formatCertificateDate(certificate.date_issued)}</dd></div>
    <div><dt>Valid until</dt><dd>{formatCertificateDate(certificate.valid_until)}</dd></div>
  </dl>;
}
