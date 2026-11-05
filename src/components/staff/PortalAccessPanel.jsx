import { useEffect, useState } from 'react';
import { staffApiErrorMessage, staffApiService } from '../../services/staffApiService.js';

export default function PortalAccessPanel({ patient, onInvitationSent }) {
  const active = patient.portal_status === 'Active' || patient.hasPortalAccount;
  const [email, setEmail] = useState(patient.email ?? '');
  const [status, setStatus] = useState(patient.portal_status ?? (active ? 'Active' : 'No Account'));
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setEmail(patient.email ?? '');
    setStatus(patient.portal_status ?? (patient.hasPortalAccount ? 'Active' : 'No Account'));
    setFailed(false); setMessage({ type: '', text: '' });
  }, [patient.id]);

  async function sendInvitation(event) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }
    setSending(true); setMessage({ type: '', text: '' });
    try {
      const result = await staffApiService.resendPortalInvitation(patient.id, normalized);
      setStatus('Invitation Sent'); setEmail(normalized); setFailed(false);
      setMessage({ type: 'success', text: `Invitation sent to ${result.masked_email}. Any earlier unused invitation is no longer valid.` });
      onInvitationSent?.(normalized);
    } catch (error) {
      setFailed(true);
      setMessage({ type: 'error', text: staffApiErrorMessage(error, 'The invitation could not be sent. Try again when email delivery is available.') });
    } finally { setSending(false); }
  }

  return <section className="patient-detail-card portal-access-card"><h2>Portal Access</h2><dl><div><dt>Status</dt><dd>{status}</dd></div><div><dt>Email</dt><dd>{email || 'Not provided'}</dd></div></dl>{active ? <p>This Patient already has an active portal account. Claim invitations are no longer available.</p> : <form onSubmit={sendInvitation} noValidate><label htmlFor="portal-access-email">Portal email</label><input id="portal-access-email" type="email" value={email} onChange={event => { setEmail(event.target.value); setMessage({ type: '', text: '' }); }} autoComplete="off" required /><p>Correcting this email sends a new invitation and invalidates any earlier unused link.</p>{message.text && <p role={message.type === 'error' ? 'alert' : 'status'} className={`portal-access-${message.type}`}>{message.text}</p>}<button type="submit" disabled={sending}>{sending ? 'Sending…' : failed ? 'Retry Invitation' : status === 'Invitation Sent' ? 'Resend Invitation' : 'Send Invitation'}</button></form>}</section>;
}
