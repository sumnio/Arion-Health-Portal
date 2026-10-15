import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiErrorMessage } from '../../services/apiClient.js';
import {
  doctorSignatureApiService,
  validateDoctorSignatureSelection,
} from '../../services/doctorSignatureApiService.js';
import '../../styles/doctor-profile.css';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value));
}

export default function DoctorProfile({ signatureService = doctorSignatureApiService }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const previewRef = useRef('');
  const [status, setStatus] = useState({ configured: false });
  const [previewUrl, setPreviewUrl] = useState('');
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function replacePreview(url) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreviewUrl(url);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await signatureService.getStatus();
        if (!active) return;
        setStatus(next);
        if (next.configured) {
          const url = URL.createObjectURL(await signatureService.getPreview());
          if (active) replacePreview(url);
          else URL.revokeObjectURL(url);
        }
      } catch (loadError) {
        if (active) setError(apiErrorMessage(loadError, { fallback: 'Certificate signature details could not be loaded.' }));
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; if (previewRef.current) URL.revokeObjectURL(previewRef.current); };
  }, []);

  function choose(event) {
    const file = event.target.files?.[0] ?? null;
    setSelected(file);
    setMessage('');
    setError(validateDoctorSignatureSelection(file));
  }

  async function submit(event) {
    event.preventDefault();
    const selectionError = validateDoctorSignatureSelection(selected);
    if (selectionError) return setError(selectionError);
    setSaving(true); setError(''); setMessage('');
    try {
      const next = await signatureService.upload(selected);
      setStatus(next);
      replacePreview(URL.createObjectURL(await signatureService.getPreview()));
      setSelected(null);
      if (inputRef.current) inputRef.current.value = '';
      setMessage('Certificate signature saved securely.');
    } catch (uploadError) {
      setError(apiErrorMessage(uploadError, { fallback: 'The signature could not be saved. Please try again.' }));
    } finally { setSaving(false); }
  }

  return <div className="doctor-profile-page">
    <header><h1>My Profile</h1><p>View your Doctor account and manage your certificate signature.</p></header>
    <section className="doctor-profile-card" aria-labelledby="doctor-account-heading">
      <h2 id="doctor-account-heading">Doctor Account</h2>
      <dl><dt>Name</dt><dd>{user?.display_name ?? 'Doctor'}</dd><dt>Role</dt><dd>Doctor</dd></dl>
    </section>
    <section className="doctor-profile-card signature-card" aria-labelledby="signature-heading">
      <h2 id="signature-heading">Certificate Signature</h2>
      <p>Upload your own signature as a PNG image. A transparent background is recommended.</p>
      <p className="signature-guidance">PNG only · maximum 1 MB · 200×50 to 2000×1000 pixels</p>
      {loading ? <p>Loading signature…</p> : <>
        {previewUrl ? <div className="signature-preview"><img src={previewUrl} alt="Your certificate signature preview" /></div> : <p className="signature-empty">No certificate signature uploaded.</p>}
        {status.configured && <p className="signature-meta">Last updated {formatDate(status.uploaded_at)} · {status.width}×{status.height} pixels</p>}
      </>}
      <form onSubmit={submit}>
        <label htmlFor="doctor-signature">{status.configured ? 'Replace signature' : 'Choose signature'}</label>
        <input ref={inputRef} id="doctor-signature" name="signature" type="file" accept="image/png,.png" onChange={choose} />
        {selected && <p className="signature-selection">Selected: {selected.name}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button className="primary-action" type="submit" disabled={saving || !selected || Boolean(error)}>{saving ? 'Saving…' : status.configured ? 'Replace Signature' : 'Upload Signature'}</button>
      </form>
      <p className="signature-privacy">Your signature is stored privately and is not available through a public link.</p>
    </section>
  </div>;
}
