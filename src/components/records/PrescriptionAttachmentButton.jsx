import { useEffect, useState } from 'react';

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
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  if (!prescription.attachment_available) return null;
  async function load(mode) {
    setStatus(mode); setMessage('');
    try {
      const result = await downloadAttachment(prescription.id, { inline: mode === 'view' });
      const url = URL.createObjectURL(result.blob);
      if (mode === 'view') {
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
  return <>
    <div className="prescription-attachment-actions">
      <button type="button" className="action-link" disabled={status === 'view' || status === 'download'} onClick={() => load('view')}>{status === 'view' ? 'Opening…' : 'View'}</button>
      <button type="button" className="action-link" disabled={status === 'view' || status === 'download'} onClick={() => load('download')}>{status === 'download' ? 'Downloading…' : 'Download'}</button>
    </div>
    {message && <p role="alert" className="field-error">{message}</p>}
    {preview && <div className="prescription-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
      <section className="prescription-preview-dialog" role="dialog" aria-modal="true" aria-label={`Prescription attachment preview: ${preview.filename}`}>
        <header><div><h2>Prescription Attachment</h2><p>{preview.filename}</p></div><button type="button" className="prescription-preview-close" aria-label="Close prescription preview" onClick={closePreview}>×</button></header>
        {preview.mimeType === 'application/pdf'
          ? <iframe src={preview.url} title={`Preview of ${preview.filename}`} />
          : <img src={preview.url} alt={`Prescription attachment: ${preview.filename}`} />}
      </section>
    </div>}
  </>;
}
