import { useState } from 'react';
import { downloadCertificatePdf } from '../../services/certificatePdfService.js';
import { patientApiService } from '../../services/patientApiService.js';
import { doctorApiService } from '../../services/doctorApiService.js';

export default function CertificatePdfButton({ certificate, audience = 'patient' }) {
  const [error, setError] = useState('');
  async function download() {
    setError('');
    try { await downloadCertificatePdf(certificate, audience === 'doctor' ? doctorApiService.downloadCertificatePdf : patientApiService.downloadCertificatePdf); }
    catch { setError('The PDF could not be downloaded. Please try again.'); }
  }
  return <><button type="button" className="action-link" onClick={download}>Download PDF</button>{error && <p role="alert">{error}</p>}</>;
}
