import { useEffect, useState } from 'react';
import {
  formatSupportingDocumentSize,
  patientSupportingDocumentService,
  supportingDocumentTypeLabel,
} from '../../services/patientSupportingDocumentApiService.js';
import '../../styles/supporting-documents.css';

function formatUploadedAt(value) {
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export default function SupportingDocumentList({ appointmentId, title, emptyMessage }) {
  const [documents, setDocuments] = useState([]); const [status, setStatus] = useState('loading'); const [message, setMessage] = useState(''); const [downloadingId, setDownloadingId] = useState(null);
  useEffect(() => {
    let active = true;
    if (!appointmentId) { setDocuments([]); setStatus('ready'); return () => { active = false; }; }
    setStatus('loading');
    patientSupportingDocumentService.listMySupportingDocuments(appointmentId).then((items) => { if (active) { setDocuments(items); setStatus('ready'); } }).catch(() => { if (active) { setStatus('error'); setMessage('Supporting documents are temporarily unavailable.'); } });
    return () => { active = false; };
  }, [appointmentId]);
  async function download(documentItem) {
    setDownloadingId(documentItem.id); setMessage('');
    try { const result = await patientSupportingDocumentService.downloadMySupportingDocument(appointmentId, documentItem.id); downloadBlob(result.blob, documentItem.filename); }
    catch { setMessage('This supporting document could not be downloaded.'); }
    finally { setDownloadingId(null); }
  }
  return <section className="supporting-documents-panel"><h2>{title}</h2>{status === 'loading' && <p aria-live="polite">Loading supporting documents…</p>}{status === 'error' && <p role="alert">{message}</p>}{status === 'ready' && documents.length === 0 && <p>{emptyMessage}</p>}{status === 'ready' && documents.length > 0 && <ul className="supporting-document-list">{documents.map((documentItem) => <li key={documentItem.id}><span className="supporting-document-type" aria-hidden="true">{supportingDocumentTypeLabel(documentItem.filename)}</span><span className="supporting-document-copy"><strong>{documentItem.filename}</strong><small>{formatSupportingDocumentSize(documentItem.size)} · Uploaded {formatUploadedAt(documentItem.uploadedAt)}</small></span><button type="button" className="action-link" disabled={downloadingId === documentItem.id} onClick={() => download(documentItem)}>{downloadingId === documentItem.id ? 'Preparing…' : 'View / Download'}</button></li>)}</ul>}{message && status !== 'error' && <p role="alert">{message}</p>}</section>;
}
