import { useEffect, useRef, useState } from 'react';
import { patientApiErrorMessage, patientApiService } from '../services/patientApiService.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = /\.(?:pdf|png|jpe?g)$/i;
const labels = Object.freeze({ not_submitted: 'Not Submitted', pending: 'Pending Verification', verified: 'Verified', rejected: 'Rejected' });

function validate(pwdIdNumber, document) {
  const errors = {};
  const normalized = pwdIdNumber.replace(/\s+/g, ' ').trim();
  if (normalized.length < 3 || normalized.length > 64) errors.pwdIdNumber = 'Enter a PWD ID number from 3 through 64 characters.';
  if (!document) errors.document = 'Select a PWD verification document.';
  else if (!ACCEPTED_EXTENSIONS.test(document.name)) errors.document = 'Select a PDF, JPG, JPEG, or PNG file.';
  else if (document.size > MAX_FILE_SIZE) errors.document = 'The document must not exceed 5 MB.';
  return errors;
}

export default function PwdVerificationSection() {
  const [verification, setVerification] = useState(null);
  const [pwdIdNumber, setPwdIdNumber] = useState('');
  const [document, setDocument] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    patientApiService.getPwdVerification()
      .then(result => active && setVerification(result))
      .catch(error => active && setMessage(patientApiErrorMessage(error, 'Unable to load PWD verification status.')));
    return () => { active = false; };
  }, []);

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validate(pwdIdNumber, document);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setBusy(true); setMessage('');
    try {
      const result = await patientApiService.submitPwdVerification({
        pwdIdNumber: pwdIdNumber.replace(/\s+/g, ' ').trim(), document,
      });
      setVerification(result); setPwdIdNumber(''); setDocument(null); setErrors({});
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      setMessage(patientApiErrorMessage(error, 'Unable to submit PWD verification.'));
    } finally { setBusy(false); }
  }

  const status = verification?.status ?? 'not_submitted';
  const canSubmit = status === 'not_submitted' || status === 'rejected';
  return <section className="profile-card pwd-verification-card" aria-labelledby="pwd-verification-heading">
    <div className="pwd-verification-heading">
      <div><h2 id="pwd-verification-heading">PWD Verification</h2><p>Submit your PWD ID for private clinic verification.</p></div>
      <span className={`pwd-status pwd-status-${status}`}>{labels[status] ?? labels.not_submitted}</span>
    </div>
    {message && <p className="profile-message profile-message-error" role="alert">{message}</p>}
    {!verification && !message && <p role="status">Loading verification status…</p>}
    {status === 'rejected' && <div className="pwd-rejection-summary"><p>Your submission could not be verified. Correct the information and submit a new document.</p>{verification.rejection_reason && <p><strong>Reason:</strong> {verification.rejection_reason}</p>}</div>}
    {canSubmit && verification && <form onSubmit={submit} noValidate className="pwd-verification-form">
      <div><label htmlFor="pwd-id-number">PWD ID number *</label><input id="pwd-id-number" value={pwdIdNumber} maxLength={64} autoComplete="off" aria-invalid={!!errors.pwdIdNumber} onChange={event => { setPwdIdNumber(event.target.value); setErrors(current => ({ ...current, pwdIdNumber: undefined })); }} />{errors.pwdIdNumber && <p className="profile-error">{errors.pwdIdNumber}</p>}</div>
      <div><label htmlFor="pwd-document">PWD verification document *</label><input ref={fileRef} id="pwd-document" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-invalid={!!errors.document} onChange={event => { setDocument(event.target.files?.[0] ?? null); setErrors(current => ({ ...current, document: undefined })); }} /><p className="profile-note">PDF, JPG, JPEG, or PNG only · maximum 5 MB.</p>{errors.document && <p className="profile-error">{errors.document}</p>}</div>
      <p className="profile-note pwd-privacy-note">Your document is stored privately and is not available through a public link.</p>
      <button type="submit" className="action-link profile-save" disabled={busy}>{busy ? 'Submitting…' : status === 'rejected' ? 'Submit Again' : 'Submit for Verification'}</button>
    </form>}
    {status === 'pending' && <><p>Your submission is awaiting clinic review.</p><p className="profile-note">Submitted {verification.submitted_at ? new Date(verification.submitted_at).toLocaleString() : 'recently'}.</p></>}
    {status === 'verified' && <p>Your PWD status has been verified. Verified status may be used for clinic queue priority.</p>}
  </section>;
}
