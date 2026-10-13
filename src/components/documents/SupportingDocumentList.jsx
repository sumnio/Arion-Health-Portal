import { useEffect, useRef, useState } from 'react';
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

export default function SupportingDocumentList({ appointmentId, title, emptyMessage, documentService = patientSupportingDocumentService, loadErrorMessage = 'Supporting documents are temporarily unavailable.' }) {
  const [documents, setDocuments] = useState([]); const [status, setStatus] = useState('loading'); const [message, setMessage] = useState(''); const [openingId, setOpeningId] = useState(null); const [preview, setPreview] = useState(null); const closeButtonRef = useRef(null); const triggerRef = useRef(null);
  useEffect(() => {
    let active = true;
    if (!appointmentId) { setDocuments([]); setStatus('ready'); return () => { active = false; }; }
    setStatus('loading'); setMessage('');
    documentService.listSupportingDocuments(appointmentId).then((items) => { if (active) { setDocuments(items); setStatus('ready'); } }).catch(() => { if (active) { setDocuments([]); setStatus('error'); setMessage(loadErrorMessage); } });
    return () => { active = false; };
  }, [appointmentId, documentService, loadErrorMessage]);
  useEffect(() => {
    if (!preview) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setPreview(null); };
    document.addEventListener('keydown', closeOnEscape);
    closeButtonRef.current?.focus();
    return () => { document.removeEventListener('keydown', closeOnEscape); URL.revokeObjectURL(preview.url); triggerRef.current?.focus(); };
  }, [preview]);
  async function open(documentItem, trigger) {
    setOpeningId(documentItem.id); setMessage(''); triggerRef.current = trigger;
    try { const result = await documentService.downloadSupportingDocument(appointmentId, documentItem.id); setPreview({ documentItem, url: URL.createObjectURL(result.blob) }); }
    catch { setMessage('This supporting document could not be opened.'); }
    finally { setOpeningId(null); }
  }
  const isPdf = preview?.documentItem.mimeType === 'application/pdf';
  return <section className="supporting-documents-panel">{title && <h2>{title}</h2>}{status === 'loading' && <p aria-live="polite">Loading supporting documents…</p>}{status === 'error' && <p role="alert">{message}</p>}{status === 'ready' && documents.length === 0 && <p>{emptyMessage}</p>}{status === 'ready' && documents.length > 0 && <ul className="supporting-document-list">{documents.map((documentItem) => <li key={documentItem.id}><span className="supporting-document-type" aria-hidden="true">{supportingDocumentTypeLabel(documentItem.filename)}</span><span className="supporting-document-copy"><strong>{documentItem.filename}</strong><small>{formatSupportingDocumentSize(documentItem.size)} · Uploaded {formatUploadedAt(documentItem.uploadedAt)}</small></span><button type="button" className="action-link" disabled={openingId === documentItem.id} onClick={(event) => open(documentItem, event.currentTarget)}>{openingId === documentItem.id ? 'Opening…' : 'View'}</button></li>)}</ul>}{message && status !== 'error' && <p role="alert">{message}</p>}{preview && <div className="supporting-document-viewer" role="dialog" aria-modal="true" aria-labelledby="supporting-document-viewer-title"><header><button ref={closeButtonRef} type="button" className="supporting-document-viewer-close" aria-label="Close document viewer" onClick={() => setPreview(null)}>×</button><h2 id="supporting-document-viewer-title">{preview.documentItem.filename}</h2></header><div className="supporting-document-viewer-content">{isPdf ? <object data={`${preview.url}#toolbar=0&navpanes=0&scrollbar=1`} type="application/pdf" aria-label={preview.documentItem.filename}><p>This PDF cannot be displayed in your browser.</p></object> : <img src={preview.url} alt={preview.documentItem.filename} />}</div></div>}</section>;
}
