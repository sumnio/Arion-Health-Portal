import { useState } from 'react';
import { downloadCertificatePdf } from '../../services/certificatePdfService.js';

export default function CertificatePdfButton({ certificate }) {
  const [error, setError] = useState('');
  function download() {
    setError('');
    try { downloadCertificatePdf(certificate); }
    catch { setError('The PDF could not be generated. Please try again.'); }
  }
  return <><button type="button" className="action-link" onClick={download}>Download PDF</button>{error && <p role="alert">{error}</p>}</>;
}
