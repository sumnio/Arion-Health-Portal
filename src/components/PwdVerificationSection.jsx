import { useEffect, useRef, useState } from 'react';
import { patientApiErrorMessage, patientApiService } from '../services/patientApiService.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = /\.(?:png|jpe?g)$/i;
const labels = Object.freeze({ not_submitted: 'Not Submitted', pending: 'Pending Verification', verified: 'Verified', rejected: 'Rejected' });

function validate(frontDocument, backDocument) {
  const errors = {};
  for (const [side, document] of [['front', frontDocument], ['back', backDocument]]) {
    if (!document) errors[side] = `Select the ${side} image of your PWD ID.`;
    else if (!ACCEPTED_EXTENSIONS.test(document.name)) errors[side] = 'Select a JPG, JPEG, or PNG image.';
    else if (document.size > MAX_FILE_SIZE) errors[side] = 'Each image must not exceed 5 MB.';
  }
  return errors;
}

export default function PwdVerificationSection() {
  const [verification, setVerification] = useState(null);
  const [frontDocument, setFrontDocument] = useState(null);
  const [backDocument, setBackDocument] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const frontFileRef = useRef(null);
  const backFileRef = useRef(null);

  useEffect(() => {
    let active = true;
    patientApiService.getPwdVerification()
      .then(result => active && setVerification(result))
      .catch(error => active && setMessage(patientApiErrorMessage(error, 'Unable to load PWD verification status.')));
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validate(frontDocument, backDocument);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setBusy(true); setMessage('');
    try {
      const result = await patientApiService.submitPwdVerification({ frontDocument, backDocument });
      setVerification(result); setFrontDocument(null); setBackDocument(null); setErrors({});
      if (frontFileRef.current) frontFileRef.current.value = '';
      if (backFileRef.current) backFileRef.current.value = '';
    } catch (error) {
      setMessage(patientApiErrorMessage(error, 'Unable to submit PWD verification.'));
    } finally { setBusy(false); }
  }

  const status = verification?.status ?? 'not_submitted';
  const canSubmit = status === 'not_submitted' || status === 'rejected';
  return <section className="profile-card pwd-verification-card" aria-labelledby="pwd-verification-heading">
    <div className="pwd-verification-heading">
      <div><h2 id="pwd-verification-heading">PWD Verification</h2><p>Submit clear front and back images of your PWD ID for private clinic verification.</p></div>
      <span className={`pwd-status pwd-status-${status}`}>{labels[status] ?? labels.not_submitted}</span>
    </div>
    {message && <p className="profile-message profile-message-error" role="alert">{message}</p>}
    {!verification && !message && <p role="status">Loading verification status…</p>}
    {status === 'rejected' && <div className="pwd-rejection-summary"><p>Your submission could not be verified. Correct the images and submit both sides again.</p>{verification.rejection_reason && <p><strong>Reason:</strong> {verification.rejection_reason}</p>}</div>}
    {canSubmit && verification && <form onSubmit={submit} noValidate className="pwd-verification-form">
      <p className="profile-note"><strong>Important:</strong> The name printed on the ID must match the name on your Patient profile.</p>
      <div><label htmlFor="pwd-front-document">Front of PWD ID *</label><input ref={frontFileRef} id="pwd-front-document" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" aria-invalid={!!errors.front} onChange={event => { setFrontDocument(event.target.files?.[0] ?? null); setErrors(current => ({ ...current, front: undefined })); }} />{errors.front && <p className="profile-error">{errors.front}</p>}</div>
      <div><label htmlFor="pwd-back-document">Back of PWD ID *</label><input ref={backFileRef} id="pwd-back-document" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" aria-invalid={!!errors.back} onChange={event => { setBackDocument(event.target.files?.[0] ?? null); setErrors(current => ({ ...current, back: undefined })); }} /><p className="profile-note">JPG, JPEG, or PNG only · maximum 5 MB per image.</p>{errors.back && <p className="profile-error">{errors.back}</p>}</div>
      <p className="profile-note pwd-privacy-note">Both images are stored privately and are not available through a public link.</p>
      <button type="submit" className="action-link profile-save" disabled={busy}>{busy ? 'Submitting…' : status === 'rejected' ? 'Submit Again' : 'Submit for Verification'}</button>
    </form>}
    {status === 'pending' && <><p>Your submission is awaiting clinic review.</p><p className="profile-note">Submitted {verification.submitted_at ? new Date(verification.submitted_at).toLocaleString() : 'recently'}.</p></>}
    {status === 'verified' && <p>Your PWD status has been verified. Verified status may be used for clinic queue priority.</p>}
  </section>;
}
