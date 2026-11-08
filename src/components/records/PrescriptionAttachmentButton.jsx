import { useState } from 'react';

function fallbackFilename(attachment) {
  if (attachment?.filename) return attachment.filename;
  if (attachment?.mime_type === 'application/pdf') return 'prescription.pdf';
  if (attachment?.mime_type === 'image/png') return 'prescription.png';
  return 'prescription.jpg';
}

export default function PrescriptionAttachmentButton({ prescription, downloadAttachment }) {
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  if (!prescription.attachment_available) return null;
  async function download() {
    setStatus('loading'); setMessage('');
    try {
      const result = await downloadAttachment(prescription.id);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fallbackFilename(prescription.attachment);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus('ready');
    } catch {
      setStatus('error');
      setMessage('This prescription attachment could not be opened.');
    }
  }
  return <>
    <button type="button" className="action-link" disabled={status === 'loading'} onClick={download}>{status === 'loading' ? 'Opening…' : 'View attachment'}</button>
    {message && <p role="alert" className="field-error">{message}</p>}
  </>;
}
