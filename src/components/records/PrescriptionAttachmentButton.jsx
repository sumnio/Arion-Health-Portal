import { useEffect, useRef, useState } from 'react';

const focusableSelector = 'button:not([disabled]), iframe, [href], [tabindex]:not([tabindex="-1"])';

function fallbackFilename(attachment) {
  if (attachment?.filename) return attachment.filename;
  if (attachment?.mime_type === 'application/pdf') return 'prescription.pdf';
  if (attachment?.mime_type === 'image/png') return 'prescription.png';
  return 'prescription.jpg';
}

export default function PrescriptionAttachmentButton({ prescription, downloadAttachment }) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => {
    if (!preview) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPreview(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [preview]);
  if (!prescription.attachment_available) return null;
  async function load(mode, trigger) {
    setStatus(mode); setMessage('');
    try {
      const result = await downloadAttachment(prescription.id, { inline: mode === 'view' });
      const url = URL.createObjectURL(result.blob);
      if (mode === 'view') {
        triggerRef.current = trigger;
        setPreview({ url, mimeType: result.contentType || prescription.attachment?.mime_type, filename: fallbackFilename(prescription.attachment) });
        setStatus('idle');
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackFilename(prescription.attachment);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus('idle');
    } catch {
      setStatus('error');
      setMessage('This prescription attachment could not be opened. Please try again.');
    }
  }
  function closePreview() {
    setPreview(null);
  }
  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll(focusableSelector)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <>
    <div className="prescription-attachment-actions">
      <button type="button" className="action-link" disabled={status === 'view' || status === 'download'} onClick={(event) => load('view', event.currentTarget)}>{status === 'view' ? 'Opening…' : 'View'}</button>
      <button type="button" className="action-link" disabled={status === 'view' || status === 'download'} onClick={() => load('download')}>{status === 'download' ? 'Downloading…' : 'Download'}</button>
    </div>
    {message && <p role="alert" className="field-error">{message}</p>}
    {preview && <div className="prescription-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
      <section ref={dialogRef} className="prescription-preview-dialog" role="dialog" aria-modal="true" aria-label={`Prescription attachment preview: ${preview.filename}`} aria-describedby="prescription-preview-filename" onKeyDown={trapFocus}>
        <header><div><h2 id="prescription-preview-title">Prescription Attachment</h2><p id="prescription-preview-filename">{preview.filename}</p></div><button ref={closeButtonRef} type="button" className="prescription-preview-close" aria-label="Close prescription preview" onClick={closePreview}>×</button></header>
        {preview.mimeType === 'application/pdf'
          ? <iframe src={preview.url} title={`Preview of ${preview.filename}`} />
          : <img src={preview.url} alt={`Prescription attachment: ${preview.filename}`} />}
      </section>
    </div>}
  </>;
}
